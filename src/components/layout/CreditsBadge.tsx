"use client";

import { Coins } from "lucide-react";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";

interface CreditsBadgeProps {
  balance: number;
}

export function CreditsBadge({ balance }: CreditsBadgeProps) {
  const isLow = balance < 20;

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <div
          className={`flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-medium ${
            isLow
              ? "border-destructive/30 bg-destructive/10 text-destructive"
              : "border-primary/20 bg-primary/5 text-primary"
          }`}
        >
          <Coins className="h-3 w-3" />
          <span>{balance}</span>
        </div>
      </TooltipTrigger>
      <TooltipContent>
        <p>
          {balance} credits remaining
          {isLow && " — running low!"}
        </p>
      </TooltipContent>
    </Tooltip>
  );
}
