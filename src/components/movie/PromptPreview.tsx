"use client";

import { useMemo } from "react";
import {
  Camera,
  User,
  Clapperboard,
  MapPin,
  Sun,
  Palette,
  AlertTriangle,
  CheckCircle,
  Info,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import type { StyleBible } from "@/types/movie";

interface PromptBlock {
  type: "camera" | "subject" | "action" | "environment" | "lighting" | "style";
  label: string;
  icon: typeof Camera;
  text: string;
  color: string;
}

interface PromptPreviewProps {
  shotType: string;
  cameraMovement: string;
  subject: string;
  action: string;
  environment?: string | null;
  lighting?: string | null;
  styleBible?: StyleBible | null;
  negativePrompt?: string | null;
  durationSeconds: number;
  characterNames?: string[];
}

const BLOCK_CONFIG: Record<
  PromptBlock["type"],
  { label: string; icon: typeof Camera; color: string }
> = {
  camera: { label: "Camera", icon: Camera, color: "text-yellow-400 bg-yellow-400/10" },
  subject: { label: "Subject", icon: User, color: "text-blue-400 bg-blue-400/10" },
  action: { label: "Action", icon: Clapperboard, color: "text-green-400 bg-green-400/10" },
  environment: { label: "Environment", icon: MapPin, color: "text-purple-400 bg-purple-400/10" },
  lighting: { label: "Lighting", icon: Sun, color: "text-orange-400 bg-orange-400/10" },
  style: { label: "Style Bible", icon: Palette, color: "text-gray-400 bg-gray-400/10" },
};

export function PromptPreview({
  shotType,
  cameraMovement,
  subject,
  action,
  environment,
  lighting,
  styleBible,
  negativePrompt,
  durationSeconds,
  characterNames = [],
}: PromptPreviewProps) {
  const blocks = useMemo<PromptBlock[]>(() => {
    const result: PromptBlock[] = [];

    if (cameraMovement || shotType) {
      const cameraText = cameraMovement.toLowerCase().includes(shotType.toLowerCase())
        ? cameraMovement
        : `${cameraMovement}, ${shotType}`;
      result.push({ type: "camera", text: cameraText, ...BLOCK_CONFIG.camera });
    }

    if (subject) {
      result.push({ type: "subject", text: subject, ...BLOCK_CONFIG.subject });
    }

    if (action) {
      result.push({ type: "action", text: action, ...BLOCK_CONFIG.action });
    }

    if (environment) {
      result.push({
        type: "environment",
        text: environment,
        ...BLOCK_CONFIG.environment,
      });
    }

    if (lighting) {
      result.push({
        type: "lighting",
        text: lighting,
        ...BLOCK_CONFIG.lighting,
      });
    }

    if (styleBible?.styleString) {
      result.push({
        type: "style",
        text: styleBible.styleString,
        ...BLOCK_CONFIG.style,
      });
    }

    return result;
  }, [shotType, cameraMovement, subject, action, environment, lighting, styleBible]);

  const fullPrompt = blocks.map((b) => b.text).join(". ").replace(/\.\./g, ".").trim();

  // Validation warnings
  const warnings: string[] = [];
  const errors: string[] = [];

  if (fullPrompt.length < 50) {
    warnings.push("Prompt is very short — more detail produces better results");
  }
  if (fullPrompt.length > 2000) {
    warnings.push("Prompt is very long — Kling may truncate parts");
  }
  if (cameraMovement.includes("orbit") && durationSeconds < 10) {
    errors.push("360 orbit requires minimum 10 seconds");
  }
  if (durationSeconds > 8) {
    warnings.push("Shots over 8s have higher artifact risk");
  }
  if (!styleBible?.styleString) {
    warnings.push("No style bible — visual consistency may vary");
  }
  if (characterNames.length > 0) {
    const mentionedChars = characterNames.filter((name) =>
      subject.toLowerCase().includes(name.toLowerCase())
    );
    if (mentionedChars.length === 0) {
      warnings.push("No characters referenced in subject");
    }
  }

  return (
    <Card className="overflow-hidden border-border">
      {/* Block-by-block preview */}
      <div className="p-4">
        <div className="mb-3 flex items-center justify-between">
          <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            Prompt Preview
          </span>
          <span className="text-xs text-muted-foreground">
            {fullPrompt.length} chars
          </span>
        </div>

        <div className="space-y-1.5">
          {blocks.map((block) => (
            <div key={block.type} className="flex items-start gap-2">
              <div
                className={`mt-0.5 flex h-5 w-5 flex-shrink-0 items-center justify-center rounded ${block.color}`}
              >
                <block.icon className="h-3 w-3" />
              </div>
              <div className="flex-1">
                <span className="text-xs font-medium text-muted-foreground">
                  {block.label}:{" "}
                </span>
                <span className="text-sm">{block.text}</span>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Negative prompt */}
      {negativePrompt && (
        <div className="border-t border-border/50 bg-destructive/5 px-4 py-2">
          <span className="text-xs font-medium text-destructive/70">
            Negative:{" "}
          </span>
          <span className="text-xs text-muted-foreground">
            {negativePrompt}
          </span>
        </div>
      )}

      {/* Validation */}
      {(errors.length > 0 || warnings.length > 0) && (
        <div className="border-t border-border/50 px-4 py-2">
          {errors.map((err, i) => (
            <div
              key={`e-${i}`}
              className="flex items-center gap-1.5 text-xs text-destructive"
            >
              <AlertTriangle className="h-3 w-3 flex-shrink-0" />
              {err}
            </div>
          ))}
          {warnings.map((warn, i) => (
            <div
              key={`w-${i}`}
              className="flex items-center gap-1.5 text-xs text-yellow-500"
            >
              <Info className="h-3 w-3 flex-shrink-0" />
              {warn}
            </div>
          ))}
          {errors.length === 0 && warnings.length === 0 && (
            <div className="flex items-center gap-1.5 text-xs text-green-500">
              <CheckCircle className="h-3 w-3" />
              Prompt looks good
            </div>
          )}
        </div>
      )}
    </Card>
  );
}
