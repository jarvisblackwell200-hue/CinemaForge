import { NextResponse } from "next/server";
import { z } from "zod/v4";
import { db } from "@/lib/db";
import { ensureUser } from "@/lib/auth";

const CreateShotSchema = z.object({
  movieId: z.string(),
  sceneIndex: z.number().int().min(0),
  order: z.number().int().min(0),
  shotType: z.string().min(1),
  cameraMovement: z.string().min(1),
  subject: z.string().min(1),
  action: z.string().min(1),
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
  status: z.string().optional(),
});

const BulkCreateSchema = z.object({
  movieId: z.string(),
  shots: z.array(CreateShotSchema.omit({ movieId: true })),
});

export async function POST(req: Request) {
  try {
    const userId = await ensureUser();

    const body = await req.json();

    // Check if it's a bulk create
    const bulkParsed = BulkCreateSchema.safeParse(body);
    if (bulkParsed.success) {
      const movie = await db.movie.findFirst({
        where: { id: bulkParsed.data.movieId, userId },
        select: { id: true },
      });
      if (!movie) {
        return NextResponse.json(
          { success: false, error: "Movie not found" },
          { status: 404 }
        );
      }

      const shots = await db.$transaction(
        bulkParsed.data.shots.map((shot) =>
          db.shot.create({
            data: {
              movieId: bulkParsed.data.movieId,
              sceneIndex: shot.sceneIndex,
              order: shot.order,
              shotType: shot.shotType,
              cameraMovement: shot.cameraMovement,
              subject: shot.subject,
              action: shot.action,
              environment: shot.environment,
              lighting: shot.lighting,
              dialogue: shot.dialogue ?? undefined,
              durationSeconds: shot.durationSeconds ?? 5,
              generatedPrompt: shot.generatedPrompt,
              negativePrompt: shot.negativePrompt,
            },
          })
        )
      );

      return NextResponse.json(
        { success: true, data: shots },
        { status: 201 }
      );
    }

    // Single shot create
    const parsed = CreateShotSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { success: false, error: z.prettifyError(parsed.error) },
        { status: 400 }
      );
    }

    const movie = await db.movie.findFirst({
      where: { id: parsed.data.movieId, userId },
      select: { id: true },
    });
    if (!movie) {
      return NextResponse.json(
        { success: false, error: "Movie not found" },
        { status: 404 }
      );
    }

    const shot = await db.shot.create({
      data: {
        movieId: parsed.data.movieId,
        sceneIndex: parsed.data.sceneIndex,
        order: parsed.data.order,
        shotType: parsed.data.shotType,
        cameraMovement: parsed.data.cameraMovement,
        subject: parsed.data.subject,
        action: parsed.data.action,
        environment: parsed.data.environment,
        lighting: parsed.data.lighting,
        dialogue: parsed.data.dialogue ?? undefined,
        durationSeconds: parsed.data.durationSeconds ?? 5,
        generatedPrompt: parsed.data.generatedPrompt,
        negativePrompt: parsed.data.negativePrompt,
      },
    });

    return NextResponse.json({ success: true, data: shot }, { status: 201 });
  } catch (error) {
    console.error("Failed to create shot:", error);
    return NextResponse.json(
      { success: false, error: "Internal server error" },
      { status: 500 }
    );
  }
}

export async function GET(req: Request) {
  try {
    const userId = await ensureUser();

    const movieId = new URL(req.url).searchParams.get("movieId");
    if (!movieId) {
      return NextResponse.json(
        { success: false, error: "movieId is required" },
        { status: 400 }
      );
    }

    const movie = await db.movie.findFirst({
      where: { id: movieId, userId },
      select: { id: true },
    });
    if (!movie) {
      return NextResponse.json(
        { success: false, error: "Movie not found" },
        { status: 404 }
      );
    }

    const shots = await db.shot.findMany({
      where: { movieId },
      include: {
        takes: {
          select: {
            id: true,
            thumbnailUrl: true,
            isHero: true,
            qualityScore: true,
          },
        },
      },
      orderBy: { order: "asc" },
    });

    return NextResponse.json({ success: true, data: shots });
  } catch (error) {
    console.error("Failed to list shots:", error);
    return NextResponse.json(
      { success: false, error: "Internal server error" },
      { status: 500 }
    );
  }
}
