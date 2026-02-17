export const CREDIT_COSTS = {
  REFERENCE_IMAGE: 1,
  VIDEO_DRAFT_5S: 5,
  VIDEO_DRAFT_10S: 8,
  VIDEO_STANDARD_5S: 15,
  VIDEO_STANDARD_10S: 25,
  VIDEO_CINEMA_5S: 40,
  VIDEO_CINEMA_10S: 65,
  MULTI_SHOT_STORYBOARD: 50,
  ASSEMBLY_EXPORT: 10,
  VOICE_LINE: 3,
  MUSIC_TRACK: 10,
} as const;

export type CreditOperation = keyof typeof CREDIT_COSTS;

export const PLAN_CREDITS = {
  FREE: 50,
  CREATOR: 500,
  PRO: 1500,
  STUDIO: 4000,
} as const;

export const PLAN_LIMITS = {
  FREE: {
    maxMovies: 1,
    maxTakesPerShot: 1,
    maxQuality: "draft" as const,
    watermark: true,
  },
  CREATOR: {
    maxMovies: 5,
    maxTakesPerShot: 2,
    maxQuality: "standard" as const,
    watermark: false,
  },
  PRO: {
    maxMovies: 20,
    maxTakesPerShot: 3,
    maxQuality: "cinema" as const,
    watermark: false,
  },
  STUDIO: {
    maxMovies: Infinity,
    maxTakesPerShot: 5,
    maxQuality: "cinema" as const,
    watermark: false,
  },
} as const;

export function getCreditCost(
  quality: "draft" | "standard" | "cinema",
  durationSeconds: number
): number {
  const isLong = durationSeconds > 7;
  switch (quality) {
    case "draft":
      return isLong ? CREDIT_COSTS.VIDEO_DRAFT_10S : CREDIT_COSTS.VIDEO_DRAFT_5S;
    case "standard":
      return isLong
        ? CREDIT_COSTS.VIDEO_STANDARD_10S
        : CREDIT_COSTS.VIDEO_STANDARD_5S;
    case "cinema":
      return isLong
        ? CREDIT_COSTS.VIDEO_CINEMA_10S
        : CREDIT_COSTS.VIDEO_CINEMA_5S;
  }
}
