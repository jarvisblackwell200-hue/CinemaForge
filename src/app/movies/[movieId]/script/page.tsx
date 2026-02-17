"use client";

import { FileText } from "lucide-react";

export default function ScriptPage() {
  return (
    <div className="flex h-full flex-col items-center justify-center gap-4 px-6 text-center">
      <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-primary/10">
        <FileText className="h-7 w-7 text-primary" />
      </div>
      <h2 className="text-xl font-semibold">Script Editor</h2>
      <p className="max-w-md text-sm text-muted-foreground">
        Review and edit your script structure — scenes, beats, and dialogue.
        This will be populated after you finalize your concept with the AI
        Director.
      </p>
    </div>
  );
}
