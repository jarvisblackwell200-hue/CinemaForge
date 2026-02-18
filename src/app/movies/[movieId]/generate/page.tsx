"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { useParams, useRouter } from "next/navigation";
import {
  Play,
  Loader2,
  CheckCircle2,
  XCircle,
  ChevronRight,
  Coins,
  Film,
  Clock,
  RefreshCw,
  Zap,
  AlertTriangle,
  Eye,
  Pause,
  SkipForward,
  Volume2,
  VolumeX,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { getCreditCost } from "@/lib/constants/pricing";
import type { QualityTier } from "@/lib/kling/types";

// ─── Types ─────────────────────────────────────────────────────

interface TakeData {
  id: string;
  videoUrl: string;
  thumbnailUrl: string | null;
  isHero: boolean;
  qualityScore: number | null;
  generationParams: Record<string, unknown> | null;
  createdAt: string;
}

interface ShotData {
  id: string;
  sceneIndex: number;
  order: number;
  shotType: string;
  cameraMovement: string;
  subject: string;
  action: string;
  environment: string | null;
  lighting: string | null;
  durationSeconds: number;
  generatedPrompt: string | null;
  negativePrompt: string | null;
  status: string;
  takes: TakeData[];
}

interface GenerationSummary {
  total: number;
  draft: number;
  generating: number;
  complete: number;
  failed: number;
}

type GenerationState = "idle" | "confirming" | "generating" | "paused" | "done";

interface CharacterData {
  id: string;
  name: string;
  referenceImages: string[];
}

// ─── Component ─────────────────────────────────────────────────

export default function GeneratePage() {
  const params = useParams<{ movieId: string }>();
  const router = useRouter();

  const [shots, setShots] = useState<ShotData[]>([]);
  const [characters, setCharacters] = useState<CharacterData[]>([]);
  const [summary, setSummary] = useState<GenerationSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [quality, setQuality] = useState<QualityTier>("draft");
  const [generateAudio, setGenerateAudio] = useState(false);
  const [genState, setGenState] = useState<GenerationState>("idle");
  const [currentShotIndex, setCurrentShotIndex] = useState(-1);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [previewShot, setPreviewShot] = useState<ShotData | null>(null);
  const [generatingIds, setGeneratingIds] = useState<Set<string>>(new Set());
  const pauseRef = useRef(false);

  // ─── Fetch shots and status ────────────────────────────────

  const fetchStatus = useCallback(async () => {
    try {
      const [genRes, charsRes] = await Promise.all([
        fetch(`/api/generate?movieId=${params.movieId}`),
        fetch(`/api/characters?movieId=${params.movieId}`),
      ]);

      const data = await genRes.json();
      if (data.success) {
        setShots(data.data.shots);
        setSummary(data.data.summary);
      }

      if (charsRes.ok) {
        const charsData = await charsRes.json();
        if (charsData.success) setCharacters(charsData.data);
      }
    } catch (error) {
      console.error("Failed to fetch generation status:", error);
    } finally {
      setLoading(false);
    }
  }, [params.movieId]);

  useEffect(() => {
    fetchStatus();
  }, [fetchStatus]);

  // ─── Cost calculation ──────────────────────────────────────

  const pendingShots = shots.filter(
    (s) => s.status === "DRAFT" || s.status === "FAILED"
  );
  const totalCost = pendingShots.reduce(
    (sum, s) => sum + getCreditCost(quality, s.durationSeconds),
    0
  );

  // ─── Generate a single shot ────────────────────────────────

  async function generateShot(shotId: string): Promise<boolean> {
    // Prevent double-clicks: skip if already generating this shot
    if (generatingIds.has(shotId)) return false;
    setGeneratingIds((prev) => new Set(prev).add(shotId));

    try {
      // Find character reference images for this shot
      const shot = shots.find((s) => s.id === shotId);
      const shotText = shot ? `${shot.subject} ${shot.action}`.toLowerCase() : "";
      const matchedRefs: string[] = [];
      for (const c of characters) {
        if (c.referenceImages?.length > 0 && shotText.includes(c.name.toLowerCase())) {
          matchedRefs.push(...c.referenceImages);
        }
      }

      const res = await fetch("/api/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          shotId,
          quality,
          generateAudio,
          characterReferenceImages: matchedRefs.length > 0 ? matchedRefs : undefined,
        }),
      });
      const data = await res.json();
      if (data.success) {
        // Update local state with the completed shot
        setShots((prev) =>
          prev.map((s) =>
            s.id === shotId
              ? {
                  ...s,
                  status: "COMPLETE",
                  takes: [data.data.take, ...s.takes],
                }
              : s
          )
        );
        setSummary((prev) =>
          prev
            ? {
                ...prev,
                draft: prev.draft - 1,
                complete: prev.complete + 1,
              }
            : prev
        );
        return true;
      } else {
        console.error("Generation failed:", data.error);
        setShots((prev) =>
          prev.map((s) =>
            s.id === shotId ? { ...s, status: "FAILED" } : s
          )
        );
        return false;
      }
    } catch (error) {
      console.error("Generation error:", error);
      return false;
    } finally {
      setGeneratingIds((prev) => {
        const next = new Set(prev);
        next.delete(shotId);
        return next;
      });
    }
  }

  // ─── Generate all pending shots sequentially ───────────────

  async function generateAll() {
    setConfirmOpen(false);
    setGenState("generating");
    pauseRef.current = false;

    for (let i = 0; i < pendingShots.length; i++) {
      if (pauseRef.current) {
        setGenState("paused");
        return;
      }

      setCurrentShotIndex(i);

      // Mark shot as generating in UI
      setShots((prev) =>
        prev.map((s) =>
          s.id === pendingShots[i].id
            ? { ...s, status: "GENERATING" }
            : s
        )
      );

      await generateShot(pendingShots[i].id);
    }

    setGenState("done");
    setCurrentShotIndex(-1);
    // Refresh to get final state
    fetchStatus();
  }

  function handlePause() {
    pauseRef.current = true;
    setGenState("paused");
  }

  function handleResume() {
    // Resume from where we left off
    const remaining = pendingShots.slice(currentShotIndex + 1);
    if (remaining.length === 0) {
      setGenState("done");
      return;
    }
    setGenState("generating");
    pauseRef.current = false;

    (async () => {
      for (let i = currentShotIndex + 1; i < pendingShots.length; i++) {
        if (pauseRef.current) {
          setGenState("paused");
          return;
        }
        setCurrentShotIndex(i);
        setShots((prev) =>
          prev.map((s) =>
            s.id === pendingShots[i].id
              ? { ...s, status: "GENERATING" }
              : s
          )
        );
        await generateShot(pendingShots[i].id);
      }
      setGenState("done");
      setCurrentShotIndex(-1);
      fetchStatus();
    })();
  }

  // ─── Loading state ─────────────────────────────────────────

  if (loading) {
    return (
      <div className="flex h-full items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  // ─── No shots ──────────────────────────────────────────────

  if (shots.length === 0) {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-4 px-6 text-center">
        <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-primary/10">
          <Film className="h-7 w-7 text-primary" />
        </div>
        <h2 className="text-xl font-semibold">No Shots to Generate</h2>
        <p className="max-w-md text-sm text-muted-foreground">
          Go back to the Storyboard and plan your shots first.
        </p>
        <Button
          variant="secondary"
          onClick={() =>
            router.push(`/movies/${params.movieId}/storyboard`)
          }
        >
          Go to Storyboard
        </Button>
      </div>
    );
  }

  // ─── Progress stats ────────────────────────────────────────

  const completedCount = shots.filter((s) => s.status === "COMPLETE").length;
  const progressPct =
    shots.length > 0 ? Math.round((completedCount / shots.length) * 100) : 0;

  // ─── Render ────────────────────────────────────────────────

  return (
    <div className="flex h-full flex-col">
      {/* Header */}
      <div className="border-b border-border/50 px-6 py-4">
        <div className="flex items-center justify-between">
          <div>
            <div className="flex items-center gap-2">
              <Play className="h-4 w-4 text-primary" />
              <h2 className="text-sm font-semibold">Generate</h2>
              {summary && (
                <Badge variant="secondary" className="text-xs">
                  {summary.complete}/{summary.total} complete
                </Badge>
              )}
            </div>
            <p className="mt-1 text-xs text-muted-foreground">
              Generate video for each shot via kie.ai (Kling 3.0).
            </p>
          </div>

          <div className="flex items-center gap-3">
            {/* Quality selector */}
            <div className="flex items-center gap-1 rounded-lg border border-border/50 bg-background p-0.5">
              {(["draft", "standard", "cinema"] as const).map((q) => (
                <button
                  key={q}
                  type="button"
                  onClick={() => setQuality(q)}
                  disabled={genState === "generating"}
                  className={`rounded-md px-3 py-1 text-xs font-medium transition-colors ${
                    quality === q
                      ? "bg-primary text-primary-foreground"
                      : "text-muted-foreground hover:text-foreground"
                  }`}
                >
                  {q.charAt(0).toUpperCase() + q.slice(1)}
                </button>
              ))}
            </div>

            {/* Audio toggle */}
            <Tooltip>
              <TooltipTrigger asChild>
                <button
                  type="button"
                  onClick={() => setGenerateAudio((prev) => !prev)}
                  disabled={genState === "generating"}
                  className={`flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-xs font-medium transition-colors ${
                    generateAudio
                      ? "border-primary/50 bg-primary/10 text-primary"
                      : "border-border/50 bg-background text-muted-foreground hover:text-foreground"
                  }`}
                >
                  {generateAudio ? (
                    <Volume2 className="h-3.5 w-3.5" />
                  ) : (
                    <VolumeX className="h-3.5 w-3.5" />
                  )}
                  Audio {generateAudio ? "On" : "Off"}
                </button>
              </TooltipTrigger>
              <TooltipContent className="text-xs">
                {generateAudio
                  ? "Kling will generate audio from dialogue and scene"
                  : "Video only, no audio generated"}
              </TooltipContent>
            </Tooltip>

            {/* Cost badge */}
            {pendingShots.length > 0 && (
              <Tooltip>
                <TooltipTrigger asChild>
                  <div className="flex items-center gap-1.5 rounded-lg border border-border/50 bg-background px-3 py-1.5">
                    <Coins className="h-3.5 w-3.5 text-primary" />
                    <span className="text-xs font-medium">
                      {totalCost} credits
                    </span>
                  </div>
                </TooltipTrigger>
                <TooltipContent className="text-xs">
                  {pendingShots.length} shots remaining at {quality} quality
                </TooltipContent>
              </Tooltip>
            )}

            {/* Action buttons */}
            {genState === "idle" && pendingShots.length > 0 && (
              <Button size="sm" onClick={() => setConfirmOpen(true)}>
                <Zap className="mr-1.5 h-3.5 w-3.5" />
                Generate All ({pendingShots.length})
              </Button>
            )}
            {genState === "generating" && (
              <Button size="sm" variant="secondary" onClick={handlePause}>
                <Pause className="mr-1.5 h-3.5 w-3.5" />
                Pause
              </Button>
            )}
            {genState === "paused" && (
              <Button size="sm" onClick={handleResume}>
                <Play className="mr-1.5 h-3.5 w-3.5" />
                Resume
              </Button>
            )}
            {(genState === "done" || pendingShots.length === 0) && completedCount > 0 && (
              <Button
                size="sm"
                onClick={() =>
                  router.push(`/movies/${params.movieId}/timeline`)
                }
              >
                Continue to Timeline
                <ChevronRight className="ml-1 h-4 w-4" />
              </Button>
            )}
          </div>
        </div>

        {/* Overall progress bar */}
        {shots.length > 0 && (
          <div className="mt-3">
            <div className="flex items-center justify-between text-xs text-muted-foreground mb-1">
              <span>
                {genState === "generating"
                  ? `Generating shot ${currentShotIndex + 1} of ${pendingShots.length}...`
                  : genState === "paused"
                    ? "Paused"
                    : genState === "done"
                      ? "Generation complete"
                      : `${completedCount} of ${shots.length} shots generated`}
              </span>
              <span>{progressPct}%</span>
            </div>
            <div className="h-1.5 overflow-hidden rounded-full bg-muted">
              <div
                className={`h-full rounded-full transition-all duration-500 ${
                  genState === "generating"
                    ? "bg-primary animate-pulse"
                    : "bg-primary"
                }`}
                style={{ width: `${progressPct}%` }}
              />
            </div>
          </div>
        )}
      </div>

      {/* Shot list */}
      <div className="flex-1 overflow-y-auto px-6 py-4">
        <div className="mx-auto max-w-3xl space-y-2">
          {shots.map((shot, index) => (
            <ShotGenerationCard
              key={shot.id}
              shot={shot}
              index={index}
              quality={quality}
              isCurrentlyGenerating={
                generatingIds.has(shot.id) || (
                  genState === "generating" &&
                  pendingShots[currentShotIndex]?.id === shot.id
                )
              }
              onGenerate={() => generateShot(shot.id)}
              onPreview={() => setPreviewShot(shot)}
              disabled={genState === "generating" || generatingIds.has(shot.id)}
            />
          ))}
        </div>
      </div>

      {/* Confirm dialog */}
      <Dialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Zap className="h-5 w-5 text-primary" />
              Generate All Shots
            </DialogTitle>
            <DialogDescription>
              This will generate {pendingShots.length} shot
              {pendingShots.length !== 1 ? "s" : ""} at{" "}
              <span className="font-medium text-foreground">{quality}</span>{" "}
              quality.
              {" "}This will use real credits via kie.ai.
            </DialogDescription>
          </DialogHeader>
          <div className="rounded-lg border border-border bg-card/50 p-4">
            <div className="flex items-center justify-between">
              <div className="space-y-1">
                <p className="text-sm font-medium">Cost Estimate</p>
                <p className="text-xs text-muted-foreground">
                  {pendingShots.length} shots, {quality} quality
                </p>
              </div>
              <div className="flex items-center gap-1.5">
                <Coins className="h-4 w-4 text-primary" />
                <span className="text-lg font-semibold">{totalCost}</span>
                <span className="text-xs text-muted-foreground">credits</span>
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setConfirmOpen(false)}>
              Cancel
            </Button>
            <Button onClick={generateAll}>
              <Zap className="mr-1.5 h-4 w-4" />
              Generate
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Video preview dialog */}
      <Dialog
        open={previewShot !== null}
        onOpenChange={(open) => {
          if (!open) setPreviewShot(null);
        }}
      >
        <DialogContent className="sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle>
              Shot {previewShot ? previewShot.order + 1 : ""} —{" "}
              {previewShot?.shotType}
            </DialogTitle>
            <DialogDescription>{previewShot?.subject}</DialogDescription>
          </DialogHeader>
          {previewShot?.takes?.[0] && (
            <div className="overflow-hidden rounded-lg bg-black">
              <video
                src={previewShot.takes[0].videoUrl}
                controls
                autoPlay
                className="w-full"
              />
            </div>
          )}
          {previewShot?.generatedPrompt && (
            <div className="rounded-lg border border-border/50 bg-card/50 p-3">
              <p className="text-xs text-muted-foreground mb-1">Prompt used:</p>
              <p className="text-xs leading-relaxed">
                {previewShot.generatedPrompt}
              </p>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}

// ─── Shot Generation Card ──────────────────────────────────────

function ShotGenerationCard({
  shot,
  index,
  quality,
  isCurrentlyGenerating,
  onGenerate,
  onPreview,
  disabled,
}: {
  shot: ShotData;
  index: number;
  quality: QualityTier;
  isCurrentlyGenerating: boolean;
  onGenerate: () => void;
  onPreview: () => void;
  disabled: boolean;
}) {
  const cost = getCreditCost(quality, shot.durationSeconds);
  const heroTake = shot.takes.find((t) => t.isHero);

  return (
    <Card
      className={`border transition-colors ${
        isCurrentlyGenerating
          ? "border-primary/50 bg-primary/5"
          : shot.status === "COMPLETE"
            ? "border-green-500/20 bg-green-500/5"
            : shot.status === "FAILED"
              ? "border-red-500/20 bg-red-500/5"
              : "border-border"
      }`}
    >
      <CardContent className="flex items-center gap-4 py-3">
        {/* Status icon */}
        <div className="flex-shrink-0">
          {isCurrentlyGenerating ? (
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10">
              <Loader2 className="h-5 w-5 animate-spin text-primary" />
            </div>
          ) : shot.status === "COMPLETE" ? (
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-green-500/10">
              <CheckCircle2 className="h-5 w-5 text-green-500" />
            </div>
          ) : shot.status === "FAILED" ? (
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-red-500/10">
              <XCircle className="h-5 w-5 text-red-500" />
            </div>
          ) : (
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-muted">
              <span className="text-sm font-semibold text-muted-foreground">
                {index + 1}
              </span>
            </div>
          )}
        </div>

        {/* Video thumbnail (if complete) */}
        {heroTake && (
          <button
            type="button"
            onClick={onPreview}
            className="relative flex-shrink-0 overflow-hidden rounded-md bg-black"
          >
            <video
              src={heroTake.videoUrl}
              muted
              className="h-14 w-24 object-cover"
              onMouseEnter={(e) => (e.target as HTMLVideoElement).play()}
              onMouseLeave={(e) => {
                const v = e.target as HTMLVideoElement;
                v.pause();
                v.currentTime = 0;
              }}
            />
            <div className="absolute inset-0 flex items-center justify-center bg-black/30 opacity-0 transition-opacity hover:opacity-100">
              <Eye className="h-4 w-4 text-white" />
            </div>
          </button>
        )}

        {/* Shot info */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <span className="text-sm font-medium truncate">
              {shot.subject || `Shot ${index + 1}`}
            </span>
            <Badge variant="secondary" className="text-[10px] flex-shrink-0">
              {shot.shotType}
            </Badge>
          </div>
          <div className="mt-0.5 flex items-center gap-3 text-xs text-muted-foreground">
            <span className="flex items-center gap-1">
              <Clock className="h-3 w-3" />
              {shot.durationSeconds}s
            </span>
            <span className="truncate">{shot.cameraMovement}</span>
          </div>
          {isCurrentlyGenerating && (
            <p className="mt-1 text-xs text-primary animate-pulse">
              Generating video...
            </p>
          )}
        </div>

        {/* Actions */}
        <div className="flex items-center gap-2 flex-shrink-0">
          {shot.status === "DRAFT" && (
            <>
              <span className="text-xs text-muted-foreground">
                {cost} cr
              </span>
              <Button
                size="sm"
                variant="secondary"
                onClick={onGenerate}
                disabled={disabled}
              >
                <Play className="mr-1 h-3 w-3" />
                Generate
              </Button>
            </>
          )}
          {shot.status === "FAILED" && (
            <Button
              size="sm"
              variant="secondary"
              onClick={onGenerate}
              disabled={disabled}
            >
              <RefreshCw className="mr-1 h-3 w-3" />
              Retry
            </Button>
          )}
          {shot.status === "COMPLETE" && (
            <div className="flex items-center gap-2">
              <Badge
                variant="outline"
                className="border-green-500/30 text-green-500 text-[10px]"
              >
                {shot.takes.length} take{shot.takes.length !== 1 ? "s" : ""}
              </Badge>
              <Button size="sm" variant="ghost" onClick={onPreview}>
                <Eye className="h-3.5 w-3.5" />
              </Button>
              <Button
                size="sm"
                variant="secondary"
                onClick={onGenerate}
                disabled={disabled}
              >
                <RefreshCw className="mr-1 h-3 w-3" />
                New Take
              </Button>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
