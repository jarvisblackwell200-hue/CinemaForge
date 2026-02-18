import { NextResponse } from "next/server";
import { z } from "zod/v4";
import { Prisma } from "@/generated/prisma/client";
import { ShotStatus } from "@/generated/prisma/enums";
import { db } from "@/lib/db";
import { ensureUser } from "@/lib/auth";

const UpdateShotSchema = z.object({
  sceneIndex: z.number().int().min(0).optional(),
  order: z.number().int().min(0).optional(),
  shotType: z.string().min(1).optional(),
  cameraMovement: z.string().min(1).optional(),
  subject: z.string().optional(),
  action: z.string().optional(),
  environment: z.string().nullish(),
  lighting: z.string().nullish(),
  dialogue: z
    .object({
      characterId: z.string(),
      characterName: z.string(),
      line: z.string(),
      emotion: z.string(),
    })
    .nullish(),
  durationSeconds: z.number().int().min(3).max(15).optional(),
  generatedPrompt: z.string().nullish(),
  negativePrompt: z.string().nullish(),
  storyboardImageUrl: z.string().nullish(),
  status: z.enum(["DRAFT", "QUEUED", "GENERATING", "COMPLETE", "FAILED"]).optional(),
});

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ shotId: string }> }
) {
  try {
    const userId = await ensureUser();
    const { shotId } = await params;

    const body = await req.json();
    const parsed = UpdateShotSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { success: false, error: z.prettifyError(parsed.error) },
        { status: 400 }
      );
    }

    // Verify ownership via movie.userId
    const shot = await db.shot.findUnique({
      where: { id: shotId },
      select: { movie: { select: { userId: true } } },
    });

    if (!shot || shot.movie.userId !== userId) {
      return NextResponse.json(
        { success: false, error: "Shot not found" },
        { status: 404 }
      );
    }

    const { dialogue, status, ...rest } = parsed.data;
    const updated = await db.shot.update({
      where: { id: shotId },
      data: {
        ...rest,
        ...(status !== undefined && { status: status as ShotStatus }),
        // Prisma requires DbNull for explicitly setting JSON fields to null
        ...(dialogue !== undefined && {
          dialogue: dialogue === null ? Prisma.DbNull : dialogue,
        }),
      },
    });

    return NextResponse.json({ success: true, data: updated });
  } catch (error) {
    console.error("Failed to update shot:", error);
    return NextResponse.json(
      { success: false, error: "Internal server error" },
      { status: 500 }
    );
  }
}

export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ shotId: string }> }
) {
  try {
    const userId = await ensureUser();
    const { shotId } = await params;

    // Verify ownership via movie.userId
    const shot = await db.shot.findUnique({
      where: { id: shotId },
      select: { movie: { select: { userId: true } } },
    });

    if (!shot || shot.movie.userId !== userId) {
      return NextResponse.json(
        { success: false, error: "Shot not found" },
        { status: 404 }
      );
    }

    await db.shot.delete({ where: { id: shotId } });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Failed to delete shot:", error);
    return NextResponse.json(
      { success: false, error: "Internal server error" },
      { status: 500 }
    );
  }
}
