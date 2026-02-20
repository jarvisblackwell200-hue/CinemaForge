"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { useParams, useRouter } from "next/navigation";
import {
  FileText,
  Plus,
  Trash2,
  ChevronRight,
  ChevronDown,
  MapPin,
  Clock,
  MessageSquare,
  Sparkles,
  Save,
  Loader2,
  AlertTriangle,
  X,
  UserCircle,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/ui/empty-state";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import type { Script, ScriptScene, ScriptBeat } from "@/types/movie";

// ─── Types ──────────────────────────────────────────────────────

interface DialogueLine {
  character: string;
  line: string;
  emotion: string;
}

interface MovieData {
  id: string;
  title: string;
  genre: string | null;
  script: Script | null;
  status: string;
}

// ─── Emotional tone colors ─────────────────────────────────────

const TONE_COLORS: Record<string, string> = {
  tension: "bg-red-500/70",
  suspense: "bg-red-500/70",
  fear: "bg-red-600/70",
  anger: "bg-red-400/70",
  mystery: "bg-purple-500/70",
  curiosity: "bg-purple-400/70",
  wonder: "bg-purple-400/70",
  sadness: "bg-blue-500/70",
  melancholy: "bg-blue-400/70",
  longing: "bg-blue-400/70",
  joy: "bg-yellow-500/70",
  excitement: "bg-yellow-400/70",
  hope: "bg-yellow-400/70",
  triumph: "bg-yellow-500/70",
  calm: "bg-green-500/70",
  peace: "bg-green-400/70",
  resolution: "bg-green-500/70",
  revelation: "bg-amber-500/70",
  shock: "bg-orange-500/70",
  determination: "bg-amber-400/70",
};

function getToneColor(tone: string): string {
  const lower = tone.toLowerCase();
  for (const [key, value] of Object.entries(TONE_COLORS)) {
    if (lower.includes(key)) return value;
  }
  return "bg-muted-foreground/50";
}

// ─── Component ──────────────────────────────────────────────────

export default function ScriptPage() {
  const params = useParams<{ movieId: string }>();
  const router = useRouter();

  const [movie, setMovie] = useState<MovieData | null>(null);
  const [scenes, setScenes] = useState<ScriptScene[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [lastSaved, setLastSaved] = useState<Date | null>(null);
  const [hasChanges, setHasChanges] = useState(false);
  const [expandedScenes, setExpandedScenes] = useState<Set<number>>(new Set());
  const [editingDialogue, setEditingDialogue] = useState<{
    sceneIndex: number;
    beatIndex: number;
  } | null>(null);

  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // ─── Fetch movie data ──────────────────────────────────────

  useEffect(() => {
    async function fetchMovie() {
      try {
        const res = await fetch(`/api/movies/${params.movieId}`);
        if (!res.ok) return;
        const data = await res.json();
        if (data.success && data.data) {
          setMovie(data.data);
          const script = data.data.script as Script | null;
          if (script?.scenes) {
            setScenes(script.scenes);
            // Expand first scene by default
            setExpandedScenes(new Set([0]));
          }
        }
      } catch (error) {
        console.error("Failed to fetch movie:", error);
      } finally {
        setLoading(false);
      }
    }
    fetchMovie();
  }, [params.movieId]);

  // ─── Auto-save ─────────────────────────────────────────────

  const saveScript = useCallback(
    async (scenesData: ScriptScene[]) => {
      setSaving(true);
      try {
        const res = await fetch(`/api/movies/${params.movieId}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            script: { scenes: scenesData },
          }),
        });
        if (res.ok) {
          setLastSaved(new Date());
          setHasChanges(false);
        }
      } catch (error) {
        console.error("Failed to save script:", error);
      } finally {
        setSaving(false);
      }
    },
    [params.movieId]
  );

  const debouncedSave = useCallback(
    (scenesData: ScriptScene[]) => {
      if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
      saveTimerRef.current = setTimeout(() => saveScript(scenesData), 1500);
    },
    [saveScript]
  );

  function updateScenes(newScenes: ScriptScene[]) {
    setScenes(newScenes);
    setHasChanges(true);
    debouncedSave(newScenes);
  }

  // ─── Scene operations ──────────────────────────────────────

  function updateScene(index: number, partial: Partial<ScriptScene>) {
    const updated = scenes.map((s, i) =>
      i === index ? { ...s, ...partial } : s
    );
    updateScenes(updated);
  }

  function addScene() {
    const newScene: ScriptScene = {
      title: `Scene ${scenes.length + 1}`,
      location: "",
      timeOfDay: "day",
      beats: [
        {
          description: "",
          emotionalTone: "neutral",
        },
      ],
    };
    const updated = [...scenes, newScene];
    updateScenes(updated);
    setExpandedScenes((prev) => new Set([...prev, updated.length - 1]));
  }

  function removeScene(index: number) {
    if (scenes.length <= 1) return;
    const updated = scenes.filter((_, i) => i !== index);
    updateScenes(updated);
    setExpandedScenes((prev) => {
      const next = new Set<number>();
      prev.forEach((i) => {
        if (i < index) next.add(i);
        else if (i > index) next.add(i - 1);
      });
      return next;
    });
  }

  // ─── Beat operations ───────────────────────────────────────

  function updateBeat(
    sceneIndex: number,
    beatIndex: number,
    partial: Partial<ScriptBeat>
  ) {
    const scene = scenes[sceneIndex];
    const updatedBeats = scene.beats.map((b, i) =>
      i === beatIndex ? { ...b, ...partial } : b
    );
    updateScene(sceneIndex, { beats: updatedBeats });
  }

  function addBeat(sceneIndex: number) {
    const scene = scenes[sceneIndex];
    const newBeat: ScriptBeat = {
      description: "",
      emotionalTone: "neutral",
    };
    updateScene(sceneIndex, { beats: [...scene.beats, newBeat] });
  }

  function removeBeat(sceneIndex: number, beatIndex: number) {
    const scene = scenes[sceneIndex];
    if (scene.beats.length <= 1) return;
    updateScene(sceneIndex, {
      beats: scene.beats.filter((_, i) => i !== beatIndex),
    });
  }

  // ─── Dialogue operations ───────────────────────────────────

  function addDialogueLine(sceneIndex: number, beatIndex: number) {
    const beat = scenes[sceneIndex].beats[beatIndex];
    const newDialogue: DialogueLine = {
      character: "",
      line: "",
      emotion: "neutral",
    };
    updateBeat(sceneIndex, beatIndex, {
      dialogue: [...(beat.dialogue ?? []), newDialogue],
    });
  }

  function updateDialogueLine(
    sceneIndex: number,
    beatIndex: number,
    dialogueIndex: number,
    partial: Partial<DialogueLine>
  ) {
    const beat = scenes[sceneIndex].beats[beatIndex];
    const updated = (beat.dialogue ?? []).map((d, i) =>
      i === dialogueIndex ? { ...d, ...partial } : d
    );
    updateBeat(sceneIndex, beatIndex, { dialogue: updated });
  }

  function removeDialogueLine(
    sceneIndex: number,
    beatIndex: number,
    dialogueIndex: number
  ) {
    const beat = scenes[sceneIndex].beats[beatIndex];
    const updated = (beat.dialogue ?? []).filter((_, i) => i !== dialogueIndex);
    updateBeat(sceneIndex, beatIndex, {
      dialogue: updated.length > 0 ? updated : undefined,
    });
  }

  // ─── Toggle scene expand ───────────────────────────────────

  function toggleScene(index: number) {
    setExpandedScenes((prev) => {
      const next = new Set(prev);
      if (next.has(index)) next.delete(index);
      else next.add(index);
      return next;
    });
  }

  // ─── Proceed to Characters ─────────────────────────────────

  async function handleContinue() {
    // Save any pending changes first
    if (hasChanges) {
      await saveScript(scenes);
    }

    // Update status to CHARACTERS
    await fetch(`/api/movies/${params.movieId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: "CHARACTERS" }),
    });

    router.push(`/movies/${params.movieId}/characters`);
  }

  // ─── Loading state ─────────────────────────────────────────

  if (loading) {
    return (
      <div className="flex h-full items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!movie?.script || scenes.length === 0) {
    return (
      <EmptyState
        icon={<FileText className="h-7 w-7 text-primary" />}
        title="No Script Yet"
        description="Head back to the Concept phase and describe your movie idea to the AI Director. It will generate a structured script for you to edit here."
        action={
          <Button
            variant="secondary"
            onClick={() => router.push(`/movies/${params.movieId}`)}
          >
            <Sparkles className="mr-2 h-4 w-4" />
            Go to Concept
          </Button>
        }
      />
    );
  }

  // ─── Computed stats ────────────────────────────────────────

  const totalBeats = scenes.reduce((sum, s) => sum + s.beats.length, 0);
  const totalDialogueLines = scenes.reduce(
    (sum, s) =>
      sum + s.beats.reduce((bSum, b) => bSum + (b.dialogue?.length ?? 0), 0),
    0
  );
  const hasEmptyBeats = scenes.some((s) =>
    s.beats.some((b) => !b.description.trim())
  );

  // ─── Render ────────────────────────────────────────────────

  return (
    <div className="flex h-full flex-col">
      {/* Header bar */}
      <div className="border-b border-border/50 px-6 py-4">
        <div className="flex items-center justify-between">
          <div>
            <div className="flex items-center gap-2">
              <FileText className="h-4 w-4 text-primary" />
              <h2 className="text-sm font-semibold">Script Editor</h2>
              <Badge variant="secondary" className="text-xs">
                {scenes.length} scene{scenes.length !== 1 ? "s" : ""},{" "}
                {totalBeats} beat{totalBeats !== 1 ? "s" : ""}
              </Badge>
              {totalDialogueLines > 0 && (
                <Badge variant="outline" className="text-xs">
                  {totalDialogueLines} dialogue line
                  {totalDialogueLines !== 1 ? "s" : ""}
                </Badge>
              )}
            </div>
            <p className="mt-1 text-xs text-muted-foreground">
              Edit your scenes, beats, and dialogue. Changes auto-save.
            </p>
          </div>

          <div className="flex items-center gap-3">
            {/* Save status */}
            <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
              {saving ? (
                <>
                  <Loader2 className="h-3 w-3 animate-spin" />
                  Saving...
                </>
              ) : hasChanges ? (
                <>
                  <div className="h-1.5 w-1.5 rounded-full bg-yellow-500" />
                  Unsaved
                </>
              ) : lastSaved ? (
                <>
                  <Save className="h-3 w-3" />
                  Saved
                </>
              ) : null}
            </div>

            <Button size="sm" onClick={handleContinue} disabled={hasEmptyBeats}>
              Continue to Characters
              <ChevronRight className="ml-1 h-4 w-4" />
            </Button>
          </div>
        </div>
      </div>

      {/* Pacing strip */}
      <div className="border-b border-border/30 px-6 py-2">
        <div className="flex items-center gap-1">
          <span className="mr-2 text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
            Pacing
          </span>
          {scenes.map((scene, si) => (
            <Tooltip key={si}>
              <TooltipTrigger asChild>
                <button
                  onClick={() => {
                    setExpandedScenes((prev) => new Set([...prev, si]));
                    document
                      .getElementById(`scene-${si}`)
                      ?.scrollIntoView({ behavior: "smooth" });
                  }}
                  className="flex h-6 gap-px"
                >
                  {scene.beats.map((beat, bi) => (
                    <div
                      key={bi}
                      className={`h-full w-4 rounded-sm transition-opacity hover:opacity-80 ${getToneColor(beat.emotionalTone)}`}
                    />
                  ))}
                </button>
              </TooltipTrigger>
              <TooltipContent side="bottom" className="text-xs">
                {scene.title} ({scene.beats.length} beats)
              </TooltipContent>
            </Tooltip>
          ))}
        </div>
      </div>

      {/* Validation warnings */}
      {hasEmptyBeats && (
        <div className="flex items-center gap-2 border-b border-border/30 bg-yellow-500/5 px-6 py-2">
          <AlertTriangle className="h-3.5 w-3.5 text-yellow-500" />
          <span className="text-xs text-yellow-500">
            Some beats are missing descriptions — fill them in before
            continuing.
          </span>
        </div>
      )}

      {/* Scene list */}
      <div className="flex-1 overflow-y-auto px-6 py-4">
        <div className="mx-auto max-w-3xl space-y-3">
          {scenes.map((scene, sceneIndex) => (
            <Card
              key={sceneIndex}
              id={`scene-${sceneIndex}`}
              className="overflow-hidden border-border"
            >
              {/* Scene header */}
              <button
                onClick={() => toggleScene(sceneIndex)}
                className="flex w-full items-center gap-3 px-4 py-3 text-left transition-colors hover:bg-secondary/50"
              >
                <span className="flex h-4 w-4 flex-shrink-0 items-center justify-center text-xs font-mono text-muted-foreground/60">{sceneIndex + 1}</span>
                {expandedScenes.has(sceneIndex) ? (
                  <ChevronDown className="h-4 w-4 flex-shrink-0 text-muted-foreground" />
                ) : (
                  <ChevronRight className="h-4 w-4 flex-shrink-0 text-muted-foreground" />
                )}
                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    <Badge
                      variant="outline"
                      className="text-[10px] text-muted-foreground"
                    >
                      Scene {sceneIndex + 1}
                    </Badge>
                    <span className="text-sm font-medium">{scene.title}</span>
                  </div>
                  {!expandedScenes.has(sceneIndex) && (
                    <div className="mt-0.5 flex items-center gap-3 text-xs text-muted-foreground">
                      {scene.location && (
                        <span className="flex items-center gap-1">
                          <MapPin className="h-3 w-3" />
                          {scene.location}
                        </span>
                      )}
                      <span>
                        {scene.beats.length} beat
                        {scene.beats.length !== 1 ? "s" : ""}
                      </span>
                      <span className="flex items-center gap-1">
                        <Clock className="h-3 w-3" />
                        {scene.timeOfDay}
                      </span>
                    </div>
                  )}
                </div>
                <div className="flex items-center gap-1">
                  {/* Mini pacing dots */}
                  {!expandedScenes.has(sceneIndex) &&
                    scene.beats.map((b, i) => (
                      <div
                        key={i}
                        className={`h-2 w-2 rounded-full ${getToneColor(b.emotionalTone)}`}
                      />
                    ))}
                </div>
              </button>

              {/* Scene content (expanded) */}
              {expandedScenes.has(sceneIndex) && (
                <div className="border-t border-border/50 px-4 pb-4 pt-3">
                  {/* Scene metadata */}
                  <div className="mb-4 grid grid-cols-3 gap-3">
                    <div>
                      <label className="mb-1 block text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
                        Title
                      </label>
                      <Input
                        value={scene.title}
                        onChange={(e) =>
                          updateScene(sceneIndex, { title: e.target.value })
                        }
                        className="h-8 text-sm"
                        placeholder="Scene title"
                      />
                    </div>
                    <div>
                      <label className="mb-1 block text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
                        Location
                      </label>
                      <Input
                        value={scene.location}
                        onChange={(e) =>
                          updateScene(sceneIndex, { location: e.target.value })
                        }
                        className="h-8 text-sm"
                        placeholder="e.g. Dark alley"
                      />
                    </div>
                    <div>
                      <label className="mb-1 block text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
                        Time of Day
                      </label>
                      <Input
                        value={scene.timeOfDay}
                        onChange={(e) =>
                          updateScene(sceneIndex, {
                            timeOfDay: e.target.value,
                          })
                        }
                        className="h-8 text-sm"
                        placeholder="e.g. night, dawn"
                      />
                    </div>
                  </div>

                  {/* Beats */}
                  <div className="space-y-2">
                    {scene.beats.map((beat, beatIndex) => (
                      <div
                        key={beatIndex}
                        className="group rounded-lg border border-border/50 bg-background/50 p-3"
                      >
                        <div className="flex items-start gap-2">
                          <span className="mt-1 flex h-4 w-4 flex-shrink-0 items-center justify-center text-xs font-mono text-muted-foreground/40">{beatIndex + 1}</span>
                          <div className="flex-1 space-y-2">
                            {/* Beat header */}
                            <div className="flex items-center gap-2">
                              <Badge
                                variant="secondary"
                                className="text-[10px]"
                              >
                                Beat {beatIndex + 1}
                              </Badge>
                              <div className="flex items-center gap-1">
                                <div
                                  className={`h-2 w-2 rounded-full ${getToneColor(beat.emotionalTone)}`}
                                />
                                <Input
                                  value={beat.emotionalTone}
                                  onChange={(e) =>
                                    updateBeat(sceneIndex, beatIndex, {
                                      emotionalTone: e.target.value,
                                    })
                                  }
                                  className="h-6 w-28 border-none bg-transparent px-1 text-xs text-muted-foreground focus-visible:ring-1"
                                  placeholder="Tone"
                                />
                              </div>
                              <div className="ml-auto flex items-center gap-1">
                                <Tooltip>
                                  <TooltipTrigger asChild>
                                    <Button
                                      variant="ghost"
                                      size="icon"
                                      className={`h-6 w-6 ${
                                        editingDialogue?.sceneIndex === sceneIndex &&
                                        editingDialogue?.beatIndex === beatIndex
                                          ? "text-primary"
                                          : beat.dialogue?.length
                                            ? "text-primary/60"
                                            : "text-muted-foreground/40 hover:text-muted-foreground"
                                      }`}
                                      onClick={() => {
                                        if (
                                          editingDialogue?.sceneIndex ===
                                            sceneIndex &&
                                          editingDialogue?.beatIndex ===
                                            beatIndex
                                        ) {
                                          setEditingDialogue(null);
                                        } else {
                                          setEditingDialogue({
                                            sceneIndex,
                                            beatIndex,
                                          });
                                          if (!beat.dialogue?.length) {
                                            addDialogueLine(
                                              sceneIndex,
                                              beatIndex
                                            );
                                          }
                                        }
                                      }}
                                    >
                                      <MessageSquare className="h-3 w-3" />
                                    </Button>
                                  </TooltipTrigger>
                                  <TooltipContent className="text-xs">
                                    {beat.dialogue?.length
                                      ? "Edit dialogue"
                                      : "Add dialogue"}
                                  </TooltipContent>
                                </Tooltip>
                                {scene.beats.length > 1 && (
                                  <Tooltip>
                                    <TooltipTrigger asChild>
                                      <Button
                                        variant="ghost"
                                        size="icon"
                                        className="h-6 w-6 text-destructive/60 opacity-0 transition-opacity hover:text-destructive group-hover:opacity-100"
                                        onClick={() =>
                                          removeBeat(sceneIndex, beatIndex)
                                        }
                                      >
                                        <Trash2 className="h-3 w-3" />
                                      </Button>
                                    </TooltipTrigger>
                                    <TooltipContent className="text-xs">
                                      Remove beat
                                    </TooltipContent>
                                  </Tooltip>
                                )}
                              </div>
                            </div>

                            {/* Beat description */}
                            <Textarea
                              value={beat.description}
                              onChange={(e) =>
                                updateBeat(sceneIndex, beatIndex, {
                                  description: e.target.value,
                                })
                              }
                              placeholder="Describe what happens in this beat..."
                              className="min-h-[60px] resize-none text-sm"
                            />

                            {/* Dialogue indicator (collapsed) */}
                            {beat.dialogue &&
                              beat.dialogue.length > 0 &&
                              !(
                                editingDialogue?.sceneIndex === sceneIndex &&
                                editingDialogue?.beatIndex === beatIndex
                              ) && (
                                <button
                                  onClick={() =>
                                    setEditingDialogue({
                                      sceneIndex,
                                      beatIndex,
                                    })
                                  }
                                  className="flex items-center gap-2 rounded-md bg-primary/5 px-2.5 py-1.5 text-xs transition-colors hover:bg-primary/10"
                                >
                                  <MessageSquare className="h-3 w-3 text-primary" />
                                  <span className="text-muted-foreground">
                                    {beat.dialogue.length} dialogue line
                                    {beat.dialogue.length !== 1 ? "s" : ""}
                                  </span>
                                  {beat.dialogue.slice(0, 2).map((d, i) => (
                                    <span key={i} className="truncate text-foreground">
                                      {d.character}: &ldquo;{d.line.slice(0, 30)}
                                      {d.line.length > 30 ? "..." : ""}&rdquo;
                                    </span>
                                  ))}
                                </button>
                              )}

                            {/* Dialogue editor (expanded) */}
                            {editingDialogue?.sceneIndex === sceneIndex &&
                              editingDialogue?.beatIndex === beatIndex && (
                                <div className="rounded-md border border-primary/20 bg-primary/5 p-3">
                                  <div className="mb-2 flex items-center justify-between">
                                    <span className="text-xs font-medium text-primary">
                                      Dialogue
                                    </span>
                                    <Button
                                      variant="ghost"
                                      size="icon"
                                      className="h-5 w-5"
                                      onClick={() =>
                                        setEditingDialogue(null)
                                      }
                                    >
                                      <X className="h-3 w-3" />
                                    </Button>
                                  </div>
                                  <div className="space-y-2">
                                    {(beat.dialogue ?? []).map(
                                      (dl, dlIndex) => (
                                        <div
                                          key={dlIndex}
                                          className="flex items-start gap-2"
                                        >
                                          <UserCircle className="mt-2 h-4 w-4 flex-shrink-0 text-muted-foreground" />
                                          <div className="flex-1 space-y-1">
                                            <div className="flex gap-2">
                                              <Input
                                                value={dl.character}
                                                onChange={(e) =>
                                                  updateDialogueLine(
                                                    sceneIndex,
                                                    beatIndex,
                                                    dlIndex,
                                                    {
                                                      character:
                                                        e.target.value,
                                                    }
                                                  )
                                                }
                                                className="h-7 w-32 text-xs"
                                                placeholder="Character"
                                              />
                                              <Input
                                                value={dl.emotion}
                                                onChange={(e) =>
                                                  updateDialogueLine(
                                                    sceneIndex,
                                                    beatIndex,
                                                    dlIndex,
                                                    {
                                                      emotion: e.target.value,
                                                    }
                                                  )
                                                }
                                                className="h-7 w-24 text-xs"
                                                placeholder="Emotion"
                                              />
                                              <Button
                                                variant="ghost"
                                                size="icon"
                                                className="h-7 w-7 text-destructive/60 hover:text-destructive"
                                                onClick={() =>
                                                  removeDialogueLine(
                                                    sceneIndex,
                                                    beatIndex,
                                                    dlIndex
                                                  )
                                                }
                                              >
                                                <Trash2 className="h-3 w-3" />
                                              </Button>
                                            </div>
                                            <Input
                                              value={dl.line}
                                              onChange={(e) =>
                                                updateDialogueLine(
                                                  sceneIndex,
                                                  beatIndex,
                                                  dlIndex,
                                                  { line: e.target.value }
                                                )
                                              }
                                              className="h-7 text-xs"
                                              placeholder="What they say..."
                                            />
                                          </div>
                                        </div>
                                      )
                                    )}
                                    <Button
                                      variant="ghost"
                                      size="sm"
                                      className="h-7 text-xs text-primary"
                                      onClick={() =>
                                        addDialogueLine(sceneIndex, beatIndex)
                                      }
                                    >
                                      <Plus className="mr-1 h-3 w-3" />
                                      Add line
                                    </Button>
                                  </div>
                                </div>
                              )}
                          </div>
                        </div>
                      </div>
                    ))}

                    {/* Add beat */}
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-8 w-full border border-dashed border-border/50 text-xs text-muted-foreground hover:border-primary/30 hover:text-primary"
                      onClick={() => addBeat(sceneIndex)}
                    >
                      <Plus className="mr-1 h-3 w-3" />
                      Add beat
                    </Button>
                  </div>

                  {/* Scene actions */}
                  {scenes.length > 1 && (
                    <div className="mt-3 flex justify-end">
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-7 text-xs text-destructive/60 hover:text-destructive"
                        onClick={() => removeScene(sceneIndex)}
                      >
                        <Trash2 className="mr-1 h-3 w-3" />
                        Remove scene
                      </Button>
                    </div>
                  )}
                </div>
              )}
            </Card>
          ))}

          {/* Add scene */}
          <Button
            variant="outline"
            className="w-full border-dashed"
            onClick={addScene}
          >
            <Plus className="mr-2 h-4 w-4" />
            Add Scene
          </Button>

          {/* Bottom spacer */}
          <div className="h-8" />
        </div>
      </div>
    </div>
  );
}
