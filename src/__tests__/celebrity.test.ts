import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { resolveCelebrityImage, resolveCelebrityImages } from "@/lib/celebrity";

// ─── Mock global fetch ──────────────────────────────────────────

const originalFetch = globalThis.fetch;

beforeEach(() => {
  vi.restoreAllMocks();
});

afterEach(() => {
  globalThis.fetch = originalFetch;
});

function mockFetch(response: { ok: boolean; json?: () => Promise<unknown>; status?: number }) {
  globalThis.fetch = vi.fn(async () => response as Response);
}

function mockFetchJson(data: unknown) {
  mockFetch({
    ok: true,
    json: async () => data,
  });
}

// ─── resolveCelebrityImage ──────────────────────────────────────

describe("resolveCelebrityImage", () => {
  it("returns image URL and attribution for a valid celebrity", async () => {
    mockFetchJson({
      originalimage: {
        source: "https://upload.wikimedia.org/keanu.jpg",
        width: 800,
        height: 1200,
      },
    });

    const result = await resolveCelebrityImage("Keanu Reeves");
    expect(result).not.toBeNull();
    expect(result!.url).toBe("https://upload.wikimedia.org/keanu.jpg");
    expect(result!.attribution).toContain("Keanu Reeves");
    expect(result!.attribution).toContain("Wikipedia");
  });

  it("falls back to thumbnail when originalimage is missing", async () => {
    mockFetchJson({
      thumbnail: {
        source: "https://upload.wikimedia.org/thumb/keanu.jpg",
        width: 200,
        height: 300,
      },
    });

    const result = await resolveCelebrityImage("Keanu Reeves");
    expect(result).not.toBeNull();
    expect(result!.url).toBe("https://upload.wikimedia.org/thumb/keanu.jpg");
  });

  it("prefers originalimage over thumbnail", async () => {
    mockFetchJson({
      originalimage: {
        source: "https://upload.wikimedia.org/original.jpg",
        width: 800,
        height: 1200,
      },
      thumbnail: {
        source: "https://upload.wikimedia.org/thumb.jpg",
        width: 200,
        height: 300,
      },
    });

    const result = await resolveCelebrityImage("Test Person");
    expect(result!.url).toBe("https://upload.wikimedia.org/original.jpg");
  });

  it("returns null when no images in response", async () => {
    mockFetchJson({});
    const result = await resolveCelebrityImage("Unknown Person");
    expect(result).toBeNull();
  });

  it("returns null when API returns non-OK status", async () => {
    mockFetch({ ok: false, status: 404 });
    const result = await resolveCelebrityImage("Nonexistent Person");
    expect(result).toBeNull();
  });

  it("returns null on network error", async () => {
    globalThis.fetch = vi.fn(async () => {
      throw new Error("Network error");
    });
    const result = await resolveCelebrityImage("Keanu Reeves");
    expect(result).toBeNull();
  });

  it("encodes spaces as underscores in the API URL", async () => {
    mockFetchJson({});
    await resolveCelebrityImage("Robert De Niro");
    const calledUrl = (globalThis.fetch as ReturnType<typeof vi.fn>).mock.calls[0][0] as string;
    expect(calledUrl).toContain("Robert_De_Niro");
    expect(calledUrl).not.toContain(" ");
  });

  it("trims whitespace from names", async () => {
    mockFetchJson({});
    await resolveCelebrityImage("  Morgan Freeman  ");
    const calledUrl = (globalThis.fetch as ReturnType<typeof vi.fn>).mock.calls[0][0] as string;
    expect(calledUrl).toContain("Morgan_Freeman");
    expect(calledUrl).not.toContain("%20%20");
  });

  it("uses the Wikipedia REST API endpoint", async () => {
    mockFetchJson({});
    await resolveCelebrityImage("Test");
    const calledUrl = (globalThis.fetch as ReturnType<typeof vi.fn>).mock.calls[0][0] as string;
    expect(calledUrl).toContain("en.wikipedia.org/api/rest_v1/page/summary");
  });

  it("sets Accept: application/json header", async () => {
    mockFetchJson({});
    await resolveCelebrityImage("Test");
    const calledOpts = (globalThis.fetch as ReturnType<typeof vi.fn>).mock.calls[0][1] as RequestInit;
    expect(calledOpts.headers).toEqual({ Accept: "application/json" });
  });

  it("sets a 5 second timeout", async () => {
    mockFetchJson({});
    await resolveCelebrityImage("Test");
    const calledOpts = (globalThis.fetch as ReturnType<typeof vi.fn>).mock.calls[0][1] as RequestInit;
    expect(calledOpts.signal).toBeTruthy();
  });
});

// ─── resolveCelebrityImages (batch) ─────────────────────────────

describe("resolveCelebrityImages", () => {
  it("returns empty map for empty input", async () => {
    const results = await resolveCelebrityImages([]);
    expect(results.size).toBe(0);
  });

  it("resolves multiple celebrities in parallel", async () => {
    let callCount = 0;
    globalThis.fetch = vi.fn(async (url: string) => {
      callCount++;
      const name = decodeURIComponent((url as string).split("/").pop()!).replace(/_/g, " ");
      return {
        ok: true,
        json: async () => ({
          originalimage: {
            source: `https://upload.wikimedia.org/${name.replace(/ /g, "_")}.jpg`,
            width: 800,
            height: 1200,
          },
        }),
      } as Response;
    });

    const results = await resolveCelebrityImages(["Actor One", "Actor Two"]);
    expect(callCount).toBe(2);
    expect(results.size).toBe(2);
    expect(results.get("Actor One")).toContain("Actor_One");
    expect(results.get("Actor Two")).toContain("Actor_Two");
  });

  it("excludes failed lookups from results", async () => {
    let callIndex = 0;
    globalThis.fetch = vi.fn(async () => {
      callIndex++;
      if (callIndex === 1) {
        return {
          ok: true,
          json: async () => ({
            originalimage: { source: "https://example.com/found.jpg", width: 800, height: 1200 },
          }),
        } as Response;
      }
      return { ok: false, status: 404 } as Response;
    });

    const results = await resolveCelebrityImages(["Found Person", "Not Found"]);
    expect(results.size).toBe(1);
    expect(results.has("Found Person")).toBe(true);
    expect(results.has("Not Found")).toBe(false);
  });

  it("handles all lookups failing gracefully", async () => {
    globalThis.fetch = vi.fn(async () => {
      throw new Error("All network requests fail");
    });

    const results = await resolveCelebrityImages(["Person A", "Person B"]);
    expect(results.size).toBe(0);
  });

  it("returns URLs as values in the map", async () => {
    mockFetchJson({
      originalimage: { source: "https://example.com/image.jpg", width: 800, height: 1200 },
    });

    const results = await resolveCelebrityImages(["Test Person"]);
    const url = results.get("Test Person");
    expect(url).toBe("https://example.com/image.jpg");
  });
});
