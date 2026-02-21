import type { ImageGenProvider, ImageGenInput, ImageGenResult } from "./provider";

/**
 * Flux Kontext Pro image generation via kie.ai.
 * Extracts the generation logic from the generate-image API route
 * into a reusable provider class.
 */
export class FluxKontextProvider implements ImageGenProvider {
  id = "flux-kontext-pro";
  name = "Flux Kontext Pro";

  private apiKey: string;
  private maxPollMs: number;

  constructor(opts?: { apiKey?: string; maxPollMs?: number }) {
    this.apiKey = opts?.apiKey ?? process.env.KIE_API_KEY ?? "";
    this.maxPollMs = opts?.maxPollMs ?? 90_000;
  }

  async generate(input: ImageGenInput): Promise<ImageGenResult> {
    if (!this.apiKey) {
      throw new Error("KIE_API_KEY not configured");
    }

    const requestBody: Record<string, unknown> = {
      model: "flux-kontext-pro",
      prompt: input.prompt,
      aspectRatio: input.aspectRatio,
      outputFormat: "jpeg",
      enableTranslation: false,
      promptUpsampling: false,
    };

    if (input.referenceImageUrl) {
      requestBody.inputImage = input.referenceImageUrl;
    }

    const res = await fetch("https://api.kie.ai/api/v1/flux/kontext/generate", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${this.apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(requestBody),
    });

    if (!res.ok) {
      const text = await res.text();
      throw new Error(`Flux API error (${res.status}): ${text}`);
    }

    const createResult = await res.json();
    if (createResult.code !== 200 || !createResult.data?.taskId) {
      throw new Error(createResult.msg ?? "Failed to create image task");
    }

    // Poll for completion
    const taskId = createResult.data.taskId;
    const start = Date.now();

    while (Date.now() - start < this.maxPollMs) {
      await new Promise((r) => setTimeout(r, 2000));

      const pollRes = await fetch(
        `https://api.kie.ai/api/v1/flux/kontext/record-info?taskId=${encodeURIComponent(taskId)}`,
        { headers: { Authorization: `Bearer ${this.apiKey}` } },
      );

      if (!pollRes.ok) continue;

      const pollJson = await pollRes.json();
      if (pollJson.code !== 200 || !pollJson.data) continue;

      const { successFlag, response, errorMessage } = pollJson.data;

      // 1 = SUCCESS
      if (successFlag === 1 && response?.resultImageUrl) {
        return { imageUrl: response.resultImageUrl, prompt: input.prompt };
      }

      // 2 = CREATE_TASK_FAILED, 3 = GENERATE_FAILED
      if (successFlag === 2 || successFlag === 3) {
        throw new Error(errorMessage || "Image generation failed");
      }

      // 0 = still generating, keep polling
    }

    throw new Error("Generation timed out");
  }
}
