import { describe, it, expect } from "vitest";
import { extractLastFrame, extractFirstFrame } from "@/lib/video/frames";

// ─── extractLastFrame ──────────────────────────────────────────

describe("extractLastFrame", () => {
  it("returns a placeholder URL in dry-run mode", async () => {
    const result = await extractLastFrame("https://example.com/video.mp4");
    expect(result).toBeTruthy();
    expect(typeof result).toBe("string");
  });

  it("returns a valid URL string in dry-run mode", async () => {
    const result = await extractLastFrame("https://example.com/video.mp4");
    expect(result).toMatch(/^https?:\/\//);
  });

  it("returns a non-empty string in dry-run mode", async () => {
    const result = await extractLastFrame("https://example.com/video.mp4");
    expect(result!.length).toBeGreaterThan(0);
  });

  it("returns consistent placeholder URL across calls", async () => {
    const result1 = await extractLastFrame("https://example.com/video1.mp4");
    const result2 = await extractLastFrame("https://example.com/video2.mp4");
    expect(result1).toBe(result2);
  });

  it("returns a string (not null) in dry-run mode", async () => {
    const result = await extractLastFrame("https://example.com/any-video.mp4");
    expect(result).not.toBeNull();
  });

  it("returns the same placeholder regardless of input URL", async () => {
    const urls = [
      "https://storage.example.com/shot-1.mp4",
      "https://cdn.example.com/shot-2.mp4",
      "https://r2.example.com/shot-3.mp4",
    ];
    const results = await Promise.all(urls.map((url) => extractLastFrame(url)));
    expect(results[0]).toBe(results[1]);
    expect(results[1]).toBe(results[2]);
  });

  it("returns a URL ending in an image extension", async () => {
    const result = await extractLastFrame("https://example.com/video.mp4");
    // Placeholder URL should be an image format
    expect(result).toMatch(/\.(webp|jpg|jpeg|png)$/i);
  });
});

// ─── extractFirstFrame ─────────────────────────────────────────

describe("extractFirstFrame", () => {
  it("returns a placeholder URL in dry-run mode", async () => {
    const result = await extractFirstFrame("https://example.com/video.mp4");
    expect(result).toBeTruthy();
    expect(typeof result).toBe("string");
  });

  it("returns a valid URL string in dry-run mode", async () => {
    const result = await extractFirstFrame("https://example.com/video.mp4");
    expect(result).toMatch(/^https?:\/\//);
  });

  it("returns a non-empty string in dry-run mode", async () => {
    const result = await extractFirstFrame("https://example.com/video.mp4");
    expect(result!.length).toBeGreaterThan(0);
  });

  it("returns consistent placeholder URL across calls", async () => {
    const result1 = await extractFirstFrame("https://example.com/video1.mp4");
    const result2 = await extractFirstFrame("https://example.com/video2.mp4");
    expect(result1).toBe(result2);
  });

  it("returns a string (not null) in dry-run mode", async () => {
    const result = await extractFirstFrame("https://example.com/any-video.mp4");
    expect(result).not.toBeNull();
  });

  it("returns a URL ending in an image extension", async () => {
    const result = await extractFirstFrame("https://example.com/video.mp4");
    expect(result).toMatch(/\.(webp|jpg|jpeg|png)$/i);
  });
});

// ─── extractLastFrame and extractFirstFrame consistency ────────

describe("frame extraction consistency", () => {
  it("both functions return the same placeholder URL in dry-run", async () => {
    const lastFrame = await extractLastFrame("https://example.com/video.mp4");
    const firstFrame = await extractFirstFrame("https://example.com/video.mp4");
    expect(lastFrame).toBe(firstFrame);
  });

  it("both functions accept any URL format", async () => {
    const urls = [
      "https://example.com/video.mp4",
      "https://r2.storage.com/bucket/path/to/video.webm",
      "https://cdn.cinemaforge.ai/media/shot-abc123.mp4",
    ];

    for (const url of urls) {
      const lastResult = await extractLastFrame(url);
      const firstResult = await extractFirstFrame(url);
      expect(lastResult).toBeTruthy();
      expect(firstResult).toBeTruthy();
    }
  });

  it("both functions resolve as promises", async () => {
    const lastPromise = extractLastFrame("https://example.com/video.mp4");
    const firstPromise = extractFirstFrame("https://example.com/video.mp4");

    expect(lastPromise).toBeInstanceOf(Promise);
    expect(firstPromise).toBeInstanceOf(Promise);

    const [lastResult, firstResult] = await Promise.all([lastPromise, firstPromise]);
    expect(lastResult).toBeTruthy();
    expect(firstResult).toBeTruthy();
  });

  it("handles concurrent calls without interference", async () => {
    const calls = Array.from({ length: 10 }, (_, i) =>
      extractLastFrame(`https://example.com/video-${i}.mp4`)
    );
    const results = await Promise.all(calls);

    // All should return the same placeholder
    const first = results[0];
    for (const result of results) {
      expect(result).toBe(first);
    }
  });
});
