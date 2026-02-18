/**
 * Celebrity image resolver — fetches headshots from Wikipedia's REST API.
 *
 * Wikipedia's page summary endpoint returns structured data including
 * the page's primary image (usually a headshot for celebrity articles).
 * Images are served from Wikimedia's CDN — public, stable, and high-res.
 */

interface WikiSummary {
  originalimage?: { source: string; width: number; height: number };
  thumbnail?: { source: string; width: number; height: number };
}

interface CelebrityImageResult {
  url: string;
  attribution: string;
}

/**
 * Fetch a celebrity headshot URL from Wikipedia's REST API.
 *
 * @param name - Full name of the celebrity (e.g. "Keanu Reeves")
 * @returns The Wikimedia CDN image URL and attribution, or null if not found
 */
export async function resolveCelebrityImage(
  name: string,
): Promise<CelebrityImageResult | null> {
  try {
    const encoded = encodeURIComponent(name.trim().replace(/\s+/g, "_"));
    const url = `https://en.wikipedia.org/api/rest_v1/page/summary/${encoded}`;

    const response = await fetch(url, {
      headers: { Accept: "application/json" },
      signal: AbortSignal.timeout(5000),
    });

    if (!response.ok) return null;

    const data = (await response.json()) as WikiSummary;

    const imageUrl = data.originalimage?.source ?? data.thumbnail?.source;
    if (!imageUrl) return null;

    return {
      url: imageUrl,
      attribution: `Image from Wikipedia (Wikimedia Commons) — ${name}`,
    };
  } catch {
    return null;
  }
}

/**
 * Fetch headshots for multiple celebrities in parallel.
 *
 * @param names - Array of celebrity names
 * @returns Map of celebrity name to image URL (only includes successful lookups)
 */
export async function resolveCelebrityImages(
  names: string[],
): Promise<Map<string, string>> {
  const results = new Map<string, string>();
  if (names.length === 0) return results;

  const settled = await Promise.allSettled(
    names.map(async (name) => {
      const result = await resolveCelebrityImage(name);
      return { name, result };
    }),
  );

  for (const outcome of settled) {
    if (outcome.status === "fulfilled" && outcome.value.result) {
      results.set(outcome.value.name, outcome.value.result.url);
    }
  }

  return results;
}
