export interface VoiceProfile {
  language: string;
  accent: string;
  tone: string;
  speed: "slow" | "normal" | "fast";
}

export interface CharacterFormData {
  name: string;
  role: "protagonist" | "antagonist" | "supporting" | "background";
  age: string;
  gender: string;
  build: string;
  hairColor: string;
  hairStyle: string;
  clothing: string;
  distinguishingFeatures: string;
  additionalDetails: string;
}
