import { FluxKontextProvider } from "@/lib/image-gen/flux-kontext";
import type { ImageGenProvider } from "@/lib/image-gen/provider";
import type {
  ScenePack,
  ScenePackImage,
  ScenePackImageAngle,
  ScriptScene,
  StyleBible,
} from "@/types/movie";

// ─── Angle definitions ──────────────────────────────────────────

interface AngleSpec {
  angle: ScenePackImageAngle;
  framing: string;
  shouldInclude: (scene: ScriptScene) => boolean;
}

const ANGLE_SPECS: AngleSpec[] = [
  {
    angle: "wide",
    framing: "Wide establishing shot showing the full location",
    shouldInclude: () => true,
  },
  {
    angle: "medium",
    framing: "Medium shot showing key set pieces and architectural details",
    shouldInclude: () => true,
  },
  {
    angle: "detail",
    framing: "Close-up detail shot of distinctive environment textures and objects",
    shouldInclude: () => true,
  },
  {
    angle: "atmospheric",
    framing: "Atmospheric shot emphasizing lighting, mood, and ambient qualities",
    shouldInclude: (scene) => {
      const atmospheric = /night|dawn|dusk|storm|rain|fog|mist|dark|dim|candle|neon|moonlight/i;
      return atmospheric.test(scene.timeOfDay) || atmospheric.test(scene.location);
    },
  },
];

// ─── Prompt assembly ────────────────────────────────────────────

function buildAnglePrompt(
  angle: AngleSpec,
  scene: ScriptScene,
  styleBible: StyleBible | null,
  shotEnvironments: string[],
): string {
  const parts: string[] = [];

  // Framing directive
  parts.push(angle.framing);

  // Location and time
  parts.push(`${scene.location}, ${scene.timeOfDay}`);

  // Pull in unique environment details from shots in this scene
  const uniqueEnvDetails = [...new Set(shotEnvironments.filter(Boolean))];
  if (uniqueEnvDetails.length > 0) {
    // Take first 2 to avoid prompt bloat
    parts.push(uniqueEnvDetails.slice(0, 2).join(". "));
  }

  // Explicit exclusion of people
  parts.push("Empty scene, no people, no characters, no figures, no human presence");

  // Style bible last
  if (styleBible?.styleString) {
    parts.push(styleBible.styleString);
  }

  return parts.filter(Boolean).join(". ").replace(/\.(\s*\.)+/g, ".").trim();
}

// ─── Generator ──────────────────────────────────────────────────

export interface GenerateScenePackInput {
  sceneIndex: number;
  scene: ScriptScene;
  styleBible: StyleBible | null;
  aspectRatio: string;
  /** Environment strings from shots in this scene */
  shotEnvironments: string[];
}

/**
 * Generates a scene pack (3-4 reference images) for a single scene.
 * Returns the pack with generated image URLs.
 *
 * Caller is responsible for credit deduction and persistence.
 */
export async function generateScenePack(
  input: GenerateScenePackInput,
  provider?: ImageGenProvider,
): Promise<ScenePack> {
  const imgProvider = provider ?? new FluxKontextProvider();
  const elementName = `element_scene_${input.sceneIndex}`;

  // Determine which angles to generate
  const angles = ANGLE_SPECS.filter((spec) => spec.shouldInclude(input.scene));

  const images: ScenePackImage[] = angles.map((spec) => ({
    angle: spec.angle,
    prompt: buildAnglePrompt(spec, input.scene, input.styleBible, input.shotEnvironments),
    imageUrl: null,
    status: "pending" as const,
  }));

  const pack: ScenePack = {
    sceneIndex: input.sceneIndex,
    status: "generating",
    images,
    elementName,
  };

  // Generate images sequentially (Flux is fast, ~5-10s per image)
  for (const image of pack.images) {
    try {
      const result = await imgProvider.generate({
        prompt: image.prompt,
        aspectRatio: input.aspectRatio,
      });
      image.imageUrl = result.imageUrl;
      image.status = "complete";
    } catch (err) {
      console.error(
        `[scene-pack] Failed to generate ${image.angle} for scene ${input.sceneIndex}:`,
        err,
      );
      image.status = "failed";
    }
  }

  // Determine overall status
  const completedCount = pack.images.filter((img) => img.status === "complete").length;
  if (completedCount === pack.images.length) {
    pack.status = "complete";
  } else if (completedCount > 0) {
    pack.status = "complete"; // Partial success is still usable
  } else {
    pack.status = "failed";
  }

  return pack;
}

/**
 * Returns the number of images that will be generated for a scene.
 * Used for credit estimation before generation.
 */
export function getScenePackImageCount(scene: ScriptScene): number {
  return ANGLE_SPECS.filter((spec) => spec.shouldInclude(scene)).length;
}
