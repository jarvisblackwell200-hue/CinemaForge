export interface StyleBible {
  filmStock: string;
  colorPalette: string;
  textures: string[];
  negativePrompt: string;
  styleString: string;
}

export interface ScriptBeat {
  description: string;
  emotionalTone: string;
  dialogue?: {
    character: string;
    line: string;
    emotion: string;
  }[];
}

export interface ScriptScene {
  title: string;
  location: string;
  timeOfDay: string;
  beats: ScriptBeat[];
}

export interface Script {
  scenes: ScriptScene[];
}

// ─── Scene Packs (environment consistency) ───────────────────

export type ScenePackImageAngle = "wide" | "medium" | "detail" | "atmospheric";
export type ScenePackStatus = "pending" | "generating" | "complete" | "failed";

export interface ScenePackImage {
  angle: ScenePackImageAngle;
  prompt: string;
  imageUrl: string | null;
  status: "pending" | "complete" | "failed";
}

export interface ScenePack {
  sceneIndex: number;
  status: ScenePackStatus;
  images: ScenePackImage[];
  elementName: string; // "element_scene_0" — used in kling_elements
}

// ─── Script Analysis ─────────────────────────────────────────

export interface ScriptAnalysis {
  synopsis: string;
  genre: string;
  suggestedDuration: number;
  scenes: ScriptScene[];
  characters: {
    name: string;
    role: string;
    suggestedVisualDescription: string;
  }[];
  styleSuggestions: {
    genre: string;
    filmStock: string;
    colorPalette: string;
    textures: string[];
    negativePrompt: string;
  };
  estimatedShots: number;
  estimatedCredits: number;
}
