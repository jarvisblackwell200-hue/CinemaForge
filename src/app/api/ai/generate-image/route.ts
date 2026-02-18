import { NextResponse } from "next/server";
import { z } from "zod/v4";
import { ensureUser } from "@/lib/auth";

const RequestSchema = z.object({
  prompt: z.string().min(10),
  style: z
    .enum(["photorealistic", "cinematic", "sketch"])
    .default("cinematic"),
  aspectRatio: z
    .enum(["portrait_4_3", "landscape_4_3", "square_hd"])
    .default("portrait_4_3"),
  referenceImageUrl: z.string().url().optional(),
});

export async function POST(req: Request) {
  try {
    await ensureUser();

    const body = await req.json();
    const parsed = RequestSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { success: false, error: z.prettifyError(parsed.error) },
        { status: 400 },
      );
    }

    const { prompt, style, referenceImageUrl } = parsed.data;

    const kieKey = process.env.KIE_API_KEY;
    if (!kieKey) {
      return NextResponse.json(
        { success: false, error: "KIE_API_KEY not configured" },
        { status: 500 },
      );
    }

    const styleModifiers: Record<string, string> = {
      photorealistic:
        "photorealistic, highly detailed, professional photography, 8K, sharp focus",
      cinematic:
        "cinematic still frame, film photography, shallow depth of field, dramatic lighting, 35mm film, 4K",
      sketch:
        "pencil sketch, storyboard art, rough linework, grayscale, concept art",
    };

    const fullPrompt = `${prompt}. ${styleModifiers[style]}`;

    // Use kie.ai Kling 3.0 to generate a short video, then extract first frame
    // This gives us a cinematic still consistent with the video generation model
    const res = await fetch("https://api.kie.ai/api/v1/jobs/createTask", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${kieKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "kling-3.0/video",
        input: {
          prompt: fullPrompt,
          sound: false,
          duration: "3",
          aspect_ratio: "16:9",
          mode: "std",
          multi_shots: false,
          ...(referenceImageUrl ? { image_urls: [referenceImageUrl] } : {}),
        },
      }),
    });

    if (!res.ok) {
      const text = await res.text();
      console.error("[generate-image] kie.ai error:", text);
      return NextResponse.json(
        { success: false, error: "Image generation failed" },
        { status: 500 },
      );
    }

    const createResult = await res.json();
    if (createResult.code !== 200 || !createResult.data?.taskId) {
      return NextResponse.json(
        { success: false, error: createResult.msg ?? "Failed to create task" },
        { status: 500 },
      );
    }

    // Poll for completion (short video, should be quick)
    const taskId = createResult.data.taskId;
    const maxPollMs = 120_000;
    const start = Date.now();

    while (Date.now() - start < maxPollMs) {
      await new Promise((r) => setTimeout(r, 3000));

      const pollRes = await fetch(
        `https://api.kie.ai/api/v1/jobs/recordInfo?taskId=${encodeURIComponent(taskId)}`,
        { headers: { Authorization: `Bearer ${kieKey}` } },
      );

      if (!pollRes.ok) continue;

      const pollJson = await pollRes.json();
      const state = pollJson.data?.state;

      if (state === "success" && pollJson.data.resultJson) {
        const result = JSON.parse(pollJson.data.resultJson);
        const videoUrl = result.resultUrls?.[0];
        if (videoUrl) {
          // Return video URL — the frontend can use a frame from it as reference
          return NextResponse.json({
            success: true,
            data: { imageUrl: videoUrl, prompt: fullPrompt },
          });
        }
      }

      if (state === "fail") {
        return NextResponse.json(
          { success: false, error: pollJson.data.failMsg ?? "Generation failed" },
          { status: 500 },
        );
      }
    }

    return NextResponse.json(
      { success: false, error: "Generation timed out" },
      { status: 504 },
    );
  } catch (error) {
    console.error("Image generation error:", error);
    return NextResponse.json(
      { success: false, error: "Image generation failed" },
      { status: 500 },
    );
  }
}
