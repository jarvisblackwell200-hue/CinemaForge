"use client";

import Link from "next/link";
import { Film, User } from "lucide-react";
import { Button } from "@/components/ui/button";
import { CreditsBadge } from "./CreditsBadge";

export function Header() {
  return (
    <header className="flex h-14 items-center justify-between border-b border-border/50 bg-background px-4">
      <Link href="/movies" className="flex items-center gap-2">
        <Film className="h-5 w-5 text-primary" />
        <span className="text-sm font-semibold tracking-tight">
          CinemaForge
        </span>
      </Link>
      <div className="flex items-center gap-3">
        <CreditsBadge balance={50} />
        <Button variant="ghost" size="icon" className="h-8 w-8">
          <User className="h-4 w-4" />
        </Button>
      </div>
    </header>
  );
}
