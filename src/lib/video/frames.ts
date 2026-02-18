/**
 * Video frame extraction utilities for continuity chaining.
 *
 * ## Current approach (A + B combined):
 * - Character reference images generated in CharacterWizard via Flux
 * - Shot 1 uses character ref as start_image_url (image-to-video)
 * - Shot N uses last frame of shot N-1 as start_image_url
 *
 * ## Future enhancement — Option C: Scene Style Frames
 * Before generating any video, generate one still image per scene that
 * establishes the environment, lighting, and color grade. The user
 * approves each style frame, then every shot in that scene uses it as
 * a visual anchor. This adds a "Style Frames" step between Storyboard
 * and Generate in the workflow pipeline:
 *
 *   Storyboard → [Style Frames] → Generate
 *
 * Implementation would involve:
 * - A StyleFrameEditor component showing one image per scene
 * - Generating via Flux with scene environment + lighting + style bible
 * - Storing approved frames on the Movie or Scene level
 * - Using scene style frame as start_image_url when no previous shot exists
 * - Could also be used to regenerate individual shots while maintaining
 *   the scene's visual identity even when continuity chain is broken
 *
 * Continuity chaining: extract the last frame of shot N-1 and use it
 * as the start_image_url for shot N, so Kling carries visual DNA
 * between shots.
 *
 * Approach: Use ffmpeg via child_process for frame extraction.
 * Extracted frames are uploaded to Supabase storage and a public URL is returned.
 */

import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { createClient } from "@supabase/supabase-js";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { readFile, unlink } from "node:fs/promises";

const execFileAsync = promisify(execFile);

const FRAME_BUCKET = "reference-images";

function getSupabase() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL ?? process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SECRET_KEY ?? process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error("Supabase not configured");
  return createClient(url, key, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}

/**
 * Get the duration of a video in seconds using ffprobe.
 */
export async function getVideoDuration(videoUrl: string): Promise<number> {
  const { stdout } = await execFileAsync("ffprobe", [
    "-v", "quiet",
    "-print_format", "json",
    "-show_format",
    videoUrl,
  ], { timeout: 30_000 });

  const info = JSON.parse(stdout);
  return parseFloat(info.format?.duration ?? "0");
}

/**
 * Extract a single frame from a video at a given time offset.
 * Returns the frame as a JPEG Buffer.
 */
async function extractFrameAt(
  videoUrl: string,
  seekSeconds: number,
): Promise<Buffer> {
  const outPath = join(tmpdir(), `cinemaforge-frame-${crypto.randomUUID()}.jpg`);

  try {
    await execFileAsync("ffmpeg", [
      "-ss", String(Math.max(0, seekSeconds)),
      "-i", videoUrl,
      "-frames:v", "1",
      "-q:v", "2",
      "-y",
      outPath,
    ], { timeout: 30_000 });

    return await readFile(outPath);
  } finally {
    // Clean up temp file
    await unlink(outPath).catch(() => {});
  }
}

/**
 * Upload a JPEG buffer to Supabase storage and return its public URL.
 */
async function uploadFrame(buffer: Buffer, prefix: string): Promise<string> {
  const supabase = getSupabase();
  const path = `frames/${prefix}/${crypto.randomUUID()}.jpg`;

  const { error } = await supabase.storage
    .from(FRAME_BUCKET)
    .upload(path, buffer, {
      contentType: "image/jpeg",
      upsert: false,
    });

  if (error) {
    throw new Error(`Failed to upload frame: ${error.message}`);
  }

  const { data } = supabase.storage.from(FRAME_BUCKET).getPublicUrl(path);
  return data.publicUrl;
}

/**
 * Extract the last frame from a video URL.
 * Uses ffprobe to find duration, then seeks near the end.
 * Returns a public URL of the uploaded frame, or null on failure.
 */
export async function extractLastFrame(
  videoUrl: string,
): Promise<string | null> {
  try {
    const duration = await getVideoDuration(videoUrl);
    if (duration <= 0) {
      console.warn("[frames] Could not determine video duration");
      return null;
    }

    // Seek to 0.1s before the end
    const seekTime = Math.max(0, duration - 0.1);
    const buffer = await extractFrameAt(videoUrl, seekTime);

    return await uploadFrame(buffer, "last");
  } catch (error) {
    console.error("[frames] Last frame extraction failed:", error);
    return null;
  }
}

/**
 * Extract the first frame from a video URL.
 * Useful for generating thumbnails.
 * Returns a public URL of the uploaded frame, or null on failure.
 */
export async function extractFirstFrame(
  videoUrl: string,
): Promise<string | null> {
  try {
    const buffer = await extractFrameAt(videoUrl, 0);
    return await uploadFrame(buffer, "first");
  } catch (error) {
    console.error("[frames] First frame extraction failed:", error);
    return null;
  }
}
