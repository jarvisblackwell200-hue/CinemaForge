export interface ImageGenInput {
  prompt: string;
  aspectRatio: string;
  referenceImageUrl?: string;
  style?: string;
}

export interface ImageGenResult {
  imageUrl: string;
  prompt: string;
}

export interface ImageGenProvider {
  id: string;
  name: string;
  generate(input: ImageGenInput): Promise<ImageGenResult>;
}
