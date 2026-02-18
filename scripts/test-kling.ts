/**
 * Quick test: generate a single 5s video via fal.ai Kling O3
 * Run: npx tsx scripts/test-kling.ts
 */
import { fal } from "@fal-ai/client";
import "dotenv/config";

fal.config({
  credentials: process.env.FAL_KEY,
});

const prompt =
  "Slow dolly push-in from medium shot to close-up. A weathered detective in a gray trenchcoat sits alone at a rain-streaked bar window. He lifts his glass and stares into the amber liquid, then sets it down untouched. Single warm bulb overhead, neon sign flickering through window. Desaturated teal grade, crushed blacks, shot on 35mm film, heavy grain. 4K.";

async function testTextToVideo() {
  console.log("=== Test 1: text-to-video ===");
  console.log(`Prompt: ${prompt.slice(0, 60)}...`);

  const input = {
    prompt,
    duration: "5",
    aspect_ratio: "16:9",
    generate_audio: false,
  };
  console.log("Input:", JSON.stringify(input, null, 2));

  try {
    const result = await fal.subscribe(
      "fal-ai/kling-video/o3/standard/text-to-video" as never,
      {
        input,
        logs: true,
        onQueueUpdate: (update: { status: string }) => {
          console.log(`  Status: ${update.status}`);
        },
      } as never
    );

    console.log("SUCCESS:", JSON.stringify((result as { data: unknown }).data, null, 2).slice(0, 300));
  } catch (err: unknown) {
    const e = err as { status?: number; body?: unknown; message?: string };
    console.error("FAILED:");
    console.error("  Status:", e.status);
    console.error("  Message:", e.message);
    console.error("  Body:", JSON.stringify(e.body, null, 2));
  }
}

async function testImageToVideo() {
  console.log("\n=== Test 2: image-to-video ===");

  // Use a simple public test image
  const input = {
    prompt: "A character walks forward slowly",
    image_url: "https://fal.media/files/elephant/8kRB4w4jEReOaWWS3MXrK.png",
    duration: "5",
    generate_audio: false,
  };
  console.log("Input:", JSON.stringify(input, null, 2));

  try {
    const result = await fal.subscribe(
      "fal-ai/kling-video/o3/standard/image-to-video" as never,
      {
        input,
        logs: true,
        onQueueUpdate: (update: { status: string }) => {
          console.log(`  Status: ${update.status}`);
        },
      } as never
    );

    console.log("SUCCESS:", JSON.stringify((result as { data: unknown }).data, null, 2).slice(0, 300));
  } catch (err: unknown) {
    const e = err as { status?: number; body?: unknown; message?: string };
    console.error("FAILED:");
    console.error("  Status:", e.status);
    console.error("  Message:", e.message);
    console.error("  Body:", JSON.stringify(e.body, null, 2));
  }
}

async function main() {
  console.log("FAL_KEY:", process.env.FAL_KEY ? "set" : "NOT SET");
  console.log();
  await testTextToVideo();
  await testImageToVideo();
}

main().catch((err) => {
  console.error("Fatal:", err);
  process.exit(1);
});
