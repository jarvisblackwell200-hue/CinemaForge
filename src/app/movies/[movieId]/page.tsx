"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { useParams, useRouter } from "next/navigation";
import {
  Send,
  Sparkles,
  Loader2,
  Check,
  Users,
  Film,
  Palette,
  Clock,
  Coins,
  FileText,
  ChevronRight,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import type { ScriptAnalysis } from "@/types/movie";

// ─── Types ──────────────────────────────────────────────────────

interface Message {
  id: string;
  role: "user" | "assistant";
  content: string;
  analysis?: ScriptAnalysis | null;
  isStreaming?: boolean;
}

interface AcceptedState {
  synopsis: boolean;
  characters: boolean;
  scenes: boolean;
  style: boolean;
}

// ─── Helpers ────────────────────────────────────────────────────

function parseAnalysisFromText(text: string): ScriptAnalysis | null {
  const match = text.match(/```json\s*([\s\S]*?)\s*```/);
  if (!match) return null;
  try {
    return JSON.parse(match[1]) as ScriptAnalysis;
  } catch {
    return null;
  }
}

function stripJsonBlock(text: string): string {
  return text.replace(/```json\s*[\s\S]*?\s*```/g, "").trim();
}

// ─── Component ──────────────────────────────────────────────────

export default function MovieConceptPage() {
  const params = useParams<{ movieId: string }>();
  const router = useRouter();
  const [messages, setMessages] = useState<Message[]>([
    {
      id: "welcome",
      role: "assistant",
      content:
        "I'm your AI Director. Tell me about the movie you want to create — describe the story, mood, setting, or even just a rough idea. I'll help you turn it into a structured production plan.\n\nFor example: \"A 60-second noir detective story set in a rainy city at night. A detective finds a mysterious note in an alley and follows the clues to an abandoned warehouse.\"",
    },
  ]);
  const [input, setInput] = useState("");
  const [isStreaming, setIsStreaming] = useState(false);
  const [accepted, setAccepted] = useState<AcceptedState>({
    synopsis: false,
    characters: false,
    scenes: false,
    style: false,
  });
  const [isSaving, setIsSaving] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const abortRef = useRef<AbortController | null>(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const latestAnalysis = [...messages]
    .reverse()
    .find((m) => m.analysis)?.analysis ?? null;

  const allAccepted =
    latestAnalysis &&
    accepted.synopsis &&
    accepted.characters &&
    accepted.scenes &&
    accepted.style;

  // ─── Stream handler ─────────────────────────────────────────

  const handleSend = useCallback(async () => {
    const text = input.trim();
    if (!text || isStreaming) return;

    const userMessage: Message = {
      id: crypto.randomUUID(),
      role: "user",
      content: text,
    };

    const assistantId = crypto.randomUUID();
    const assistantMessage: Message = {
      id: assistantId,
      role: "assistant",
      content: "",
      isStreaming: true,
    };

    setMessages((prev) => [...prev, userMessage, assistantMessage]);
    setInput("");
    setIsStreaming(true);

    // Reset accepted state for new analysis
    setAccepted({ synopsis: false, characters: false, scenes: false, style: false });

    const conversationMessages = [
      ...messages.filter((m) => m.role !== "assistant" || m.id !== "welcome"),
      userMessage,
    ].map((m) => ({
      role: m.role,
      content: m.role === "assistant" ? (m.content + (m.analysis ? `\n\`\`\`json\n${JSON.stringify(m.analysis)}\n\`\`\`` : "")) : m.content,
    }));

    try {
      abortRef.current = new AbortController();

      const res = await fetch("/api/ai/script", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          messages: conversationMessages,
          movieId: params.movieId,
        }),
        signal: abortRef.current.signal,
      });

      if (!res.ok) {
        const errorData = await res.json().catch(() => ({}));
        throw new Error(
          (errorData as { error?: string }).error ?? `HTTP ${res.status}`
        );
      }

      const reader = res.body?.getReader();
      if (!reader) throw new Error("No response body");

      const decoder = new TextDecoder();
      let fullText = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        const chunk = decoder.decode(value, { stream: true });
        const lines = chunk.split("\n");

        for (const line of lines) {
          if (!line.startsWith("data: ")) continue;
          const data = line.slice(6);
          try {
            const event = JSON.parse(data) as {
              type: string;
              text?: string;
              error?: string;
            };

            if (event.type === "text" && event.text) {
              fullText += event.text;
              setMessages((prev) =>
                prev.map((m) =>
                  m.id === assistantId
                    ? { ...m, content: stripJsonBlock(fullText) }
                    : m
                )
              );
            } else if (event.type === "error") {
              throw new Error(event.error);
            }
          } catch (e) {
            if (e instanceof SyntaxError) continue;
            throw e;
          }
        }
      }

      // Parse analysis from the complete response
      const analysis = parseAnalysisFromText(fullText);
      setMessages((prev) =>
        prev.map((m) =>
          m.id === assistantId
            ? {
                ...m,
                content: stripJsonBlock(fullText),
                analysis,
                isStreaming: false,
              }
            : m
        )
      );
    } catch (error) {
      if ((error as Error).name === "AbortError") return;

      const errorMsg =
        error instanceof Error ? error.message : "Something went wrong";

      setMessages((prev) =>
        prev.map((m) =>
          m.id === assistantId
            ? {
                ...m,
                content:
                  m.content ||
                  `I couldn't connect to the AI Director right now. ${errorMsg}. You can try again or describe your idea in more detail.`,
                isStreaming: false,
              }
            : m
        )
      );
    } finally {
      setIsStreaming(false);
      abortRef.current = null;
    }
  }, [input, isStreaming, messages, params.movieId]);

  // ─── Accept & save to movie ─────────────────────────────────

  async function handleAcceptAll() {
    if (!latestAnalysis || isSaving) return;
    setIsSaving(true);

    try {
      const res = await fetch(`/api/movies/${params.movieId}`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          "x-user-id": "dev-user", // TODO: real auth
        },
        body: JSON.stringify({
          synopsis: latestAnalysis.synopsis,
          genre: latestAnalysis.genre,
          script: { scenes: latestAnalysis.scenes },
          styleBible: latestAnalysis.styleSuggestions,
          targetDuration: latestAnalysis.suggestedDuration,
          status: "SCRIPTING",
        }),
      });

      if (res.ok) {
        router.push(`/movies/${params.movieId}/script`);
      }
    } catch (error) {
      console.error("Failed to save concept:", error);
    } finally {
      setIsSaving(false);
    }
  }

  // ─── Render ─────────────────────────────────────────────────

  return (
    <div className="flex h-full flex-col">
      {/* Chat header */}
      <div className="border-b border-border/50 px-6 py-4">
        <div className="flex items-center gap-2">
          <Sparkles className="h-4 w-4 text-primary" />
          <h2 className="text-sm font-semibold">AI Director</h2>
          <Badge variant="secondary" className="text-xs">
            Concept Phase
          </Badge>
        </div>
        <p className="mt-1 text-xs text-muted-foreground">
          Describe your movie idea and I&apos;ll help structure it into scenes,
          characters, and shots.
        </p>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto px-6 py-4">
        <div className="mx-auto max-w-2xl space-y-4">
          {messages.map((msg) => (
            <div key={msg.id}>
              {/* Message bubble */}
              <div
                className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}
              >
                <div
                  className={`max-w-[85%] rounded-xl px-4 py-3 text-sm leading-relaxed ${
                    msg.role === "user"
                      ? "bg-primary text-primary-foreground"
                      : "bg-secondary text-secondary-foreground"
                  }`}
                >
                  {msg.content.split("\n").map((line, i) =>
                    line.trim() ? (
                      <p key={i} className={i > 0 ? "mt-2" : ""}>
                        {line}
                      </p>
                    ) : (
                      <div key={i} className="h-2" />
                    )
                  )}
                  {msg.isStreaming && (
                    <span className="ml-1 inline-block h-4 w-1 animate-pulse bg-current" />
                  )}
                </div>
              </div>

              {/* Suggestion cards (shown after assistant messages with analysis) */}
              {msg.analysis && !msg.isStreaming && (
                <div className="mt-3 space-y-2">
                  <SynopsisCard
                    analysis={msg.analysis}
                    accepted={accepted.synopsis}
                    onAccept={() =>
                      setAccepted((prev) => ({ ...prev, synopsis: true }))
                    }
                  />
                  <CharactersCard
                    analysis={msg.analysis}
                    accepted={accepted.characters}
                    onAccept={() =>
                      setAccepted((prev) => ({ ...prev, characters: true }))
                    }
                  />
                  <ScenesCard
                    analysis={msg.analysis}
                    accepted={accepted.scenes}
                    onAccept={() =>
                      setAccepted((prev) => ({ ...prev, scenes: true }))
                    }
                  />
                  <StyleEstimateCard
                    analysis={msg.analysis}
                    accepted={accepted.style}
                    onAccept={() =>
                      setAccepted((prev) => ({ ...prev, style: true }))
                    }
                  />

                  {/* Accept all + proceed */}
                  {allAccepted && (
                    <Card className="border-primary/30 bg-primary/5 p-4">
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="text-sm font-medium text-primary">
                            Production plan locked in!
                          </p>
                          <p className="text-xs text-muted-foreground">
                            Ready to move to the script editor
                          </p>
                        </div>
                        <Button
                          onClick={handleAcceptAll}
                          disabled={isSaving}
                          size="sm"
                        >
                          {isSaving ? (
                            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                          ) : (
                            <ChevronRight className="mr-2 h-4 w-4" />
                          )}
                          Continue to Script
                        </Button>
                      </div>
                    </Card>
                  )}
                </div>
              )}
            </div>
          ))}

          {isStreaming && messages[messages.length - 1]?.content === "" && (
            <div className="flex justify-start">
              <div className="flex items-center gap-2 rounded-xl bg-secondary px-4 py-3 text-sm text-muted-foreground">
                <Loader2 className="h-4 w-4 animate-spin" />
                The Director is thinking...
              </div>
            </div>
          )}

          <div ref={messagesEndRef} />
        </div>
      </div>

      {/* Input */}
      <div className="border-t border-border/50 px-6 py-4">
        <div className="mx-auto max-w-2xl">
          <div className="relative">
            <Textarea
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  handleSend();
                }
              }}
              placeholder={
                latestAnalysis
                  ? "Suggest changes... (e.g., 'Make it darker' or 'Add a twist ending')"
                  : "Describe your movie idea..."
              }
              className="min-h-[80px] resize-none pr-12"
              disabled={isStreaming}
            />
            <Button
              onClick={handleSend}
              disabled={!input.trim() || isStreaming}
              size="icon"
              className="absolute bottom-2 right-2 h-8 w-8"
            >
              <Send className="h-4 w-4" />
            </Button>
          </div>
          <p className="mt-2 text-xs text-muted-foreground">
            Press Enter to send, Shift+Enter for new line.
            {latestAnalysis &&
              " Accept all cards above, then continue to the script editor."}
          </p>
        </div>
      </div>
    </div>
  );
}

