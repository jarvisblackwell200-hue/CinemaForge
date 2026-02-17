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
 * Approach: Use fal.ai's frame extraction or fall back to ffmpeg.
 * In dry-run mode, returns a placeholder image URL.
 */

const DRY_RUN = process.env.KLING_DRY_RUN !== "false";

const PLACEHOLDER_FRAME_URL =
  "https://fal.media/files/elephant/OEbhPGhwTQMGOgVOGGJjH_image.webp";

/**
 * Extract the last frame from a video URL.
 *
 * For now uses a server-side fetch + ffmpeg approach.
 * Falls back to placeholder in dry-run mode.
 */
export async function extractLastFrame(
  videoUrl: string
): Promise<string | null> {
  if (DRY_RUN) {
    return PLACEHOLDER_FRAME_URL;
  }

  try {
    // Use fal.ai's video-to-image endpoint if available,
    // otherwise fall back to returning null (skip chaining)
    //
    // For production: implement ffmpeg frame extraction on the worker,
    // or use a video processing API. The extracted frame should be
    // uploaded to R2 and its URL stored on the shot's endFrameUrl field.
    //
    // Simplified approach for MVP: use the video URL itself.
    // Some video models accept video URLs as image references,
    // but Kling specifically needs a still image.
    //
    // TODO: Implement proper frame extraction with ffmpeg:
    // ffmpeg -sseof -0.1 -i <video_url> -frames:v 1 -q:v 2 frame.jpg

    return null; // Skip chaining until ffmpeg is available
  } catch (error) {
    console.error("Frame extraction failed:", error);
    return null;
  }
}

/**
 * Extract the first frame from a video URL.
 * Useful for generating thumbnails.
 */
export async function extractFirstFrame(
  videoUrl: string
): Promise<string | null> {
  if (DRY_RUN) {
    return PLACEHOLDER_FRAME_URL;
  }

  try {
    // TODO: Implement with ffmpeg
    // ffmpeg -i <video_url> -frames:v 1 -q:v 2 frame.jpg
    return null;
  } catch (error) {
    console.error("Frame extraction failed:", error);
    return null;
  }
}
