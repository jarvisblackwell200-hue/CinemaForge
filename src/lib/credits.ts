import { db } from "@/lib/db";
import { getCreditCost } from "@/lib/constants/pricing";
import type { QualityTier } from "@/lib/kling/types";

// ─── Check balance ─────────────────────────────────────────────

export async function getBalance(userId: string): Promise<number> {
  const user = await db.user.findUnique({
    where: { id: userId },
    select: { creditsBalance: true },
  });
  return user?.creditsBalance ?? 0;
}

export async function canAfford(
  userId: string,
  cost: number
): Promise<boolean> {
  const balance = await getBalance(userId);
  return balance >= cost;
}

// ─── Deduct credits atomically ─────────────────────────────────

export interface DeductOptions {
  userId: string;
  amount: number;
  type: "USAGE" | "PURCHASE" | "SUBSCRIPTION" | "BONUS" | "REFUND";
  movieId?: string;
  shotId?: string;
  memo: string;
}

/**
 * Deducts credits atomically: updates balance and creates ledger entry
 * in a single transaction. Returns the new balance.
 * Throws if insufficient credits.
 */
export async function deductCredits(opts: DeductOptions): Promise<number> {
  const balance = await getBalance(opts.userId);
  if (balance < opts.amount) {
    throw new Error(
      `Insufficient credits: need ${opts.amount}, have ${balance}`
    );
  }

  const [updatedUser] = await db.$transaction([
    db.user.update({
      where: { id: opts.userId },
      data: { creditsBalance: { decrement: opts.amount } },
      select: { creditsBalance: true },
    }),
    db.creditLedger.create({
      data: {
        userId: opts.userId,
        amount: -opts.amount,
        type: opts.type,
        movieId: opts.movieId,
        shotId: opts.shotId,
        memo: opts.memo,
      },
    }),
  ]);

  return updatedUser.creditsBalance;
}

// ─── Refund credits ────────────────────────────────────────────

/**
 * Refunds credits atomically: increments balance and records refund.
 * Returns the new balance.
 */
export async function refundCredits(opts: {
  userId: string;
  amount: number;
  movieId?: string;
  shotId?: string;
  memo: string;
}): Promise<number> {
  const [updatedUser] = await db.$transaction([
    db.user.update({
      where: { id: opts.userId },
      data: { creditsBalance: { increment: opts.amount } },
      select: { creditsBalance: true },
    }),
    db.creditLedger.create({
      data: {
        userId: opts.userId,
        amount: opts.amount,
        type: "REFUND",
        movieId: opts.movieId,
        shotId: opts.shotId,
        memo: opts.memo,
      },
    }),
  ]);

  return updatedUser.creditsBalance;
}

// ─── Estimate cost for a movie ─────────────────────────────────

export interface CostEstimate {
  shotCount: number;
  totalCredits: number;
  perShot: { shotId: string; credits: number; durationSeconds: number }[];
  canAfford: boolean;
  currentBalance: number;
}

export async function estimateMovieCost(
  userId: string,
  movieId: string,
  quality: QualityTier
): Promise<CostEstimate> {
  const shots = await db.shot.findMany({
    where: { movieId, status: { in: ["DRAFT", "FAILED"] } },
    select: { id: true, durationSeconds: true },
    orderBy: { order: "asc" },
  });

  const perShot = shots.map((s) => ({
    shotId: s.id,
    credits: getCreditCost(quality, s.durationSeconds),
    durationSeconds: s.durationSeconds,
  }));

  const totalCredits = perShot.reduce((sum, s) => sum + s.credits, 0);
  const balance = await getBalance(userId);

  return {
    shotCount: shots.length,
    totalCredits,
    perShot,
    canAfford: balance >= totalCredits,
    currentBalance: balance,
  };
}

// ─── Get credit history ────────────────────────────────────────

export async function getCreditHistory(
  userId: string,
  limit = 50
) {
  return db.creditLedger.findMany({
    where: { userId },
    orderBy: { createdAt: "desc" },
    take: limit,
  });
}