// ─── Suggestion Cards ─────────────────────────────────────────

function SynopsisCard({
  analysis,
  accepted,
  onAccept,
}: {
  analysis: ScriptAnalysis;
  accepted: boolean;
  onAccept: () => void;
}) {
  return (
    <Card
      className={`p-4 transition-all ${accepted ? "border-primary/30 bg-primary/5" : "border-border"}`}
    >
      <div className="mb-2 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Film className="h-4 w-4 text-primary" />
          <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            Synopsis
          </span>
          <Badge variant="secondary" className="text-xs">
            {analysis.genre}
          </Badge>
        </div>
        <AcceptButton accepted={accepted} onAccept={onAccept} />
      </div>
      <p className="text-sm">{analysis.synopsis}</p>
      <div className="mt-2 flex items-center gap-3 text-xs text-muted-foreground">
        <span className="flex items-center gap-1">
          <Clock className="h-3 w-3" />
          {analysis.suggestedDuration}s
        </span>
        <span>{analysis.estimatedShots} shots</span>
      </div>
    </Card>
  );
}

function CharactersCard({
  analysis,
  accepted,
  onAccept,
}: {
  analysis: ScriptAnalysis;
  accepted: boolean;
  onAccept: () => void;
}) {
  return (
    <Card
      className={`p-4 transition-all ${accepted ? "border-primary/30 bg-primary/5" : "border-border"}`}
    >
      <div className="mb-2 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Users className="h-4 w-4 text-primary" />
          <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            Characters ({analysis.characters.length})
          </span>
        </div>
        <AcceptButton accepted={accepted} onAccept={onAccept} />
      </div>
      <div className="space-y-2">
        {analysis.characters.map((char, i) => (
          <div key={i} className="rounded-md bg-background/50 px-3 py-2">
            <div className="flex items-center gap-2">
              <span className="text-sm font-medium">{char.name}</span>
              <Badge variant="outline" className="text-xs">
                {char.role}
              </Badge>
            </div>
            <p className="mt-1 text-xs text-muted-foreground">
              {char.suggestedVisualDescription}
            </p>
          </div>
        ))}
      </div>
    </Card>
  );
}

