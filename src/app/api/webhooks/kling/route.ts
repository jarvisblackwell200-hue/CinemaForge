import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { refundCredits } from "@/lib/credits";

/**
 * Webhook handler for fal.ai generation completion callbacks.
 *
 * fal.ai can send webhook notifications when a generation job completes.
 * This is an alternative to the polling approach used by fal.subscribe().
 *
 * In the current implementation, we use fal.subscribe() which polls
 * internally, so this webhook is a future-proofing measure for when
 * we move to async job submission with fal.queue.submit().
 *
 * Expected payload from fal.ai:
 * {
 *   request_id: string,
 *   status: "OK" | "ERROR",
 *   payload: { video: { url, file_size, content_type } } | null,
 *   error: string | null
 * }
 */

interface FalWebhookPayload {
  request_id: string;
  status: "OK" | "ERROR";
  payload: {
    video: {
      url: string;
      file_size: number;
      content_type: string;
    };
  } | null;
  error: string | null;
}

export async function POST(req: NextRequest) {
  try {
    const body = (await req.json()) as FalWebhookPayload;

    // Find the take by fal request ID (stored as klingTaskId)
    const take = await db.take.findFirst({
      where: { klingTaskId: body.request_id },
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
      console.warn(`Webhook: no take found for request_id ${body.request_id}`);
      return NextResponse.json({ received: true, matched: false });
    }

    if (body.status === "OK" && body.payload?.video) {
      // Success: update the take with the video URL
      await db.take.update({
        where: { id: take.id },
        data: {
          videoUrl: body.payload.video.url,
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

      // Refund the credits
      const params = take.generationParams as { quality?: string } | null;
      const quality = params?.quality ?? "draft";
      const { getCreditCost } = await import("@/lib/constants/pricing");
      const cost = getCreditCost(
        quality as "draft" | "standard" | "cinema",
        take.shot.durationSeconds
      );

      await refundCredits({
        userId: take.shot.movie.userId,
        amount: cost,
        movieId: take.shot.movieId,
        shotId: take.shot.id,
        memo: `Refund: generation failed (webhook) — ${body.error ?? "unknown error"}`,
      });

      // Clean up the failed take
      await db.take.delete({ where: { id: take.id } });
    }

    return NextResponse.json({ received: true, matched: true });
  } catch (error) {
    console.error("Kling webhook error:", error);
    return NextResponse.json(
      { received: true, error: "Processing failed" },
      { status: 500 }
    );
  }
}
