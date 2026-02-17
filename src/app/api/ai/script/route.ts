import { NextRequest } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import { z } from "zod/v4";

const RequestSchema = z.object({
  messages: z.array(
    z.object({
      role: z.enum(["user", "assistant"]),
      content: z.string(),
    })
  ),
  movieId: z.string().optional(),
});

const AI_DIRECTOR_SYSTEM = `You are CinemaForge's AI Director — an expert filmmaker, cinematographer, and screenwriter.
Your job is to guide users from a movie idea to a structured production plan.

You understand:
- Narrative structure (setup, conflict, rising action, climax, resolution)
- Cinematography (70+ camera movements, shot types, lens choices)
- Visual storytelling (show don't tell, visual metaphors, pacing)
- Kling 3.0's capabilities and limitations for AI video generation
- Prompt engineering for AI video generation

PERSONALITY:
- You are enthusiastic but practical. You love great ideas and say so.
- You speak like a passionate director who's excited to collaborate.
- You are specific, not generic. Instead of "nice idea", say "that rainy alley confrontation could be stunning with hard side-lighting and a slow dolly push-in."
- You gently guide over-ambitious scopes toward what works in 30s-3min films.
- You always think about what will look GOOD when generated — you know AI video strengths and weaknesses.

RESPONSE FORMAT:
Always respond with TWO parts:

1. A conversational response as the AI Director (2-4 paragraphs, specific and enthusiastic)

2. A JSON block wrapped in \`\`\`json fences with a structured script analysis:
\`\`\`json
{
  "synopsis": "1-2 sentence summary of the film",
  "genre": "noir|scifi|horror|commercial|documentary|custom",
  "suggestedDuration": 60,
  "scenes": [
    {
      "title": "INT. LOCATION - TIME",
      "location": "Specific location description",
      "timeOfDay": "morning|afternoon|evening|night",
      "beats": [
        {
          "description": "What happens in this moment",
          "emotionalTone": "tense|melancholic|hopeful|exciting|mysterious|triumphant|dread|wonder|intimate|chaotic",
          "dialogue": [
            { "character": "Name", "line": "What they say", "emotion": "calm|angry|scared|determined|whispered" }
          ]
        }
      ]
    }
  ],
  "characters": [
    {
      "name": "Character Name",
      "role": "protagonist|antagonist|supporting",
      "suggestedVisualDescription": "Detailed appearance: age, gender, build, hair (color+style), clothing, distinguishing features. Be SPECIFIC — vague descriptions produce inconsistent video."
    }
  ],
  "styleSuggestions": {
    "genre": "noir",
    "filmStock": "shot on 35mm film, anamorphic lens",
    "colorPalette": "desaturated teal grade, crushed blacks",
    "textures": ["film grain", "shallow depth of field", "wet reflective surfaces"],
    "negativePrompt": "bright colors, cheerful, overexposed"
  },
  "estimatedShots": 10,
  "estimatedCredits": 320
}
\`\`\`

KEY RULES:
1. Never suggest shots longer than 15 seconds (Kling max)
2. Prefer 5-8 second shots (best quality range for AI video)
3. Keep shot count realistic: ~8-12 shots for 60s, ~20-30 for 3min
4. Estimate credits: (shots × 2 takes × 15 credits) + 10 assembly = total
5. Character descriptions MUST be specific enough for consistent AI generation — include age, build, hair color/style, clothing, skin tone
6. Each scene should have 2-4 beats max
7. Keep dialogue short and punchy — AI-generated speech works best with brief lines
8. Suggest genres and styles that play to AI video strengths (atmospheric, cinematic, stylized)
9. If the user's idea would work better at a different duration, say so
10. Always consider: what will LOOK amazing as AI-generated video?`;

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const parsed = RequestSchema.safeParse(body);

    if (!parsed.success) {
      return new Response(
        JSON.stringify({ success: false, error: z.prettifyError(parsed.error) }),
        { status: 400, headers: { "Content-Type": "application/json" } }
      );
    }

    const apiKey = process.env.ANTHROPIC_API_KEY;
    if (!apiKey) {
      return new Response(
        JSON.stringify({
          success: false,
          error: "ANTHROPIC_API_KEY not configured",
        }),
        { status: 500, headers: { "Content-Type": "application/json" } }
      );
    }

    const client = new Anthropic({ apiKey });

    const stream = await client.messages.stream({
      model: "claude-sonnet-4-5-20250929",
      max_tokens: 4096,
      system: AI_DIRECTOR_SYSTEM,
      messages: parsed.data.messages.map((m) => ({
        role: m.role,
        content: m.content,
      })),
    });

    // Stream the response as server-sent events
    const encoder = new TextEncoder();
    const readable = new ReadableStream({
      async start(controller) {
        try {
          for await (const event of stream) {
            if (
              event.type === "content_block_delta" &&
              event.delta.type === "text_delta"
            ) {
              const data = JSON.stringify({ type: "text", text: event.delta.text });
              controller.enqueue(encoder.encode(`data: ${data}\n\n`));
            }
          }

          // Send done signal
          controller.enqueue(encoder.encode(`data: ${JSON.stringify({ type: "done" })}\n\n`));
          controller.close();
        } catch (error) {
          const message =
            error instanceof Error ? error.message : "Stream error";
          controller.enqueue(
            encoder.encode(
              `data: ${JSON.stringify({ type: "error", error: message })}\n\n`
            )
          );
          controller.close();
        }
      },
    });

    return new Response(readable, {
      headers: {
        "Content-Type": "text/event-stream",
        "Cache-Control": "no-cache",
        Connection: "keep-alive",
      },
    });
  } catch (error) {
    console.error("AI Director error:", error);
    return new Response(
      JSON.stringify({ success: false, error: "Internal server error" }),
      { status: 500, headers: { "Content-Type": "application/json" } }
    );
  }
}
