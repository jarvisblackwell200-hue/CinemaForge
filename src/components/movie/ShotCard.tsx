"use client";

import { useState } from "react";
import {
  Camera,
  Clock,
  ChevronDown,
  ChevronUp,
  Trash2,
  Sparkles,
  AlertTriangle,
  Eye,
  Plus,
  X,
  MessageSquare,
  MapPin,
  Sun,
  Pencil,
  ImageIcon,
  Loader2,
  RefreshCw,
  Link2,
  Unlink,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Separator } from "@/components/ui/separator";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import type { ShotDialogue } from "@/types/shot";

const SHOT_TYPES = [
  "wide",
  "medium",
  "close-up",
  "extreme-close-up",
  "ots",
  "pov",
  "aerial",
  "low-angle",
  "high-angle",
  "dutch-angle",
] as const;

interface ShotData {
  id?: string;
  sceneIndex: number;
  order: number;
  shotType: string;
  cameraMovement: string;
  subject: string;
  action: string;
  environment?: string | null;
  lighting?: string | null;
  dialogue?: ShotDialogue | null;
  durationSeconds: number;
  generatedPrompt?: string | null;
  negativePrompt?: string | null;
  storyboardImageUrl?: string | null;
  startFrameUrl?: string | null;
  status?: string;
  takes?: {
    id: string;
    thumbnailUrl: string | null;
    isHero: boolean;
    qualityScore: number | null;
  }[];
}

interface ShotCardProps {
  shot: ShotData;
  index: number;
  isExpanded: boolean;
  onToggleExpand: () => void;
  onChange: (updates: Partial<ShotData>) => void;
  onDelete: () => void;
  onOpenCameraBrowser: () => void;
  onRequestSuggestion: () => void;
  onGenerateSketch?: () => void;
  isGeneratingSketch?: boolean;
  genre?: string | null;
}

function getShotTypeColor(shotType: string): string {
  switch (shotType) {
    case "wide":
    case "aerial":
      return "bg-purple-600/20 text-purple-400 border-purple-500/30";
    case "medium":
      return "bg-blue-600/20 text-blue-400 border-blue-500/30";
    case "close-up":
    case "extreme-close-up":
      return "bg-green-600/20 text-green-400 border-green-500/30";
    case "ots":
    case "pov":
      return "bg-yellow-600/20 text-yellow-400 border-yellow-500/30";
    case "low-angle":
    case "high-angle":
    case "dutch-angle":
      return "bg-orange-600/20 text-orange-400 border-orange-500/30";
    default:
      return "bg-muted text-muted-foreground border-border";
  }
}

function getStatusIndicator(status?: string) {
  switch (status) {
    case "QUEUED":
      return <span className="h-2 w-2 rounded-full bg-blue-500" />;
    case "GENERATING":
      return <span className="h-2 w-2 rounded-full bg-amber-500 animate-pulse" />;
    case "COMPLETE":
      return <span className="h-2 w-2 rounded-full bg-green-500" />;
    case "FAILED":
      return <span className="h-2 w-2 rounded-full bg-red-500" />;
    default:
      return <span className="h-2 w-2 rounded-full bg-muted-foreground/30" />;
  }
}

function assemblePreviewPrompt(shot: ShotData): string {
  const parts: string[] = [];
  if (shot.cameraMovement || shot.shotType) {
    parts.push(`${shot.cameraMovement}, ${shot.shotType}`);
  }
  if (shot.subject) parts.push(shot.subject);
  if (shot.action) parts.push(shot.action);
  if (shot.environment) parts.push(shot.environment);
  if (shot.lighting) parts.push(shot.lighting);
  return parts.filter(Boolean).join(". ") + (parts.length > 0 ? "." : "");
}

