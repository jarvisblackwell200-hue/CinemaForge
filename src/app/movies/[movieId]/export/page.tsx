"use client";

import { useState, useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
import {
  Download,
  Loader2,
  Film,
  Clock,
  HardDrive,
  CheckCircle2,
  ArrowLeft,
  ExternalLink,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

// ─── Types ──────────────────────────────────────────────────────

interface MovieExportData {
  id: string;
  title: string;
  genre: string | null;
  status: string;
  targetDuration: number;
  timeline: {
    exportedUrl: string | null;
    orderedShotIds: string[];
  } | null;
  _count: { shots: number };
}

// ─── Component ──────────────────────────────────────────────────

export default function ExportPage() {
  const params = useParams<{ movieId: string }>();
  const router = useRouter();

  const [movie, setMovie] = useState<MovieExportData | null>(null);
  const [loading, setLoading] = useState(true);
  const [downloading, setDownloading] = useState(false);

  // ─── Fetch movie data ────────────────────────────────────

  useEffect(() => {
    async function fetchMovie() {
      try {
        const res = await fetch(`/api/movies/${params.movieId}`);
        if (res.ok) {
          const json = await res.json();
          if (json.success) setMovie(json.data);
        }
      } catch (error) {
        console.error("Failed to fetch movie:", error);
      } finally {
        setLoading(false);
      }
    }
    fetchMovie();
  }, [params.movieId]);

  // ─── Download handler ────────────────────────────────────

  async function handleDownload() {
    if (!movie?.timeline?.exportedUrl) return;
    setDownloading(true);

    try {
      const res = await fetch(movie.timeline.exportedUrl);
      if (!res.ok) throw new Error("Download failed");

      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `${movie.title.replace(/[^a-zA-Z0-9-_ ]/g, "")}.mp4`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (error) {
      console.error("Download failed:", error);
    } finally {
      setDownloading(false);
    }
  }

  // ─── Format file size ────────────────────────────────────

  function formatSize(bytes: number): string {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  }

  // ─── Loading ─────────────────────────────────────────────

  if (loading) {
    return (
      <div className="flex h-full items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  // ─── No assembled movie ──────────────────────────────────

  if (!movie?.timeline?.exportedUrl) {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-4 px-6 text-center">
        <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-primary/10">
          <Download className="h-7 w-7 text-primary" />
        </div>
        <h2 className="text-xl font-semibold">No Export Available</h2>
        <p className="max-w-md text-sm text-muted-foreground">
          Assemble your shots on the timeline first, then come back here to
          download the finished movie.
        </p>
        <Button
          variant="secondary"
          onClick={() => router.push(`/movies/${params.movieId}/timeline`)}
        >
          <ArrowLeft className="mr-2 h-4 w-4" />
          Go to Timeline
        </Button>
      </div>
    );
  }

  // ─── Render ──────────────────────────────────────────────

  const exportUrl = movie.timeline.exportedUrl;
  const shotCount = movie.timeline.orderedShotIds?.length ?? movie._count.shots;

  return (
    <div className="flex h-full flex-col">
      {/* Header */}
      <div className="border-b border-border/50 px-6 py-4">
        <div className="flex items-center justify-between">
          <div>
            <div className="flex items-center gap-2">
              <Download className="h-4 w-4 text-primary" />
              <h2 className="text-sm font-semibold">Export</h2>
              {movie.status === "COMPLETE" && (
                <Badge variant="secondary" className="bg-green-500/10 text-green-400 text-xs">
                  <CheckCircle2 className="mr-1 h-3 w-3" />
                  Complete
                </Badge>
              )}
            </div>
            <p className="mt-1 text-xs text-muted-foreground">
              Preview and download your finished short film.
            </p>
          </div>

          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" asChild>
              <a href={exportUrl} target="_blank" rel="noopener noreferrer">
                <ExternalLink className="mr-1.5 h-3.5 w-3.5" />
                Open in New Tab
              </a>
            </Button>
            <Button size="sm" onClick={handleDownload} disabled={downloading}>
              {downloading ? (
                <>
                  <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
                  Downloading...
                </>
              ) : (
                <>
                  <Download className="mr-1.5 h-3.5 w-3.5" />
                  Download MP4
                </>
              )}
            </Button>
          </div>
        </div>
      </div>

      {/* Video preview */}
      <div className="flex-1 overflow-y-auto px-6 py-6">
        <div className="mx-auto max-w-4xl space-y-6">
          {/* Main video player */}
          <Card className="overflow-hidden border-border/50 bg-black">
            <video
              src={exportUrl}
              controls
              className="mx-auto w-full"
              style={{ maxHeight: "60vh" }}
            />
          </Card>

          {/* Movie info */}
          <Card className="border-border/50 p-4">
            <h3 className="text-lg font-semibold">{movie.title}</h3>
            <div className="mt-3 flex flex-wrap items-center gap-4 text-sm text-muted-foreground">
              {movie.genre && (
                <span className="flex items-center gap-1.5">
                  <Film className="h-4 w-4" />
                  {movie.genre.charAt(0).toUpperCase() + movie.genre.slice(1)}
                </span>
              )}
              <span className="flex items-center gap-1.5">
                <Clock className="h-4 w-4" />
                {movie.targetDuration}s target
              </span>
              <span className="flex items-center gap-1.5">
                <HardDrive className="h-4 w-4" />
                {shotCount} shots
              </span>
            </div>
          </Card>

          {/* Re-assemble option */}
          <div className="flex items-center justify-between rounded-lg border border-border/50 bg-card/50 px-4 py-3">
            <div>
              <p className="text-sm font-medium">Need changes?</p>
              <p className="text-xs text-muted-foreground">
                Go back to the timeline to adjust transitions or regenerate individual shots.
              </p>
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={() => router.push(`/movies/${params.movieId}/timeline`)}
            >
              <ArrowLeft className="mr-1.5 h-3.5 w-3.5" />
              Back to Timeline
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
