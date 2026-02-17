"use client";

import { LayoutGrid } from "lucide-react";

export default function StoryboardPage() {
  return (
    <div className="flex h-full flex-col items-center justify-center gap-4 px-6 text-center">
      <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-primary/10">
        <LayoutGrid className="h-7 w-7 text-primary" />
      </div>
      <h2 className="text-xl font-semibold">Storyboard</h2>
      <p className="max-w-md text-sm text-muted-foreground">
        Plan every shot with AI-suggested camera angles and movements. Preview
        the exact prompts that will be sent to the video generator before
        spending any credits.
      </p>
    </div>
  );
}
