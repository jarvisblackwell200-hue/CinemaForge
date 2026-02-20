"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { Plus, Film, Clock, Clapperboard, Sparkles, Loader2, AlertCircle, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Header } from "@/components/layout/Header";
import { QuickCreateDialog } from "@/components/movie/QuickCreateDialog";

interface MovieSummary {
  id: string;
  title: string;
  genre: string | null;
  status: string;
  synopsis: string | null;
  targetDuration: number;
  updatedAt: string;
  _count: { shots: number; characters: number };
}

const STATUS_LABELS: Record<string, string> = {
  CONCEPT: "Concept",
  SCRIPTING: "Scripting",
  CHARACTERS: "Characters",
  STORYBOARDING: "Storyboarding",
  GENERATING: "Generating",
  ASSEMBLING: "Assembling",
  COMPLETE: "Complete",
};

const STATUS_COLORS: Record<string, string> = {
  CONCEPT: "bg-muted text-muted-foreground border border-border",
  SCRIPTING: "bg-blue-500/10 text-blue-400 border border-blue-500/20",
  CHARACTERS: "bg-purple-500/10 text-purple-400 border border-purple-500/20",
  STORYBOARDING: "bg-amber-500/10 text-amber-400 border border-amber-500/20",
  GENERATING: "bg-orange-500/10 text-orange-400 border border-orange-500/20",
  ASSEMBLING: "bg-cyan-500/10 text-cyan-400 border border-cyan-500/20",
  COMPLETE: "bg-green-500/10 text-green-400 border border-green-500/20",
};

const GENRE_GRADIENTS: Record<string, string> = {
  noir: "from-slate-800 to-teal-900",
  scifi: "from-blue-900 to-indigo-900",
  horror: "from-gray-900 to-green-950",
  commercial: "from-amber-900 to-orange-900",
  documentary: "from-stone-800 to-stone-900",
};

function formatTimeAgo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const minutes = Math.floor(diff / 60000);
  if (minutes < 1) return "just now";
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}

export default function MoviesPage() {
  const [movies, setMovies] = useState<MovieSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [quickCreateOpen, setQuickCreateOpen] = useState(false);

  const fetchMovies = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/movies");
      const json = await res.json();
      if (!res.ok || !json.success) {
        setError(json.error ?? "Failed to load movies");
        return;
      }
      setMovies(json.data);
    } catch {
      setError("Failed to connect to server");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchMovies();
  }, [fetchMovies]);

  return (
    <div className="flex min-h-screen flex-col">
      <Header />
      <main className="flex-1 px-6 py-8">
        <div className="mx-auto max-w-6xl">
          <div className="mb-8 flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold tracking-tight">Your Movies</h1>
              <p className="mt-1 text-sm text-muted-foreground">
                Create and manage your AI film projects
              </p>
            </div>
            <div className="flex gap-2">
              <Button variant="outline" onClick={() => setQuickCreateOpen(true)}>
                <Sparkles className="mr-2 h-4 w-4" />
                Quick Create
              </Button>
              <Button asChild>
                <Link href="/movies/new">
                  <Plus className="mr-2 h-4 w-4" />
                  New Movie
                </Link>
              </Button>
            </div>
          </div>

          {loading ? (
            <div className="flex flex-col items-center justify-center py-24">
              <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
              <p className="mt-4 text-sm text-muted-foreground">Loading your movies...</p>
            </div>
          ) : error ? (
            <div className="flex flex-col items-center justify-center rounded-xl border border-destructive/30 py-24">
              <AlertCircle className="h-8 w-8 text-destructive" />
              <p className="mt-4 text-sm text-destructive">{error}</p>
              <Button variant="outline" size="sm" className="mt-4" onClick={fetchMovies}>
                <RefreshCw className="mr-2 h-3 w-3" />
                Retry
              </Button>
            </div>
          ) : movies.length === 0 ? (
            <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-border py-24">
              <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-primary/10">
                <Clapperboard className="h-8 w-8 text-primary" />
              </div>
              <h2 className="mb-2 text-lg font-semibold">
                Create your first movie
              </h2>
              <p className="mb-6 max-w-sm text-center text-sm text-muted-foreground">
                Describe your movie idea and let the AI Director help you plan
                every shot, choose camera angles, and build your short film.
              </p>
              <div className="flex gap-3">
                <Button variant="outline" onClick={() => setQuickCreateOpen(true)}>
                  <Sparkles className="mr-2 h-4 w-4" />
                  Quick Create
                </Button>
                <Button asChild>
                  <Link href="/movies/new">
                    <Plus className="mr-2 h-4 w-4" />
                    Start creating
                  </Link>
                </Button>
              </div>
            </div>
          ) : (
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {movies.map((movie) => (
                <Link key={movie.id} href={`/movies/${movie.id}`}>
                  <Card className="group cursor-pointer overflow-hidden border-border/50 transition-all hover:border-primary/30 hover:shadow-lg hover:shadow-primary/5">
                    <div
                      className={`h-32 bg-gradient-to-br ${
                        GENRE_GRADIENTS[movie.genre ?? ""] ??
                        "from-zinc-800 to-zinc-900"
                      } flex items-end p-4`}
                    >
                      <Film className="h-6 w-6 text-white/30" />
                    </div>
                    <div className="p-4">
                      <div className="mb-2 flex items-center justify-between">
                        <h3 className="font-semibold tracking-tight group-hover:text-primary">
                          {movie.title}
                        </h3>
                        <Badge
                          variant="secondary"
                          className={STATUS_COLORS[movie.status]}
                        >
                          {STATUS_LABELS[movie.status]}
                        </Badge>
                      </div>
                      {movie.synopsis && (
                        <p className="mb-3 line-clamp-2 text-xs text-muted-foreground">
                          {movie.synopsis}
                        </p>
                      )}
                      <div className="flex items-center gap-3 text-xs text-muted-foreground">
                        <span className="flex items-center gap-1">
                          <Clock className="h-3 w-3" />
                          {movie.targetDuration}s
                        </span>
                        {movie._count.shots > 0 && (
                          <span>{movie._count.shots} shots</span>
                        )}
                        {movie._count.characters > 0 && (
                          <span>{movie._count.characters} characters</span>
                        )}
                        <span className="ml-auto">
                          {formatTimeAgo(movie.updatedAt)}
                        </span>
                      </div>
                    </div>
                  </Card>
                </Link>
              ))}
            </div>
          )}
        </div>
      </main>
      <QuickCreateDialog open={quickCreateOpen} onOpenChange={(open) => {
        setQuickCreateOpen(open);
        if (!open) fetchMovies();
      }} />
    </div>
  );
}
