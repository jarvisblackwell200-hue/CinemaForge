/**
 * Stripe integration for CinemaForge credit purchases and subscriptions.
 *
 * Supports:
 * - One-time credit pack purchases (checkout sessions)
 * - Subscription plan upgrades (CREATOR/PRO/STUDIO)
 * - Webhook handling for payment confirmation
 */

import Stripe from "stripe";
import { db } from "@/lib/db";
import { PLAN_CREDITS } from "@/lib/constants/pricing";

// ─── Stripe client ─────────────────────────────────────────────

let stripeInstance: Stripe | null = null;

function getStripe(): Stripe {
  if (!stripeInstance) {
    const key = process.env.STRIPE_SECRET_KEY;
    if (!key) throw new Error("STRIPE_SECRET_KEY not configured");
    stripeInstance = new Stripe(key, { apiVersion: "2025-05-28.basil" });
  }
  return stripeInstance;
}

// ─── Credit pack definitions ───────────────────────────────────

export const CREDIT_PACKS = [
  { id: "pack-100", credits: 100, priceUsd: 499, label: "100 Credits" },
  { id: "pack-300", credits: 300, priceUsd: 1199, label: "300 Credits" },
  { id: "pack-1000", credits: 1000, priceUsd: 2999, label: "1,000 Credits" },
] as const;

// ─── Checkout session for credit pack ──────────────────────────

export async function createCreditPackCheckout(
  userId: string,
  packId: string,
  returnUrl: string,
): Promise<string> {
  const pack = CREDIT_PACKS.find((p) => p.id === packId);
  if (!pack) throw new Error(`Invalid pack: ${packId}`);

  const stripe = getStripe();

  const session = await stripe.checkout.sessions.create({
    mode: "payment",
    line_items: [
      {
        price_data: {
          currency: "usd",
          unit_amount: pack.priceUsd,
          product_data: {
            name: pack.label,
            description: `${pack.credits} CinemaForge video generation credits`,
          },
        },
        quantity: 1,
      },
    ],
    metadata: {
      userId,
      type: "credit_pack",
      packId: pack.id,
      credits: String(pack.credits),
    },
    success_url: `${returnUrl}?session_id={CHECKOUT_SESSION_ID}`,
    cancel_url: returnUrl,
  });

  if (!session.url) throw new Error("Failed to create checkout session");
  return session.url;
}

// ─── Checkout session for subscription ─────────────────────────

export async function createSubscriptionCheckout(
  userId: string,
  plan: "CREATOR" | "PRO" | "STUDIO",
  returnUrl: string,
): Promise<string> {
  const priceEnvKey = `STRIPE_PRICE_${plan}`;
  const priceId = process.env[priceEnvKey];
  if (!priceId) throw new Error(`${priceEnvKey} not configured`);

  const stripe = getStripe();

  const session = await stripe.checkout.sessions.create({
    mode: "subscription",
    line_items: [{ price: priceId, quantity: 1 }],
    metadata: {
      userId,
      type: "subscription",
      plan,
    },
    success_url: `${returnUrl}?session_id={CHECKOUT_SESSION_ID}`,
    cancel_url: returnUrl,
  });

  if (!session.url) throw new Error("Failed to create checkout session");
  return session.url;
}

// ─── Webhook: process completed checkout ───────────────────────

export async function handleCheckoutCompleted(
  session: Stripe.Checkout.Session,
): Promise<void> {
  const userId = session.metadata?.userId;
  if (!userId) {
    console.error("[stripe] No userId in session metadata");
    return;
  }

  const type = session.metadata?.type;

  if (type === "credit_pack") {
    const credits = parseInt(session.metadata?.credits ?? "0", 10);
    if (credits <= 0) return;

    await db.$transaction([
      db.user.update({
        where: { id: userId },
        data: { creditsBalance: { increment: credits } },
      }),
      db.creditLedger.create({
        data: {
          userId,
          amount: credits,
          type: "PURCHASE",
          memo: `Credit pack: ${credits} credits (${session.metadata?.packId})`,
        },
      }),
    ]);

    console.log(`[stripe] Added ${credits} credits to user ${userId}`);
  } else if (type === "subscription") {
    const plan = session.metadata?.plan as "CREATOR" | "PRO" | "STUDIO";
    const monthlyCredits = PLAN_CREDITS[plan] ?? 0;

    await db.$transaction([
      db.user.update({
        where: { id: userId },
        data: {
          plan,
          creditsBalance: { increment: monthlyCredits },
        },
      }),
      db.creditLedger.create({
        data: {
          userId,
          amount: monthlyCredits,
          type: "SUBSCRIPTION",
          memo: `${plan} plan subscription — ${monthlyCredits} monthly credits`,
        },
      }),
    ]);

    console.log(`[stripe] Upgraded user ${userId} to ${plan}, added ${monthlyCredits} credits`);
  }
}

// ─── Webhook: process subscription renewal ─────────────────────

export async function handleInvoicePaid(
  invoice: Stripe.Invoice,
): Promise<void> {
  const subscriptionId = invoice.subscription as string | null;
  if (!subscriptionId) return;

  const stripe = getStripe();
  const subscription = await stripe.subscriptions.retrieve(subscriptionId);
  const userId = subscription.metadata?.userId;
  if (!userId) return;

  const plan = subscription.metadata?.plan as "CREATOR" | "PRO" | "STUDIO" | undefined;
  if (!plan || !(plan in PLAN_CREDITS)) return;

  const monthlyCredits = PLAN_CREDITS[plan];

  await db.$transaction([
    db.user.update({
      where: { id: userId },
      data: { creditsBalance: { increment: monthlyCredits } },
    }),
    db.creditLedger.create({
      data: {
        userId,
        amount: monthlyCredits,
        type: "SUBSCRIPTION",
        memo: `${plan} plan renewal — ${monthlyCredits} monthly credits`,
      },
    }),
  ]);

  console.log(`[stripe] Renewed ${plan} for user ${userId}, added ${monthlyCredits} credits`);
}

// ─── Webhook signature verification ───────────────────────────

export function constructEvent(
  body: string | Buffer,
  signature: string,
): Stripe.Event {
  const stripe = getStripe();
  const secret = process.env.STRIPE_WEBHOOK_SECRET;
  if (!secret) throw new Error("STRIPE_WEBHOOK_SECRET not configured");

  return stripe.webhooks.constructEvent(body, signature, secret);
}
