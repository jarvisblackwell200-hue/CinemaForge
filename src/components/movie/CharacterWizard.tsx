"use client";

import { useState, useMemo, useCallback } from "react";
import {
  Users,
  ChevronRight,
  ChevronLeft,
  Check,
  AlertTriangle,
  Sparkles,
  Loader2,
  ImageIcon,
  RefreshCw,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface CreatedCharacter {
  id: string;
  movieId: string;
  name: string;
  role: string | null;
  visualDescription: string;
  referenceImages: string[];
  createdAt: string;
}

interface CharacterWizardProps {
  movieId: string;
  onComplete: (character: CreatedCharacter) => void;
  onCancel: () => void;
  initialData?: {
    name: string;
    role: string;
    suggestedVisualDescription: string;
  };
}

type Role = "protagonist" | "antagonist" | "supporting" | "background";
type AgeRange = "child" | "teen" | "20s" | "30s" | "40s" | "50s" | "60s+";
type Gender = "male" | "female" | "non-binary";
type Build = "slim" | "average" | "athletic" | "stocky" | "heavy";
type HairStyle =
  | "short cropped"
  | "medium length"
  | "long straight"
  | "long wavy"
  | "curly"
  | "buzz cut"
  | "bald"
  | "ponytail"
  | "braids";
type FacialHair = "none" | "stubble" | "beard" | "mustache" | "goatee";

interface FormFields {
  name: string;
  role: Role | "";
  ageRange: AgeRange | "";
  gender: Gender | "";
  build: Build | "";
  skinTone: string;
  hairColor: string;
  hairStyle: HairStyle | "";
  facialHair: FacialHair | "";
  clothing: string;
  distinguishingFeatures: string;
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const ROLES: { value: Role; label: string; description: string }[] = [
  { value: "protagonist", label: "Protagonist", description: "Main character driving the story" },
  { value: "antagonist", label: "Antagonist", description: "Opposes the protagonist" },
  { value: "supporting", label: "Supporting", description: "Key secondary character" },
  { value: "background", label: "Background", description: "Brief appearances" },
];

const AGE_RANGES: AgeRange[] = ["child", "teen", "20s", "30s", "40s", "50s", "60s+"];

const GENDERS: Gender[] = ["male", "female", "non-binary"];

const BUILDS: Build[] = ["slim", "average", "athletic", "stocky", "heavy"];

const HAIR_STYLES: HairStyle[] = [
  "short cropped",
  "medium length",
  "long straight",
  "long wavy",
  "curly",
  "buzz cut",
  "bald",
  "ponytail",
  "braids",
];

const FACIAL_HAIR_OPTIONS: FacialHair[] = [
  "none",
  "stubble",
  "beard",
  "mustache",
  "goatee",
];

const STEPS = [
  { id: 1, label: "Basics", description: "Name & role" },
  { id: 2, label: "Appearance", description: "Visual details" },
  { id: 3, label: "Preview", description: "Review & create" },
] as const;

// ---------------------------------------------------------------------------
// Helper: option picker button
// ---------------------------------------------------------------------------

function OptionButton({
  selected,
  onClick,
  children,
}: {
  selected: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`rounded-lg border px-3 py-2 text-sm transition-all ${
        selected
          ? "border-primary bg-primary/10 text-primary"
          : "border-border bg-card text-muted-foreground hover:border-primary/50 hover:text-foreground"
      }`}
    >
      {children}
    </button>
  );
}

// ---------------------------------------------------------------------------
// Helper: field label
// ---------------------------------------------------------------------------

function FieldLabel({
  children,
  required,
}: {
  children: React.ReactNode;
  required?: boolean;
}) {
  return (
    <label className="mb-1.5 block text-sm font-medium text-foreground">
      {children}
      {required && <span className="ml-1 text-destructive">*</span>}
    </label>
  );
}

// ---------------------------------------------------------------------------
// Main Component
// ---------------------------------------------------------------------------

export function CharacterWizard({
  movieId,
  onComplete,
  onCancel,
  initialData,
}: CharacterWizardProps) {
  const [step, setStep] = useState(1);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [referenceImageUrl, setReferenceImageUrl] = useState<string | null>(null);
  const [generatingImage, setGeneratingImage] = useState(false);

  const [fields, setFields] = useState<FormFields>(() => ({
    name: initialData?.name ?? "",
    role: (initialData?.role as Role) ?? "",
    ageRange: "",
    gender: "",
    build: "",
    skinTone: "",
    hairColor: "",
    hairStyle: "",
    facialHair: "",
    clothing: "",
    distinguishingFeatures: "",
  }));

  const updateField = useCallback(
    <K extends keyof FormFields>(key: K, value: FormFields[K]) => {
      setFields((prev) => ({ ...prev, [key]: value }));
    },
    []
  );

  // -----------------------------------------------------------------------
  // Assembled visual description
  // -----------------------------------------------------------------------

  const visualDescription = useMemo(() => {
    const parts: string[] = [];

    const age = fields.ageRange;
    const gender = fields.gender;
    const build = fields.build;

    // "A [age] [gender] with a [build] build"
    if (age || gender || build) {
      let intro = "A";
      if (age) intro += ` ${age === "60s+" ? "60s+" : age}`;
      if (gender) intro += ` ${gender}`;
      if (build) intro += ` with a ${build} build`;
      parts.push(intro);
    }

    // "skin tone skin"
    if (fields.skinTone.trim()) {
      parts.push(`${fields.skinTone.trim()} skin`);
    }

    // "hair color hair style hair"
    if (fields.hairColor.trim() || fields.hairStyle) {
      const hairParts: string[] = [];
      if (fields.hairColor.trim()) hairParts.push(fields.hairColor.trim());
      if (fields.hairStyle) hairParts.push(fields.hairStyle);
      hairParts.push("hair");
      parts.push(hairParts.join(" "));
    }

    // facial hair (skip "none")
    if (fields.facialHair && fields.facialHair !== "none") {
      parts.push(`${fields.facialHair} facial hair`);
    }

    // clothing
    if (fields.clothing.trim()) {
      parts.push(`wearing ${fields.clothing.trim()}`);
    }

    // distinguishing features
    if (fields.distinguishingFeatures.trim()) {
      parts.push(fields.distinguishingFeatures.trim());
    }

    if (parts.length === 0) return "";

    // Join with commas and finish with a period
    return parts.join(", ") + ".";
  }, [fields]);

  // -----------------------------------------------------------------------
  // Consistency score
  // -----------------------------------------------------------------------

  interface ConsistencyItem {
    field: string;
    filled: boolean;
    warning: string;
  }

  const consistencyItems = useMemo<ConsistencyItem[]>(() => {
    return [
      {
        field: "Age range",
        filled: fields.ageRange !== "",
        warning: "Without age range, character age may vary between shots.",
      },
      {
        field: "Gender",
        filled: fields.gender !== "",
        warning: "Without gender, character appearance may be inconsistent.",
      },
      {
        field: "Build",
        filled: fields.build !== "",
        warning: "Without build, body type may change between shots.",
      },
      {
        field: "Skin tone",
        filled: fields.skinTone.trim() !== "",
        warning: "Without skin tone, complexion may vary between shots.",
      },
      {
        field: "Hair color",
        filled: fields.hairColor.trim() !== "",
        warning: "Without hair color, character may vary between shots.",
      },
      {
        field: "Hair style",
        filled: fields.hairStyle !== "",
        warning: "Without hair style, hairstyle may change between shots.",
      },
      {
        field: "Clothing",
        filled: fields.clothing.trim() !== "",
        warning: "Without clothing details, wardrobe may be inconsistent.",
      },
    ];
  }, [fields]);

  const consistencyScore = useMemo(() => {
    const filled = consistencyItems.filter((i) => i.filled).length;
    return Math.round((filled / consistencyItems.length) * 100);
  }, [consistencyItems]);

  // -----------------------------------------------------------------------
  // Step validation
  // -----------------------------------------------------------------------

  const canAdvance = useMemo(() => {
    if (step === 1) {
      return fields.name.trim().length > 0 && fields.role !== "";
    }
    if (step === 2) {
      // At minimum require age, gender, build for decent consistency
      return (
        fields.ageRange !== "" &&
        fields.gender !== "" &&
        fields.build !== ""
      );
    }
    return true;
  }, [step, fields]);

  // -----------------------------------------------------------------------
  // Submit
  // -----------------------------------------------------------------------

  // -----------------------------------------------------------------------
  // Generate reference image
  // -----------------------------------------------------------------------

  const generateReferenceImage = async () => {
    if (visualDescription.length < 20) return;
    setGeneratingImage(true);
    setError(null);

    try {
      const res = await fetch("/api/ai/generate-image", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          prompt: `Portrait of ${fields.name}: ${visualDescription}`,
          style: "cinematic",
          aspectRatio: "portrait_4_3",
        }),
      });

      const data = await res.json();
      if (data.success) {
        setReferenceImageUrl(data.data.imageUrl);
      } else {
        setError(data.error ?? "Failed to generate image");
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Image generation failed");
    } finally {
      setGeneratingImage(false);
    }
  };

  // -----------------------------------------------------------------------
  // Submit
  // -----------------------------------------------------------------------

  const handleSubmit = async () => {
    if (visualDescription.length < 20) {
      setError("Visual description is too short. Please fill in more appearance details.");
      return;
    }

    setSubmitting(true);
    setError(null);

    try {
      const referenceImages = referenceImageUrl ? [referenceImageUrl] : [];

      const response = await fetch("/api/characters", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          movieId,
          name: fields.name.trim(),
          role: fields.role || undefined,
          visualDescription,
          referenceImages,
        }),
      });

      const result = await response.json();

      if (!response.ok || !result.success) {
        setError(result.error ?? "Failed to create character");
        return;
      }

      onComplete(result.data as CreatedCharacter);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Network error");
    } finally {
      setSubmitting(false);
    }
  };

  // -----------------------------------------------------------------------
  // Render
  // -----------------------------------------------------------------------

  return (
    <div className="flex flex-col gap-6">
      {/* Step indicator */}
      <div className="flex items-center gap-2">
        {STEPS.map((s, idx) => (
          <div key={s.id} className="flex items-center gap-2">
            {idx > 0 && (
              <div
                className={`h-px w-6 ${
                  step > s.id - 1 ? "bg-primary" : "bg-border"
                }`}
              />
            )}
            <button
              type="button"
              onClick={() => {
                if (s.id < step) setStep(s.id);
              }}
              disabled={s.id > step}
              className={`flex items-center gap-2 rounded-lg px-3 py-1.5 text-sm transition-colors ${
                step === s.id
                  ? "bg-primary/10 text-primary font-medium"
                  : step > s.id
                    ? "text-muted-foreground hover:text-foreground cursor-pointer"
                    : "text-muted-foreground/50 cursor-not-allowed"
              }`}
            >
              <span
                className={`flex h-6 w-6 items-center justify-center rounded-full text-xs font-semibold ${
                  step > s.id
                    ? "bg-primary text-primary-foreground"
                    : step === s.id
                      ? "bg-primary/20 text-primary"
                      : "bg-muted text-muted-foreground"
                }`}
              >
                {step > s.id ? <Check className="h-3 w-3" /> : s.id}
              </span>
              <span className="hidden sm:inline">{s.label}</span>
            </button>
          </div>
        ))}
      </div>

      {/* Step content */}
      <div className="min-h-[320px]">
        {/* ----------------------------------------------------------------- */}
        {/* Step 1: Basics */}
        {/* ----------------------------------------------------------------- */}
        {step === 1 && (
          <div className="space-y-6">
            <div>
              <h3 className="text-lg font-semibold">Character Basics</h3>
              <p className="mt-1 text-sm text-muted-foreground">
                Start with the essentials -- who is this character?
              </p>
            </div>

            {/* Name */}
            <div>
              <FieldLabel required>Character Name</FieldLabel>
              <Input
                value={fields.name}
                onChange={(e) => updateField("name", e.target.value)}
                placeholder="e.g. Detective Marlowe"
                className="max-w-sm"
              />
            </div>

            {/* Role */}
            <div>
              <FieldLabel required>Role</FieldLabel>
              <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                {ROLES.map((r) => (
                  <OptionButton
                    key={r.value}
                    selected={fields.role === r.value}
                    onClick={() => updateField("role", r.value)}
                  >
                    <div className="text-left">
                      <div className="font-medium">{r.label}</div>
                      <div className="mt-0.5 text-xs text-muted-foreground">
                        {r.description}
                      </div>
                    </div>
                  </OptionButton>
                ))}
              </div>
            </div>

            {initialData?.suggestedVisualDescription && (
              <Card className="border-primary/20 bg-primary/5">
                <CardContent className="flex items-start gap-3 pt-0">
                  <Sparkles className="mt-0.5 h-4 w-4 flex-shrink-0 text-primary" />
                  <div>
                    <p className="text-sm font-medium text-primary">
                      AI Director Suggestion
                    </p>
                    <p className="mt-1 text-sm text-muted-foreground">
                      {initialData.suggestedVisualDescription}
                    </p>
                    <p className="mt-2 text-xs text-muted-foreground">
                      Use this as guidance when filling in the appearance fields
                      in the next step.
                    </p>
                  </div>
                </CardContent>
              </Card>
            )}
          </div>
        )}

        {/* ----------------------------------------------------------------- */}
        {/* Step 2: Appearance */}
        {/* ----------------------------------------------------------------- */}
        {step === 2 && (
          <div className="space-y-6">
            <div>
              <h3 className="text-lg font-semibold">Visual Appearance</h3>
              <p className="mt-1 text-sm text-muted-foreground">
                These details ensure your character looks consistent across
                every shot. Fill in as many as possible.
              </p>
            </div>

            <div className="grid gap-5 sm:grid-cols-2">
              {/* Age Range */}
              <div>
                <FieldLabel required>Age Range</FieldLabel>
                <div className="flex flex-wrap gap-1.5">
                  {AGE_RANGES.map((age) => (
                    <OptionButton
                      key={age}
                      selected={fields.ageRange === age}
                      onClick={() => updateField("ageRange", age)}
                    >
                      {age}
                    </OptionButton>
                  ))}
                </div>
              </div>

              {/* Gender */}
              <div>
                <FieldLabel required>Gender</FieldLabel>
                <div className="flex flex-wrap gap-1.5">
                  {GENDERS.map((g) => (
                    <OptionButton
                      key={g}
                      selected={fields.gender === g}
                      onClick={() => updateField("gender", g)}
                    >
                      {g}
                    </OptionButton>
                  ))}
                </div>
              </div>

              {/* Build */}
              <div>
                <FieldLabel required>Build</FieldLabel>
                <div className="flex flex-wrap gap-1.5">
                  {BUILDS.map((b) => (
                    <OptionButton
                      key={b}
                      selected={fields.build === b}
                      onClick={() => updateField("build", b)}
                    >
                      {b}
                    </OptionButton>
                  ))}
                </div>
              </div>

              {/* Skin Tone */}
              <div>
                <FieldLabel>Skin Tone</FieldLabel>
                <Input
                  value={fields.skinTone}
                  onChange={(e) => updateField("skinTone", e.target.value)}
                  placeholder="e.g. fair, olive, dark brown"
                  className="max-w-xs"
                />
              </div>

              {/* Hair Color */}
              <div>
                <FieldLabel>Hair Color</FieldLabel>
                <Input
                  value={fields.hairColor}
                  onChange={(e) => updateField("hairColor", e.target.value)}
                  placeholder="e.g. jet black, silver, auburn"
                  className="max-w-xs"
                />
              </div>

              {/* Hair Style */}
              <div>
                <FieldLabel>Hair Style</FieldLabel>
                <div className="flex flex-wrap gap-1.5">
                  {HAIR_STYLES.map((style) => (
                    <OptionButton
                      key={style}
                      selected={fields.hairStyle === style}
                      onClick={() => updateField("hairStyle", style)}
                    >
                      {style}
                    </OptionButton>
                  ))}
                </div>
              </div>

              {/* Facial Hair (only for male) */}
              {fields.gender === "male" && (
                <div>
                  <FieldLabel>Facial Hair</FieldLabel>
                  <div className="flex flex-wrap gap-1.5">
                    {FACIAL_HAIR_OPTIONS.map((fh) => (
                      <OptionButton
                        key={fh}
                        selected={fields.facialHair === fh}
                        onClick={() => updateField("facialHair", fh)}
                      >
                        {fh}
                      </OptionButton>
                    ))}
                  </div>
                </div>
              )}

              {/* Clothing */}
              <div className="sm:col-span-2">
                <FieldLabel>Clothing</FieldLabel>
                <Input
                  value={fields.clothing}
                  onChange={(e) => updateField("clothing", e.target.value)}
                  placeholder="e.g. a long dark trenchcoat over a rumpled white shirt, loose tie"
                />
              </div>

              {/* Distinguishing Features */}
              <div className="sm:col-span-2">
                <FieldLabel>Distinguishing Features</FieldLabel>
                <Input
                  value={fields.distinguishingFeatures}
                  onChange={(e) =>
                    updateField("distinguishingFeatures", e.target.value)
                  }
                  placeholder="e.g. scar across left eyebrow, wire-rimmed glasses, sleeve tattoo"
                />
              </div>
            </div>
          </div>
        )}

        {/* ----------------------------------------------------------------- */}
        {/* Step 3: Preview */}
        {/* ----------------------------------------------------------------- */}
        {step === 3 && (
          <div className="space-y-6">
            <div>
              <h3 className="text-lg font-semibold">Review Character</h3>
              <p className="mt-1 text-sm text-muted-foreground">
                This is how{" "}
                <span className="font-medium text-foreground">
                  {fields.name || "your character"}
                </span>{" "}
                will be described in every generation prompt.
              </p>
            </div>

            {/* Identity */}
            <div className="flex items-center gap-3">
              <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-primary/10">
                <Users className="h-6 w-6 text-primary" />
              </div>
              <div>
                <h4 className="text-base font-semibold">{fields.name}</h4>
                {fields.role && (
                  <Badge variant="secondary" className="mt-0.5 capitalize">
                    {fields.role}
                  </Badge>
                )}
              </div>
            </div>

            {/* Visual Description */}
            <Card className="border-border">
              <CardContent className="pt-0">
                <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                  Visual Description (used in prompts)
                </p>
                {visualDescription ? (
                  <p className="text-sm leading-relaxed">{visualDescription}</p>
                ) : (
                  <p className="text-sm italic text-muted-foreground">
                    No visual description yet. Go back and fill in appearance
                    fields.
                  </p>
                )}
              </CardContent>
            </Card>

            {/* Reference Image */}
            <Card className="border-border">
              <CardContent className="pt-0">
                <p className="mb-3 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                  Reference Image
                </p>
                {referenceImageUrl ? (
                  <div className="space-y-3">
                    <div className="relative overflow-hidden rounded-lg border border-border bg-black">
                      <img
                        src={referenceImageUrl}
                        alt={`${fields.name} reference`}
                        className="w-full max-h-64 object-contain"
                      />
                    </div>
                    <div className="flex items-center gap-2">
                      <Badge variant="outline" className="border-green-500/30 text-green-500 text-[10px]">
                        <Check className="mr-1 h-2.5 w-2.5" />
                        Generated
                      </Badge>
                      <Button
                        size="sm"
                        variant="ghost"
                        className="h-7 text-xs"
                        onClick={generateReferenceImage}
                        disabled={generatingImage}
                      >
                        {generatingImage ? (
                          <Loader2 className="mr-1 h-3 w-3 animate-spin" />
                        ) : (
                          <RefreshCw className="mr-1 h-3 w-3" />
                        )}
                        Regenerate
                      </Button>
                    </div>
                  </div>
                ) : (
                  <div className="flex flex-col items-center gap-3 rounded-lg border border-dashed border-border py-6">
                    <ImageIcon className="h-8 w-8 text-muted-foreground/40" />
                    <p className="text-xs text-muted-foreground text-center max-w-xs">
                      Generate a reference image to ensure this character looks
                      consistent across all shots.
                    </p>
                    <Button
                      size="sm"
                      variant="secondary"
                      onClick={generateReferenceImage}
                      disabled={generatingImage || visualDescription.length < 20}
                    >
                      {generatingImage ? (
                        <>
                          <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
                          Generating...
                        </>
                      ) : (
                        <>
                          <Sparkles className="mr-1.5 h-3.5 w-3.5" />
                          Generate Reference Image
                        </>
                      )}
                    </Button>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Consistency Score */}
            <Card className="border-border">
              <CardContent className="pt-0">
                <div className="mb-3 flex items-center justify-between">
                  <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                    Consistency Score
                  </p>
                  <span
                    className={`text-lg font-bold ${
                      consistencyScore >= 80
                        ? "text-green-400"
                        : consistencyScore >= 50
                          ? "text-yellow-400"
                          : "text-destructive"
                    }`}
                  >
                    {consistencyScore}%
                  </span>
                </div>

                {/* Progress bar */}
                <div className="mb-4 h-2 overflow-hidden rounded-full bg-muted">
                  <div
                    className={`h-full rounded-full transition-all duration-500 ${
                      consistencyScore >= 80
                        ? "bg-green-400"
                        : consistencyScore >= 50
                          ? "bg-yellow-400"
                          : "bg-destructive"
                    }`}
                    style={{ width: `${consistencyScore}%` }}
                  />
                </div>

                {/* Warnings for missing fields */}
                <div className="space-y-1.5">
                  {consistencyItems.map((item) =>
                    item.filled ? (
                      <div
                        key={item.field}
                        className="flex items-center gap-2 text-xs text-green-400"
                      >
                        <Check className="h-3 w-3 flex-shrink-0" />
                        <span>{item.field}</span>
                      </div>
                    ) : (
                      <div
                        key={item.field}
                        className="flex items-start gap-2 text-xs text-yellow-500"
                      >
                        <AlertTriangle className="mt-0.5 h-3 w-3 flex-shrink-0" />
                        <span>{item.warning}</span>
                      </div>
                    )
                  )}
                </div>
              </CardContent>
            </Card>

            {/* Error */}
            {error && (
              <div className="flex items-center gap-2 rounded-lg border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive">
                <AlertTriangle className="h-4 w-4 flex-shrink-0" />
                {error}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Navigation buttons */}
      <div className="flex items-center justify-between border-t border-border pt-4">
        <Button variant="ghost" onClick={step === 1 ? onCancel : () => setStep(step - 1)}>
          {step === 1 ? (
            "Cancel"
          ) : (
            <>
              <ChevronLeft className="mr-1 h-4 w-4" />
              Back
            </>
          )}
        </Button>

        {step < 3 ? (
          <Button
            onClick={() => setStep(step + 1)}
            disabled={!canAdvance}
          >
            Next
            <ChevronRight className="ml-1 h-4 w-4" />
          </Button>
        ) : (
          <Button
            onClick={handleSubmit}
            disabled={submitting || visualDescription.length < 20}
          >
            {submitting ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Creating...
              </>
            ) : (
              <>
                <Check className="mr-1 h-4 w-4" />
                Create Character
              </>
            )}
          </Button>
        )}
      </div>
    </div>
  );
}
