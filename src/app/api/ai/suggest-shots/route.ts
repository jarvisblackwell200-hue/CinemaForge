import { NextRequest, NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import { z } from "zod/v4";
import type { ShotSuggestion } from "@/types/shot";

const RequestSchema = z.object({
  beat: z.object({
    description: z.string(),
    emotionalTone: z.string(),
    dialogue: z
      .array(
        z.object({
          character: z.string(),
          line: z.string(),
          emotion: z.string(),
        })
      )
      .optional(),
  }),
  genre: z.string(),
  sceneContext: z.string().optional(),
  previousShotType: z.string().optional(),
});

const SHOT_SUGGESTION_PROMPT = `You are a cinematographer suggesting camera setups for an AI-generated video.

Given a scene beat (what happens emotionally and physically) and the film's genre, suggest 3 camera/shot options ranked by how well they serve the story.

RULES:
- Each suggestion must use exactly ONE camera movement
- Prefer 5-8 second shots (best quality for AI video)
- The rationale should explain WHY this camera choice enhances the emotional beat
- Consider genre conventions (noir = low angles + shadows, horror = dutch angles + handheld, etc.)
- If there was a previous shot type, suggest something that creates good visual rhythm (don't repeat the same angle)
- The promptSnippet should be ready to inject into a Kling prompt

Respond with ONLY valid JSON, no other text:
{
  "suggestions": [
    {
      "shotType": "close-up",
      "cameraMovement": "dolly-push-in",
      "promptSyntax": "Slow dolly push-in from medium shot to close-up",
      "promptSnippet": "Slow dolly push-in from medium shot to close-up, capturing the subject's expression",
      "rationale": "A push-in creates intimacy — the audience leans in with the character during this emotional moment",
      "durationRecommendation": 6,
      "alternatives": [
        {
          "shotType": "medium",
          "cameraMovement": "static-medium",
          "rationale": "A static medium holds space for the emotion without pushing"
        }
      ]
    }
  ]
}`;

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const parsed = RequestSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { success: false, error: z.prettifyError(parsed.error) },
        { status: 400 }
      );
    }

    const apiKey = process.env.ANTHROPIC_API_KEY;
    if (!apiKey) {
      return NextResponse.json(
        {
          success: false,
          error: "ANTHROPIC_API_KEY not configured",
        },
        { status: 500 }
      );
    }

    const client = new Anthropic({ apiKey });

    const { beat, genre, sceneContext, previousShotType } = parsed.data;

    const userPrompt = [
      `Genre: ${genre}`,
      `Beat: ${beat.description}`,
      `Emotional tone: ${beat.emotionalTone}`,
      beat.dialogue?.length
        ? `Dialogue: ${beat.dialogue.map((d) => `${d.character}: "${d.line}"`).join(", ")}`
        : null,
      sceneContext ? `Scene context: ${sceneContext}` : null,
      previousShotType
        ? `Previous shot was: ${previousShotType} (suggest variety)`
        : null,
    ]
      .filter(Boolean)
      .join("\n");

    const response = await client.messages.create({
      model: "claude-sonnet-4-5-20250929",
      max_tokens: 1024,
      system: SHOT_SUGGESTION_PROMPT,
      messages: [{ role: "user", content: userPrompt }],
    });

    const text =
      response.content[0].type === "text" ? response.content[0].text : "";

    try {
      const parsed = JSON.parse(text) as { suggestions: ShotSuggestion[] };
      return NextResponse.json({
        success: true,
        data: parsed.suggestions,
      });
    } catch {
      return NextResponse.json(
        { success: false, error: "Failed to parse AI response" },
        { status: 500 }
      );
    }
  } catch (error) {
    console.error("Shot suggestion error:", error);
    return NextResponse.json(
      { success: false, error: "Internal server error" },
      { status: 500 }
    );
  }
}
