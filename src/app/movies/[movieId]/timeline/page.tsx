"use client";

import { useState, useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
import {
  Layers,
  Loader2,
  Play,
  ChevronRight,
  Clock,
  Film,
  AlertCircle,
  Scissors,
  Blend,
  CircleDot,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { CREDIT_COSTS } from "@/lib/constants/pricing";

// ─── Types ──────────────────────────────────────────────────────

interface Take {
  id: string;
  videoUrl: string;
  thumbnailUrl: string | null;
  isHero: boolean;
}

interface TimelineShot {
  id: string;
  order: number;
  sceneIndex: number;
  shotType: string;
  subject: string;
  durationSeconds: number;
  status: string;
  takes: Take[];
}

type TransitionType = "cut" | "crossfade" | "fade-black";

interface Transition {
  type: TransitionType;
  durationMs: number;
}

const TRANSITION_OPTIONS: { type: TransitionType; label: string; icon: typeof Scissors; desc: string }[] = [
  { type: "cut", label: "Cut", icon: Scissors, desc: "Hard cut, instant transition" },
  { type: "crossfade", label: "Crossfade", icon: Blend, desc: "Smooth dissolve between shots" },
  { type: "fade-black", label: "Fade to Black", icon: CircleDot, desc: "Fade out then fade in" },
];

// ─── Component ──────────────────────────────────────────────────

export default function TimelinePage() {
  const params = useParams<{ movieId: string }>();
  const router = useRouter();

  const [shots, setShots] = useState<TimelineShot[]>([]);
  const [transitions, setTransitions] = useState<Transition[]>([]);
  const [loading, setLoading] = useState(true);
  const [assembling, setAssembling] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);

  // ─── Fetch shots ───────────────────────────────────────────

  useEffect(() => {
    async function fetchData() {
      try {
        const res = await fetch(`/api/generate?movieId=${params.movieId}`);
        if (!res.ok) {
          setError("Failed to load shots");
          return;
        }
        const json = await res.json();
        if (!json.success) {
          setError(json.error ?? "Failed to load shots");
          return;
        }

        const completed = (json.data.shots as TimelineShot[]).filter(
          (s) => s.status === "COMPLETE" && s.takes.some((t) => t.isHero),
        );
        completed.sort((a, b) => a.order - b.order);
        setShots(completed);

        // Initialize transitions (cut by default)
        setTransitions(
          Array.from({ length: Math.max(0, completed.length - 1) }, () => ({
            type: "cut" as TransitionType,
            durationMs: 0,
          })),
        );

        // Check for existing assembled video
        const timelineRes = await fetch(`/api/movies/${params.movieId}`);
        if (timelineRes.ok) {
          const movieJson = await timelineRes.json();
          if (movieJson.success && movieJson.data?.timeline?.exportedUrl) {
            setPreviewUrl(movieJson.data.timeline.exportedUrl);
          }
        }
      } catch {
        setError("Failed to connect to server");
      } finally {
        setLoading(false);
      }
    }
    fetchData();
  }, [params.movieId]);

  // ─── Update transition ────────────────────────────────────

  function setTransition(index: number, type: TransitionType) {
    setTransitions((prev) =>
      prev.map((t, i) =>
        i === index
          ? { type, durationMs: type === "cut" ? 0 : 500 }
          : t,
      ),
    );
  }

  // ─── Assemble movie ──────────────────────────────────────

  async function handleAssemble() {
    setAssembling(true);
    setError(null);

    try {
      const res = await fetch("/api/assemble", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          movieId: params.movieId,
          transitions,
        }),
      });

      const json = await res.json();
      if (!res.ok || !json.success) {
        setError(json.error ?? "Assembly failed");
        return;
      }

      setPreviewUrl(json.data.videoUrl);
    } catch {
      setError("Assembly failed — check your connection");
    } finally {
      setAssembling(false);
    }
  }

  // ─── Get hero take URL for a shot ────────────────────────

  function getHeroTakeUrl(shot: TimelineShot): string | null {
    const hero = shot.takes.find((t) => t.isHero);
    return hero?.videoUrl ?? null;
  }

  function getHeroThumbnail(shot: TimelineShot): string | null {
    const hero = shot.takes.find((t) => t.isHero);
    return hero?.thumbnailUrl ?? null;
  }

  // ─── Total duration ──────────────────────────────────────

  const totalDuration = shots.reduce((sum, s) => sum + s.durationSeconds, 0);

  // ─── Loading ─────────────────────────────────────────────

  if (loading) {
    return (
      <div className="flex h-full items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  // ─── No completed shots ──────────────────────────────────

  if (shots.length === 0) {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-4 px-6 text-center">
        <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-primary/10">
          <Layers className="h-7 w-7 text-primary" />
        </div>
        <h2 className="text-xl font-semibold">No Completed Shots</h2>
        <p className="max-w-md text-sm text-muted-foreground">
          Generate your shots first, then come back here to arrange them on the
          timeline and assemble your movie.
        </p>
        <Button
          variant="secondary"
          onClick={() => router.push(`/movies/${params.movieId}/generate`)}
        >
          Go to Generate
        </Button>
      </div>
    );
  }

  // ─── Render ──────────────────────────────────────────────

  return (
    <div className="flex h-full flex-col">
      {/* Header */}
      <div className="border-b border-border/50 px-6 py-4">
        <div className="flex items-center justify-between">
          <div>
            <div className="flex items-center gap-2">
              <Layers className="h-4 w-4 text-primary" />
              <h2 className="text-sm font-semibold">Timeline</h2>
              <Badge variant="secondary" className="text-xs">
                {shots.length} shot{shots.length !== 1 ? "s" : ""}
              </Badge>
            </div>
            <p className="mt-1 text-xs text-muted-foreground">
              Set transitions between shots and assemble your final movie.
            </p>
          </div>

          <div className="flex items-center gap-3">
            <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
              <Clock className="h-3.5 w-3.5" />
              {totalDuration}s total
            </div>

            <Button
              size="sm"
              onClick={handleAssemble}
              disabled={assembling || shots.length === 0}
            >
              {assembling ? (
                <>
                  <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
                  Assembling...
                </>
              ) : (
                <>
                  <Film className="mr-1.5 h-3.5 w-3.5" />
                  Assemble Movie ({CREDIT_COSTS.ASSEMBLY_EXPORT} credits)
                </>
              )}
            </Button>

            {previewUrl && (
              <Button
                size="sm"
                variant="outline"
                onClick={() => router.push(`/movies/${params.movieId}/export`)}
              >
                Continue to Export
                <ChevronRight className="ml-1 h-4 w-4" />
              </Button>
            )}
          </div>
        </div>
      </div>

      {/* Error */}
      {error && (
        <div className="mx-6 mt-4 flex items-center gap-2 rounded-lg border border-destructive/30 bg-destructive/5 px-4 py-3">
          <AlertCircle className="h-4 w-4 text-destructive" />
          <span className="text-sm text-destructive">{error}</span>
        </div>
      )}

      {/* Preview player */}
      {previewUrl && (
        <div className="mx-6 mt-4">
          <Card className="overflow-hidden border-border/50 bg-black">
            <video
              src={previewUrl}
              controls
              className="mx-auto max-h-[400px] w-full"
            />
          </Card>
        </div>
      )}

      {/* Timeline strip */}
      <div className="flex-1 overflow-x-auto px-6 py-6">
        <div className="flex items-start gap-0">
          {shots.map((shot, index) => (
            <div key={shot.id} className="flex items-center">
              {/* Shot card */}
              <div className="w-48 shrink-0">
                <Card className="overflow-hidden border-border/50">
                  {/* Thumbnail / video preview */}
                  <div className="relative aspect-video bg-muted">
                    {getHeroTakeUrl(shot) ? (
                      <video
                        src={getHeroTakeUrl(shot)!}
                        className="h-full w-full object-cover"
                        muted
                        onMouseEnter={(e) => (e.target as HTMLVideoElement).play()}
                        onMouseLeave={(e) => {
                          const vid = e.target as HTMLVideoElement;
                          vid.pause();
                          vid.currentTime = 0;
                        }}
                      />
                    ) : getHeroThumbnail(shot) ? (
                      <img
                        src={getHeroThumbnail(shot)!}
                        alt={shot.subject}
                        className="h-full w-full object-cover"
                      />
                    ) : (
                      <div className="flex h-full items-center justify-center">
                        <Film className="h-6 w-6 text-muted-foreground/30" />
                      </div>
                    )}
                    <Badge
                      variant="secondary"
                      className="absolute bottom-1 right-1 text-[10px]"
                    >
                      {shot.durationSeconds}s
                    </Badge>
                    <Badge
                      variant="outline"
                      className="absolute top-1 left-1 text-[10px]"
                    >
                      #{index + 1}
                    </Badge>
                  </div>

                  {/* Shot info */}
                  <div className="p-2">
                    <p className="truncate text-xs font-medium">{shot.subject}</p>
                    <p className="truncate text-[10px] text-muted-foreground">
                      {shot.shotType}
                    </p>
                  </div>
                </Card>
              </div>

              {/* Transition picker between shots */}
              {index < shots.length - 1 && (
                <div className="flex w-20 shrink-0 flex-col items-center gap-1 px-2">
                  {TRANSITION_OPTIONS.map((opt) => {
                    const Icon = opt.icon;
                    const isActive = transitions[index]?.type === opt.type;
                    return (
                      <button
                        key={opt.type}
                        onClick={() => setTransition(index, opt.type)}
                        className={`flex w-full items-center gap-1 rounded px-2 py-1 text-[10px] transition-colors ${
                          isActive
                            ? "bg-primary/10 text-primary"
                            : "text-muted-foreground hover:bg-muted"
                        }`}
                        title={opt.desc}
                      >
                        <Icon className="h-3 w-3" />
                        {opt.label}
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
