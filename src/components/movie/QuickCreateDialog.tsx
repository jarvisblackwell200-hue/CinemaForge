"use client";

import { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { Sparkles, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";

interface QuickCreateDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const DURATION_OPTIONS = [
  { value: 30, label: "30s" },
  { value: 60, label: "60s" },
  { value: 120, label: "2min" },
  { value: 180, label: "3min" },
] as const;

const LOADING_PHASES = [
  "Writing script...",
  "Casting characters...",
  "Planning shots...",
  "Assembling prompts...",
];

const PHASE_INTERVAL_MS = 4000;

export function QuickCreateDialog({ open, onOpenChange }: QuickCreateDialogProps) {
  const router = useRouter();
  const [concept, setConcept] = useState("");
  const [duration, setDuration] = useState(60);
  const [isCreating, setIsCreating] = useState(false);
  const [loadingPhase, setLoadingPhase] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const phaseInterval = useRef<ReturnType<typeof setInterval> | null>(null);

  // Cycle through loading phases
  useEffect(() => {
    if (isCreating) {
      setLoadingPhase(0);
      phaseInterval.current = setInterval(() => {
        setLoadingPhase((prev) =>
          prev < LOADING_PHASES.length - 1 ? prev + 1 : prev
        );
      }, PHASE_INTERVAL_MS);
    } else {
      if (phaseInterval.current) {
        clearInterval(phaseInterval.current);
        phaseInterval.current = null;
      }
    }
    return () => {
      if (phaseInterval.current) clearInterval(phaseInterval.current);
    };
  }, [isCreating]);

  async function handleSubmit() {
    if (concept.trim().length < 10) return;
    setIsCreating(true);
    setError(null);

    try {
      const res = await fetch("/api/ai/quick-create", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          concept: concept.trim(),
          targetDuration: duration,
        }),
      });

      const json = await res.json();

      if (json.success) {
        onOpenChange(false);
        router.push(`/movies/${json.data.movieId}/generate`);
      } else {
        setError(json.error ?? "Something went wrong. Please try again.");
      }
    } catch {
      setError("Network error. Please check your connection and try again.");
    } finally {
      setIsCreating(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={isCreating ? undefined : onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-amber-500" />
            Quick Create
          </DialogTitle>
          <DialogDescription>
            Describe your movie idea and we&apos;ll auto-generate the script,
            characters, and shot plan in one step.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div>
            <label
              htmlFor="quick-concept"
              className="mb-2 block text-sm font-medium"
            >
              Movie concept
            </label>
            <Textarea
              id="quick-concept"
              value={concept}
              onChange={(e) => setConcept(e.target.value)}
              placeholder="A noir detective finds a mysterious letter that leads to a hidden speakeasy beneath the city..."
              className="min-h-24 resize-none"
              disabled={isCreating}
              onKeyDown={(e) => {
                if (e.key === "Enter" && e.metaKey && concept.trim().length >= 10) {
                  handleSubmit();
                }
              }}
            />
            <p className="mt-1 text-xs text-muted-foreground">
              Be descriptive — the more detail, the better the result.
            </p>
          </div>

          <div>
            <label className="mb-2 block text-sm font-medium">
              Target duration
            </label>
            <div className="flex gap-2">
              {DURATION_OPTIONS.map((opt) => (
                <button
                  key={opt.value}
                  onClick={() => setDuration(opt.value)}
                  disabled={isCreating}
                  className={`flex-1 rounded-md border px-3 py-2 text-sm font-medium transition-all ${
                    duration === opt.value
                      ? "border-primary bg-primary/10 text-primary"
                      : "border-border hover:border-primary/30"
                  } disabled:opacity-50`}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          </div>

          {error && (
            <div className="rounded-md border border-red-500/20 bg-red-500/10 px-3 py-2 text-sm text-red-400">
              {error}
            </div>
          )}

          {isCreating ? (
            <div className="flex flex-col items-center gap-3 py-4">
              <Loader2 className="h-6 w-6 animate-spin text-amber-500" />
              <p className="text-sm font-medium text-amber-500">
                {LOADING_PHASES[loadingPhase]}
              </p>
              <p className="text-xs text-muted-foreground">
                This usually takes 15-20 seconds
              </p>
            </div>
          ) : (
            <Button
              onClick={handleSubmit}
              disabled={concept.trim().length < 10}
              className="w-full"
            >
              <Sparkles className="mr-2 h-4 w-4" />
              {error ? "Try Again" : "Create Movie"}
            </Button>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