export function ShotCard({
  shot,
  index,
  isExpanded,
  onToggleExpand,
  onChange,
  onDelete,
  onOpenCameraBrowser,
  onRequestSuggestion,
  onGenerateSketch,
  isGeneratingSketch,
}: ShotCardProps) {
  const [showEnvLighting, setShowEnvLighting] = useState(
    Boolean(shot.environment || shot.lighting)
  );

  const previewPrompt = assemblePreviewPrompt(shot);

  if (!isExpanded) {
    return (
      <Card className="border-border bg-card hover:bg-accent/10 transition-colors">
        <CardContent className="flex items-center gap-3 p-3">
          {/* Sketch thumbnail */}
          <div className="shrink-0 h-9 w-16 rounded border border-border bg-background overflow-hidden flex items-center justify-center">
            {isGeneratingSketch ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin text-muted-foreground" />
            ) : shot.storyboardImageUrl ? (
              <img
                src={shot.storyboardImageUrl}
                alt={`Shot ${index + 1} sketch`}
                className="h-full w-full object-cover"
              />
            ) : (
              <Pencil className="h-3 w-3 text-muted-foreground/40" />
            )}
          </div>
          <div
            className="flex flex-1 items-center gap-3 cursor-pointer min-w-0"
            onClick={onToggleExpand}
          >
            <Badge variant="outline" className="shrink-0 border-border text-foreground font-mono text-xs">
              {index + 1}
            </Badge>
            <Badge variant="outline" className={`shrink-0 text-xs ${getShotTypeColor(shot.shotType)}`}>
              {shot.shotType}
            </Badge>
            <Tooltip>
              <TooltipTrigger asChild>
                <span className="text-xs text-muted-foreground shrink-0 flex items-center gap-1 max-w-[140px] truncate">
                  <Camera className="h-3 w-3 shrink-0" />
                  {shot.cameraMovement || "No movement"}
                </span>
              </TooltipTrigger>
              <TooltipContent className="text-xs max-w-xs">
                {shot.cameraMovement || "No camera movement set"}
              </TooltipContent>
            </Tooltip>
            <span className="text-sm text-foreground truncate min-w-0">
              {shot.subject || "Untitled shot"}
            </span>
            <div className="ml-auto flex items-center gap-2 shrink-0">
              {shot.dialogue && <MessageSquare className="h-3 w-3 text-muted-foreground" />}
              <Badge variant="outline" className="border-border text-muted-foreground text-xs font-mono">
                <Clock className="mr-1 h-3 w-3" />
                {shot.durationSeconds}s
              </Badge>
              {shot.status === "COMPLETE" && shot.startFrameUrl && (
                <Link2 className="h-3 w-3 text-green-500" />
              )}
              {shot.status === "COMPLETE" && !shot.startFrameUrl && (
                <Unlink className="h-3 w-3 text-red-400" />
              )}
              {getStatusIndicator(shot.status)}
              <ChevronDown className="h-4 w-4 text-muted-foreground/40" />
            </div>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="border-primary/40 bg-card">
      <CardContent className="p-4 space-y-4">
        {/* Header */}
        <div className="flex items-center gap-3">
          <Badge variant="outline" className="border-border text-foreground font-mono text-xs">
            Shot {index + 1}
          </Badge>
          {getStatusIndicator(shot.status)}
          <span className="text-xs text-muted-foreground uppercase">{shot.status || "DRAFT"}</span>
          <div className="ml-auto">
            <Button variant="ghost" size="sm" onClick={onToggleExpand} className="text-muted-foreground hover:text-foreground">
              <ChevronUp className="h-4 w-4" />
            </Button>
          </div>
        </div>

        <Separator />

        {/* Storyboard Sketch */}
        <div className="space-y-2">
          {shot.storyboardImageUrl ? (
            <div className="relative rounded-lg overflow-hidden border border-border bg-background">
              <img
                src={shot.storyboardImageUrl}
                alt={`Shot ${index + 1} storyboard sketch`}
                className="w-full aspect-video object-cover"
              />
            </div>
          ) : (
            <div className="w-full aspect-video rounded-lg border border-dashed border-border bg-background flex flex-col items-center justify-center gap-1.5">
              <ImageIcon className="h-6 w-6 text-muted-foreground/30" />
              <span className="text-xs text-muted-foreground/60">No storyboard sketch</span>
            </div>
          )}
          {onGenerateSketch && (
            <Button
              variant="outline"
              size="sm"
              onClick={onGenerateSketch}
              disabled={isGeneratingSketch || (!shot.subject && !shot.action)}
              className="w-full border-border text-foreground hover:border-primary/50 hover:text-primary gap-1.5"
            >
              {isGeneratingSketch ? (
                <>
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  Generating sketch...
                </>
              ) : shot.storyboardImageUrl ? (
                <>
                  <RefreshCw className="h-3.5 w-3.5" />
                  Regenerate Sketch
                </>
              ) : (
                <>
                  <Pencil className="h-3.5 w-3.5" />
                  Generate Sketch
                </>
              )}
            </Button>
          )}
        </div>

        <Separator />

        {/* Camera Section */}
        <div className="space-y-3">
          <h4 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
            <Camera className="h-3.5 w-3.5" /> Camera
          </h4>
          <div className="flex flex-wrap gap-1.5">
            {SHOT_TYPES.map((type) => (
              <button
                key={type}
                onClick={() => onChange({ shotType: type })}
                className={`px-2.5 py-1 rounded-full text-xs font-medium border transition-colors ${
                  shot.shotType === type
                    ? getShotTypeColor(type) + " ring-1 ring-current"
                    : "border-border text-muted-foreground hover:text-foreground hover:border-muted-foreground"
                }`}
              >
                {type}
              </button>
            ))}
          </div>
          <div className="flex gap-2">
            <Input
              value={shot.cameraMovement}
              readOnly
              placeholder="Select camera movement..."
              className="flex-1 bg-background border-border text-foreground text-sm"
            />
            <Button variant="outline" size="sm" onClick={onOpenCameraBrowser} className="border-border text-foreground hover:border-primary/50 hover:text-primary">
              <Eye className="mr-1.5 h-3.5 w-3.5" /> Browse
            </Button>
          </div>
          <div className="flex items-center gap-3">
            <label className="text-xs text-muted-foreground shrink-0">Duration</label>
            <input
              type="range"
              min={3}
              max={15}
              value={shot.durationSeconds}
              onChange={(e) => onChange({ durationSeconds: parseInt(e.target.value, 10) })}
              className="flex-1 accent-amber-500 h-1.5"
            />
            <Badge variant="outline" className="font-mono text-xs border-border text-foreground tabular-nums">
              {shot.durationSeconds}s
            </Badge>
            {shot.durationSeconds > 8 && (
              <Badge variant="outline" className="text-xs border-amber-500/40 text-amber-400 gap-1">
                <AlertTriangle className="h-3 w-3" /> Quality risk
              </Badge>
            )}
          </div>
        </div>

        <Separator />

        {/* Subject & Action */}
        <div className="space-y-3">
          <h4 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Subject & Action</h4>
          <Textarea
            value={shot.subject}
            onChange={(e) => onChange({ subject: e.target.value })}
            placeholder="Who or what is on screen..."
            rows={2}
            className="bg-background border-border text-foreground text-sm resize-none"
          />
          <Textarea
            value={shot.action}
            onChange={(e) => onChange({ action: e.target.value })}
            placeholder="What happens (beginning, middle, end)..."
            rows={2}
            className="bg-background border-border text-foreground text-sm resize-none"
          />
        </div>

        {/* Environment & Lighting (collapsible) */}
        <div>
          {!showEnvLighting ? (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setShowEnvLighting(true)}
              className="text-muted-foreground hover:text-foreground text-xs gap-1.5"
            >
              <Plus className="h-3 w-3" /> Environment & Lighting
            </Button>
          ) : (
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <h4 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
                  <MapPin className="h-3.5 w-3.5" /> Environment & <Sun className="h-3.5 w-3.5" /> Lighting
                </h4>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setShowEnvLighting(false)}
                  className="text-muted-foreground/60 hover:text-muted-foreground h-6 w-6 p-0"
                >
                  <X className="h-3 w-3" />
                </Button>
              </div>
              <Input
                value={shot.environment ?? ""}
                onChange={(e) => onChange({ environment: e.target.value || null })}
                placeholder="Location, time of day, weather..."
                className="bg-background border-border text-foreground text-sm"
              />
              <Input
                value={shot.lighting ?? ""}
                onChange={(e) => onChange({ lighting: e.target.value || null })}
                placeholder="Light sources, mood, quality..."
                className="bg-background border-border text-foreground text-sm"
              />
            </div>
          )}
        </div>

        {/* Dialogue (optional) */}
        <div>
          {!shot.dialogue ? (
            <Button
              variant="ghost"
              size="sm"
              onClick={() =>
                onChange({
                  dialogue: { characterId: "", characterName: "", line: "", emotion: "neutral" },
                })
              }
              className="text-muted-foreground hover:text-foreground text-xs gap-1.5"
            >
              <MessageSquare className="h-3 w-3" /> Add Dialogue
            </Button>
          ) : (
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <h4 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
                  <MessageSquare className="h-3.5 w-3.5" /> Dialogue
                </h4>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => onChange({ dialogue: null })}
                  className="text-red-500/60 hover:text-red-400 h-6 w-6 p-0"
                >
                  <X className="h-3 w-3" />
                </Button>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <Input
                  value={shot.dialogue.characterName}
                  onChange={(e) =>
                    onChange({ dialogue: { ...shot.dialogue!, characterName: e.target.value } })
                  }
                  placeholder="Character name"
                  className="bg-background border-border text-foreground text-sm"
                />
                <Input
                  value={shot.dialogue.emotion}
                  onChange={(e) =>
                    onChange({ dialogue: { ...shot.dialogue!, emotion: e.target.value } })
                  }
                  placeholder="Emotion (e.g. stern, hopeful)"
                  className="bg-background border-border text-foreground text-sm"
                />
              </div>
              <Input
                value={shot.dialogue.line}
                onChange={(e) =>
                  onChange({ dialogue: { ...shot.dialogue!, line: e.target.value } })
                }
                placeholder="Dialogue line..."
                className="bg-background border-border text-foreground text-sm"
              />
            </div>
          )}
        </div>

        <Separator />

        {/* Prompt Preview */}
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <h4 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Prompt Preview</h4>
            <span className="text-xs text-muted-foreground/60 tabular-nums">{previewPrompt.length} chars</span>
          </div>
          <textarea
            value={previewPrompt}
            readOnly
            rows={3}
            className="w-full rounded-md border border-border bg-background px-3 py-2 font-mono text-xs text-muted-foreground resize-none focus:outline-none"
          />
        </div>

        {/* Footer */}
        <div className="flex items-center gap-2 pt-1">
          <Button
            variant="outline"
            size="sm"
            onClick={onRequestSuggestion}
            className="border-primary/30 text-primary hover:bg-primary/10 hover:text-primary gap-1.5"
          >
            <Sparkles className="h-3.5 w-3.5" /> Suggest
          </Button>
          <div className="flex-1" />
          <Button
            variant="ghost"
            size="sm"
            onClick={onDelete}
            className="text-red-500/60 hover:text-red-400 hover:bg-red-500/10 gap-1.5"
          >
            <Trash2 className="h-3.5 w-3.5" /> Delete
          </Button>
          <Button variant="ghost" size="sm" onClick={onToggleExpand} className="text-muted-foreground hover:text-foreground">
            <ChevronUp className="h-4 w-4" />
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
