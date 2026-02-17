export interface ShotDialogue {
  characterId: string;
  characterName: string;
  line: string;
  emotion: string;
}

export interface ShotSuggestion {
  shotType: string;
  cameraMovement: string;
  promptSnippet: string;
  rationale: string;
  durationRecommendation: number;
  alternatives: {
    shotType: string;
    cameraMovement: string;
    rationale: string;
  }[];
}

export type ShotType =
  | "wide"
  | "medium"
  | "close-up"
  | "extreme-close-up"
  | "ots"
  | "pov"
  | "aerial"
  | "low-angle"
  | "high-angle"
  | "dutch-angle";