function ScenesCard({
  analysis,
  accepted,
  onAccept,
}: {
  analysis: ScriptAnalysis;
  accepted: boolean;
  onAccept: () => void;
}) {
  return (
    <Card
      className={`p-4 transition-all ${accepted ? "border-primary/30 bg-primary/5" : "border-border"}`}
    >
      <div className="mb-2 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <FileText className="h-4 w-4 text-primary" />
          <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            Scenes ({analysis.scenes.length})
          </span>
        </div>
        <AcceptButton accepted={accepted} onAccept={onAccept} />
      </div>
      <div className="space-y-2">
        {analysis.scenes.map((scene, i) => (
          <div key={i} className="rounded-md bg-background/50 px-3 py-2">
            <p className="text-sm font-medium">{scene.title}</p>
            <p className="text-xs text-muted-foreground">
              {scene.beats.length} beat{scene.beats.length !== 1 ? "s" : ""} —{" "}
              {scene.beats.map((b) => b.emotionalTone).join(", ")}
            </p>
          </div>
        ))}
      </div>
    </Card>
  );
}

function StyleEstimateCard({
  analysis,
  accepted,
  onAccept,
}: {
  analysis: ScriptAnalysis;
  accepted: boolean;
  onAccept: () => void;
}) {
  return (
    <Card
      className={`p-4 transition-all ${accepted ? "border-primary/30 bg-primary/5" : "border-border"}`}
    >
      <div className="mb-2 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Palette className="h-4 w-4 text-primary" />
          <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            Style & Cost
          </span>
        </div>
        <AcceptButton accepted={accepted} onAccept={onAccept} />
      </div>
      <div className="space-y-2">
        <div className="rounded-md bg-background/50 px-3 py-2">
          <p className="text-xs text-muted-foreground">Film stock</p>
          <p className="text-sm">{analysis.styleSuggestions.filmStock}</p>
        </div>
        <div className="rounded-md bg-background/50 px-3 py-2">
          <p className="text-xs text-muted-foreground">Color palette</p>
          <p className="text-sm">{analysis.styleSuggestions.colorPalette}</p>
        </div>
        <div className="rounded-md bg-background/50 px-3 py-2">
          <p className="text-xs text-muted-foreground">Textures</p>
          <div className="mt-1 flex flex-wrap gap-1">
            {analysis.styleSuggestions.textures.map((t, i) => (
              <Badge key={i} variant="secondary" className="text-xs">
                {t}
              </Badge>
            ))}
          </div>
        </div>
        <div className="flex items-center gap-2 rounded-md bg-background/50 px-3 py-2">
          <Coins className="h-4 w-4 text-primary" />
          <div>
            <p className="text-sm font-medium">
              ~{analysis.estimatedCredits} credits
            </p>
            <p className="text-xs text-muted-foreground">
              {analysis.estimatedShots} shots × 2 takes at standard quality +
              assembly
            </p>
          </div>
        </div>
      </div>
    </Card>
  );
}

function AcceptButton({
  accepted,
  onAccept,
}: {
  accepted: boolean;
  onAccept: () => void;
}) {
  if (accepted) {
    return (
      <div className="flex items-center gap-1 text-xs text-primary">
        <Check className="h-3 w-3" />
        Accepted
      </div>
    );
  }
  return (
    <Button variant="ghost" size="sm" className="h-7 text-xs" onClick={onAccept}>
      Accept
    </Button>
  );
}
