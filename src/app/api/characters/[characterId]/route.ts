import { NextResponse } from "next/server";
import { z } from "zod/v4";
import { Prisma } from "@/generated/prisma/client";
import { db } from "@/lib/db";
import { ensureUser } from "@/lib/auth";

const UpdateCharacterSchema = z.object({
  name: z.string().min(1, "Name is required").optional(),
  role: z.enum(["protagonist", "antagonist", "supporting", "background"]).optional(),
  visualDescription: z
    .string()
    .min(20, "Visual description must be at least 20 characters for consistent generation")
    .optional(),
  referenceImages: z.array(z.string()).optional(),
  voiceProfile: z
    .object({
      language: z.string(),
      accent: z.string(),
      tone: z.string(),
      speed: z.enum(["slow", "normal", "fast"]),
    })
    .nullish(),
  styleBibleEntry: z.string().nullish(),
});

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ characterId: string }> }
) {
  try {
    const userId = await ensureUser();
    const { characterId } = await params;

    const body = await req.json();
    const parsed = UpdateCharacterSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { success: false, error: z.prettifyError(parsed.error) },
        { status: 400 }
      );
    }

    // Verify ownership via character → movie → userId
    const character = await db.character.findUnique({
      where: { id: characterId },
      select: { movie: { select: { userId: true } } },
    });

    if (!character || character.movie.userId !== userId) {
      return NextResponse.json(
        { success: false, error: "Character not found" },
        { status: 404 }
      );
    }

    const { voiceProfile, ...rest } = parsed.data;
    const updated = await db.character.update({
      where: { id: characterId },
      data: {
        ...rest,
        // Prisma requires DbNull for explicitly setting JSON fields to null
        ...(voiceProfile !== undefined && {
          voiceProfile: voiceProfile === null ? Prisma.DbNull : voiceProfile,
        }),
      },
    });

    return NextResponse.json({ success: true, data: updated });
  } catch (error) {
    console.error("Failed to update character:", error);
    return NextResponse.json(
      { success: false, error: "Internal server error" },
      { status: 500 }
    );
  }
}
