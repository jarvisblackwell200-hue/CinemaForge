"use client";

import { Download } from "lucide-react";

export default function ExportPage() {
  return (
    <div className="flex h-full flex-col items-center justify-center gap-4 px-6 text-center">
      <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-primary/10">
        <Download className="h-7 w-7 text-primary" />
      </div>
      <h2 className="text-xl font-semibold">Export</h2>
      <p className="max-w-md text-sm text-muted-foreground">
        Download your finished short film as MP4. Choose resolution, aspect
        ratio, and whether to include individual shots as separate files.
      </p>
    </div>
  );
}
