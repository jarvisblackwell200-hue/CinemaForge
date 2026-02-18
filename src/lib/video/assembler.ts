/**
 * Video assembly pipeline using FFmpeg.
 *
 * Takes an ordered list of video clips (hero takes), applies transitions,
 * concatenates them, and exports a final MP4. The output is uploaded to
 * Supabase storage and its public URL is returned.
 *
 * ## Pipeline:
 * 1. Download all hero takes to a temp directory
 * 2. Create an FFmpeg concat file listing all clips
 * 3. Apply transitions (cut = direct concat, crossfade = xfade filter)
 * 4. Export as MP4 (H.264 video, AAC audio)
 * 5. Upload to Supabase storage
 * 6. Clean up temp files
 */

import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { createClient } from "@supabase/supabase-js";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { writeFile, readFile, mkdir, unlink, readdir } from "node:fs/promises";

const execFileAsync = promisify(execFile);

const EXPORT_BUCKET = "exports";

export interface AssemblyClip {
  videoUrl: string;
  durationSeconds: number;
}

export type TransitionType = "cut" | "crossfade" | "fade-black";

export interface AssemblyTransition {
  type: TransitionType;
  durationMs: number; // only used for crossfade/fade-black
}

export interface AssemblyOptions {
  clips: AssemblyClip[];
  transitions?: AssemblyTransition[]; // length = clips.length - 1
  outputName?: string; // filename prefix
}

export interface AssemblyResult {
  videoUrl: string;
  fileSize: number;
  durationSeconds: number;
}

function getSupabase() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL ?? process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SECRET_KEY ?? process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error("Supabase not configured");
  return createClient(url, key, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}

/**
 * Download a video from a URL to a local path.
 */
async function downloadVideo(url: string, destPath: string): Promise<void> {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Failed to download video: ${res.status}`);
  const buffer = Buffer.from(await res.arrayBuffer());
  await writeFile(destPath, buffer);
}

/**
 * Assemble clips using simple concatenation (no transitions / cut-only).
 * Uses FFmpeg's concat demuxer for fast, lossless-ish concatenation.
 */
async function concatClips(
  clipPaths: string[],
  outputPath: string,
  workDir: string,
): Promise<void> {
  // Create concat file
  const concatFile = join(workDir, "concat.txt");
  const lines = clipPaths.map((p) => `file '${p}'`).join("\n");
  await writeFile(concatFile, lines);

  await execFileAsync("ffmpeg", [
    "-f", "concat",
    "-safe", "0",
    "-i", concatFile,
    "-c", "copy",
    "-movflags", "+faststart",
    "-y",
    outputPath,
  ], { timeout: 300_000 }); // 5 min timeout
}

/**
 * Assemble clips with crossfade transitions using the xfade filter.
 */
async function concatWithTransitions(
  clipPaths: string[],
  transitions: AssemblyTransition[],
  clipDurations: number[],
  outputPath: string,
): Promise<void> {
  if (clipPaths.length < 2) {
    throw new Error("Need at least 2 clips for transitions");
  }

  // Build complex filter for xfade transitions
  const inputs: string[] = [];
  for (const path of clipPaths) {
    inputs.push("-i", path);
  }

  const filters: string[] = [];
  let prevLabel = "[0:v]";
  let offsetAccum = 0;

  for (let i = 0; i < transitions.length; i++) {
    const t = transitions[i];
    const nextLabel = `[${i + 1}:v]`;
    const outLabel = i < transitions.length - 1 ? `[v${i}]` : "[outv]";

    const transitionDur = t.type === "cut" ? 0 : t.durationMs / 1000;
    offsetAccum += clipDurations[i] - transitionDur;

    if (t.type === "cut") {
      // For cut transitions, just concatenate without xfade
      filters.push(
        `${prevLabel}${nextLabel}concat=n=2:v=1:a=0${outLabel}`,
      );
    } else {
      const xfadeTransition = t.type === "fade-black" ? "fade" : "fade";
      filters.push(
        `${prevLabel}${nextLabel}xfade=transition=${xfadeTransition}:duration=${transitionDur}:offset=${offsetAccum}${outLabel}`,
      );
    }

    prevLabel = outLabel;
  }

  const args = [
    ...inputs,
    "-filter_complex", filters.join(";"),
    "-map", "[outv]",
    "-c:v", "libx264",
    "-preset", "medium",
    "-crf", "23",
    "-movflags", "+faststart",
    "-y",
    outputPath,
  ];

  await execFileAsync("ffmpeg", args, { timeout: 300_000 });
}

/**
 * Assemble a sequence of video clips into a single movie.
 *
 * Downloads each clip, applies transitions, and exports as MP4.
 * The final video is uploaded to Supabase and a public URL is returned.
 */
export async function assembleMovie(
  options: AssemblyOptions,
): Promise<AssemblyResult> {
  const { clips, transitions, outputName } = options;

  if (clips.length === 0) {
    throw new Error("No clips to assemble");
  }

  // Create temp work directory
  const workDir = join(tmpdir(), `cinemaforge-assembly-${crypto.randomUUID()}`);
  await mkdir(workDir, { recursive: true });

  const clipPaths: string[] = [];
  const outputPath = join(workDir, "output.mp4");

  try {
    // Download all clips
    for (let i = 0; i < clips.length; i++) {
      const ext = clips[i].videoUrl.split(".").pop()?.split("?")[0] ?? "mp4";
      const clipPath = join(workDir, `clip-${i}.${ext}`);
      await downloadVideo(clips[i].videoUrl, clipPath);
      clipPaths.push(clipPath);
    }

    // Check if we have any non-cut transitions
    const hasTransitions = transitions?.some((t) => t.type !== "cut");

    if (!transitions || !hasTransitions) {
      // Simple concat
      await concatClips(clipPaths, outputPath, workDir);
    } else {
      // Concat with transitions
      await concatWithTransitions(
        clipPaths,
        transitions,
        clips.map((c) => c.durationSeconds),
        outputPath,
      );
    }

    // Read output and get size
    const outputBuffer = await readFile(outputPath);
    const fileSize = outputBuffer.length;

    // Get duration
    const { stdout } = await execFileAsync("ffprobe", [
      "-v", "quiet",
      "-print_format", "json",
      "-show_format",
      outputPath,
    ], { timeout: 30_000 });
    const info = JSON.parse(stdout);
    const durationSeconds = parseFloat(info.format?.duration ?? "0");

    // Upload to Supabase
    const supabase = getSupabase();
    const fileName = `${outputName ?? "movie"}-${Date.now()}.mp4`;
    const storagePath = `assembled/${fileName}`;

    const { error: uploadError } = await supabase.storage
      .from(EXPORT_BUCKET)
      .upload(storagePath, outputBuffer, {
        contentType: "video/mp4",
        upsert: false,
      });

    if (uploadError) {
      throw new Error(`Failed to upload assembled video: ${uploadError.message}`);
    }

    const { data } = supabase.storage.from(EXPORT_BUCKET).getPublicUrl(storagePath);

    return {
      videoUrl: data.publicUrl,
      fileSize,
      durationSeconds,
    };
  } finally {
    // Clean up temp directory
    try {
      const files = await readdir(workDir);
      await Promise.all(files.map((f) => unlink(join(workDir, f)).catch(() => {})));
      await unlink(workDir).catch(() => {});
    } catch {
      // Ignore cleanup errors
    }
  }
}
