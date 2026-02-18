import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { refundCredits } from "@/lib/credits";
import type { KieWebhookPayload } from "@/lib/kling/types";

/**
 * Webhook handler for kie.ai generation completion callbacks.
 *
 * kie.ai sends a POST when a video generation task completes or fails.
 * Include `callBackUrl` in the createTask request to enable this.
 *
 * Expected payload:
 * {
 *   code: 200 | 501,
 *   msg: string,
 *   data: {
 *     taskId: string,
 *     info?: { resultUrls: string[], originUrls?: string[] },
 *     fallbackFlag: boolean
 *   }
 * }
 */

export async function POST(req: NextRequest) {
  try {
    const body = (await req.json()) as KieWebhookPayload;

    // Find the take by kie.ai task ID (stored as klingTaskId for schema compat)
    const take = await db.take.findFirst({
      where: { klingTaskId: body.data.taskId },
      include: {
        shot: {
          select: {
            id: true,
            movieId: true,
            durationSeconds: true,
            movie: { select: { userId: true } },
          },
        },
      },
    });

    if (!take) {
      console.warn(`[kie webhook] No take found for taskId ${body.data.taskId}`);
      return NextResponse.json({ received: true, matched: false });
    }

    if (body.code === 200 && body.data.info?.resultUrls?.length) {
      // Success: update the take with the video URL
      await db.take.update({
        where: { id: take.id },
        data: {
          videoUrl: body.data.info.resultUrls[0],
        },
      });

      // Mark shot as complete
      await db.shot.update({
        where: { id: take.shot.id },
        data: { status: "COMPLETE" },
      });
    } else {
      // Failure: mark shot as failed and refund credits
      await db.shot.update({
        where: { id: take.shot.id },
        data: { status: "FAILED" },
      });

      const params = take.generationParams as { quality?: string } | null;
      const quality = params?.quality ?? "draft";
      const { getCreditCost } = await import("@/lib/constants/pricing");
      const cost = getCreditCost(
        quality as "draft" | "standard" | "cinema",
        take.shot.durationSeconds,
      );

      await refundCredits({
        userId: take.shot.movie.userId,
        amount: cost,
        movieId: take.shot.movieId,
        shotId: take.shot.id,
        memo: `Refund: generation failed (webhook) — ${body.msg ?? "unknown error"}`,
      });

      await db.take.delete({ where: { id: take.id } });
    }

    return NextResponse.json({ received: true, matched: true });
  } catch (error) {
    console.error("[kie webhook] Error:", error);
    return NextResponse.json(
      { received: true, error: "Processing failed" },
      { status: 500 },
    );
  }
}
