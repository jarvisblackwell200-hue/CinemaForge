"use client";

import { useState, useMemo, useCallback, useRef } from "react";
import {
  Users,
  ChevronRight,
  ChevronLeft,
  Check,
  AlertTriangle,
  Sparkles,
  Loader2,
  ImageIcon,
  Upload,
  X,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
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

interface EditCharacterData {
  id: string;
  name: string;
  role: string | null;
  visualDescription: string;
  referenceImages: string[];
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
  editCharacter?: EditCharacterData;
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
  manualDescription: string; // free-text description when skipping form
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

/** Recommended angles for reference images — guides users toward multi-angle coverage. */
const ANGLE_GUIDES = [
  { label: "Front", hint: "Face straight-on" },
  { label: "3/4 View", hint: "Slightly turned" },
  { label: "Side", hint: "Profile view" },
  { label: "Action", hint: "Full body / pose" },
] as const;

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
  "short cropped", "medium length", "long straight", "long wavy",
  "curly", "buzz cut", "bald", "ponytail", "braids",
];

const FACIAL_HAIR_OPTIONS: FacialHair[] = [
  "none", "stubble", "beard", "mustache", "goatee",
];

const STEPS = [
  { id: 1, label: "Basics", description: "Name & role" },
  { id: 2, label: "Appearance", description: "Visual details" },
  { id: 3, label: "Preview", description: "Review & create" },
] as const;

// ---------------------------------------------------------------------------
// Helper: parse visual description back into form fields (best-effort)
// ---------------------------------------------------------------------------

function parseVisualDescription(desc: string): Partial<FormFields> {
  const result: Partial<FormFields> = {};
  const lower = desc.toLowerCase();

  for (const age of AGE_RANGES) {
    if (lower.includes(age)) { result.ageRange = age; break; }
  }
  for (const g of GENDERS) {
    if (lower.includes(g)) { result.gender = g; break; }
  }
  for (const b of BUILDS) {
    if (lower.includes(`${b} build`)) { result.build = b; break; }
  }
  for (const hs of HAIR_STYLES) {
    if (lower.includes(`${hs} hair`) || lower.includes(hs)) { result.hairStyle = hs; break; }
  }
  for (const fh of FACIAL_HAIR_OPTIONS) {
    if (fh !== "none" && lower.includes(`${fh} facial hair`)) { result.facialHair = fh; break; }
  }
  const skinMatch = lower.match(/(\w[\w\s]*?)\s+skin/);
  if (skinMatch) result.skinTone = skinMatch[1].trim();
  const hairColorMatch = lower.match(
    /(\w+)\s+(?:short cropped|medium length|long straight|long wavy|curly|buzz cut|ponytail|braids|)\s*hair/
  );
  if (hairColorMatch?.[1]) {
    const candidate = hairColorMatch[1].trim();
    const styleWords = new Set(HAIR_STYLES.flatMap((s) => s.split(" ")));
    if (!styleWords.has(candidate)) result.hairColor = candidate;
  }
  const clothingMatch = desc.match(/wearing\s+(.+?)(?:\.|,\s*[a-z])/i);
  if (clothingMatch) result.clothing = clothingMatch[1].trim();

  return result;
}

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

function FieldLabel({ children, required }: { children: React.ReactNode; required?: boolean }) {
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
  editCharacter,
}: CharacterWizardProps) {
  const isEditing = !!editCharacter;
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [step, setStep] = useState(1);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [referenceImages, setReferenceImages] = useState<string[]>(
    () => editCharacter?.referenceImages ?? []
  );
  const [generatingImage, setGeneratingImage] = useState(false);
  const [uploading, setUploading] = useState(false);

  const [fields, setFields] = useState<FormFields>(() => {
    if (editCharacter) {
      const parsed = parseVisualDescription(editCharacter.visualDescription);
      const hasFormFields = parsed.ageRange || parsed.gender || parsed.build;
      return {
        name: editCharacter.name,
        role: (editCharacter.role as Role) ?? "",
        ageRange: parsed.ageRange ?? "",
        gender: parsed.gender ?? "",
        build: parsed.build ?? "",
        skinTone: parsed.skinTone ?? "",
        hairColor: parsed.hairColor ?? "",
        hairStyle: parsed.hairStyle ?? "",
        facialHair: parsed.facialHair ?? "",
        clothing: parsed.clothing ?? "",
        distinguishingFeatures: "",
        manualDescription: hasFormFields ? "" : editCharacter.visualDescription,
      };
    }

    return {
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
      manualDescription: "",
    };
  });

  const updateField = useCallback(
    <K extends keyof FormFields>(key: K, value: FormFields[K]) => {
      setFields((prev) => ({ ...prev, [key]: value }));
    },
    []
  );

  // Whether the user has a reference image (can skip appearance form)
  const hasRefImage = referenceImages.length > 0;

  // -----------------------------------------------------------------------
  // Assembled visual description (from form fields)
  // -----------------------------------------------------------------------

  const formVisualDescription = useMemo(() => {
    const parts: string[] = [];
    const { ageRange: age, gender, build } = fields;

    if (age || gender || build) {
      let intro = "A";
      if (age) intro += ` ${age}`;
      if (gender) intro += ` ${gender}`;
      if (build) intro += ` with a ${build} build`;
      parts.push(intro);
    }
    if (fields.skinTone.trim()) parts.push(`${fields.skinTone.trim()} skin`);
    if (fields.hairColor.trim() || fields.hairStyle) {
      const hp: string[] = [];
      if (fields.hairColor.trim()) hp.push(fields.hairColor.trim());
      if (fields.hairStyle) hp.push(fields.hairStyle);
      hp.push("hair");
      parts.push(hp.join(" "));
    }
    if (fields.facialHair && fields.facialHair !== "none") {
      parts.push(`${fields.facialHair} facial hair`);
    }
    if (fields.clothing.trim()) parts.push(`wearing ${fields.clothing.trim()}`);
    if (fields.distinguishingFeatures.trim()) parts.push(fields.distinguishingFeatures.trim());

    return parts.length > 0 ? parts.join(", ") + "." : "";
  }, [fields]);

  // Final description: use form fields if filled, otherwise manual text
  const visualDescription = formVisualDescription || fields.manualDescription.trim();

  // -----------------------------------------------------------------------
  // Consistency score
  // -----------------------------------------------------------------------

  interface ConsistencyItem {
    field: string;
    filled: boolean;
    weight: number;
    warning: string;
  }

  const consistencyItems = useMemo<ConsistencyItem[]>(() => [
    { field: "Age range", filled: fields.ageRange !== "", weight: 1, warning: "Without age range, character age may vary between shots." },
    { field: "Gender", filled: fields.gender !== "", weight: 1, warning: "Without gender, character appearance may be inconsistent." },
    { field: "Build", filled: fields.build !== "", weight: 1, warning: "Without build, body type may change between shots." },
    { field: "Skin tone", filled: fields.skinTone.trim() !== "", weight: 1, warning: "Without skin tone, complexion may vary between shots." },
    { field: "Hair color", filled: fields.hairColor.trim() !== "", weight: 1, warning: "Without hair color, character may vary between shots." },
    { field: "Hair style", filled: fields.hairStyle !== "", weight: 1, warning: "Without hair style, hairstyle may change between shots." },
    { field: "Clothing", filled: fields.clothing.trim() !== "", weight: 1, warning: "Without clothing details, wardrobe may be inconsistent." },
    { field: "Reference image (1st)", filled: referenceImages.length >= 1, weight: 2, warning: "A reference image greatly improves character consistency." },
    { field: "Reference image (2nd)", filled: referenceImages.length >= 2, weight: 2, warning: "Upload 2-4 images from different angles for best face-locking." },
    { field: "Reference images (3-4)", filled: referenceImages.length >= 3, weight: 1, warning: "Additional angles further improve consistency." },
  ], [fields, referenceImages.length]);

  const consistencyScore = useMemo(() => {
    const totalWeight = consistencyItems.reduce((sum, i) => sum + i.weight, 0);
    const filledWeight = consistencyItems
      .filter((i) => i.filled)
      .reduce((sum, i) => sum + i.weight, 0);
    return Math.round((filledWeight / totalWeight) * 100);
  }, [consistencyItems]);

  // -----------------------------------------------------------------------
  // Step validation
  // -----------------------------------------------------------------------

  const canAdvance = useMemo(() => {
    if (step === 1) return fields.name.trim().length > 0 && fields.role !== "";
    if (step === 2) {
      // If they have a ref image, appearance fields are optional
      if (hasRefImage) return true;
      return fields.ageRange !== "" && fields.gender !== "" && fields.build !== "";
    }
    return true;
  }, [step, fields, hasRefImage]);

  // -----------------------------------------------------------------------
  // Upload reference image
  // -----------------------------------------------------------------------

  const handleFileUpload = async (file: File) => {
    if (!file.type.startsWith("image/")) {
      setError("Please upload an image file (JPEG, PNG, WebP, or GIF)");
      return;
    }
    if (file.size > 10 * 1024 * 1024) {
      setError("Image must be under 10 MB");
      return;
    }

    setUploading(true);
    setError(null);

    try {
      const formData = new FormData();
      formData.append("file", file);

      const res = await fetch("/api/upload", { method: "POST", body: formData });
      const data = await res.json();

      if (data.success) {
        setReferenceImages((prev) => [...prev, data.data.url]);
      } else {
        setError(data.error ?? "Upload failed");
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Upload failed");
    } finally {
      setUploading(false);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    const file = e.dataTransfer.files[0];
    if (file) handleFileUpload(file);
  };

  // -----------------------------------------------------------------------
  // Generate reference image
  // -----------------------------------------------------------------------

  const generateReferenceImage = async () => {
    if (visualDescription.length < 10) return;
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
        setReferenceImages((prev) => [...prev, data.data.imageUrl]);
      } else {
        setError(data.error ?? "Failed to generate image");
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Image generation failed");
    } finally {
      setGeneratingImage(false);
    }
  };

  const removeReferenceImage = (index: number) => {
    setReferenceImages((prev) => prev.filter((_, i) => i !== index));
  };

  // -----------------------------------------------------------------------
  // Submit
  // -----------------------------------------------------------------------

  const handleSubmit = async () => {
    // With a reference image, relax the description requirement
    const minDesc = hasRefImage ? 1 : 20;
    if (visualDescription.length < minDesc) {
      setError(
        hasRefImage
          ? "Please add at least a brief description for this character."
          : "Visual description is too short. Please fill in more appearance details."
      );
      return;
    }

    setSubmitting(true);
    setError(null);

    try {
      if (isEditing) {
        const response = await fetch(`/api/characters/${editCharacter.id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            name: fields.name.trim(),
            role: fields.role || undefined,
            visualDescription,
            referenceImages,
          }),
        });
        const result = await response.json();
        if (!response.ok || !result.success) {
          setError(result.error ?? "Failed to update character");
          return;
        }
        onComplete(result.data as CreatedCharacter);
      } else {
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
      }
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
              <div className={`h-px w-6 ${step > s.id - 1 ? "bg-primary" : "bg-border"}`} />
            )}
            <button
              type="button"
              onClick={() => { if (s.id < step) setStep(s.id); }}
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

      {/* Hidden file input — always in DOM so refs work from any step */}
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) handleFileUpload(file);
          e.target.value = "";
        }}
      />

      {/* Step content */}
      <div className="min-h-[320px]">
        {/* ----------------------------------------------------------------- */}
        {/* Step 1: Basics + optional image upload */}
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

            {/* Reference images with angle guidance */}
            <div>
              <FieldLabel>Reference Images</FieldLabel>
              <p className="mb-2 text-xs text-muted-foreground">
                Upload 2-4 images from different angles for reliable face-locking across shots.
              </p>
              <div className="grid grid-cols-4 gap-2">
                {ANGLE_GUIDES.map((guide, slotIdx) => {
                  const img = referenceImages[slotIdx];
                  return (
                    <div key={guide.label} className="flex flex-col items-center gap-1">
                      {img ? (
                        <div className="group/img relative h-20 w-20 overflow-hidden rounded-lg border border-border bg-black">
                          <img
                            src={img}
                            alt={`${guide.label} reference`}
                            className="h-full w-full object-cover"
                          />
                          <button
                            type="button"
                            onClick={() => removeReferenceImage(slotIdx)}
                            className="absolute right-0.5 top-0.5 flex h-5 w-5 items-center justify-center rounded-full bg-black/70 text-white opacity-0 transition-opacity group-hover/img:opacity-100 hover:bg-destructive"
                          >
                            <X className="h-3 w-3" />
                          </button>
                        </div>
                      ) : (
                        <button
                          type="button"
                          onClick={() => fileInputRef.current?.click()}
                          disabled={uploading}
                          onDragOver={(e) => e.preventDefault()}
                          onDrop={handleDrop}
                          className="flex h-20 w-20 flex-col items-center justify-center gap-0.5 rounded-lg border-2 border-dashed border-border text-muted-foreground transition-colors hover:border-primary/50 hover:text-primary"
                        >
                          {uploading ? (
                            <Loader2 className="h-4 w-4 animate-spin" />
                          ) : (
                            <Upload className="h-4 w-4" />
                          )}
                        </button>
                      )}
                      <span className="text-[10px] font-medium text-muted-foreground">
                        {guide.label}
                      </span>
                      <span className="text-[9px] text-muted-foreground/60">
                        {guide.hint}
                      </span>
                    </div>
                  );
                })}
              </div>
              {/* Extra images beyond 4 */}
              {referenceImages.length > 4 && (
                <div className="mt-2 flex gap-2 flex-wrap">
                  {referenceImages.slice(4).map((url, i) => (
                    <div
                      key={i + 4}
                      className="group/img relative h-16 w-16 overflow-hidden rounded-lg border border-border bg-black"
                    >
                      <img src={url} alt={`Extra reference ${i + 1}`} className="h-full w-full object-cover" />
                      <button
                        type="button"
                        onClick={() => removeReferenceImage(i + 4)}
                        className="absolute right-0.5 top-0.5 flex h-5 w-5 items-center justify-center rounded-full bg-black/70 text-white opacity-0 transition-opacity group-hover/img:opacity-100 hover:bg-destructive"
                      >
                        <X className="h-3 w-3" />
                      </button>
                    </div>
                  ))}
                </div>
              )}
              {referenceImages.length > 0 && (
                <p className="mt-2 text-xs flex items-center gap-1">
                  {referenceImages.length >= 2 ? (
                    <span className="text-green-500 flex items-center gap-1">
                      <Check className="h-3 w-3" />
                      {referenceImages.length} images -- face-locking enabled. You can skip the appearance form.
                    </span>
                  ) : (
                    <span className="text-amber-400 flex items-center gap-1">
                      <AlertTriangle className="h-3 w-3" />
                      1 image uploaded -- add at least 1 more for face-locking to work.
                    </span>
                  )}
                </p>
              )}
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

            {error && (
              <div className="flex items-center gap-2 rounded-lg border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive">
                <AlertTriangle className="h-4 w-4 flex-shrink-0" />
                {error}
              </div>
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
                {hasRefImage
                  ? "You have a reference image. These fields are optional but improve consistency."
                  : "These details ensure your character looks consistent across every shot. Fill in as many as possible."}
              </p>
            </div>

            <div className="grid gap-5 sm:grid-cols-2">
              <div>
                <FieldLabel required={!hasRefImage}>Age Range</FieldLabel>
                <div className="flex flex-wrap gap-1.5">
                  {AGE_RANGES.map((age) => (
                    <OptionButton key={age} selected={fields.ageRange === age} onClick={() => updateField("ageRange", age)}>
                      {age}
                    </OptionButton>
                  ))}
                </div>
              </div>

              <div>
                <FieldLabel required={!hasRefImage}>Gender</FieldLabel>
                <div className="flex flex-wrap gap-1.5">
                  {GENDERS.map((g) => (
                    <OptionButton key={g} selected={fields.gender === g} onClick={() => updateField("gender", g)}>
                      {g}
                    </OptionButton>
                  ))}
                </div>
              </div>

              <div>
                <FieldLabel required={!hasRefImage}>Build</FieldLabel>
                <div className="flex flex-wrap gap-1.5">
                  {BUILDS.map((b) => (
                    <OptionButton key={b} selected={fields.build === b} onClick={() => updateField("build", b)}>
                      {b}
                    </OptionButton>
                  ))}
                </div>
              </div>

              <div>
                <FieldLabel>Skin Tone</FieldLabel>
                <Input
                  value={fields.skinTone}
                  onChange={(e) => updateField("skinTone", e.target.value)}
                  placeholder="e.g. fair, olive, dark brown"
                  className="max-w-xs"
                />
              </div>

              <div>
                <FieldLabel>Hair Color</FieldLabel>
                <Input
                  value={fields.hairColor}
                  onChange={(e) => updateField("hairColor", e.target.value)}
                  placeholder="e.g. jet black, silver, auburn"
                  className="max-w-xs"
                />
              </div>

              <div>
                <FieldLabel>Hair Style</FieldLabel>
                <div className="flex flex-wrap gap-1.5">
                  {HAIR_STYLES.map((style) => (
                    <OptionButton key={style} selected={fields.hairStyle === style} onClick={() => updateField("hairStyle", style)}>
                      {style}
                    </OptionButton>
                  ))}
                </div>
              </div>

              {fields.gender === "male" && (
                <div>
                  <FieldLabel>Facial Hair</FieldLabel>
                  <div className="flex flex-wrap gap-1.5">
                    {FACIAL_HAIR_OPTIONS.map((fh) => (
                      <OptionButton key={fh} selected={fields.facialHair === fh} onClick={() => updateField("facialHair", fh)}>
                        {fh}
                      </OptionButton>
                    ))}
                  </div>
                </div>
              )}

              <div className="sm:col-span-2">
                <FieldLabel>Clothing</FieldLabel>
                <Input
                  value={fields.clothing}
                  onChange={(e) => updateField("clothing", e.target.value)}
                  placeholder="e.g. a long dark trenchcoat over a rumpled white shirt, loose tie"
                />
              </div>

              <div className="sm:col-span-2">
                <FieldLabel>Distinguishing Features</FieldLabel>
                <Input
                  value={fields.distinguishingFeatures}
                  onChange={(e) => updateField("distinguishingFeatures", e.target.value)}
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
                {formVisualDescription ? (
                  <p className="text-sm leading-relaxed">{formVisualDescription}</p>
                ) : (
                  <div>
                    <Textarea
                      value={fields.manualDescription}
                      onChange={(e) => updateField("manualDescription", e.target.value)}
                      placeholder={
                        hasRefImage
                          ? "Briefly describe what's not obvious from the image (e.g. clothing, accessories, context)..."
                          : "Describe this character's appearance..."
                      }
                      className="min-h-[80px] resize-none text-sm"
                    />
                    {hasRefImage && (
                      <p className="mt-1.5 text-[10px] text-muted-foreground">
                        The reference image handles visual identity. Add details only about what changes between shots (clothing, props, etc).
                      </p>
                    )}
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Reference Images */}
            <Card className="border-border">
              <CardContent className="pt-0">
                <p className="mb-3 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                  Reference Images
                </p>
                {referenceImages.length > 0 ? (
                  <div className="space-y-3">
                    <div className="grid grid-cols-3 gap-2">
                      {referenceImages.map((url, i) => (
                        <div
                          key={i}
                          className="group/img relative overflow-hidden rounded-lg border border-border bg-black"
                        >
                          <img
                            src={url}
                            alt={`${fields.name} reference ${i + 1}`}
                            className="w-full aspect-[3/4] object-cover"
                          />
                          <button
                            type="button"
                            onClick={() => removeReferenceImage(i)}
                            className="absolute right-1 top-1 flex h-5 w-5 items-center justify-center rounded-full bg-black/70 text-white opacity-0 transition-opacity group-hover/img:opacity-100 hover:bg-destructive"
                          >
                            <X className="h-3 w-3" />
                          </button>
                        </div>
                      ))}
                    </div>
                    <div className="flex items-center gap-2 flex-wrap">
                      <Badge variant="outline" className="border-green-500/30 text-green-500 text-[10px]">
                        <Check className="mr-1 h-2.5 w-2.5" />
                        {referenceImages.length} image{referenceImages.length !== 1 ? "s" : ""}
                      </Badge>
                      {referenceImages.length === 1 && (
                        <span className="text-[10px] text-amber-400">
                          Upload 2-4 images from different angles for best face-locking
                        </span>
                      )}
                      {referenceImages.length >= 2 && referenceImages.length < 4 && (
                        <span className="text-[10px] text-muted-foreground">
                          {4 - referenceImages.length} more image{4 - referenceImages.length !== 1 ? "s" : ""} recommended for optimal consistency
                        </span>
                      )}
                      <Button
                        size="sm"
                        variant="ghost"
                        className="h-7 text-xs"
                        onClick={() => fileInputRef.current?.click()}
                        disabled={uploading}
                      >
                        {uploading ? (
                          <Loader2 className="mr-1 h-3 w-3 animate-spin" />
                        ) : (
                          <Upload className="mr-1 h-3 w-3" />
                        )}
                        Upload Another
                      </Button>
                      {visualDescription.length >= 10 && (
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
                            <Sparkles className="mr-1 h-3 w-3" />
                          )}
                          Generate One
                        </Button>
                      )}
                    </div>
                  </div>
                ) : (
                  <div className="flex flex-col items-center gap-3 rounded-lg border border-dashed border-border py-6">
                    <ImageIcon className="h-8 w-8 text-muted-foreground/40" />
                    <p className="text-xs text-muted-foreground text-center max-w-xs">
                      Generate a reference image to ensure this character looks
                      consistent across all shots.
                    </p>
                    <div className="flex items-center gap-2">
                      <Button
                        size="sm"
                        variant="secondary"
                        onClick={() => fileInputRef.current?.click()}
                        disabled={uploading}
                      >
                        {uploading ? (
                          <>
                            <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
                            Uploading...
                          </>
                        ) : (
                          <>
                            <Upload className="mr-1.5 h-3.5 w-3.5" />
                            Upload Image
                          </>
                        )}
                      </Button>
                      {visualDescription.length >= 10 && (
                        <Button
                          size="sm"
                          variant="secondary"
                          onClick={generateReferenceImage}
                          disabled={generatingImage}
                        >
                          {generatingImage ? (
                            <>
                              <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
                              Generating...
                            </>
                          ) : (
                            <>
                              <Sparkles className="mr-1.5 h-3.5 w-3.5" />
                              Generate
                            </>
                          )}
                        </Button>
                      )}
                    </div>
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
                <div className="space-y-1.5">
                  {consistencyItems.map((item) =>
                    item.filled ? (
                      <div key={item.field} className="flex items-center gap-2 text-xs text-green-400">
                        <Check className="h-3 w-3 flex-shrink-0" />
                        <span>{item.field}</span>
                      </div>
                    ) : (
                      <div key={item.field} className="flex items-start gap-2 text-xs text-yellow-500">
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

        <div className="flex items-center gap-2">
          {/* Skip to preview when on Step 1 with a ref image */}
          {step === 1 && hasRefImage && canAdvance && (
            <Button
              variant="outline"
              onClick={() => setStep(3)}
            >
              Skip to Preview
              <ChevronRight className="ml-1 h-4 w-4" />
            </Button>
          )}

          {step < 3 ? (
            <Button onClick={() => setStep(step + 1)} disabled={!canAdvance}>
              {step === 1 && hasRefImage ? "Details" : "Next"}
              <ChevronRight className="ml-1 h-4 w-4" />
            </Button>
          ) : (
            <Button
              onClick={handleSubmit}
              disabled={submitting || (!hasRefImage && visualDescription.length < 20) || (hasRefImage && visualDescription.length < 1)}
            >
              {submitting ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  {isEditing ? "Saving..." : "Creating..."}
                </>
              ) : (
                <>
                  <Check className="mr-1 h-4 w-4" />
                  {isEditing ? "Save Changes" : "Create Character"}
                </>
              )}
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}
