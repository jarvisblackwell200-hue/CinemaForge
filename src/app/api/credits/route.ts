import { NextRequest, NextResponse } from "next/server";
import { getBalance, getCreditHistory, estimateMovieCost } from "@/lib/credits";

// ─── GET: Balance, history, or movie cost estimate ─────────────

export async function GET(req: NextRequest) {
  try {
    const userId = req.headers.get("x-user-id");
    if (!userId) {
      return NextResponse.json(
        { success: false, error: "Unauthorized" },
        { status: 401 }
      );
    }

    const action = req.nextUrl.searchParams.get("action") ?? "balance";

    // Get current balance
    if (action === "balance") {
      const balance = await getBalance(userId);
      return NextResponse.json({ success: true, data: { balance } });
    }

    // Get credit history
    if (action === "history") {
      const limit = Number(req.nextUrl.searchParams.get("limit") ?? "50");
      const history = await getCreditHistory(userId, limit);
      return NextResponse.json({ success: true, data: history });
    }

    // Estimate cost for a movie
    if (action === "estimate") {
      const movieId = req.nextUrl.searchParams.get("movieId");
      const quality = req.nextUrl.searchParams.get("quality") ?? "draft";

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
