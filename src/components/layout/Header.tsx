"use client";

import Link from "next/link";
import { Film, LogOut } from "lucide-react";
import { UserButton, SignedIn, SignedOut, SignOutButton } from "@clerk/nextjs";
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
        <SignedIn>
          <UserButton
            afterSignOutUrl="/"
            appearance={{
              elements: {
                avatarBox: "h-8 w-8",
              },
            }}
          />
          <SignOutButton redirectUrl="/">
            <Button variant="ghost" size="sm" className="gap-1.5 text-xs text-muted-foreground">
              <LogOut className="h-3.5 w-3.5" />
              Sign out
            </Button>
          </SignOutButton>
        </SignedIn>
        <SignedOut>
          <Button asChild variant="ghost" size="sm">
            <Link href="/sign-in">Sign in</Link>
          </Button>
          <Button asChild size="sm">
            <Link href="/sign-up">Sign up</Link>
          </Button>
        </SignedOut>
      </div>
    </header>
  );
}
