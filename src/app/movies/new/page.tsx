"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowRight, Film, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Separator } from "@/components/ui/separator";
import { Header } from "@/components/layout/Header";
import { QuickCreateDialog } from "@/components/movie/QuickCreateDialog";

const DURATION_OPTIONS = [
  { value: 30, label: "30s" },
  { value: 60, label: "60s" },
  { value: 120, label: "2min" },
  { value: 180, label: "3min" },
] as const;

const GENRE_OPTIONS = [
  { id: "noir", label: "Film Noir", gradient: "from-slate-800 to-teal-900" },
  { id: "scifi", label: "Sci-Fi", gradient: "from-blue-900 to-indigo-900" },
  { id: "horror", label: "Horror", gradient: "from-gray-900 to-green-950" },
  {
    id: "commercial",
    label: "Commercial",
    gradient: "from-amber-900 to-orange-900",
  },
  {
    id: "documentary",
    label: "Documentary",
    gradient: "from-stone-800 to-stone-900",
  },
  { id: "custom", label: "Custom", gradient: "from-zinc-800 to-zinc-900" },
] as const;

export default function NewMoviePage() {
  const router = useRouter();
  const [title, setTitle] = useState("");
  const [genre, setGenre] = useState<string | null>(null);
  const [duration, setDuration] = useState(60);
  const [isCreating, setIsCreating] = useState(false);
  const [quickCreateOpen, setQuickCreateOpen] = useState(false);

  async function handleCreate() {
    if (!title.trim()) return;
    setIsCreating(true);

    try {
      const res = await fetch("/api/movies", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: title.trim(),
          genre: genre === "custom" ? null : genre,
          targetDuration: duration,
        }),
      });

      const json = await res.json();
      if (json.success) {
        router.push(`/movies/${json.data.id}`);
      }
    } catch (error) {
      console.error("Failed to create movie:", error);
    } finally {
      setIsCreating(false);
    }
  }

  return (
    <div className="flex min-h-screen flex-col">
      <Header />
      <main className="flex flex-1 items-center justify-center px-6">
        <div className="w-full max-w-lg">
          <div className="mb-8 text-center">
            <div className="mb-4 inline-flex h-14 w-14 items-center justify-center rounded-2xl bg-primary/10">
              <Film className="h-7 w-7 text-primary" />
            </div>
            <h1 className="text-2xl font-bold tracking-tight">
              Start a new movie
            </h1>
            <p className="mt-2 text-sm text-muted-foreground">
              Give it a title and optionally pick a genre. You&apos;ll describe
              your full idea in the next step.
            </p>
          </div>

          <div className="space-y-6">
            <div>
              <label
                htmlFor="title"
                className="mb-2 block text-sm font-medium"
              >
                Movie title
              </label>
              <Input
                id="title"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="The Last Signal"
                className="h-12 text-base"
                autoFocus
                onKeyDown={(e) => {
                  if (e.key === "Enter" && title.trim()) handleCreate();
                }}
              />
            </div>

            <div>
              <label className="mb-3 block text-sm font-medium">
                Genre{" "}
                <span className="text-muted-foreground">(optional)</span>
              </label>
              <div className="grid grid-cols-3 gap-2">
                {GENRE_OPTIONS.map((g) => (
                  <button
                    key={g.id}
                    onClick={() => setGenre(genre === g.id ? null : g.id)}
                    className={`flex flex-col items-center gap-2 rounded-lg border p-3 text-xs font-medium transition-all ${
                      genre === g.id
                        ? "border-primary bg-primary/10 text-primary"
                        : "border-border hover:border-primary/30"
                    }`}
                  >
                    <div
                      className={`h-8 w-full rounded bg-gradient-to-br ${g.gradient}`}
                    />
                    {g.label}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <label className="mb-2 block text-sm font-medium">
                Target Length
              </label>
              <p className="mb-3 text-xs text-muted-foreground">
                How long should your film be?
              </p>
              <div className="flex gap-2">
                {DURATION_OPTIONS.map((opt) => (
                  <button
                    key={opt.value}
                    onClick={() => setDuration(opt.value)}
                    className={`flex-1 rounded-md border px-3 py-2 text-sm font-medium transition-all ${
                      duration === opt.value
                        ? "border-primary bg-primary/10 text-primary"
                        : "border-border hover:border-primary/30"
                    }`}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
            </div>

            <Button
              onClick={handleCreate}
              disabled={!title.trim() || isCreating}
              className="h-12 w-full text-base"
            >
              {isCreating ? (
                "Creating..."
              ) : (
                <>
                  Start creating
                  <ArrowRight className="ml-2 h-4 w-4" />
                </>
              )}
            </Button>

            <div className="flex items-center gap-3">
              <Separator className="flex-1" />
              <span className="text-xs text-muted-foreground">or</span>
              <Separator className="flex-1" />
            </div>

            <Button
              variant="outline"
              onClick={() => setQuickCreateOpen(true)}
              className="h-12 w-full text-base"
            >
              <Sparkles className="mr-2 h-4 w-4" />
              Quick Create from concept
            </Button>
          </div>
        </div>
      </main>
      <QuickCreateDialog open={quickCreateOpen} onOpenChange={setQuickCreateOpen} />
    </div>
  );
}
