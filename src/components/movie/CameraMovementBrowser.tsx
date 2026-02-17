"use client";

import { useState, useMemo } from "react";
import {
  Crosshair,
  User,
  Zap,
  ArrowRightLeft,
  Search,
  Clock,
  Check,
  X,
} from "lucide-react";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  CAMERA_MOVEMENTS,
  type CameraMovement,
} from "@/lib/constants/camera-movements";

interface CameraMovementBrowserProps {
  open: boolean;
  onClose: () => void;
  onSelect: (movement: CameraMovement) => void;
  currentMovementId?: string;
}

const CATEGORIES = [
  { id: "all", label: "All", icon: Search },
  { id: "establishing", label: "Establishing", icon: Crosshair },
  { id: "character", label: "Character", icon: User },
  { id: "action", label: "Action", icon: Zap },
  { id: "transition", label: "Transition", icon: ArrowRightLeft },
] as const;

type CategoryFilter = (typeof CATEGORIES)[number]["id"];

export function CameraMovementBrowser({
  open,
  onClose,
  onSelect,
  currentMovementId,
}: CameraMovementBrowserProps) {
  const [search, setSearch] = useState("");
  const [category, setCategory] = useState<CategoryFilter>("all");
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const filtered = useMemo(() => {
    return CAMERA_MOVEMENTS.filter((m) => {
      if (category !== "all" && m.category !== category) return false;
      if (search) {
        const q = search.toLowerCase();
        return (
          m.name.toLowerCase().includes(q) ||
          m.description.toLowerCase().includes(q) ||
          m.bestFor.toLowerCase().includes(q)
        );
      }
      return true;
    });
  }, [search, category]);

  const selected = selectedId
    ? CAMERA_MOVEMENTS.find((m) => m.id === selectedId)
    : null;

  function handleSelect(movement: CameraMovement) {
    onSelect(movement);
    onClose();
    setSelectedId(null);
    setSearch("");
    setCategory("all");
  }

  return (
    <Sheet open={open} onOpenChange={(v) => !v && onClose()}>
      <SheetContent side="right" className="w-full sm:max-w-2xl">
        <SheetHeader>
          <SheetTitle className="flex items-center gap-2">
            Camera Movements
            <Badge variant="secondary" className="text-xs">
              {CAMERA_MOVEMENTS.length} techniques
            </Badge>
          </SheetTitle>
        </SheetHeader>

        <div className="mt-4 flex flex-col gap-4">
          {/* Search */}
          <div className="relative">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search movements..."
              className="pl-9"
            />
          </div>

          {/* Category filters */}
          <div className="flex gap-1">
            {CATEGORIES.map((cat) => (
              <Button
                key={cat.id}
                variant={category === cat.id ? "default" : "ghost"}
                size="sm"
                className="h-8 text-xs"
                onClick={() => setCategory(cat.id)}
              >
                <cat.icon className="mr-1 h-3 w-3" />
                {cat.label}
              </Button>
            ))}
          </div>

          {/* Results */}
          <div className="flex flex-1 gap-4 overflow-hidden">
            {/* Movement list */}
            <ScrollArea className="h-[calc(100vh-260px)] flex-1">
              <div className="space-y-1 pr-2">
                {filtered.map((movement) => (
                  <button
                    key={movement.id}
                    onClick={() => setSelectedId(movement.id)}
                    className={`w-full rounded-lg px-3 py-2.5 text-left transition-colors ${
                      selectedId === movement.id
                        ? "bg-primary/10 text-primary"
                        : movement.id === currentMovementId
                          ? "bg-primary/5 text-foreground"
                          : "hover:bg-secondary"
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-medium">
                        {movement.name}
                      </span>
                      <div className="flex items-center gap-1">
                        {movement.id === currentMovementId && (
                          <Badge
                            variant="outline"
                            className="text-[10px] text-primary"
                          >
                            current
                          </Badge>
                        )}
                        <Badge variant="secondary" className="text-[10px]">
                          {movement.category}
                        </Badge>
                      </div>
                    </div>
                    <p className="mt-0.5 line-clamp-1 text-xs text-muted-foreground">
                      {movement.bestFor}
                    </p>
                  </button>
                ))}

                {filtered.length === 0 && (
                  <div className="py-8 text-center text-sm text-muted-foreground">
                    No movements match your search
                  </div>
                )}
              </div>
            </ScrollArea>

            {/* Detail panel */}
            {selected && (
              <div className="hidden w-72 flex-col rounded-lg border border-border bg-card p-4 sm:flex">
                <div className="mb-3 flex items-center justify-between">
                  <h3 className="font-semibold">{selected.name}</h3>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-6 w-6"
                    onClick={() => setSelectedId(null)}
                  >
                    <X className="h-3 w-3" />
                  </Button>
                </div>

                <Badge variant="secondary" className="mb-3 w-fit text-xs">
                  {selected.category}
                </Badge>

                <ScrollArea className="flex-1">
                  <div className="space-y-4 pr-2">
                    <div>
                      <p className="mb-1 text-xs font-medium text-muted-foreground">
                        What it does
                      </p>
                      <p className="text-sm leading-relaxed">
                        {selected.description}
                      </p>
                    </div>

                    <div>
                      <p className="mb-1 text-xs font-medium text-muted-foreground">
                        Best for
                      </p>
                      <p className="text-sm text-muted-foreground">
                        {selected.bestFor}
                      </p>
                    </div>

                    <div>
                      <p className="mb-1 text-xs font-medium text-muted-foreground">
                        Min duration
                      </p>
                      <div className="flex items-center gap-1 text-sm">
                        <Clock className="h-3 w-3 text-muted-foreground" />
                        {selected.minDuration}s minimum
                      </div>
                    </div>

                    <div>
                      <p className="mb-1 text-xs font-medium text-muted-foreground">
                        Prompt syntax
                      </p>
                      <code className="block rounded bg-background px-2 py-1.5 text-xs">
                        {selected.promptSyntax}
                      </code>
                    </div>

                    <div>
                      <p className="mb-1 text-xs font-medium text-muted-foreground">
                        Example prompt
                      </p>
                      <p className="rounded bg-background px-2 py-1.5 text-xs leading-relaxed text-muted-foreground">
                        {selected.examplePrompt}
                      </p>
                    </div>
                  </div>
                </ScrollArea>

                <Button
                  className="mt-4 w-full"
                  onClick={() => handleSelect(selected)}
                >
                  <Check className="mr-2 h-4 w-4" />
                  Use this movement
                </Button>
              </div>
            )}
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}
