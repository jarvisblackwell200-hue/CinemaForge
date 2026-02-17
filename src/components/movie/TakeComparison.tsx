"use client";

import { useState } from "react";
import {
  Star,
  Trash2,
  Loader2,
  RefreshCw,
  CheckCircle2,
  Clock,
  Play,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

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

interface TakeComparisonProps {
  shotId: string;
  takes: TakeData[];
  onSetHero: (takeId: string) => Promise<void>;
  onDelete: (takeId: string) => Promise<void>;
  onRegenerate: () => void;
  disabled?: boolean;
}

// ─── Component ─────────────────────────────────────────────────

export function TakeComparison({
  shotId,
  takes,
  onSetHero,
  onDelete,
  onRegenerate,
  disabled,
}: TakeComparisonProps) {
  const [settingHero, setSettingHero] = useState<string | null>(null);
  const [deleting, setDeleting] = useState<string | null>(null);
  const [playingId, setPlayingId] = useState<string | null>(null);

  async function handleSetHero(takeId: string) {
    setSettingHero(takeId);
    try {
      await onSetHero(takeId);
    } finally {
      setSettingHero(null);
    }
  }

  async function handleDelete(takeId: string) {
    setDeleting(takeId);
    try {
      await onDelete(takeId);
    } finally {
      setDeleting(null);
    }
  }

  if (takes.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center gap-3 rounded-lg border border-dashed border-border p-8 text-center">
        <Play className="h-8 w-8 text-muted-foreground/40" />
        <p className="text-sm text-muted-foreground">
          No takes yet. Generate a video to see results here.
        </p>
        <Button size="sm" variant="secondary" onClick={onRegenerate} disabled={disabled}>
          <RefreshCw className="mr-1.5 h-3.5 w-3.5" />
          Generate
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <h4 className="text-sm font-medium">
          Takes ({takes.length})
        </h4>
        <Button size="sm" variant="ghost" onClick={onRegenerate} disabled={disabled}>
          <RefreshCw className="mr-1.5 h-3.5 w-3.5" />
          New Take
        </Button>
      </div>

      <div
        className={`grid gap-3 ${
          takes.length === 1
            ? "grid-cols-1 max-w-lg"
            : takes.length === 2
              ? "grid-cols-2"
              : "grid-cols-3"
        }`}
      >
        {takes.map((take) => {
          const params = take.generationParams as {
            quality?: string;
            duration?: number;
            dryRun?: boolean;
            generationTimeMs?: number;
          } | null;

          return (
            <Card
              key={take.id}
              className={`overflow-hidden border transition-colors ${
                take.isHero
                  ? "border-primary/50 ring-1 ring-primary/20"
                  : "border-border"
              }`}
            >
              {/* Video player */}
              <div className="relative aspect-video bg-black">
                <video
                  src={take.videoUrl}
                  controls={playingId === take.id}
                  muted={playingId !== take.id}
                  loop
                  className="h-full w-full object-contain"
                  onClick={() =>
                    setPlayingId(playingId === take.id ? null : take.id)
                  }
                  onPlay={() => setPlayingId(take.id)}
                />
                {playingId !== take.id && (
                  <button
                    type="button"
                    onClick={() => setPlayingId(take.id)}
                    className="absolute inset-0 flex items-center justify-center bg-black/20 transition-colors hover:bg-black/40"
                  >
                    <div className="flex h-10 w-10 items-center justify-center rounded-full bg-white/20 backdrop-blur-sm">
                      <Play className="h-5 w-5 text-white ml-0.5" />
                    </div>
                  </button>
                )}
                {/* Hero badge */}
                {take.isHero && (
                  <Badge className="absolute left-2 top-2 bg-primary/90 text-[10px]">
                    <Star className="mr-1 h-2.5 w-2.5" />
                    Hero
                  </Badge>
                )}
                {/* Dry-run badge */}
                {params?.dryRun && (
                  <Badge
                    variant="outline"
                    className="absolute right-2 top-2 border-yellow-500/30 bg-black/50 text-yellow-500 text-[10px]"
                  >
                    Dry Run
                  </Badge>
                )}
              </div>

              {/* Info and actions */}
              <div className="p-3 space-y-2">
                {/* Metadata */}
                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                  {params?.quality && (
                    <Badge variant="secondary" className="text-[10px]">
                      {params.quality}
                    </Badge>
                  )}
                  {params?.generationTimeMs && (
                    <span className="flex items-center gap-1">
                      <Clock className="h-3 w-3" />
                      {(params.generationTimeMs / 1000).toFixed(1)}s
                    </span>
                  )}
                  <span>
                    {new Date(take.createdAt).toLocaleTimeString(undefined, {
                      hour: "2-digit",
                      minute: "2-digit",
                    })}
                  </span>
                </div>

                {/* Actions */}
                <div className="flex items-center gap-2">
                  {!take.isHero && (
                    <Button
                      size="sm"
                      variant="secondary"
                      className="flex-1"
                      onClick={() => handleSetHero(take.id)}
                      disabled={settingHero !== null || disabled}
                    >
                      {settingHero === take.id ? (
                        <Loader2 className="mr-1.5 h-3 w-3 animate-spin" />
                      ) : (
                        <Star className="mr-1.5 h-3 w-3" />
                      )}
                      Select Hero
                    </Button>
                  )}
                  {take.isHero && (
                    <div className="flex flex-1 items-center gap-1.5 text-xs text-primary">
                      <CheckCircle2 className="h-3.5 w-3.5" />
                      Selected as hero take
                    </div>
                  )}
                  <Button
                    size="icon-xs"
                    variant="ghost"
                    className="text-muted-foreground hover:text-destructive"
                    onClick={() => handleDelete(take.id)}
                    disabled={deleting !== null || disabled}
                  >
                    {deleting === take.id ? (
                      <Loader2 className="h-3 w-3 animate-spin" />
                    ) : (
                      <Trash2 className="h-3 w-3" />
                    )}
                  </Button>
                </div>
              </div>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
