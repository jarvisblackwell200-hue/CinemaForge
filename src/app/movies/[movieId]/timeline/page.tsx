"use client";

import { Layers } from "lucide-react";

export default function TimelinePage() {
  return (
    <div className="flex h-full flex-col items-center justify-center gap-4 px-6 text-center">
      <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-primary/10">
        <Layers className="h-7 w-7 text-primary" />
      </div>
      <h2 className="text-xl font-semibold">Timeline</h2>
      <p className="max-w-md text-sm text-muted-foreground">
        Arrange your shots on the timeline, set transitions between scenes, and
        preview the assembled movie before exporting.
      </p>
    </div>
  );
}
