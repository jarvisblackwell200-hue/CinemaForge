import { NextResponse } from "next/server";
import { z } from "zod/v4";
import Anthropic from "@anthropic-ai/sdk";
import { db } from "@/lib/db";
import { ensureUser } from "@/lib/auth";
import { getGenrePreset } from "@/lib/constants/genre-presets";
import { planShotsFromScript } from "@/lib/ai/shot-planner";
import { parseDirectorResponse, estimateCredits } from "@/lib/ai/director";
import { resolveCelebrityImages } from "@/lib/celebrity";
import type { StyleBible } from "@/types/movie";

const QuickCreateSchema = z.object({
  concept: z.string().min(10, "Concept must be at least 10 characters"),
  targetDuration: z.number().int().min(30).max(180).optional(),
});

const QUICK_CREATE_SYSTEM = `You are CinemaForge's AI Director. Given a movie concept, produce ONLY a JSON response (no conversational text). Your output must be a valid JSON object wrapped in \`\`\`json code fences.

RULES:
- Generate a creative, specific title (never generic)
- Break the story into 2-5 scenes depending on target duration
- Each scene has 1-4 beats with emotional tones
- Suggest 1-3 characters with detailed visual descriptions suitable for AI video generation
- Visual descriptions must be specific: age, build, hair, clothing, distinguishing features
- Pick the best genre from: noir, scifi, horror, commercial, documentary, custom
- Keep scenes focused and visual — describe what the CAMERA sees
- For ~60s target: 3-4 scenes, 8-12 total beats
- For ~30s target: 2-3 scenes, 4-6 total beats
- For ~120s+: 4-5 scenes, 15-25 total beats
- Vary your creative choices — never produce the same structure twice
- Be bold and cinematic in your descriptions
- If the character is or is based on a real celebrity, set "celebrityRef" to their full real name (e.g. "Keanu Reeves"). Keep the celebrity name in "suggestedVisualDescription" too for text-to-video fallback. Set to null for fictional characters.

JSON Schema:
{
  "title": "Creative movie title",
  "synopsis": "1-2 sentence summary",
  "genre": "noir|scifi|horror|commercial|documentary|custom",
  "suggestedDuration": 60,
  "scenes": [
    {
      "title": "INT. LOCATION - TIME",
      "location": "Detailed location description",
      "timeOfDay": "morning|afternoon|evening|night",
      "beats": [
        {
          "description": "Vivid description of what happens — what the camera sees",
          "emotionalTone": "tense|melancholic|hopeful|exciting|mysterious|dramatic|peaceful|fearful|angry|sad|romantic|suspenseful|triumphant|chaotic|reflective|ominous",
          "dialogue": [
            { "character": "Name", "line": "What they say", "emotion": "calm|angry|scared|hopeful|etc" }
          ]
        }
      ]
    }
  ],
  "characters": [
    {
      "name": "Character Name",
      "role": "protagonist|antagonist|supporting",
      "suggestedVisualDescription": "Detailed physical appearance for AI video generation",
      "celebrityRef": "Real Person Name or null"
    }
  ],
  "styleSuggestions": {
    "genre": "noir",
    "filmStock": "shot on 35mm film, anamorphic lens",
    "colorPalette": "desaturated teal grade",
    "textures": ["film grain", "shallow depth of field"],
    "negativePrompt": "bright colors, cheerful"
  },
  "estimatedShots": 10,
  "estimatedCredits": 300
}`;

