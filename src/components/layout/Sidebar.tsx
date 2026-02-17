"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Sparkles,
  FileText,
  Users,
  LayoutGrid,
  Play,
  Layers,
  Download,
  Check,
} from "lucide-react";

interface SidebarProps {
  movieId: string;
  movieStatus: string;
}

const PIPELINE_STEPS = [
  {
    id: "concept",
    label: "Concept",
    icon: Sparkles,
    path: "",
    statuses: ["CONCEPT"],
  },
  {
    id: "script",
    label: "Script",
    icon: FileText,
    path: "/script",
    statuses: ["SCRIPTING"],
  },
  {
    id: "characters",
    label: "Characters",
    icon: Users,
    path: "/characters",
    statuses: ["CHARACTERS"],
  },
  {
    id: "storyboard",
    label: "Storyboard",
    icon: LayoutGrid,
    path: "/storyboard",
    statuses: ["STORYBOARDING"],
  },
  {
    id: "generate",
    label: "Generate",
    icon: Play,
    path: "/generate",
    statuses: ["GENERATING"],
  },
  {
    id: "timeline",
    label: "Timeline",
    icon: Layers,
    path: "/timeline",
    statuses: ["ASSEMBLING"],
  },
  {
    id: "export",
    label: "Export",
    icon: Download,
    path: "/export",
    statuses: ["COMPLETE"],
  },
] as const;

const STATUS_ORDER = [
  "CONCEPT",
  "SCRIPTING",
  "CHARACTERS",
  "STORYBOARDING",
  "GENERATING",
  "ASSEMBLING",
  "COMPLETE",
];

export function Sidebar({ movieId, movieStatus }: SidebarProps) {
  const pathname = usePathname();
  const currentStatusIndex = STATUS_ORDER.indexOf(movieStatus);

  return (
    <aside className="flex w-56 flex-col border-r border-border/50 bg-background">
      <nav className="flex flex-1 flex-col gap-0.5 p-3">
        {PIPELINE_STEPS.map((step, index) => {
          const stepStatusIndex = STATUS_ORDER.indexOf(step.statuses[0]);
          const isComplete = stepStatusIndex < currentStatusIndex;
          const isCurrent = (step.statuses as readonly string[]).includes(movieStatus);
          const href = `/movies/${movieId}${step.path}`;
          const isActive = pathname === href;

          return (
            <Link
              key={step.id}
              href={href}
              className={`flex items-center gap-3 rounded-md px-3 py-2 text-sm transition-colors ${
                isActive
                  ? "bg-primary/10 text-primary"
                  : isCurrent
                    ? "text-foreground"
                    : isComplete
                      ? "text-muted-foreground hover:text-foreground"
                      : "text-muted-foreground/50 hover:text-muted-foreground"
              }`}
            >
              <div className="relative">
                {isComplete ? (
                  <div className="flex h-5 w-5 items-center justify-center rounded-full bg-primary/20">
                    <Check className="h-3 w-3 text-primary" />
                  </div>
                ) : (
                  <step.icon
                    className={`h-5 w-5 ${isCurrent ? "text-primary" : ""}`}
                  />
                )}
              </div>
              <span className="font-medium">{step.label}</span>
              {isCurrent && (
                <div className="ml-auto h-1.5 w-1.5 rounded-full bg-primary" />
              )}
            </Link>
          );
        })}
      </nav>
      <div className="border-t border-border/50 p-3">
        <p className="text-xs text-muted-foreground">
          Step {Math.min(currentStatusIndex + 1, 7)} of 7
        </p>
      </div>
    </aside>
  );
}
