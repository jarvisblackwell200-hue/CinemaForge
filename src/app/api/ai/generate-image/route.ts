import { NextResponse } from "next/server";
import { z } from "zod/v4";
import { fal } from "@fal-ai/client";
import { ensureUser } from "@/lib/auth";

const DRY_RUN = process.env.KLING_DRY_RUN !== "false";

const MOCK_IMAGE_URL =
  "https://fal.media/files/elephant/OEbhPGhwTQMGOgVOGGJjH_image.webp";

const RequestSchema = z.object({
  prompt: z.string().min(10),
  style: z.enum(["photorealistic", "cinematic", "sketch"]).default("cinematic"),
  aspectRatio: z.enum(["portrait_4_3", "landscape_4_3", "square_hd"]).default("portrait_4_3"),
});

export async function POST(req: Request) {
  try {
    await ensureUser();

    const body = await req.json();
    const parsed = RequestSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { success: false, error: z.prettifyError(parsed.error) },
        { status: 400 }
      );
    }

    const { prompt, style, aspectRatio } = parsed.data;

    // Build the image prompt with style modifiers
    const styleModifiers: Record<string, string> = {
      photorealistic:
        "photorealistic, highly detailed, professional photography, 8K, sharp focus",
      cinematic:
        "cinematic still frame, film photography, shallow depth of field, dramatic lighting, 35mm film, 4K",
      sketch:
        "pencil sketch, storyboard art, rough linework, grayscale, concept art",
    };

    const fullPrompt = `${prompt}. ${styleModifiers[style]}`;

    // Dry-run mode
    if (DRY_RUN) {
      await new Promise((r) => setTimeout(r, 800)); // simulate delay
      return NextResponse.json({
        success: true,
        data: {
          imageUrl: MOCK_IMAGE_URL,
          prompt: fullPrompt,
          isDryRun: true,
        },
      });
    }

    // Real generation via Flux Schnell
    const falKey = process.env.FAL_KEY;
    if (!falKey) {
      return NextResponse.json(
        { success: false, error: "FAL_KEY not configured" },
        { status: 500 }
      );
    }

    fal.config({ credentials: falKey });

    const result = await fal.subscribe("fal-ai/flux/schnell", {
      input: {
        prompt: fullPrompt,
        num_inference_steps: 4,
        image_size: aspectRatio,
        num_images: 1,
        output_format: "jpeg",
      },
    });

    const images = (result.data as { images: { url: string }[] }).images;
    if (!images?.[0]?.url) {
      return NextResponse.json(
        { success: false, error: "No image generated" },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      data: {
        imageUrl: images[0].url,
        prompt: fullPrompt,
        isDryRun: false,
      },
    });
  } catch (error) {
    console.error("Image generation error:", error);
    return NextResponse.json(
      { success: false, error: "Image generation failed" },
      { status: 500 }
    );
  }
}
