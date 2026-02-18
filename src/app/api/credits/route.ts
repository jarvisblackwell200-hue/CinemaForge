import { NextResponse } from "next/server";
import { z } from "zod/v4";
import { getBalance, getCreditHistory, estimateMovieCost } from "@/lib/credits";
import { ensureUser } from "@/lib/auth";
import {
  createCreditPackCheckout,
  createSubscriptionCheckout,
  CREDIT_PACKS,
} from "@/lib/stripe";

// ─── GET: Balance, history, or movie cost estimate ─────────────

export async function GET(req: Request) {
  try {
    const userId = await ensureUser();

    const action = new URL(req.url).searchParams.get("action") ?? "balance";

    // Get current balance
    if (action === "balance") {
      const balance = await getBalance(userId);
      return NextResponse.json({ success: true, data: { balance } });
    }

    // Get credit history
    if (action === "history") {
      const limit = Number(new URL(req.url).searchParams.get("limit") ?? "50");
      const history = await getCreditHistory(userId, limit);
      return NextResponse.json({ success: true, data: history });
    }

    // Estimate cost for a movie
    if (action === "estimate") {
      const url = new URL(req.url);
      const movieId = url.searchParams.get("movieId");
      const quality = url.searchParams.get("quality") ?? "draft";

      if (!movieId) {
        return NextResponse.json(
          { success: false, error: "movieId required for estimate" },
          { status: 400 }
        );
      }

      const estimate = await estimateMovieCost(
        userId,
        movieId,
        quality as "draft" | "standard" | "cinema"
      );
      return NextResponse.json({ success: true, data: estimate });
    }

    return NextResponse.json(
      { success: false, error: "Unknown action" },
      { status: 400 }
    );
  } catch (error) {
    console.error("Credits API error:", error);
    return NextResponse.json(
      { success: false, error: "Internal server error" },
      { status: 500 }
    );
  }
}

// ─── POST: Purchase credits or upgrade plan ────────────────────

const PurchaseSchema = z.discriminatedUnion("type", [
  z.object({
    type: z.literal("credit_pack"),
    packId: z.string(),
  }),
  z.object({
    type: z.literal("subscription"),
    plan: z.enum(["CREATOR", "PRO", "STUDIO"]),
  }),
]);

export async function POST(req: Request) {
  try {
    const userId = await ensureUser();

    const body = await req.json();
    const parsed = PurchaseSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { success: false, error: "Invalid request" },
        { status: 400 }
      );
    }

    const returnUrl = new URL("/movies", req.url).toString();

    if (parsed.data.type === "credit_pack") {
      const checkoutUrl = await createCreditPackCheckout(
        userId,
        parsed.data.packId,
        returnUrl
      );
      return NextResponse.json({ success: true, data: { checkoutUrl } });
    }

    if (parsed.data.type === "subscription") {
      const checkoutUrl = await createSubscriptionCheckout(
        userId,
        parsed.data.plan,
        returnUrl
      );
      return NextResponse.json({ success: true, data: { checkoutUrl } });
    }

    return NextResponse.json(
      { success: false, error: "Unknown purchase type" },
      { status: 400 }
    );
  } catch (error) {
    console.error("Credits purchase error:", error);
    const message = error instanceof Error ? error.message : "Internal server error";
    return NextResponse.json(
      { success: false, error: message },
      { status: 500 }
    );
  }
}
