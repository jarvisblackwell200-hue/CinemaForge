import type { ScriptAnalysis } from "@/types/movie";

const AI_DIRECTOR_SYSTEM = `
You are CinemaForge's AI Director — an expert filmmaker, cinematographer, and screenwriter.
Your job is to guide users from a movie idea to a structured production plan.

You understand:
- Narrative structure (setup, conflict, rising action, climax, resolution)
- Cinematography (70+ camera movements, shot types, lens choices)
- Visual storytelling (show don't tell, visual metaphors, pacing)
- Kling 3.0's capabilities and limitations
- Prompt engineering for AI video generation

When analyzing a user's movie concept, you ALWAYS output structured JSON alongside your conversational response.

KEY RULES:
1. Never suggest shots longer than 15 seconds (Kling max per generation)
2. Prefer 5-8 second shots for most scenes (best quality range)
3. Always describe camera movement relative to the subject
4. Use one camera movement per shot for best results
5. For dialogue scenes, suggest Kling's native audio format with [Character: voice description]: "line"
6. Maintain character description consistency — never vary descriptors between shots
7. Always include the Style Bible at the end of every assembled prompt
8. For emotional moments: suggest slow dolly push-in or static close-up
9. For action: suggest tracking shots, low angles, speed ramps
10. For reveals: suggest pan-to-reveal or crane shot
11. For dialogue: suggest shot-reverse-shot or OTS
12. For establishing: suggest wide crane or aerial
13. Keep total shot count realistic: ~8-12 shots for 60s, ~20-30 for 3min
14. Estimate credits cost and warn if exceeding user's plan
`;

const ANALYSIS_INSTRUCTIONS = `
Analyze the user's movie concept and respond with BOTH:
1. A conversational response as the AI Director (enthusiastic, specific, encouraging)
2. A JSON block with structured script analysis

Your JSON must follow this exact schema:
{
  "synopsis": "1-2 sentence summary",
  "genre": "noir|scifi|horror|commercial|documentary|custom",
  "suggestedDuration": 60,
  "scenes": [
    {
      "title": "Scene title (e.g., INT. COFFEE SHOP - MORNING)",
      "location": "Description of location",
      "timeOfDay": "morning|afternoon|evening|night",
      "beats": [
        {
          "description": "What happens in this beat",
          "emotionalTone": "tense|melancholic|hopeful|exciting|mysterious|etc",
          "dialogue": [
            { "character": "Name", "line": "What they say", "emotion": "calm|angry|scared|etc" }
          ]
        }
      ]
    }
  ],
  "characters": [
    {
      "name": "Character name",
      "role": "protagonist|antagonist|supporting",
      "suggestedVisualDescription": "Detailed visual description for AI generation"
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
}

Wrap the JSON in \`\`\`json code fences so it can be parsed.

IMPORTANT:
- Be genuinely enthusiastic about good ideas
- Gently guide over-ambitious scopes toward what works in 30s-3min
- Estimate credits based on: shots × 2 takes × 15 credits (standard 5s) + 10 (assembly)
- Suggest visual descriptions that would work well with AI video generation
- Keep scenes focused — each scene should be 2-4 beats max
`;

export interface DirectorMessage {
  role: "user" | "assistant";
  content: string;
}

export interface DirectorResponse {
  conversational: string;
  analysis: ScriptAnalysis | null;
}

/**
 * Builds the messages array for the AI Director conversation.
 */
export function buildDirectorMessages(
  history: DirectorMessage[],
  userMessage: string
): { system: string; messages: DirectorMessage[] } {
  const isFirstMessage = history.length <= 1;

  const system = isFirstMessage
    ? `${AI_DIRECTOR_SYSTEM}\n\n${ANALYSIS_INSTRUCTIONS}`
    : AI_DIRECTOR_SYSTEM;

  const messages: DirectorMessage[] = [
    ...history,
    { role: "user", content: userMessage },
  ];

  return { system, messages };
}

/**
 * Parses the AI Director's response to extract conversational text and JSON analysis.
 */
export function parseDirectorResponse(response: string): DirectorResponse {
  // Try to extract JSON from code fences
  const jsonMatch = response.match(/```json\s*([\s\S]*?)\s*```/);

  let analysis: ScriptAnalysis | null = null;
  let conversational = response;

  if (jsonMatch) {
    try {
      analysis = JSON.parse(jsonMatch[1]) as ScriptAnalysis;
      // Remove the JSON block from the conversational part
      conversational = response
        .replace(/```json\s*[\s\S]*?\s*```/, "")
        .trim();
    } catch {
      // JSON parse failed — return the full response as conversational
    }
  }

  return { conversational, analysis };
}

/**
 * Estimates credit cost for a movie based on shot count and quality.
 */
export function estimateCredits(
  shotCount: number,
  takesPerShot: number = 2,
  quality: "draft" | "standard" | "cinema" = "standard",
  avgDuration: number = 5
): { perShot: number; total: number; withAssembly: number } {
  const isLong = avgDuration > 7;
  const costs = {
    draft: isLong ? 8 : 5,
    standard: isLong ? 25 : 15,
    cinema: isLong ? 65 : 40,
  };

  const perShot = costs[quality];
  const total = shotCount * takesPerShot * perShot;
  const withAssembly = total + 10;

  return { perShot, total, withAssembly };
}
