"use client";

import Link from "next/link";
import { Film } from "lucide-react";
import { UserButton } from "@clerk/nextjs";
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
        <UserButton
          afterSignOutUrl="/"
          appearance={{
            elements: {
              avatarBox: "h-8 w-8",
            },
          }}
        />
      </div>
    </header>
  );
}
