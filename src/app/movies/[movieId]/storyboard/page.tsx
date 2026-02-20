"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { useParams, useRouter } from "next/navigation";
import {
  LayoutGrid,
  Sparkles,
  Loader2,
  ChevronRight,
  Plus,
  Coins,
  Clock,
  Film,
  AlertTriangle,
  Camera,
  Trash2,
  Pencil,
  RotateCcw,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { EmptyState } from "@/components/ui/empty-state";
import { ShotCard } from "@/components/movie/ShotCard";
import { CameraMovementBrowser } from "@/components/movie/CameraMovementBrowser";
import { PromptPreview } from "@/components/movie/PromptPreview";
import { getCreditCost } from "@/lib/constants/pricing";
import type { Script, ScriptScene, StyleBible } from "@/types/movie";
import type { ShotSuggestion } from "@/types/shot";
import type { CameraMovement } from "@/lib/constants/camera-movements";

// ─── Director Tips (rotating fun facts during generation) ───────

const DIRECTOR_TIPS = [
  "Hitchcock believed every shot should tell a story even without dialogue.",
  "A dolly push-in builds intimacy — the audience leans in with the camera.",
  "Dutch angles signal unease. Use sparingly for maximum impact.",
  "The 180-degree rule keeps your audience spatially oriented in dialogue scenes.",
  "Wide establishing shots give your audience a mental map of the scene.",
  "Roger Deakins prefers natural light sources — even in fantasy worlds.",
  "A rack focus is the cinematic equivalent of pointing at something.",
  "Tracking shots create energy — Kubrick used them to build dread.",
  "Slow motion isn't just for action — it can amplify any emotion.",
  "The best camera movement is the one the audience doesn't notice.",
  "Spielberg's face-reaction shots work because empathy is visual.",
  "Cut on action — the eye follows movement and forgives the edit.",
  "Low angles make characters powerful. High angles make them vulnerable.",
  "Film noir used shadows as characters — light is your invisible actor.",
];

function DirectorTips() {
  const [tipIndex, setTipIndex] = useState(
    () => Math.floor(Math.random() * DIRECTOR_TIPS.length)
  );
  const [fade, setFade] = useState(true);

  useEffect(() => {
    const interval = setInterval(() => {
      setFade(false);
      setTimeout(() => {
        setTipIndex((i) => (i + 1) % DIRECTOR_TIPS.length);
        setFade(true);
      }, 300);
    }, 4500);
    return () => clearInterval(interval);
  }, []);

  return (
    <div className="text-center">
      <p
        className={`text-xs text-muted-foreground/60 italic transition-opacity duration-300 ${
          fade ? "opacity-100" : "opacity-0"
        }`}
      >
        {DIRECTOR_TIPS[tipIndex]}
      </p>
    </div>
  );
}

// ─── Types ──────────────────────────────────────────────────────

interface ShotData {
  id?: string;
  sceneIndex: number;
  order: number;
  shotType: string;
  cameraMovement: string;
  subject: string;
  action: string;
  environment?: string | null;
  lighting?: string | null;
  dialogue?: {
    characterId: string;
    characterName: string;
    line: string;
    emotion: string;
  } | null;
  durationSeconds: number;
  generatedPrompt?: string | null;
  negativePrompt?: string | null;
  storyboardImageUrl?: string | null;
  status?: string;
  takes?: {
    id: string;
    thumbnailUrl: string | null;
    isHero: boolean;
    qualityScore: number | null;
  }[];
}

interface MovieData {
  id: string;
  title: string;
  genre: string | null;
  targetDuration: number | null;
  script: Script | null;
  styleBible: StyleBible | null;
  status: string;
}

interface CharacterData {
  id: string;
  name: string;
  visualDescription: string;
  referenceImages: string[];
}

// ─── Component ──────────────────────────────────────────────────

export default function StoryboardPage() {
  const params = useParams<{ movieId: string }>();
  const router = useRouter();

  const [movie, setMovie] = useState<MovieData | null>(null);
  const [shots, setShots] = useState<ShotData[]>([]);
  const [characters, setCharacters] = useState<CharacterData[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [genProgress, setGenProgress] = useState({
    current: 0,
    total: 0,
    sceneName: "",
    beatDescription: "",
    phase: "" as "" | "analyzing" | "planning" | "saving" | "done",
  });
  const [expandedShot, setExpandedShot] = useState<number | null>(null);
  const [cameraBrowserOpen, setCameraBrowserOpen] = useState(false);
  const [cameraBrowserTarget, setCameraBrowserTarget] = useState<number | null>(
    null
  );
  const [promptPreviewShot, setPromptPreviewShot] = useState<number | null>(
    null
  );
  const [sketchGenerating, setSketchGenerating] = useState<Set<number>>(
    new Set()
  );
  const [generatingAllSketches, setGeneratingAllSketches] = useState(false);
  const [sketchError, setSketchError] = useState<string | null>(null);
  const [regenConfirmOpen, setRegenConfirmOpen] = useState(false);
  const [scaleToFitOpen, setScaleToFitOpen] = useState(false);

  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const genAbortRef = useRef<AbortController | null>(null);
  const mountedRef = useRef(true);
  const shotsRef = useRef(shots);
  shotsRef.current = shots;

  // Clean up on unmount: abort any in-progress generation
  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
      genAbortRef.current?.abort();
    };
  }, []);

  // ─── Fetch data ────────────────────────────────────────────

  useEffect(() => {
    async function fetchAll() {
      try {
        const [movieRes, shotsRes, charsRes] = await Promise.all([
          fetch(`/api/movies/${params.movieId}`),
          fetch(`/api/shots?movieId=${params.movieId}`),
          fetch(`/api/characters?movieId=${params.movieId}`),
        ]);

        if (movieRes.ok) {
          const movieData = await movieRes.json();
          if (movieData.success) setMovie(movieData.data);
        }

        if (shotsRes.ok) {
          const shotsData = await shotsRes.json();
          if (shotsData.success) setShots(shotsData.data);
        }

        if (charsRes.ok) {
          const charsData = await charsRes.json();
          if (charsData.success) setCharacters(charsData.data);
        }
      } catch (error) {
        console.error("Failed to fetch storyboard data:", error);
      } finally {
        setLoading(false);
      }
    }
    fetchAll();
  }, [params.movieId]);

  // ─── Auto-generate shots from script ───────────────────────

  async function generateShotsFromScript() {
    if (!movie?.script?.scenes || generating) return;
    setGenerating(true);

    // Create an abort controller for this generation run
    const abortController = new AbortController();
    genAbortRef.current = abortController;

    const totalBeats = movie.script.scenes.reduce(
      (sum, s) => sum + s.beats.length,
      0
    );
    setGenProgress({ current: 0, total: totalBeats, sceneName: "", beatDescription: "", phase: "analyzing" });

    try {
      const generatedShots: ShotData[] = [];
      let order = 0;
      let beatIndex = 0;

      for (
        let sceneIndex = 0;
        sceneIndex < movie.script.scenes.length;
        sceneIndex++
      ) {
        const scene = movie.script.scenes[sceneIndex];
        for (const beat of scene.beats) {
          // Bail if aborted (user navigated away or cancelled)
          if (abortController.signal.aborted) return;

          beatIndex++;
          setGenProgress({
            current: beatIndex,
            total: totalBeats,
            sceneName: scene.title,
            beatDescription:
              beat.description.length > 80
                ? beat.description.slice(0, 80) + "..."
                : beat.description,
            phase: "planning",
          });

          // Get AI suggestion for each beat
          let suggestion: ShotSuggestion | null = null;
          try {
            const res = await fetch("/api/ai/suggest-shots", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                beat: {
                  description: beat.description,
                  emotionalTone: beat.emotionalTone,
                  dialogue: beat.dialogue,
                },
                genre: movie.genre ?? "drama",
                sceneContext: `${scene.title} — ${scene.location}, ${scene.timeOfDay}`,
                previousShotType:
                  generatedShots.length > 0
                    ? generatedShots[generatedShots.length - 1].shotType
                    : undefined,
              }),
              signal: abortController.signal,
            });

            if (res.ok) {
              const data = await res.json();
              if (data.success && data.data?.[0]) {
                suggestion = data.data[0];
              }
            }
          } catch (err) {
            // If aborted, exit cleanly
            if (err instanceof DOMException && err.name === "AbortError") return;
            // Fall through to defaults if AI suggestion fails
          }

          const shot: ShotData = {
            sceneIndex,
            order: order++,
            shotType: suggestion?.shotType ?? "medium",
            cameraMovement:
              suggestion?.promptSnippet ?? suggestion?.cameraMovement ?? "Static tripod, medium shot",
            subject: beat.description.split(".")[0] || beat.description,
            action: beat.description,
            environment: `${scene.location}, ${scene.timeOfDay}`,
            lighting: undefined,
            dialogue: beat.dialogue?.[0]
              ? {
                  characterId: "",
                  characterName: beat.dialogue[0].character,
                  line: beat.dialogue[0].line,
                  emotion: beat.dialogue[0].emotion,
                }
              : undefined,
            durationSeconds: suggestion?.durationRecommendation ?? 5,
            status: "DRAFT",
          };

          generatedShots.push(shot);
        }
      }

      // Bail if aborted before saving
      if (abortController.signal.aborted) return;

      // Saving phase
      setGenProgress((p) => ({ ...p, phase: "saving", beatDescription: "" }));

      // Bulk save shots
      const res = await fetch("/api/shots", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          movieId: params.movieId,
          shots: generatedShots,
        }),
        signal: abortController.signal,
      });

      const data = await res.json();
      if (res.ok && data.success) {
        if (mountedRef.current) setShots(data.data);
      } else {
        console.error("Bulk save failed:", data);
      }

      if (mountedRef.current) {
        setGenProgress((p) => ({ ...p, phase: "done" }));
      }
      // Brief delay to show "done" state before clearing
      await new Promise((r) => setTimeout(r, 800));
    } catch (error) {
      if (error instanceof DOMException && error.name === "AbortError") return;
      console.error("Failed to generate shots:", error);
    } finally {
      if (genAbortRef.current === abortController) {
        genAbortRef.current = null;
      }
      if (mountedRef.current) {
        setGenerating(false);
        setGenProgress({ current: 0, total: 0, sceneName: "", beatDescription: "", phase: "" });
      }
    }
  }

  // ─── Regenerate storyboard ─────────────────────────────────

  async function regenerateStoryboard() {
    setRegenConfirmOpen(false);

    // Abort any in-progress generation first
    genAbortRef.current?.abort();

    // Delete ALL shots (force=true) so old sketches don't persist
    try {
      await fetch(`/api/shots?movieId=${params.movieId}&force=true`, {
        method: "DELETE",
      });
    } catch (error) {
      console.error("Failed to delete existing shots:", error);
    }

    setShots([]);
    // Re-run the generation
    await generateShotsFromScript();
  }

  async function scaleToFitTarget() {
    if (!movie?.targetDuration || shots.length === 0) return;
    setScaleToFitOpen(false);

    const rawTotal = shots.reduce((s, sh) => s + sh.durationSeconds, 0);
    if (rawTotal === 0) return;

    const scale = movie.targetDuration / rawTotal;
    const updated = shots.map((shot) => {
      const maxDur = shot.cameraMovement?.includes("orbit") ? 12 : 10;
      const newDuration = Math.max(3, Math.min(maxDur, Math.round(shot.durationSeconds * scale)));
      return { ...shot, durationSeconds: newDuration };
    });

    setShots(updated);

    // Persist all duration changes
    setSaving(true);
    try {
      await Promise.all(
        updated.map((shot) =>
          shot.id
            ? fetch(`/api/shots/${shot.id}`, {
                method: "PATCH",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ durationSeconds: shot.durationSeconds }),
              })
            : Promise.resolve()
        )
      );
    } catch (error) {
      console.error("Failed to save scaled durations:", error);
    } finally {
      setSaving(false);
    }
  }

  const hasGeneratedShots = shots.some(
    (s) => s.status === "COMPLETE" || s.status === "GENERATING"
  );

  // ─── Shot CRUD ─────────────────────────────────────────────

  const debouncedSave = useCallback(
    (shotIndex: number, updates: Partial<ShotData>) => {
      if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
      saveTimerRef.current = setTimeout(async () => {
        // Read from ref to avoid stale closure over shots array
        const shot = shotsRef.current[shotIndex];
        if (!shot?.id) return;
        setSaving(true);
        try {
          await fetch(`/api/shots/${shot.id}`, {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(updates),
          });
        } catch (error) {
          console.error("Failed to save shot:", error);
        } finally {
          setSaving(false);
        }
      }, 1000);
    },
    []
  );

  function updateShot(index: number, updates: Partial<ShotData>) {
    setShots((prev) =>
      prev.map((s, i) => (i === index ? { ...s, ...updates } : s))
    );
    debouncedSave(index, updates);
  }

  async function addShot(sceneIndex: number) {
    const sceneShotCount = shots.filter(
      (s) => s.sceneIndex === sceneIndex
    ).length;
    const newShot: ShotData = {
      sceneIndex,
      order: shots.length,
      shotType: "medium",
      cameraMovement: "Static tripod, medium shot",
      subject: "",
      action: "",
      durationSeconds: 5,
      status: "DRAFT",
    };

    // Save immediately
    try {
      const res = await fetch("/api/shots", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          movieId: params.movieId,
          ...newShot,
        }),
      });

      if (res.ok) {
        const data = await res.json();
        if (data.success) {
          setShots((prev) => [...prev, data.data]);
          setExpandedShot(shots.length);
        }
      }
    } catch (error) {
      console.error("Failed to add shot:", error);
    }
  }

  async function deleteShot(index: number) {
    const shot = shots[index];
    if (shot?.id) {
      try {
        await fetch(`/api/shots/${shot.id}`, {
          method: "DELETE",
        });
      } catch (error) {
        console.error("Failed to delete shot:", error);
      }
    }
    setShots((prev) => prev.filter((_, i) => i !== index));
    if (expandedShot === index) setExpandedShot(null);
  }

  // ─── AI suggestion for a single shot ──────────────────────

  async function requestSuggestion(shotIndex: number) {
    const shot = shots[shotIndex];
    const scene = movie?.script?.scenes?.[shot.sceneIndex];
    if (!scene || !movie) return;

    try {
      const res = await fetch("/api/ai/suggest-shots", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          beat: {
            description: shot.action || shot.subject,
            emotionalTone: "neutral",
          },
          genre: movie.genre ?? "drama",
          sceneContext: `${scene.title} — ${scene.location}, ${scene.timeOfDay}`,
          previousShotType:
            shotIndex > 0 ? shots[shotIndex - 1].shotType : undefined,
        }),
      });

      if (res.ok) {
        const data = await res.json();
        if (data.success && data.data?.[0]) {
          const suggestion = data.data[0] as ShotSuggestion;
          updateShot(shotIndex, {
            shotType: suggestion.shotType,
            cameraMovement: suggestion.cameraMovement,
            durationSeconds: suggestion.durationRecommendation,
          });
        }
      }
    } catch (error) {
      console.error("Failed to get suggestion:", error);
    }
  }

  // ─── Camera browser handler ────────────────────────────────

  function openCameraBrowser(shotIndex: number) {
    setCameraBrowserTarget(shotIndex);
    setCameraBrowserOpen(true);
  }

  function handleCameraSelect(movement: CameraMovement) {
    if (cameraBrowserTarget !== null) {
      updateShot(cameraBrowserTarget, {
        cameraMovement: movement.promptSyntax,
      });
    }
  }

  // ─── Sketch generation ────────────────────────────────────

  async function generateSketch(index: number) {
    const shot = shots[index];
    if (!shot?.subject && !shot?.action) return;

    setSketchGenerating((prev) => new Set(prev).add(index));

    try {
      // Re-fetch characters to get the latest reference images
      // (user may have added images on the characters page after storyboard loaded)
      let latestCharacters = characters;
      try {
        const charRes = await fetch(`/api/characters?movieId=${params.movieId}`);
        if (charRes.ok) {
          const charData = await charRes.json();
          if (charData.success) {
            latestCharacters = charData.data;
            setCharacters(charData.data);
          }
        }
      } catch {
        // Fall back to cached characters
      }

      // Find characters mentioned in this shot's subject/action
      const shotText = `${shot.subject} ${shot.action}`.toLowerCase();
      const matchedCharacters = latestCharacters.filter(
        (c: CharacterData) => shotText.includes(c.name.toLowerCase())
      );

      // Check if any matched character has a reference image
      let referenceImageUrl: string | undefined;
      for (const c of matchedCharacters) {
        if (c.referenceImages && c.referenceImages.length > 0) {
          referenceImageUrl = c.referenceImages[0];
          break;
        }
      }

      // If no name-matched character had images, check all characters for images
      // (covers cases where shot text uses a nickname or abbreviation)
      if (!referenceImageUrl) {
        for (const c of latestCharacters) {
          if (c.referenceImages && c.referenceImages.length > 0) {
            referenceImageUrl = c.referenceImages[0];
            break;
          }
        }
      }

      // Build a clean prompt without duplications
      const promptParts: string[] = [];

      // Camera — use cameraMovement (already includes shot type info)
      if (shot.cameraMovement) {
        promptParts.push(shot.cameraMovement);
      } else if (shot.shotType) {
        promptParts.push(`${shot.shotType} shot`);
      }

      // Characters — only add text descriptions when there's NO reference image
      // (the image itself is the source of truth for appearance)
      if (!referenceImageUrl && matchedCharacters.length > 0) {
        const charDescs = matchedCharacters
          .map((c) => `${c.name}: ${c.visualDescription}`)
          .join(". ");
        promptParts.push(charDescs);
      }

      // Subject & action — avoid adding action if it's the same as subject
      if (shot.subject) promptParts.push(shot.subject);
      if (shot.action && shot.action !== shot.subject) {
        promptParts.push(shot.action);
      }

      if (shot.environment) promptParts.push(shot.environment);
      if (shot.lighting) promptParts.push(shot.lighting);

      const res = await fetch("/api/ai/generate-image", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          prompt: promptParts.join(". "),
          style: "sketch",
          aspectRatio: "landscape_4_3",
          referenceImageUrl,
        }),
      });

      const data = await res.json();
      if (res.ok && data.success && data.data?.imageUrl) {
        const imageUrl = data.data.imageUrl;
        setSketchError(null);

        // Update local state
        setShots((prev) =>
          prev.map((s, i) =>
            i === index ? { ...s, storyboardImageUrl: imageUrl } : s
          )
        );

        // Persist to DB
        if (shot.id) {
          await fetch(`/api/shots/${shot.id}`, {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ storyboardImageUrl: imageUrl }),
          });
        }
      } else {
        const errorMsg = data.error ?? `Sketch generation failed (${res.status})`;
        console.error("Sketch generation failed:", errorMsg);
        setSketchError(errorMsg);
      }
    } catch (error) {
      console.error("Failed to generate sketch:", error);
      setSketchError(error instanceof Error ? error.message : "Sketch generation failed");
    } finally {
      setSketchGenerating((prev) => {
        const next = new Set(prev);
        next.delete(index);
        return next;
      });
    }
  }

  async function generateAllSketches() {
    setGeneratingAllSketches(true);
    try {
      for (let i = 0; i < shots.length; i++) {
        if (!shots[i].storyboardImageUrl && (shots[i].subject || shots[i].action)) {
          await generateSketch(i);
        }
      }
    } finally {
      setGeneratingAllSketches(false);
    }
  }

  // ─── Proceed to Generate ───────────────────────────────────

  async function handleContinue() {
    await fetch(`/api/movies/${params.movieId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: "GENERATING" }),
    });
    router.push(`/movies/${params.movieId}/generate`);
  }

  // ─── Loading state ─────────────────────────────────────────

  if (loading) {
    return (
      <div className="flex h-full items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  // ─── No script yet ─────────────────────────────────────────

  if (!movie?.script?.scenes) {
    return (
      <EmptyState
        icon={<LayoutGrid className="h-7 w-7 text-primary" />}
        title="No Script Yet"
        description="Complete the Concept and Script phases first, then come back to plan your shots."
        action={
          <Button
            variant="secondary"
            onClick={() => router.push(`/movies/${params.movieId}`)}
          >
            Go to Concept
          </Button>
        }
      />
    );
  }

  // ─── Group shots by scene ──────────────────────────────────

  const scenes = movie.script.scenes;
  const shotsByScene = scenes.map((_, i) =>
    shots
      .map((shot, originalIndex) => ({ shot, originalIndex }))
      .filter(({ shot }) => shot.sceneIndex === i)
      .sort((a, b) => a.shot.order - b.shot.order)
  );

  // ─── Cost estimate ─────────────────────────────────────────

  const totalDuration = shots.reduce((sum, s) => sum + s.durationSeconds, 0);
  const estimatedCost = shots.reduce(
    (sum, s) => sum + getCreditCost("standard", s.durationSeconds),
    0
  );
  const draftCost = shots.reduce(
    (sum, s) => sum + getCreditCost("draft", s.durationSeconds),
    0
  );

  const hasEmptyShots = shots.some((s) => !s.subject.trim() || !s.action.trim());

  // ─── Render ────────────────────────────────────────────────

  return (
    <div className="flex h-full flex-col">
      {/* Header */}
      <div className="border-b border-border/50 px-6 py-4">
        <div className="flex items-center justify-between">
          <div>
            <div className="flex items-center gap-2">
              <LayoutGrid className="h-4 w-4 text-primary" />
              <h2 className="text-sm font-semibold">Storyboard</h2>
              <Badge variant="secondary" className="text-xs">
                {shots.length} shot{shots.length !== 1 ? "s" : ""}
              </Badge>
              {saving && (
                <span className="flex items-center gap-1 text-xs text-muted-foreground">
                  <Loader2 className="h-3 w-3 animate-spin" />
                  Saving...
                </span>
              )}
            </div>
            <p className="mt-1 text-xs text-muted-foreground">
              Plan every shot — camera, subject, action. Preview prompts before
              spending credits.
            </p>
          </div>

          <div className="flex items-center gap-3">
            {/* Cost estimate */}
            <Tooltip>
              <TooltipTrigger asChild>
                <div className="flex items-center gap-1.5 rounded-lg border border-border/50 bg-background px-3 py-1.5">
                  <Coins className="h-3.5 w-3.5 text-primary" />
                  <span className="text-xs font-medium">
                    ~{draftCost}–{estimatedCost} credits
                  </span>
                </div>
              </TooltipTrigger>
              <TooltipContent className="text-xs">
                Draft: ~{draftCost} credits / Standard: ~{estimatedCost}{" "}
                credits
              </TooltipContent>
            </Tooltip>

            {/* Duration budget bar */}
            <Tooltip>
              <TooltipTrigger asChild>
                <button
                  className="flex items-center gap-1.5 rounded-lg border border-border/50 bg-background px-3 py-1.5"
                  onClick={() => movie?.targetDuration && setScaleToFitOpen(true)}
                >
                  <Clock className="h-3.5 w-3.5 text-muted-foreground" />
                  {movie?.targetDuration ? (
                    <>
                      <div className="h-1.5 w-16 overflow-hidden rounded-full bg-muted">
                        <div
                          className={`h-full rounded-full transition-all ${
                            totalDuration <= (movie.targetDuration ?? Infinity)
                              ? "bg-green-500"
                              : totalDuration <= (movie.targetDuration ?? Infinity) * 1.2
                                ? "bg-amber-500"
                                : "bg-red-500"
                          }`}
                          style={{
                            width: `${Math.min(100, (totalDuration / (movie.targetDuration ?? totalDuration)) * 100)}%`,
                          }}
                        />
                      </div>
                      <span className="text-xs font-medium">
                        {totalDuration}s / {movie.targetDuration}s
                      </span>
                    </>
                  ) : (
                    <span className="text-xs text-muted-foreground">{totalDuration}s total</span>
                  )}
                </button>
              </TooltipTrigger>
              <TooltipContent className="text-xs">
                {movie?.targetDuration
                  ? totalDuration <= movie.targetDuration
                    ? `${movie.targetDuration - totalDuration}s under target`
                    : `${totalDuration - movie.targetDuration}s over target — click to scale to fit`
                  : "No target duration set"}
              </TooltipContent>
            </Tooltip>

            {shots.length > 0 && (
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setRegenConfirmOpen(true)}
                    disabled={generating}
                  >
                    <RotateCcw className="mr-1.5 h-3.5 w-3.5" />
                    Regenerate
                  </Button>
                </TooltipTrigger>
                <TooltipContent className="text-xs">
                  Delete all shots and re-plan from script
                </TooltipContent>
              </Tooltip>
            )}

            {shots.length > 0 && (
              <Button
                variant="outline"
                size="sm"
                onClick={generateAllSketches}
                disabled={generatingAllSketches || shots.every((s) => !!s.storyboardImageUrl)}
              >
                {generatingAllSketches ? (
                  <>
                    <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
                    Generating...
                  </>
                ) : (
                  <>
                    <Pencil className="mr-1.5 h-3.5 w-3.5" />
                    Generate All Sketches
                  </>
                )}
              </Button>
            )}

            <Button
              size="sm"
              onClick={handleContinue}
              disabled={shots.length === 0 || hasEmptyShots}
            >
              Continue to Generate
              <ChevronRight className="ml-1 h-4 w-4" />
            </Button>
          </div>
        </div>
      </div>

      {/* Empty state: generate from script */}
      {shots.length === 0 && !generating && (
        <EmptyState
          icon={<Sparkles className="h-7 w-7 text-primary" />}
          title="Generate Shot Plan"
          description={`Your script has ${scenes.length} scene${scenes.length !== 1 ? "s" : ""} with ${scenes.reduce((sum, s) => sum + s.beats.length, 0)} beats. The AI Director will suggest camera angles and movements for each beat.`}
          className="flex-1"
          action={
            <Button onClick={generateShotsFromScript}>
              <Sparkles className="mr-2 h-4 w-4" />
              Auto-generate shots from script
            </Button>
          }
        />
      )}

      {/* Generation progress overlay */}
      {generating && (
        <div className="flex flex-1 flex-col items-center justify-center gap-6 px-6">
          <div className="w-full max-w-lg space-y-6">
            {/* Animated film reel icon */}
            <div className="flex justify-center">
              <div className="relative flex h-20 w-20 items-center justify-center">
                <div className="absolute inset-0 rounded-full border-2 border-primary/20" />
                <div className="absolute inset-0 animate-spin rounded-full border-2 border-t-primary border-r-transparent border-b-transparent border-l-transparent [animation-duration:1.2s]" />
                <div className="absolute inset-2 animate-spin rounded-full border-2 border-t-transparent border-r-primary/60 border-b-transparent border-l-transparent [animation-direction:reverse] [animation-duration:1.8s]" />
                <Film className="h-8 w-8 text-primary" />
              </div>
            </div>

            {/* Phase title */}
            <div className="text-center">
              <h2 className="text-lg font-semibold">
                {genProgress.phase === "analyzing" && "Analyzing your script..."}
                {genProgress.phase === "planning" && "Planning shots..."}
                {genProgress.phase === "saving" && "Saving shot plan..."}
                {genProgress.phase === "done" && "Shot plan ready!"}
              </h2>
              {genProgress.sceneName && genProgress.phase === "planning" && (
                <p className="mt-1 text-sm text-muted-foreground">
                  Scene: <span className="text-foreground">{genProgress.sceneName}</span>
                </p>
              )}
            </div>

            {/* Progress bar */}
            {genProgress.total > 0 && (
              <div className="space-y-2">
                <div className="h-2 overflow-hidden rounded-full bg-muted">
                  <div
                    className="h-full rounded-full bg-primary transition-all duration-500 ease-out"
                    style={{
                      width: `${genProgress.phase === "done" ? 100 : genProgress.phase === "saving" ? 95 : (genProgress.current / genProgress.total) * 90}%`,
                    }}
                  />
                </div>
                <div className="flex items-center justify-between text-xs text-muted-foreground">
                  <span>
                    {genProgress.phase === "done"
                      ? "Complete!"
                      : genProgress.phase === "saving"
                        ? "Saving to database..."
                        : `Beat ${genProgress.current} of ${genProgress.total}`}
                  </span>
                  <span>
                    {genProgress.phase === "done"
                      ? "100%"
                      : `${Math.round(
                          genProgress.phase === "saving"
                            ? 95
                            : (genProgress.current / genProgress.total) * 90
                        )}%`}
                  </span>
                </div>
              </div>
            )}

            {/* Current beat being processed */}
            {genProgress.beatDescription && genProgress.phase === "planning" && (
              <div className="rounded-lg border border-border/50 bg-card/50 px-4 py-3">
                <p className="text-xs text-muted-foreground">
                  Suggesting camera &amp; framing for:
                </p>
                <p className="mt-1 text-sm italic text-foreground/80">
                  &ldquo;{genProgress.beatDescription}&rdquo;
                </p>
              </div>
            )}

            {/* Fun director tips that rotate */}
            <DirectorTips />

            {/* Cancel button */}
            <div className="flex justify-center">
              <Button
                variant="ghost"
                size="sm"
                className="text-xs text-muted-foreground hover:text-foreground"
                onClick={() => {
                  genAbortRef.current?.abort();
                  setGenerating(false);
                  setGenProgress({ current: 0, total: 0, sceneName: "", beatDescription: "", phase: "" });
                }}
              >
                Cancel generation
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Shot grid by scene */}
      {shots.length > 0 && (
        <div className="flex-1 overflow-y-auto px-6 py-4">
          <div className="mx-auto max-w-4xl space-y-6">
            {scenes.map((scene, sceneIndex) => (
              <div key={sceneIndex}>
                {/* Scene header */}
                <div className="mb-2 flex items-center gap-3">
                  <Badge
                    variant="outline"
                    className="text-[10px] text-muted-foreground"
                  >
                    Scene {sceneIndex + 1}
                  </Badge>
                  <span className="text-sm font-medium">{scene.title}</span>
                  <span className="text-xs text-muted-foreground">
                    {scene.location} — {scene.timeOfDay}
                  </span>
                  <div className="ml-auto">
                    <Badge variant="secondary" className="text-[10px]">
                      {shotsByScene[sceneIndex].length} shot
                      {shotsByScene[sceneIndex].length !== 1 ? "s" : ""}
                    </Badge>
                  </div>
                </div>

                {/* Shots for this scene */}
                <div className="space-y-2">
                  {shotsByScene[sceneIndex].map(
                    ({ shot, originalIndex }) => (
                      <div key={originalIndex}>
                        <ShotCard
                          shot={shot}
                          index={originalIndex}
                          isExpanded={expandedShot === originalIndex}
                          onToggleExpand={() =>
                            setExpandedShot(
                              expandedShot === originalIndex
                                ? null
                                : originalIndex
                            )
                          }
                          onChange={(updates) =>
                            updateShot(originalIndex, updates)
                          }
                          onDelete={() => deleteShot(originalIndex)}
                          onOpenCameraBrowser={() =>
                            openCameraBrowser(originalIndex)
                          }
                          onRequestSuggestion={() =>
                            requestSuggestion(originalIndex)
                          }
                          onGenerateSketch={() =>
                            generateSketch(originalIndex)
                          }
                          isGeneratingSketch={sketchGenerating.has(
                            originalIndex
                          )}
                          genre={movie?.genre}
                        />

                        {/* Inline prompt preview when expanded */}
                        {expandedShot === originalIndex && (
                          <div className="mt-2 ml-6">
                            <PromptPreview
                              shotType={shot.shotType}
                              cameraMovement={shot.cameraMovement}
                              subject={shot.subject}
                              action={shot.action}
                              environment={shot.environment}
                              lighting={shot.lighting}
                              styleBible={movie?.styleBible}
                              negativePrompt={shot.negativePrompt}
                              durationSeconds={shot.durationSeconds}
                              characterNames={characters.map((c) => c.name)}
                            />
                          </div>
                        )}
                      </div>
                    )
                  )}

                  {/* Add shot to scene */}
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-8 w-full border border-dashed border-border/50 text-xs text-muted-foreground hover:border-primary/30 hover:text-primary"
                    onClick={() => addShot(sceneIndex)}
                  >
                    <Plus className="mr-1 h-3 w-3" />
                    Add shot to {scene.title}
                  </Button>
                </div>
              </div>
            ))}

            {/* Sketch error */}
            {sketchError && (
              <div className="flex items-center gap-2 rounded-lg border border-red-500/20 bg-red-500/5 px-4 py-3">
                <AlertTriangle className="h-4 w-4 shrink-0 text-red-500" />
                <span className="text-sm text-red-400">{sketchError}</span>
                <button
                  onClick={() => setSketchError(null)}
                  className="ml-auto text-xs text-red-500/60 hover:text-red-400"
                >
                  Dismiss
                </button>
              </div>
            )}

            {/* Warnings */}
            {hasEmptyShots && (
              <div className="flex items-center gap-2 rounded-lg border border-yellow-500/20 bg-yellow-500/5 px-4 py-3">
                <AlertTriangle className="h-4 w-4 text-yellow-500" />
                <span className="text-sm text-yellow-500">
                  Some shots are missing subject or action descriptions. Fill
                  them in before generating.
                </span>
              </div>
            )}

            {/* Summary card */}
            <Card className="border-border bg-card/50 p-4">
              <div className="flex items-center justify-between">
                <div className="space-y-1">
                  <p className="text-sm font-medium">Generation Summary</p>
                  <div className="flex items-center gap-4 text-xs text-muted-foreground">
                    <span className="flex items-center gap-1">
                      <Film className="h-3 w-3" />
                      {shots.length} shots
                    </span>
                    <span className="flex items-center gap-1">
                      <Clock className="h-3 w-3" />
                      {totalDuration}s total
                    </span>
                    <span className="flex items-center gap-1">
                      <Camera className="h-3 w-3" />
                      {new Set(shots.map((s) => s.shotType)).size} shot types
                    </span>
                  </div>
                </div>
                <div className="text-right">
                  <div className="flex items-center gap-1.5">
                    <Coins className="h-4 w-4 text-primary" />
                    <span className="text-lg font-semibold">{draftCost}</span>
                    <span className="text-xs text-muted-foreground">
                      – {estimatedCost} credits
                    </span>
                  </div>
                  <p className="text-[10px] text-muted-foreground">
                    draft – standard quality
                  </p>
                </div>
              </div>
            </Card>

            <div className="h-8" />
          </div>
        </div>
      )}

      {/* Regenerate confirmation dialog */}
      <Dialog open={regenConfirmOpen} onOpenChange={setRegenConfirmOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <RotateCcw className="h-5 w-5 text-primary" />
              Regenerate Storyboard
            </DialogTitle>
            <DialogDescription>
              This will delete all {shots.length} shot(s) including any sketches and re-plan them from your script using AI suggestions.
              {hasGeneratedShots && " Generated video takes will be lost."}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setRegenConfirmOpen(false)}>
              Cancel
            </Button>
            <Button onClick={regenerateStoryboard}>
              <RotateCcw className="mr-1.5 h-4 w-4" />
              Regenerate
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Scale to fit dialog */}
      <Dialog open={scaleToFitOpen} onOpenChange={setScaleToFitOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Clock className="h-5 w-5 text-primary" />
              Scale to Target Duration
            </DialogTitle>
            <DialogDescription>
              Your storyboard is {totalDuration}s but your target is{" "}
              {movie?.targetDuration}s. Adjust all shot durations proportionally
              to fit?
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setScaleToFitOpen(false)}>
              Cancel
            </Button>
            <Button onClick={scaleToFitTarget}>Scale to fit</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Camera Movement Browser */}
      <CameraMovementBrowser
        open={cameraBrowserOpen}
        onClose={() => {
          setCameraBrowserOpen(false);
          setCameraBrowserTarget(null);
        }}
        onSelect={handleCameraSelect}
        currentMovementId={
          cameraBrowserTarget !== null
            ? shots[cameraBrowserTarget]?.cameraMovement
            : undefined
        }
      />
    </div>
  );
}
