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
