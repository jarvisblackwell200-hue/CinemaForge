export interface GenrePreset {
  id: string;
  name: string;
  description: string;
  styleBible: {
    filmStock: string;
    colorPalette: string;
    textures: string[];
    negativePrompt: string;
    styleString: string;
  };
  cameraPreferences: string[];
  lightingKeywords: string[];
  pacing: "slow" | "moderate" | "fast";
  avgShotDuration: number;
}

export const GENRE_PRESETS: GenrePreset[] = [
  {
    id: "noir",
    name: "Film Noir",
    description:
      "Rain-slicked streets, hard shadows, and moral ambiguity rendered in desaturated teal tones with crushed blacks. Evokes the tension and mystery of classic detective cinema with a modern cinematic edge.",
    styleBible: {
      filmStock: "shot on 35mm film, anamorphic lens",
      colorPalette: "desaturated teal grade, crushed blacks",
      textures: [
        "heavy film grain",
        "shallow depth of field",
        "wet reflective surfaces",
        "hard shadows",
      ],
      negativePrompt:
        "bright colors, sunny, cheerful, overexposed, cartoon, anime, saturated, warm tones, flat lighting, daytime exterior",
      styleString:
        "Desaturated teal grade, crushed blacks, hard side-lighting, wet reflective surfaces, shot on 35mm film, anamorphic lens, heavy film grain, narrow depth of field, cinematic. 4K.",
    },
    cameraPreferences: [
      "dolly-push-in",
      "static-wide",
      "pan-reveal",
      "low-angle-tracking",
      "dutch-angle",
    ],
    lightingKeywords: [
      "hard side-light",
      "neon reflections",
      "single source overhead",
      "rim lighting",
      "flickering",
      "chiaroscuro",
    ],
    pacing: "slow",
    avgShotDuration: 6,
  },
  {
    id: "scifi",
    name: "Sci-Fi Cinematic",
    description:
      "A polished futuristic aesthetic built on cool blue-steel tones, volumetric haze, and precise lens flares. Designed for expansive world-building shots and sleek character moments that feel both grand and grounded.",
    styleBible: {
      filmStock: "shot on ARRI Alexa, anamorphic",
      colorPalette: "cool blue-steel palette, neon accents",
      textures: [
        "clean sharp focus",
        "lens flares",
        "volumetric lighting",
        "atmospheric haze",
      ],
      negativePrompt:
        "vintage, warm tones, natural settings, amateur, shaky, film grain, rustic, pastoral, low resolution, hand-drawn",
      styleString:
        "Cool blue-steel palette, volumetric lighting, lens flares, shot on ARRI Alexa, anamorphic, clean sharp focus, futuristic, neon accents, atmospheric haze, cinematic. 4K.",
    },
    cameraPreferences: [
      "crane-up-reveal",
      "tracking-follow",
      "orbit-360",
      "dolly-push-in",
      "static-wide",
    ],
    lightingKeywords: [
      "neon",
      "holographic",
      "volumetric",
      "backlit",
      "cold LED",
      "bioluminescent",
    ],
    pacing: "moderate",
    avgShotDuration: 5,
  },
  {
    id: "horror",
    name: "Horror / Thriller",
    description:
      "Claustrophobic framing and deep, unforgiving shadows create constant unease. Heavy 35mm grain and desaturated muted greens give every frame a sense of dread and decay.",
    styleBible: {
      filmStock: "shot on 35mm film",
      colorPalette: "desaturated, high contrast, muted greens",
      textures: [
        "heavy film grain",
        "deep shadows",
        "claustrophobic framing",
        "flickering light",
      ],
      negativePrompt:
        "bright, colorful, happy, wide open spaces, cheerful, cartoon, well-lit, saturated, clean, polished, studio lighting",
      styleString:
        "Desaturated, high contrast, deep shadows, flickering light, handheld slight shake, 35mm film grain, claustrophobic framing, muted greens and yellows, cinematic. 4K.",
    },
    cameraPreferences: [
      "handheld",
      "dolly-push-in",
      "dutch-angle",
      "rack-focus",
      "static-wide",
    ],
    lightingKeywords: [
      "flickering",
      "single candle",
      "moonlight",
      "deep shadow",
      "practical lights only",
      "under-lit",
    ],
    pacing: "slow",
    avgShotDuration: 7,
  },
  {
    id: "commercial",
    name: "Commercial / Product",
    description:
      "Pristine, high-production-value imagery with soft diffused lighting and razor-sharp detail. Every frame feels aspirational and polished, designed to showcase subjects at their absolute best.",
    styleBible: {
      filmStock: "shot on RED Komodo",
      colorPalette: "clean, bright, color-accurate",
      textures: [
        "shallow depth of field",
        "soft diffused lighting",
        "4K sharp",
        "high production value",
      ],
      negativePrompt:
        "dark, gritty, noisy, amateur, shaky, film grain, vintage, desaturated, low budget, harsh shadows, ugly",
      styleString:
        "Clean, bright, professional, shot on RED Komodo, shallow depth of field, soft diffused lighting, high production value, color-accurate, 4K sharp, cinematic.",
    },
    cameraPreferences: [
      "orbit-360",
      "dolly-push-in",
      "macro-close-up",
      "crane-up-reveal",
      "tracking-follow",
    ],
    lightingKeywords: [
      "soft diffused",
      "bright key light",
      "rim light",
      "studio lighting",
      "golden hour",
      "beauty dish",
    ],
    pacing: "moderate",
    avgShotDuration: 4,
  },
  {
    id: "documentary",
    name: "Documentary / Observational",
    description:
      "An authentic, unpolished visual language that prioritizes truth over perfection. Muted earth tones and available light give every frame the intimacy and credibility of real-world observation.",
    styleBible: {
      filmStock: "shot on 16mm film",
      colorPalette: "muted earth tones, natural",
      textures: [
        "handheld feel",
        "natural grain",
        "authentic",
        "available light",
      ],
      negativePrompt:
        "dramatic lighting, neon, fantasy, CGI, perfect, polished, studio lighting, saturated, cinematic color grade, lens flares",
      styleString:
        "Natural lighting, handheld feel, observational, 16mm film aesthetic, muted earth tones, authentic, unpolished, documentary. 4K.",
    },
    cameraPreferences: [
      "handheld",
      "static-wide",
      "tracking-follow",
      "rack-focus",
    ],
    lightingKeywords: [
      "natural",
      "available light",
      "overcast",
      "window light",
      "practical",
      "mixed color temperature",
    ],
    pacing: "moderate",
    avgShotDuration: 6,
  },
];

export function getGenrePreset(id: string): GenrePreset | undefined {
  return GENRE_PRESETS.find((preset) => preset.id === id);
}
