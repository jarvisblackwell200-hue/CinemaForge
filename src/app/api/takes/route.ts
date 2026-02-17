import { NextRequest, NextResponse } from "next/server";
import { z } from "zod/v4";
import { db } from "@/lib/db";

// ─── Set hero take ─────────────────────────────────────────────

const SetHeroSchema = z.object({
  takeId: z.string(),
  shotId: z.string(),
});

export async function PATCH(req: NextRequest) {
  try {
    const userId = req.headers.get("x-user-id");
    if (!userId) {
      return NextResponse.json(
        { success: false, error: "Unauthorized" },
        { status: 401 }
      );
    }

    const body = await req.json();
    const parsed = SetHeroSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { success: false, error: z.prettifyError(parsed.error) },
        { status: 400 }
      );
    }

    // Verify ownership through shot → movie → user chain
    const take = await db.take.findFirst({
      where: { id: parsed.data.takeId, shotId: parsed.data.shotId },
      include: {
        shot: {
          select: {
            movie: { select: { userId: true } },
          },
        },
      },
    });

    if (!take || take.shot.movie.userId !== userId) {
      return NextResponse.json(
        { success: false, error: "Take not found" },
        { status: 404 }
      );
    }

    // Unset all hero takes for this shot, then set the new one
    await db.$transaction([
      db.take.updateMany({
        where: { shotId: parsed.data.shotId },
        data: { isHero: false },
      }),
      db.take.update({
        where: { id: parsed.data.takeId },
        data: { isHero: true },
      }),
    ]);

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Failed to set hero take:", error);
    return NextResponse.json(
      { success: false, error: "Internal server error" },
      { status: 500 }
    );
  }
}

// ─── Get takes for a shot ──────────────────────────────────────

export async function GET(req: NextRequest) {
  try {
    const userId = req.headers.get("x-user-id");
    if (!userId) {
      return NextResponse.json(
        { success: false, error: "Unauthorized" },
        { status: 401 }
      );
    }

    const shotId = req.nextUrl.searchParams.get("shotId");
    if (!shotId) {
      return NextResponse.json(
        { success: false, error: "shotId required" },
        { status: 400 }
      );
    }

    // Verify ownership
    const shot = await db.shot.findFirst({
      where: { id: shotId },
      select: { movie: { select: { userId: true } } },
    });

    if (!shot || shot.movie.userId !== userId) {
      return NextResponse.json(
        { success: false, error: "Shot not found" },
        { status: 404 }
      );
    }

    const takes = await db.take.findMany({
      where: { shotId },
      orderBy: { createdAt: "desc" },
    });

    return NextResponse.json({ success: true, data: takes });
  } catch (error) {
    console.error("Failed to fetch takes:", error);
    return NextResponse.json(
      { success: false, error: "Internal server error" },
      { status: 500 }
    );
  }
}

// ─── Delete a take ─────────────────────────────────────────────

export async function DELETE(req: NextRequest) {
  try {
    const userId = req.headers.get("x-user-id");
    if (!userId) {
      return NextResponse.json(
        { success: false, error: "Unauthorized" },
        { status: 401 }
      );
    }

    const takeId = req.nextUrl.searchParams.get("takeId");
    if (!takeId) {
      return NextResponse.json(
        { success: false, error: "takeId required" },
        { status: 400 }
      );
    }

    const take = await db.take.findFirst({
      where: { id: takeId },
      include: {
        shot: {
          select: { movie: { select: { userId: true } } },
        },
      },
    });

    if (!take || take.shot.movie.userId !== userId) {
      return NextResponse.json(
        { success: false, error: "Take not found" },
        { status: 404 }
      );
    }

    await db.take.delete({ where: { id: takeId } });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Failed to delete take:", error);
    return NextResponse.json(
      { success: false, error: "Internal server error" },
      { status: 500 }
    );
  }
}
