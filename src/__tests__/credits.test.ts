import { describe, it, expect } from "vitest";
import {
  getCreditCost,
  CREDIT_COSTS,
  PLAN_CREDITS,
  PLAN_LIMITS,
} from "@/lib/constants/pricing";

// ─── getCreditCost ──────────────────────────────────────────────

describe("getCreditCost", () => {
  it("returns draft 5s cost for short draft shots", () => {
    expect(getCreditCost("draft", 5)).toBe(CREDIT_COSTS.VIDEO_DRAFT_5S);
    expect(getCreditCost("draft", 7)).toBe(CREDIT_COSTS.VIDEO_DRAFT_5S);
  });

  it("returns draft 10s cost for long draft shots", () => {
    expect(getCreditCost("draft", 8)).toBe(CREDIT_COSTS.VIDEO_DRAFT_10S);
    expect(getCreditCost("draft", 15)).toBe(CREDIT_COSTS.VIDEO_DRAFT_10S);
  });

  it("returns standard 5s cost for short standard shots", () => {
    expect(getCreditCost("standard", 5)).toBe(CREDIT_COSTS.VIDEO_STANDARD_5S);
  });

  it("returns standard 10s cost for long standard shots", () => {
    expect(getCreditCost("standard", 10)).toBe(CREDIT_COSTS.VIDEO_STANDARD_10S);
  });

  it("returns cinema 5s cost for short cinema shots", () => {
    expect(getCreditCost("cinema", 5)).toBe(CREDIT_COSTS.VIDEO_CINEMA_5S);
  });

  it("returns cinema 10s cost for long cinema shots", () => {
    expect(getCreditCost("cinema", 10)).toBe(CREDIT_COSTS.VIDEO_CINEMA_10S);
  });

  it("uses 7s as the threshold between short and long", () => {
    // 7s is short (not > 7)
    expect(getCreditCost("standard", 7)).toBe(CREDIT_COSTS.VIDEO_STANDARD_5S);
    // 8s is long (> 7)
    expect(getCreditCost("standard", 8)).toBe(CREDIT_COSTS.VIDEO_STANDARD_10S);
  });

  it("handles minimum duration (3s)", () => {
    expect(getCreditCost("draft", 3)).toBe(CREDIT_COSTS.VIDEO_DRAFT_5S);
  });
});

// ─── Cost estimation for a full movie ───────────────────────────

describe("movie cost estimation", () => {
  it("estimates cost for a typical 60s noir film (10 shots)", () => {
    // Noir = ~6s avg per shot, 10 shots, standard quality
    const shotCount = 10;
    const avgDuration = 6; // under 7s threshold
    const costPerShot = getCreditCost("standard", avgDuration);
    const totalGeneration = costPerShot * shotCount;
    const assembly = CREDIT_COSTS.ASSEMBLY_EXPORT;
    const total = totalGeneration + assembly;

    expect(costPerShot).toBe(15); // standard 5s
    expect(totalGeneration).toBe(150);
    expect(total).toBe(160);
  });

  it("estimates cost for a 3-minute action film (25 shots, 2 takes each)", () => {
    const shotCount = 25;
    const takesPerShot = 2;
    const avgDuration = 5;
    const costPerTake = getCreditCost("standard", avgDuration);
    const totalGeneration = costPerTake * shotCount * takesPerShot;
    const assembly = CREDIT_COSTS.ASSEMBLY_EXPORT;

    expect(totalGeneration).toBe(750);
    expect(totalGeneration + assembly).toBe(760);
  });

  it("draft quality is significantly cheaper than standard", () => {
    const draftCost = getCreditCost("draft", 5);
    const standardCost = getCreditCost("standard", 5);
    const cinemaCost = getCreditCost("cinema", 5);

    expect(draftCost).toBeLessThan(standardCost);
    expect(standardCost).toBeLessThan(cinemaCost);
    // Draft should be at least 50% cheaper than standard
    expect(draftCost).toBeLessThanOrEqual(standardCost * 0.5);
  });
});

// ─── Plan limits ────────────────────────────────────────────────

describe("plan credits and limits", () => {
  it("free plan has 50 credits", () => {
    expect(PLAN_CREDITS.FREE).toBe(50);
  });

  it("free plan can afford at least 3 draft shots", () => {
    const draftCost = getCreditCost("draft", 5);
    const maxShots = Math.floor(PLAN_CREDITS.FREE / draftCost);
    expect(maxShots).toBeGreaterThanOrEqual(3);
  });

  it("free plan is limited to draft quality", () => {
    expect(PLAN_LIMITS.FREE.maxQuality).toBe("draft");
  });

  it("studio plan has unlimited movies", () => {
    expect(PLAN_LIMITS.STUDIO.maxMovies).toBe(Infinity);
  });

  it("plans scale in credits: FREE < CREATOR < PRO < STUDIO", () => {
    expect(PLAN_CREDITS.FREE).toBeLessThan(PLAN_CREDITS.CREATOR);
    expect(PLAN_CREDITS.CREATOR).toBeLessThan(PLAN_CREDITS.PRO);
    expect(PLAN_CREDITS.PRO).toBeLessThan(PLAN_CREDITS.STUDIO);
  });

  it("plans scale in max takes per shot", () => {
    expect(PLAN_LIMITS.FREE.maxTakesPerShot).toBeLessThan(
      PLAN_LIMITS.CREATOR.maxTakesPerShot
    );
    expect(PLAN_LIMITS.CREATOR.maxTakesPerShot).toBeLessThan(
      PLAN_LIMITS.PRO.maxTakesPerShot
    );
  });
});

// ─── Credit cost constants ──────────────────────────────────────

describe("credit cost constants", () => {
  it("longer shots cost more within the same quality tier", () => {
    expect(CREDIT_COSTS.VIDEO_DRAFT_5S).toBeLessThan(CREDIT_COSTS.VIDEO_DRAFT_10S);
    expect(CREDIT_COSTS.VIDEO_STANDARD_5S).toBeLessThan(CREDIT_COSTS.VIDEO_STANDARD_10S);
    expect(CREDIT_COSTS.VIDEO_CINEMA_5S).toBeLessThan(CREDIT_COSTS.VIDEO_CINEMA_10S);
  });

  it("higher quality costs more for the same duration", () => {
    expect(CREDIT_COSTS.VIDEO_DRAFT_5S).toBeLessThan(CREDIT_COSTS.VIDEO_STANDARD_5S);
    expect(CREDIT_COSTS.VIDEO_STANDARD_5S).toBeLessThan(CREDIT_COSTS.VIDEO_CINEMA_5S);
  });

  it("assembly export is reasonably priced", () => {
    expect(CREDIT_COSTS.ASSEMBLY_EXPORT).toBeLessThanOrEqual(20);
  });

  it("reference image is the cheapest operation", () => {
    const allCosts = Object.values(CREDIT_COSTS);
    expect(CREDIT_COSTS.REFERENCE_IMAGE).toBe(Math.min(...allCosts));
  });
});
