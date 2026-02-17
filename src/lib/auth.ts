import { auth, currentUser } from "@clerk/nextjs/server";
import { db } from "@/lib/db";

/**
 * Get the authenticated user's ID from Clerk.
 * Throws if not authenticated.
 */
export async function getAuthUserId(): Promise<string> {
  const { userId } = await auth();
  if (!userId) {
    throw new Error("Unauthorized");
  }
  return userId;
}

/**
 * Ensure the Clerk user exists in our Prisma database.
 * Creates a new User record with free plan + 50 credits on first visit.
 * Returns the Prisma user ID (same as Clerk userId).
 */
export async function ensureUser(): Promise<string> {
  const { userId } = await auth();
  if (!userId) {
    throw new Error("Unauthorized");
  }

  // Check if user already exists in our DB
  const existing = await db.user.findUnique({
    where: { id: userId },
    select: { id: true },
  });

  if (existing) {
    return existing.id;
  }

  // First time user — get their info from Clerk and create DB record
  const clerkUser = await currentUser();
  const email =
    clerkUser?.emailAddresses?.[0]?.emailAddress ?? `${userId}@clerk.user`;
  const name =
    clerkUser?.firstName && clerkUser?.lastName
      ? `${clerkUser.firstName} ${clerkUser.lastName}`
      : clerkUser?.firstName ?? clerkUser?.username ?? null;

  await db.user.create({
    data: {
      id: userId,
      email,
      name,
      plan: "FREE",
      creditsBalance: 50,
    },
  });

  // Record the signup bonus in the credit ledger
  await db.creditLedger.create({
    data: {
      userId,
      amount: 50,
      type: "BONUS",
      memo: "Welcome bonus — 50 free credits",
    },
  });

  return userId;
}
