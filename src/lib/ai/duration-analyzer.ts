import type { ScriptAnalysis } from "@/types/movie";
import { getDurationBias } from "./shot-planner";

export interface DurationAnalysis {
  /** What this story naturally needs (seconds) */
  optimalDuration: number;
  /** Compressed to minimum viable durations */
  minViableDuration: number;
  /** Let everything breathe */
  maxComfortDuration: number;
  /** Per-scene breakdown */
  breakdown: {
    sceneIndex: number;
    beats: number;
    hasDialogue: boolean;
    estimatedSeconds: number;
  }[];
  /** 0–100: how well targetDuration fits the story */
  fitScore: number;
  /** Human-readable advice when fitScore < 70 */
  suggestion: string | null;
}

/**
 * Analyze how well a target duration fits a story's natural length.
 * Pure function — no side effects.
 */
export function analyzeDuration(
  analysis: ScriptAnalysis,
  targetDuration: number,
): DurationAnalysis {
  const breakdown: DurationAnalysis["breakdown"] = [];

  let totalOptimal = 0;

  for (let sceneIdx = 0; sceneIdx < analysis.scenes.length; sceneIdx++) {
    const scene = analysis.scenes[sceneIdx];
    let sceneSeconds = 0;
    let hasDialogue = false;

    for (const beat of scene.beats) {
      const beatHasDialogue = Array.isArray(beat.dialogue) && beat.dialogue.length > 0;
      if (beatHasDialogue) hasDialogue = true;

      // Base: 5s for visual beats, 7s for dialogue beats
      const base = beatHasDialogue ? 7 : 5;
      const bias = getDurationBias(beat.emotionalTone);
      sceneSeconds += base + bias;
    }

    totalOptimal += sceneSeconds;
    breakdown.push({
      sceneIndex: sceneIdx,
      beats: scene.beats.length,
      hasDialogue,
      estimatedSeconds: Math.round(sceneSeconds),
    });
  }

  const optimalDuration = Math.round(totalOptimal);
  const minViableDuration = Math.round(totalOptimal * 0.6);
  const maxComfortDuration = Math.round(totalOptimal * 1.4);

  // fitScore: 100 if within ±15% of optimal, scales down linearly outside
  let fitScore: number;
  if (optimalDuration === 0) {
    fitScore = targetDuration === 0 ? 100 : 0;
  } else {
    const deviation = Math.abs(targetDuration - optimalDuration) / optimalDuration;
    if (deviation <= 0.15) {
      fitScore = 100;
    } else {
      // Linear falloff: at 2× deviation (100% off), score = 0
      fitScore = Math.max(0, Math.round(100 * (1 - (deviation - 0.15) / 0.85)));
    }
  }

  // Generate suggestion when fitScore < 70
  let suggestion: string | null = null;
  if (fitScore < 70 && optimalDuration > 0) {
    const totalBeats = analysis.scenes.reduce((sum, s) => sum + s.beats.length, 0);
    const dialogueBeats = analysis.scenes.reduce(
      (sum, s) => sum + s.beats.filter((b) => Array.isArray(b.dialogue) && b.dialogue.length > 0).length,
      0,
    );

    const beatInfo = dialogueBeats > 0
      ? `${totalBeats} beats (${dialogueBeats} with dialogue)`
      : `${totalBeats} beats`;

    if (targetDuration < optimalDuration) {
      const formatDuration = (s: number) => s >= 120 ? `${Math.round(s / 60)} minutes` : `${s}s`;
      suggestion = `Your story has ${beatInfo} — it naturally fits ~${optimalDuration}s. Consider trimming ${Math.max(1, Math.round((optimalDuration - targetDuration) / 7))} scene beats or extending to ${formatDuration(optimalDuration)}.`;
    } else {
      suggestion = `Your story has ${beatInfo} — it naturally fits ~${optimalDuration}s. Consider adding more scenes or beats to fill ${targetDuration}s, or reducing the target.`;
    }
  }

  return {
    optimalDuration,
    minViableDuration,
    maxComfortDuration,
    breakdown,
    fitScore,
    suggestion,
  };
}
