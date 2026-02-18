/**
 * Quick test: generate a single 5s video via kie.ai (Kling 3.0)
 * Run: npx tsx scripts/test-kling.ts
 */
import "dotenv/config";

const KIE_BASE = "https://api.kie.ai/api/v1";

const prompt =
  "Slow dolly push-in from medium shot to close-up. A weathered detective in a gray trenchcoat sits alone at a rain-streaked bar window. He lifts his glass and stares into the amber liquid, then sets it down untouched. Single warm bulb overhead, neon sign flickering through window. Desaturated teal grade, crushed blacks, shot on 35mm film, heavy grain. 4K.";

async function createTask(input: Record<string, unknown>) {
  const res = await fetch(`${KIE_BASE}/jobs/createTask`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${process.env.KIE_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: "kling-3.0/video",
      input,
    }),
  });

  const json = await res.json();
  if (json.code !== 200) throw new Error(`createTask failed: ${json.msg}`);
  return json.data.taskId as string;
}

async function pollUntilDone(taskId: string) {
  console.log(`  Polling task ${taskId}...`);
  const start = Date.now();

  while (Date.now() - start < 300_000) {
    await new Promise((r) => setTimeout(r, 3000));

    const res = await fetch(
      `${KIE_BASE}/jobs/recordInfo?taskId=${encodeURIComponent(taskId)}`,
      { headers: { Authorization: `Bearer ${process.env.KIE_API_KEY}` } },
    );

    const json = await res.json();
    const state = json.data?.state;
    console.log(`  State: ${state} (${((Date.now() - start) / 1000).toFixed(0)}s)`);

    if (state === "success") {
      const result = JSON.parse(json.data.resultJson);
      return result.resultUrls;
    }

    if (state === "fail") {
      throw new Error(`Generation failed: ${json.data.failMsg}`);
    }
  }

  throw new Error("Timed out after 5 minutes");
}

async function testTextToVideo() {
  console.log("=== Test 1: text-to-video ===");
  console.log(`Prompt: ${prompt.slice(0, 60)}...`);

  try {
    const taskId = await createTask({
      prompt,
      sound: false,
      duration: "5",
      aspect_ratio: "16:9",
      mode: "std",
      multi_shots: false,
    });
    const urls = await pollUntilDone(taskId);
    console.log("SUCCESS:", urls);
  } catch (err) {
    console.error("FAILED:", err);
  }
}

async function testImageToVideo() {
  console.log("\n=== Test 2: image-to-video ===");

  try {
    const taskId = await createTask({
      prompt: "A character walks forward slowly",
      image_urls: ["https://upload.wikimedia.org/wikipedia/commons/thumb/4/4c/Brad_Pitt_2019_by_Glenn_Francis.jpg/440px-Brad_Pitt_2019_by_Glenn_Francis.jpg"],
      sound: false,
      duration: "5",
      mode: "std",
      multi_shots: false,
    });
    const urls = await pollUntilDone(taskId);
    console.log("SUCCESS:", urls);
  } catch (err) {
    console.error("FAILED:", err);
  }
}

async function main() {
  console.log("KIE_API_KEY:", process.env.KIE_API_KEY ? "set" : "NOT SET");
  console.log();
  await testTextToVideo();
  await testImageToVideo();
}

main().catch((err) => {
  console.error("Fatal:", err);
  process.exit(1);
});
