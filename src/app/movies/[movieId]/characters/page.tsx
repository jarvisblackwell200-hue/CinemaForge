"use client";

import { Users } from "lucide-react";

export default function CharactersPage() {
  return (
    <div className="flex h-full flex-col items-center justify-center gap-4 px-6 text-center">
      <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-primary/10">
        <Users className="h-7 w-7 text-primary" />
      </div>
      <h2 className="text-xl font-semibold">Characters</h2>
      <p className="max-w-md text-sm text-muted-foreground">
        Define your characters with detailed visual descriptions and reference
        images. Consistency starts here — the more detail you provide, the
        better your characters will look across every shot.
      </p>
    </div>
  );
}
