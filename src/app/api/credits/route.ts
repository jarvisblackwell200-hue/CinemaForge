import { NextResponse } from "next/server";
import { getBalance, getCreditHistory, estimateMovieCost } from "@/lib/credits";
import { ensureUser } from "@/lib/auth";

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
