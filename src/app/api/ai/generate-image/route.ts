import { NextResponse } from "next/server";
import { z } from "zod/v4";
import { fal } from "@fal-ai/client";
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

// Map internal aspect ratio names to Nano Banana format
const ASPECT_RATIO_MAP: Record<string, "4:3" | "3:4" | "16:9" | "1:1"> = {
  portrait_4_3: "3:4",
  landscape_4_3: "4:3",
  square_hd: "1:1",
};

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

    const { prompt, style, aspectRatio, referenceImageUrl } = parsed.data;

    const falKey = process.env.FAL_KEY;
    if (!falKey) {
      return NextResponse.json(
        { success: false, error: "FAL_KEY not configured" },
        { status: 500 }
      );
    }

    fal.config({ credentials: falKey });

    const styleModifiers: Record<string, string> = {
      photorealistic:
        "photorealistic, highly detailed, professional photography, 8K, sharp focus",
      cinematic:
        "cinematic still frame, film photography, shallow depth of field, dramatic lighting, 35mm film, 4K",
      sketch:
        "pencil sketch, storyboard art, rough linework, grayscale, concept art",
    };

    const fullPrompt = `${prompt}. ${styleModifiers[style]}`;
    const nbAspectRatio = ASPECT_RATIO_MAP[aspectRatio] ?? "4:3";

    let imageUrl: string;

    if (referenceImageUrl) {
      // Nano Banana Edit: takes reference image + prompt to place the
      // character from the image into the described scene
      const result = await fal.subscribe("fal-ai/nano-banana/edit", {
        input: {
          prompt: `Using the character from the reference image, generate: ${fullPrompt}`,
          image_urls: [referenceImageUrl],
          aspect_ratio: nbAspectRatio,
          num_images: 1,
          output_format: "jpeg",
          limit_generations: true,
        },
      });

      const images = result.data.images;
      if (!images?.[0]?.url) {
        return NextResponse.json(
          { success: false, error: "No image generated" },
          { status: 500 }
        );
      }
      imageUrl = images[0].url;
    } else {
      // Nano Banana: text-to-image
      const result = await fal.subscribe("fal-ai/nano-banana", {
        input: {
          prompt: fullPrompt,
          aspect_ratio: nbAspectRatio,
          num_images: 1,
          output_format: "jpeg",
          limit_generations: true,
        },
      });

      const images = result.data.images;
      if (!images?.[0]?.url) {
        return NextResponse.json(
          { success: false, error: "No image generated" },
          { status: 500 }
        );
      }
      imageUrl = images[0].url;
    }

    return NextResponse.json({
      success: true,
      data: {
        imageUrl,
        prompt: fullPrompt,
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
