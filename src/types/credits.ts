export interface CreditBalance {
  balance: number;
  plan: "FREE" | "CREATOR" | "PRO" | "STUDIO";
}

export interface CreditEstimate {
  operation: string;
  cost: number;
  currentBalance: number;
  balanceAfter: number;
  canAfford: boolean;
}

export interface LedgerEntry {
  id: string;
  amount: number;
  type: "PURCHASE" | "SUBSCRIPTION" | "USAGE" | "BONUS" | "REFUND";
  memo: string | null;
  movieId: string | null;
  shotId: string | null;
  createdAt: Date;
}