export async function POST(req: Request) {
  try {
    const userId = await ensureUser();

    const body = await req.json();
    const parsed = QuickCreateSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { success: false, error: z.prettifyError(parsed.error) },
        { status: 400 }
      );
    }

    const { concept, targetDuration = 60 } = parsed.data;

    // Step 1: Call Claude for script analysis (single call with temperature 1.0 for variety)
    const anthropic = new Anthropic();
    const message = await anthropic.messages.create({
      model: "claude-sonnet-4-5-20250929",
      max_tokens: 4096,
      temperature: 1.0,
      system: QUICK_CREATE_SYSTEM,
      messages: [
        {
          role: "user",
          content: `Movie concept: "${concept}"\nTarget duration: ${targetDuration} seconds\n\nGenerate the complete script analysis JSON now.`,
        },
      ],
    });

    // Extract text content from Claude response
    const responseText = message.content
      .filter((block): block is Anthropic.TextBlock => block.type === "text")
      .map((block) => block.text)
      .join("");

    // Parse the JSON from the response
    const { analysis } = parseDirectorResponse(responseText);
    if (!analysis) {
      return NextResponse.json(
        { success: false, error: "Failed to generate script analysis. Please try again." },
        { status: 500 }
      );
    }

    // Extract title from raw JSON (not in ScriptAnalysis type but returned by our prompt)
    const jsonMatch = responseText.match(/```json\s*([\s\S]*?)\s*```/);
    let title = `Untitled — ${concept.slice(0, 30)}`;
    if (jsonMatch) {
      try {
        const raw = JSON.parse(jsonMatch[1]);
        if (typeof raw.title === "string" && raw.title.trim()) {
          title = raw.title.trim();
        }
      } catch { /* use fallback title */ }
    }

    // Step 2: Resolve genre preset
    const genrePreset = getGenrePreset(analysis.genre) ?? null;

    // Build style bible from preset or Claude's suggestions
    let styleBible: StyleBible;
    if (genrePreset) {
      styleBible = genrePreset.styleBible;
    } else {
      const s = analysis.styleSuggestions;
      styleBible = {
        filmStock: s.filmStock,
        colorPalette: s.colorPalette,
        textures: s.textures,
        negativePrompt: s.negativePrompt,
        styleString: `${s.colorPalette}, ${s.textures.join(", ")}, ${s.filmStock}, cinematic. 4K.`,
      };
    }

    // Step 3: Create Movie record
    const movie = await db.movie.create({
      data: {
        userId,
        title,
        synopsis: analysis.synopsis,
        genre: analysis.genre,
        targetDuration: analysis.suggestedDuration ?? targetDuration,
        status: "STORYBOARDING",
        styleBible: JSON.parse(JSON.stringify(styleBible)),
        script: JSON.parse(JSON.stringify({ scenes: analysis.scenes })),
      },
      select: { id: true, title: true },
    });

    // Step 4: Create Character records
    const characterRecords = await db.$transaction(
      analysis.characters.map((char) =>
        db.character.create({
          data: {
            movieId: movie.id,
            name: char.name,
            role: char.role,
            visualDescription: char.suggestedVisualDescription,
          },
          select: { id: true, name: true, role: true, visualDescription: true },
        })
      )
    );

    // Step 4b: Resolve celebrity reference images
    // Extract celebrityRef from the raw JSON (not in ScriptAnalysis type)
    const celebrityRefs = new Map<string, string>(); // characterName → celebrityRef
    if (jsonMatch) {
      try {
        const raw = JSON.parse(jsonMatch[1]);
        if (Array.isArray(raw.characters)) {
          for (const rawChar of raw.characters) {
            if (typeof rawChar.celebrityRef === "string" && rawChar.celebrityRef.trim()) {
              celebrityRefs.set(rawChar.name, rawChar.celebrityRef.trim());
            }
          }
        }
      } catch { /* ignore parse errors — already parsed above */ }
    }

    // Fetch Wikipedia headshots for all celebrity references
    const celebrityNames = [...celebrityRefs.values()];
    const celebrityImages = await resolveCelebrityImages(celebrityNames);

    // Update character records with resolved reference images
    const characterUpdates: Promise<unknown>[] = [];
    for (const char of characterRecords) {
      const celeb = celebrityRefs.get(char.name);
      if (celeb && celebrityImages.has(celeb)) {
        characterUpdates.push(
          db.character.update({
            where: { id: char.id },
            data: { referenceImages: [celebrityImages.get(celeb)!] },
          })
        );
      }
    }
    if (characterUpdates.length > 0) {
      await Promise.all(characterUpdates);
    }

    // Build character list with referenceImages for the shot planner
    const charactersWithRefs = characterRecords.map((c) => {
      const celeb = celebrityRefs.get(c.name);
      const refImages = celeb && celebrityImages.has(celeb) ? [celebrityImages.get(celeb)!] : [];
      return {
        id: c.id,
        name: c.name,
        role: c.role,
        visualDescription: c.visualDescription,
        referenceImages: refImages,
      };
    });

    // Step 5: Plan shots using the deterministic planner
    const plannedShots = planShotsFromScript(
      analysis,
      charactersWithRefs,
      styleBible,
      genrePreset,
    );

    // Step 6: Bulk-create Shot records
    const shotRecords = await db.$transaction(
      plannedShots.map((shot) =>
        db.shot.create({
          data: {
            movieId: movie.id,
            sceneIndex: shot.sceneIndex,
            order: shot.order,
            shotType: shot.shotType,
            cameraMovement: shot.cameraMovement,
            subject: shot.subject,
            action: shot.action,
            environment: shot.environment,
            lighting: shot.lighting,
            dialogue: shot.dialogue ?? undefined,
            durationSeconds: shot.durationSeconds,
            generatedPrompt: shot.generatedPrompt,
            negativePrompt: shot.negativePrompt,
          },
        })
      )
    );

    // Estimate credits for generating all shots
    const creditEstimate = estimateCredits(
      shotRecords.length,
      1, // 1 take per shot for estimate
      "standard",
      genrePreset?.avgShotDuration ?? 5,
    );

    return NextResponse.json(
      {
        success: true,
        data: {
          movieId: movie.id,
          title: movie.title,
          shotCount: shotRecords.length,
          characterCount: characterRecords.length,
          estimatedCredits: creditEstimate.withAssembly,
        },
      },
      { status: 201 }
    );
  } catch (error) {
    console.error("Quick create failed:", error);

    if (error instanceof Error && error.message === "Unauthorized") {
      return NextResponse.json(
        { success: false, error: "Unauthorized" },
        { status: 401 }
      );
    }

    return NextResponse.json(
      { success: false, error: "Failed to create movie. Please try again." },
      { status: 500 }
    );
  }
}
