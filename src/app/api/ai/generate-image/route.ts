import { NextResponse } from "next/server";
import { z } from "zod/v4";
import { ensureUser } from "@/lib/auth";
import { CREDIT_COSTS } from "@/lib/constants/pricing";
import { deductCredits, refundCredits } from "@/lib/credits";
import { FluxKontextProvider } from "@/lib/image-gen/flux-kontext";

const ASPECT_RATIO_MAP: Record<string, string> = {
  portrait_4_3: "3:4",
  landscape_4_3: "16:9",
  square_hd: "1:1",
};

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

const provider = new FluxKontextProvider();

export async function POST(req: Request) {
  try {
    const userId = await ensureUser();

    const body = await req.json();
    const parsed = RequestSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { success: false, error: z.prettifyError(parsed.error) },
        { status: 400 },
      );
    }

    // Deduct credits atomically (guarded update + ledger in one transaction)
    const cost = CREDIT_COSTS.REFERENCE_IMAGE;
    const newBalance = await deductCredits({
      userId,
      amount: cost,
      type: "USAGE",
      memo: "Reference image generation",
    });
    if (newBalance === null) {
      return NextResponse.json(
        { success: false, error: `Insufficient credits. Need ${cost} credit.` },
        { status: 402 },
      );
    }

    const { prompt, style, referenceImageUrl } = parsed.data;

    const styleModifiers: Record<string, string> = {
      photorealistic:
        "photorealistic, highly detailed, professional photography, 8K, sharp focus",
      cinematic:
        "cinematic still frame, film photography, shallow depth of field, dramatic lighting, 35mm film, 4K",
      sketch:
        "pencil sketch, storyboard art, rough linework, grayscale, concept art",
    };

    const fullPrompt = `${prompt}. ${styleModifiers[style]}`;
    const fluxAspectRatio = ASPECT_RATIO_MAP[parsed.data.aspectRatio] ?? "16:9";

    try {
      const result = await provider.generate({
        prompt: fullPrompt,
        aspectRatio: fluxAspectRatio,
        referenceImageUrl,
      });

      return NextResponse.json({
        success: true,
        data: { imageUrl: result.imageUrl, prompt: fullPrompt },
      });
    } catch (genError) {
      console.error("[generate-image] Generation failed:", genError);
      await refundCredit(userId, cost);
      const message = genError instanceof Error ? genError.message : "Image generation failed";
      const status = message.includes("timed out") ? 504 : 500;
      return NextResponse.json(
        { success: false, error: message, refunded: true },
        { status },
      );
    }
  } catch (error) {
    console.error("Image generation error:", error);
    return NextResponse.json(
      { success: false, error: "Image generation failed" },
      { status: 500 },
    );
  }
}

async function refundCredit(userId: string, amount: number) {
  await refundCredits({
    userId,
    amount,
    memo: "Refund: reference image generation failed",
  });
}
