"use client";

import { Trash2, Edit, Users, Image as ImageIcon } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface CharacterData {
  id: string;
  name: string;
  role: string | null;
  visualDescription: string;
  referenceImages: string[];
  createdAt: string;
}

interface CharacterCardProps {
  character: CharacterData;
  onEdit: () => void;
  onDelete: () => void;
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const ROLE_COLORS: Record<string, string> = {
  protagonist: "bg-primary/15 text-primary border-primary/30",
  antagonist: "bg-destructive/15 text-destructive border-destructive/30",
  supporting: "bg-blue-500/15 text-blue-400 border-blue-500/30",
  background: "bg-muted text-muted-foreground border-border",
};

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function CharacterCard({
  character,
  onEdit,
  onDelete,
}: CharacterCardProps) {
  const roleColorClass =
    ROLE_COLORS[character.role ?? ""] ?? ROLE_COLORS.background;

  const createdDate = new Date(character.createdAt).toLocaleDateString(
    undefined,
    { month: "short", day: "numeric" }
  );

  return (
    <Card className="group relative overflow-hidden border-border transition-colors hover:border-primary/30">
      {/* Delete button (top-right corner) */}
      <Button
        variant="ghost"
        size="icon-xs"
        className="absolute right-2 top-2 z-10 opacity-0 transition-opacity group-hover:opacity-100 text-muted-foreground hover:text-destructive"
        onClick={(e) => {
          e.stopPropagation();
          onDelete();
        }}
      >
        <Trash2 className="h-3 w-3" />
      </Button>

      {/* Clickable card body */}
      <button
        type="button"
        onClick={onEdit}
        className="w-full text-left focus:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 rounded-xl"
      >
        <CardContent className="pt-0">
          {/* Reference images row (or placeholder) */}
          <div className="mb-4 flex gap-2">
            {character.referenceImages.length > 0 ? (
              character.referenceImages.slice(0, 3).map((url, i) => (
                <div
                  key={i}
                  className="relative h-16 w-16 overflow-hidden rounded-lg border border-border bg-muted"
                >
                  <img
                    src={url}
                    alt={`${character.name} reference ${i + 1}`}
                    className="h-full w-full object-cover"
                  />
                </div>
              ))
            ) : (
              <div className="flex h-16 w-16 items-center justify-center rounded-lg border border-dashed border-border bg-muted/50">
                <ImageIcon className="h-5 w-5 text-muted-foreground/50" />
              </div>
            )}
            {character.referenceImages.length > 3 && (
              <div className="flex h-16 w-16 items-center justify-center rounded-lg border border-border bg-muted text-xs text-muted-foreground">
                +{character.referenceImages.length - 3}
              </div>
            )}
          </div>

          {/* Name and role */}
          <div className="mb-2 flex items-start justify-between gap-2">
            <div className="flex items-center gap-2">
              <div className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-lg bg-primary/10">
                <Users className="h-4 w-4 text-primary" />
              </div>
              <h3 className="text-sm font-semibold leading-tight">
                {character.name}
              </h3>
            </div>
          </div>

          {/* Role badge */}
          {character.role && (
            <Badge
              variant="outline"
              className={`mb-3 capitalize ${roleColorClass}`}
            >
              {character.role}
            </Badge>
          )}

          {/* Visual description (truncated) */}
          <p className="line-clamp-2 text-xs leading-relaxed text-muted-foreground">
            {character.visualDescription}
          </p>

          {/* Footer */}
          <div className="mt-3 flex items-center justify-between border-t border-border/50 pt-3">
            <span className="text-[10px] text-muted-foreground/60">
              Created {createdDate}
            </span>
            <span className="flex items-center gap-1 text-[10px] text-muted-foreground/60 opacity-0 transition-opacity group-hover:opacity-100">
              <Edit className="h-3 w-3" />
              Edit
            </span>
          </div>
        </CardContent>
      </button>
    </Card>
  );
}
