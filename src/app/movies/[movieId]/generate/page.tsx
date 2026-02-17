"use client";

import { Play } from "lucide-react";

export default function GeneratePage() {
  return (
    <div className="flex h-full flex-col items-center justify-center gap-4 px-6 text-center">
      <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-primary/10">
        <Play className="h-7 w-7 text-primary" />
      </div>
      <h2 className="text-xl font-semibold">Generate</h2>
      <p className="max-w-md text-sm text-muted-foreground">
        Generate video for each shot, compare multiple takes side-by-side, and
        select the best ones. Smart retries and credit protection keep you in
        control.
      </p>
    </div>
  );
}
