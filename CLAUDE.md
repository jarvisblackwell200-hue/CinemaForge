# CLAUDE.md — CinemaForge Development Guide

> **This file instructs Claude Code on how to build CinemaForge, an AI-guided movie creation platform.**
> Read this entire file before writing any code. Follow these conventions strictly.

---

## Project Overview

CinemaForge guides users from a movie idea to an exported short film (30s–3min) using Kling 3.0 as the video generation backbone. The app acts as an AI film director — it structures scripts, suggests cinematography, manages character consistency, generates video shot-by-shot, and assembles the final movie.

**Read `PRODUCT_SPEC.md` for the full product specification before starting any feature work.**

---

## Tech Stack

```
Frontend:     Next.js 14+ (App Router) · React 18+ · TypeScript · Tailwind CSS · Zustand
Backend:      Next.js API Routes (initially) → Extract to separate service if needed
Database:     PostgreSQL via Prisma ORM
Queue:        BullMQ + Redis (for generation job management)
Storage:      Cloudflare R2 (S3-compatible) for all media assets
AI/LLM:      Anthropic Claude API (prompt intelligence, script analysis, suggestions)
Video Gen:    Kling 3.0 API (via fal.ai SDK or direct Kling API)
Auth:         NextAuth.js (email + OAuth)
Payments:     Stripe (subscriptions + credit packs)
Deployment:   Vercel (frontend) + Railway/Fly.io (worker processes)
```

---

## Project Structure

```
cinemaforge/
├── CLAUDE.md                    # THIS FILE — development instructions
├── PRODUCT_SPEC.md              # Full product specification
├── package.json
├── tsconfig.json
├── tailwind.config.ts
├── prisma/
│   └── schema.prisma            # Database schema
├── src/
│   ├── app/                     # Next.js App Router
│   │   ├── layout.tsx
│   │   ├── page.tsx             # Landing / dashboard
│   │   ├── (auth)/
│   │   │   ├── login/page.tsx
│   │   │   └── signup/page.tsx
│   │   ├── movies/
│   │   │   ├── page.tsx              # Movie list / dashboard
│   │   │   ├── new/page.tsx          # New movie wizard
│   │   │   └── [movieId]/
│   │   │       ├── page.tsx          # Movie overview
│   │   │       ├── script/page.tsx   # Script editor
│   │   │       ├── characters/page.tsx
│   │   │       ├── storyboard/page.tsx
│   │   │       ├── generate/page.tsx
│   │   │       ├── timeline/page.tsx
│   │   │       └── export/page.tsx
│   │   └── api/
│   │       ├── movies/route.ts
│   │       ├── characters/route.ts
│   │       ├── shots/route.ts
│   │       ├── generate/route.ts
│   │       ├── assemble/route.ts
│   │       ├── credits/route.ts
│   │       ├── ai/
│   │       │   ├── script/route.ts       # LLM script generation
│   │       │   ├── suggest-shots/route.ts # LLM shot suggestions
│   │       │   └── prompt/route.ts       # LLM prompt assembly
│   │       └── webhooks/
│   │           ├── stripe/route.ts
│   │           └── kling/route.ts
│   ├── components/
│   │   ├── ui/                   # Shared UI primitives (shadcn/ui)
│   │   ├── movie/
│   │   │   ├── ConceptChat.tsx        # Conversational movie ideation
│   │   │   ├── ScriptEditor.tsx       # Scene/beat/dialogue editor
│   │   │   ├── CharacterCard.tsx      # Character definition + refs
│   │   │   ├── CharacterWizard.tsx    # Guided character creation
│   │   │   ├── ShotCard.tsx           # Individual shot editor
│   │   │   ├── StoryboardView.tsx     # Visual shot grid
│   │   │   ├── CameraMovementBrowser.tsx
│   │   │   ├── StyleBibleEditor.tsx
│   │   │   ├── PromptPreview.tsx      # Shows assembled prompt
│   │   │   ├── TakeComparison.tsx     # Side-by-side take picker
│   │   │   ├── TimelineEditor.tsx     # Shot sequence + transitions
│   │   │   ├── GenerationQueue.tsx    # Generation status dashboard
│   │   │   └── MoviePreview.tsx       # Final playback
│   │   └── layout/
│   │       ├── Sidebar.tsx
│   │       ├── Header.tsx
│   │       └── CreditsBadge.tsx
│   ├── lib/
│   │   ├── db.ts                 # Prisma client singleton
│   │   ├── auth.ts               # NextAuth config
│   │   ├── stripe.ts             # Stripe helpers
│   │   ├── credits.ts            # Credit checking, deduction, ledger
│   │   ├── kling/
│   │   │   ├── client.ts         # Kling API client wrapper
│   │   │   ├── types.ts          # Kling API types
│   │   │   ├── prompts.ts        # Prompt assembly engine
│   │   │   └── elements.ts       # Character element management
│   │   ├── ai/
│   │   │   ├── director.ts       # Claude-powered AI director
│   │   │   ├── script-analyzer.ts
│   │   │   ├── shot-suggester.ts
│   │   │   └── prompt-optimizer.ts
│   │   ├── video/
│   │   │   ├── assembler.ts      # FFmpeg-based assembly
│   │   │   └── thumbnail.ts      # Frame extraction
│   │   └── constants/
│   │       ├── camera-movements.ts    # Full camera movement database
│   │       ├── genre-presets.ts       # Style bible presets per genre
│   │       ├── prompt-templates.ts    # Reusable prompt blocks
│   │       └── pricing.ts            # Credit costs per operation
│   ├── store/
│   │   ├── movieStore.ts         # Zustand store for active movie
│   │   └── uiStore.ts           # UI state
│   ├── hooks/
│   │   ├── useMovie.ts
│   │   ├── useCredits.ts
│   │   ├── useGeneration.ts
│   │   └── useAIDirector.ts
│   └── types/
│       ├── movie.ts
│       ├── character.ts
│       ├── shot.ts
│       └── credits.ts
├── workers/
│   ├── generation-worker.ts      # BullMQ worker: processes Kling jobs
│   └── assembly-worker.ts        # BullMQ worker: FFmpeg assembly
└── scripts/
    ├── seed-camera-movements.ts  # Seed camera movement DB
    └── seed-genre-presets.ts     # Seed genre presets
```

---

## Database Schema (Prisma)

Define in `prisma/schema.prisma`. Key models:

```prisma
model User {
  id             String   @id @default(cuid())
  email          String   @unique
  name           String?
  plan           Plan     @default(FREE)
  creditsBalance Int      @default(50)
  movies         Movie[]
  creditLedger   CreditLedger[]
  createdAt      DateTime @default(now())
}

enum Plan {
  FREE
  CREATOR
  PRO
  STUDIO
}

model Movie {
  id              String     @id @default(cuid())
  userId          String
  user            User       @relation(fields: [userId], references: [id])
  title           String
  synopsis        String?
  genre           String?    // noir, scifi, horror, commercial, documentary, custom
  targetDuration  Int        @default(60) // seconds
  aspectRatio     String     @default("16:9")
  status          MovieStatus @default(CONCEPT)
  styleBible      Json?      // { filmStock, colorPalette, textures, negativePrompt }
  script          Json?      // { scenes: [{ title, location, beats: [{ description, dialogue }] }] }
  characters      Character[]
  shots           Shot[]
  timeline        Timeline?
  createdAt       DateTime   @default(now())
  updatedAt       DateTime   @updatedAt
}

enum MovieStatus {
  CONCEPT
  SCRIPTING
  CHARACTERS
  STORYBOARDING
  GENERATING
  ASSEMBLING
  COMPLETE
}

model Character {
  id                String   @id @default(cuid())
  movieId           String
  movie             Movie    @relation(fields: [movieId], references: [id], onDelete: Cascade)
  name              String
  role              String?  // "protagonist", "antagonist", "supporting"
  visualDescription String   @db.Text
  referenceImages   String[] // S3/R2 URLs
  voiceProfile      Json?    // { language, accent, tone, speed }
  styleBibleEntry   String?  @db.Text // appended to prompts featuring this character
  klingElementId    String?  // ID from Kling Elements API
  createdAt         DateTime @default(now())
}

model Shot {
  id              String     @id @default(cuid())
  movieId         String
  movie           Movie      @relation(fields: [movieId], references: [id], onDelete: Cascade)
  sceneIndex      Int        // which scene this belongs to
  order           Int        // position within the movie
  shotType        String     // wide, medium, close-up, extreme-close-up, ots, pov, etc.
  cameraMovement  String     // from camera movements database
  subject         String     @db.Text
  action          String     @db.Text
  environment     String?    @db.Text
  lighting        String?    @db.Text
  dialogue        Json?      // { characterId, line, emotion }
  durationSeconds Int        @default(5)
  generatedPrompt String?    @db.Text  // the assembled Kling prompt
  negativePrompt  String?    @db.Text
  startFrameUrl   String?    // for continuity chaining
  endFrameUrl     String?
  status          ShotStatus @default(DRAFT)
  takes           Take[]
  createdAt       DateTime   @default(now())
  updatedAt       DateTime   @updatedAt
}

enum ShotStatus {
  DRAFT
  QUEUED
  GENERATING
  COMPLETE
  FAILED
}

model Take {
  id               String   @id @default(cuid())
  shotId           String
  shot             Shot     @relation(fields: [shotId], references: [id], onDelete: Cascade)
  videoUrl         String   // S3/R2 URL
  thumbnailUrl     String?
  isHero           Boolean  @default(false)
  klingTaskId      String?  // for tracking Kling generation
  generationParams Json?    // snapshot of params used
  qualityScore     Float?   // 0-1, auto or manual
  createdAt        DateTime @default(now())
}

model Timeline {
  id             String   @id @default(cuid())
  movieId        String   @unique
  movie          Movie    @relation(fields: [movieId], references: [id], onDelete: Cascade)
  orderedShotIds String[] // ordered shot IDs
  transitions    Json?    // [{ afterShotId, type: "cut"|"crossfade"|"fade", durationMs }]
  audioLayers    Json?    // [{ type: "music"|"sfx"|"ambient", url, startMs, endMs, volume }]
  exportedUrl    String?  // final assembled video URL
  createdAt      DateTime @default(now())
  updatedAt      DateTime @updatedAt
}

model CreditLedger {
  id        String      @id @default(cuid())
  userId    String
  user      User        @relation(fields: [userId], references: [id])
  amount    Int         // positive = credit, negative = debit
  type      CreditType
  movieId   String?
  shotId    String?
  memo      String?     // human-readable description
  createdAt DateTime    @default(now())
}

enum CreditType {
  PURCHASE
  SUBSCRIPTION
  USAGE
  BONUS
  REFUND
}
```

---

## Key Implementation Details

### 1. AI Director (Claude-Powered Brain)

Located in `src/lib/ai/director.ts`. This is the most important module — it powers all creative guidance.

**System prompt for the AI Director:**
```typescript
const AI_DIRECTOR_SYSTEM = `
You are CinemaForge's AI Director — an expert filmmaker, cinematographer, and screenwriter.
Your job is to guide users from a movie idea to a structured production plan.

You understand:
- Narrative structure (setup, conflict, rising action, climax, resolution)
- Cinematography (70+ camera movements, shot types, lens choices)
- Visual storytelling (show don't tell, visual metaphors, pacing)
- Kling 3.0's capabilities and limitations
- Prompt engineering for AI video generation

When analyzing a user's movie concept, you ALWAYS output structured JSON alongside your conversational response.

KEY RULES:
1. Never suggest shots longer than 15 seconds (Kling max per generation)
2. Prefer 5-8 second shots for most scenes (best quality range)
3. Always describe camera movement relative to the subject
4. Use one camera movement per shot for best results
5. For dialogue scenes, suggest Kling's native audio format with [Character: voice description]: "line"
6. Maintain character description consistency — never vary descriptors between shots
7. Always include the Style Bible at the end of every assembled prompt
8. For emotional moments: suggest slow dolly push-in or static close-up
9. For action: suggest tracking shots, low angles, speed ramps
10. For reveals: suggest pan-to-reveal or crane shot
11. For dialogue: suggest shot-reverse-shot or OTS
12. For establishing: suggest wide crane or aerial
13. Keep total shot count realistic: ~8-12 shots for 60s, ~20-30 for 3min
14. Estimate credits cost and warn if exceeding user's plan
`;
```

**Script analysis function:**
The director takes a natural language movie concept and returns:
```typescript
interface ScriptAnalysis {
  synopsis: string;
  genre: string;
  suggestedDuration: number; // seconds
  scenes: {
    title: string;
    location: string;
    timeOfDay: string;
    beats: {
      description: string;
      emotionalTone: string;
      dialogue?: { character: string; line: string; emotion: string }[];
    }[];
  }[];
  characters: {
    name: string;
    role: string;
    suggestedVisualDescription: string;
  }[];
  styleSuggestions: {
    genre: string;
    filmStock: string;
    colorPalette: string;
    textures: string[];
    negativePrompt: string;
  };
  estimatedShots: number;
  estimatedCredits: number;
}
```

**Shot suggestion function:**
Takes a scene beat and returns camera/shot recommendations:
```typescript
interface ShotSuggestion {
  shotType: string;
  cameraMovement: string;
  promptSnippet: string; // ready to use camera + action description
  rationale: string; // "Close-up with slow push-in emphasizes the detective's realization"
  durationRecommendation: number;
  alternatives: { shotType: string; cameraMovement: string; rationale: string }[];
}
```

### 2. Prompt Assembly Engine

Located in `src/lib/kling/prompts.ts`. Assembles the final Kling prompt from components.

**Prompt assembly order (critical for Kling 3.0 quality):**
```
1. Camera/Shot type → HOW the audience sees it
2. Subject → WHO is on screen (with @Element references)
3. Action → WHAT happens (beginning → middle → end)
4. Environment → WHERE (location, time, weather)
5. Lighting → specific light sources
6. Style Bible → appended last (film stock, grade, texture)
```

**Key implementation rules:**
```typescript
function assemblePrompt(shot: Shot, characters: Character[], styleBible: StyleBible): string {
  // 1. CAMERA BLOCK — from camera movement database
  const cameraBlock = getCameraPromptText(shot.cameraMovement, shot.shotType);

  // 2. SUBJECT BLOCK — with character element references
  // IMPORTANT: Use @CharacterName for Kling element binding
  // IMPORTANT: Do NOT re-describe what's in reference images
  const subjectBlock = buildSubjectBlock(shot.subject, characters);

  // 3. ACTION BLOCK — temporal: describe beginning, middle, end
  const actionBlock = shot.action;

  // 4. ENVIRONMENT
  const envBlock = shot.environment || "";

  // 5. LIGHTING
  const lightBlock = shot.lighting || "";

  // 6. STYLE BIBLE — always last
  const styleBlock = formatStyleBible(styleBible);

  // Assemble with natural sentence flow, not comma-separated keywords
  return [cameraBlock, subjectBlock, actionBlock, envBlock, lightBlock, styleBlock]
    .filter(Boolean)
    .join(". ") + ".";
}
```

**Kling multi-shot format (for 3.0 storyboard mode):**
```typescript
function assembleMultiShotPrompt(shots: Shot[], characters: Character[], styleBible: StyleBible): string {
  // Max 6 shots per multi-shot generation
  // Each shot: "Shot N (Xs): [camera], [subject] [action]. [dialogue if any]"
  return shots.map((shot, i) => {
    const camera = getCameraPromptText(shot.cameraMovement, shot.shotType);
    const subject = buildSubjectBlock(shot.subject, characters);
    const dialogue = formatDialogue(shot.dialogue);
    return `Shot ${i + 1} (${shot.durationSeconds}s): ${camera}, ${subject} ${shot.action}.${dialogue ? `\n  ${dialogue}` : ""}`;
  }).join("\n");
}
```

**Dialogue formatting for Kling 3.0 native audio:**
```typescript
function formatDialogue(dialogue: ShotDialogue | null): string {
  if (!dialogue) return "";
  // Format: [Character Name, voice description]: "Line"
  return `[${dialogue.characterName}, ${dialogue.emotion} voice]: "${dialogue.line}"`;
}
```

### 3. Camera Movement Database

Located in `src/lib/constants/camera-movements.ts`.

```typescript
export interface CameraMovement {
  id: string;
  name: string;
  category: "establishing" | "character" | "action" | "transition";
  description: string;
  bestFor: string; // when to use it
  promptSyntax: string; // exact text to inject into Kling prompts
  minDuration: number; // minimum seconds needed
  examplePrompt: string; // full example prompt using this movement
  icon: string; // emoji or icon reference
}

export const CAMERA_MOVEMENTS: CameraMovement[] = [
  {
    id: "dolly-push-in",
    name: "Dolly Push-In",
    category: "character",
    description: "Camera moves steadily forward toward the subject, creating intimacy and focus",
    bestFor: "Emotional moments, realizations, building tension",
    promptSyntax: "Slow dolly push-in from medium shot to close-up",
    minDuration: 5,
    examplePrompt: "Slow dolly push-in from medium shot to close-up. A woman sits alone at a rain-streaked window, her reflection ghostly in the glass. She slowly reaches up and touches the cold surface. Soft natural light from overcast sky, condensation on glass, shallow depth of field, shot on 35mm film.",
    icon: "🎯"
  },
  {
    id: "crane-up-reveal",
    name: "Crane Up Reveal",
    category: "establishing",
    description: "Camera sweeps upward to reveal the full scope of a location or scene",
    bestFor: "Establishing shots, revealing scale, opening scenes",
    promptSyntax: "Crane shot sweeping upward to reveal the full scene",
    minDuration: 5,
    examplePrompt: "Crane shot sweeping upward from street level. Starting on a lone figure standing in fog, the camera rises to reveal an enormous Gothic cathedral towering above. Volumetric fog, golden hour backlighting, 4K cinematic.",
    icon: "🏗️"
  },
  {
    id: "tracking-follow",
    name: "Tracking Follow",
    category: "action",
    description: "Camera moves alongside the subject, maintaining consistent framing while they move",
    bestFor: "Walking/running scenes, chase sequences, journey moments",
    promptSyntax: "Tracking shot, camera follows alongside the subject at [position]",
    minDuration: 5,
    examplePrompt: "Tracking shot, camera follows alongside the detective at shoulder height as he walks briskly through a crowded night market. Neon signs blur in the background, steam rises from food stalls. Handheld energy, shallow focus on subject, anamorphic bokeh.",
    icon: "🏃"
  },
  {
    id: "static-wide",
    name: "Static Wide",
    category: "establishing",
    description: "Locked-off wide shot showing the full scene, no camera movement",
    bestFor: "Establishing context, tableaux shots, letting action play out",
    promptSyntax: "Static tripod, wide shot",
    minDuration: 3,
    examplePrompt: "Static tripod, wide shot of an empty desert highway stretching to the horizon. A single car approaches from the distance, growing larger. Heat shimmer, dust, golden hour, deep depth of field.",
    icon: "📐"
  },
  {
    id: "orbit-360",
    name: "360° Orbit",
    category: "character",
    description: "Camera circles completely around the subject",
    bestFor: "Hero introductions, transformation reveals, dramatic emphasis",
    promptSyntax: "Camera orbits 360 degrees around the subject",
    minDuration: 10,
    examplePrompt: "Camera orbits 360 degrees around a samurai standing in a bamboo forest clearing. Cherry blossom petals fall slowly. The warrior draws his katana as the camera completes its rotation. Volumetric light rays, shallow depth of field.",
    icon: "🔄"
  },
  {
    id: "pan-reveal",
    name: "Pan-to-Reveal",
    category: "transition",
    description: "Camera pans horizontally to discover something new in the scene",
    bestFor: "Plot reveals, surprises, transitioning attention",
    promptSyntax: "The camera pans slowly to the [direction], revealing",
    minDuration: 5,
    examplePrompt: "The camera pans slowly to the right, moving away from the detective's shocked face. The pan gradually reveals a massive evidence board covered in photos, maps, and red string connecting clues. Cinematic, suspenseful, dramatic reveal.",
    icon: "👀"
  },
  {
    id: "handheld",
    name: "Handheld",
    category: "action",
    description: "Intentionally imperfect, organic camera movement with natural sway",
    bestFor: "Raw energy, urgency, documentary feel, chase scenes",
    promptSyntax: "Handheld camera, close behind the subject",
    minDuration: 3,
    examplePrompt: "Handheld camera, close behind a man running through narrow alley corridors at night. Breathing audible. Walls blur past, puddles splash. Flickering overhead lights create strobing effect. Raw, urgent, 16mm film grain.",
    icon: "🖐️"
  },
  {
    id: "rack-focus",
    name: "Rack Focus",
    category: "transition",
    description: "Focus shifts from foreground to background (or reverse) within the shot",
    bestFor: "Shifting attention between subjects, reveals, storytelling transitions",
    promptSyntax: "Rack focus from [foreground element] to [background element]",
    minDuration: 3,
    examplePrompt: "Rack focus from a wilted rose in the foreground to a woman sitting alone at a café table in the background. She stares at an empty chair across from her. Soft natural light, shallow depth of field, melancholic.",
    icon: "🔍"
  },
  // ... Continue with 30+ more movements
  // Categories: whip-pan, crash-zoom, dolly-zoom, low-angle-tracking,
  // high-angle-looking-down, dutch-angle, fpv, steadicam, aerial-drone,
  // macro-close-up, ots-dialogue, shot-reverse-shot, pull-out-reveal,
  // tilt-up, tilt-down, truck-left-right, speed-ramp, etc.
];
```

### 4. Genre Style Presets

Located in `src/lib/constants/genre-presets.ts`.

```typescript
export interface GenrePreset {
  id: string;
  name: string;
  styleBible: {
    filmStock: string;
    colorPalette: string;
    textures: string[];
    negativePrompt: string;
    styleString: string; // the full appended style text
  };
  cameraPreferences: string[]; // preferred camera movement IDs
  lightingKeywords: string[];
  pacing: "slow" | "moderate" | "fast";
  avgShotDuration: number; // seconds
}

export const GENRE_PRESETS: GenrePreset[] = [
  {
    id: "noir",
    name: "Film Noir",
    styleBible: {
      filmStock: "shot on 35mm film, anamorphic lens",
      colorPalette: "desaturated teal grade, crushed blacks",
      textures: ["heavy film grain", "shallow depth of field", "wet reflective surfaces", "hard shadows"],
      negativePrompt: "bright colors, sunny, cheerful, overexposed, cartoon, anime",
      styleString: "Desaturated teal grade, crushed blacks, hard side-lighting, wet reflective surfaces, shot on 35mm film, anamorphic lens, heavy film grain, narrow depth of field, cinematic. 4K."
    },
    cameraPreferences: ["dolly-push-in", "static-wide", "pan-reveal", "low-angle-tracking", "dutch-angle"],
    lightingKeywords: ["hard side-light", "neon reflections", "single source overhead", "rim lighting", "flickering", "chiaroscuro"],
    pacing: "slow",
    avgShotDuration: 6
  },
  {
    id: "scifi",
    name: "Sci-Fi Cinematic",
    styleBible: {
      filmStock: "shot on ARRI Alexa, anamorphic",
      colorPalette: "cool blue-steel palette, neon accents",
      textures: ["clean sharp focus", "lens flares", "volumetric lighting", "atmospheric haze"],
      negativePrompt: "vintage, warm tones, natural settings, amateur, shaky",
      styleString: "Cool blue-steel palette, volumetric lighting, lens flares, shot on ARRI Alexa, anamorphic, clean sharp focus, futuristic, neon accents, atmospheric haze, cinematic. 4K."
    },
    cameraPreferences: ["crane-up-reveal", "tracking-follow", "orbit-360", "dolly-push-in", "static-wide"],
    lightingKeywords: ["neon", "holographic", "volumetric", "backlit", "cold LED", "bioluminescent"],
    pacing: "moderate",
    avgShotDuration: 5
  },
  {
    id: "horror",
    name: "Horror / Thriller",
    styleBible: {
      filmStock: "shot on 35mm film",
      colorPalette: "desaturated, high contrast, muted greens",
      textures: ["heavy film grain", "deep shadows", "claustrophobic framing", "flickering light"],
      negativePrompt: "bright, colorful, happy, wide open spaces, cheerful, cartoon",
      styleString: "Desaturated, high contrast, deep shadows, flickering light, handheld slight shake, 35mm film grain, claustrophobic framing, muted greens and yellows, cinematic. 4K."
    },
    cameraPreferences: ["handheld", "dolly-push-in", "dutch-angle", "rack-focus", "static-wide"],
    lightingKeywords: ["flickering", "single candle", "moonlight", "deep shadow", "practical lights only", "under-lit"],
    pacing: "slow",
    avgShotDuration: 7
  },
  {
    id: "commercial",
    name: "Commercial / Product",
    styleBible: {
      filmStock: "shot on RED Komodo",
      colorPalette: "clean, bright, color-accurate",
      textures: ["shallow depth of field", "soft diffused lighting", "4K sharp", "high production value"],
      negativePrompt: "dark, gritty, noisy, amateur, shaky, film grain, vintage",
      styleString: "Clean, bright, professional, shot on RED Komodo, shallow depth of field, soft diffused lighting, high production value, color-accurate, 4K sharp, cinematic."
    },
    cameraPreferences: ["orbit-360", "dolly-push-in", "macro-close-up", "crane-up-reveal", "tracking-follow"],
    lightingKeywords: ["soft diffused", "bright key light", "rim light", "studio lighting", "golden hour"],
    pacing: "moderate",
    avgShotDuration: 4
  },
  {
    id: "documentary",
    name: "Documentary / Observational",
    styleBible: {
      filmStock: "shot on 16mm film",
      colorPalette: "muted earth tones, natural",
      textures: ["handheld feel", "natural grain", "authentic", "available light"],
      negativePrompt: "dramatic lighting, neon, fantasy, CGI, perfect, polished",
      styleString: "Natural lighting, handheld feel, observational, 16mm film aesthetic, muted earth tones, authentic, unpolished, documentary. 4K."
    },
    cameraPreferences: ["handheld", "static-wide", "tracking-follow", "rack-focus"],
    lightingKeywords: ["natural", "available light", "overcast", "window light", "practical"],
    pacing: "moderate",
    avgShotDuration: 6
  }
];
```

### 5. Credit System

Located in `src/lib/credits.ts`.

```typescript
export const CREDIT_COSTS = {
  REFERENCE_IMAGE: 1,
  VIDEO_DRAFT_5S: 5,
  VIDEO_DRAFT_10S: 8,
  VIDEO_STANDARD_5S: 15,
  VIDEO_STANDARD_10S: 25,
  VIDEO_CINEMA_5S: 40,
  VIDEO_CINEMA_10S: 65,
  MULTI_SHOT_STORYBOARD: 50,
  ASSEMBLY_EXPORT: 10,
  VOICE_LINE: 3,
  MUSIC_TRACK: 10,
} as const;

// Check if user can afford an operation BEFORE executing it
// Deduct credits atomically in a transaction with the generation job
// Always record in CreditLedger with memo explaining the charge
// Refund credits if generation fails after 3 retries
```

### 6. Generation Worker

Located in `workers/generation-worker.ts`. Runs as a separate process.

```typescript
// BullMQ worker that:
// 1. Picks up generation jobs from Redis queue
// 2. Calls Kling API with assembled prompt
// 3. Polls for completion (Kling is async — typically 30s-3min)
// 4. On success: download video, upload to R2, create Take record, extract thumbnail
// 5. On failure: retry up to 3x with slight prompt variation
// 6. If all retries fail: refund credits, mark shot as FAILED
// 7. When all shots in a movie are COMPLETE: trigger assembly job

// IMPORTANT: Implement continuity chaining
// Before generating shot N, extract the last frame of shot N-1's hero take
// Use that as the start_frame for shot N to maintain visual continuity
```

### 7. Video Assembly

Located in `src/lib/video/assembler.ts`. Uses FFmpeg.

```typescript
// Assembly pipeline:
// 1. Download all hero takes from R2
// 2. Trim each to the specified duration
// 3. Apply transitions between shots (cut = direct concat, crossfade = xfade filter)
// 4. Mix audio layers (dialogue from Kling, music track, ambient)
// 5. Apply a uniform color LUT if specified
// 6. Export as MP4 (H.264, AAC audio)
// 7. Upload to R2
// 8. Update Timeline record with exportedUrl

// Use fluent-ffmpeg or direct ffmpeg child_process
// Ensure ffmpeg is available in the worker environment
```

---

## UI/UX Design Principles

### Visual design
- **Dark theme** — cinematic feel, easier on the eyes for creative work
- **Film-inspired UI** — subtle film strip motifs, dark grays (#0f0f0f, #1a1a1a, #2a2a2a), accent color: warm amber (#f59e0b) or cinema red (#dc2626)
- **Clean layout** — generous whitespace, no clutter. One task at a time.
- **Video-first** — every video/image gets maximum screen real estate
- Use **shadcn/ui** components as the base, customized to the dark cinema theme

### Workflow navigation
The movie creation is a **linear pipeline with step-back capability:**
```
Concept → Script → Characters → Storyboard → Generate → Timeline → Export
   ↑         ↑          ↑            ↑           ↑          ↑
   └─────────┴──────────┴────────────┴───────────┴──────────┘
              (can always go back and edit earlier steps)
```

Each step is a page under `/movies/[movieId]/`. The sidebar shows all steps with completion status. The current step is highlighted. Steps after the current one are grayed but accessible.

### Key UI interactions
- **ConceptChat** — Chat-style interface where user describes their idea and AI Director responds with structured suggestions. "Accept" buttons on each suggestion to lock it in.
- **ShotCard** — Expandable card showing thumbnail (or placeholder), shot type badge, camera icon, duration, prompt preview. Click to edit. Drag to reorder.
- **CameraMovementBrowser** — Modal/drawer with grid of camera movements, filterable by category. Each card shows name, icon, description, "Use for..." hint. Click to select and inject into current shot.
- **TakeComparison** — 2–3 video players side by side. "Select Hero" button under each. Quick "Regenerate" button that sends shot back to queue.
- **PromptPreview** — Live-updating text area showing the fully assembled prompt. Yellow highlights show which parts come from the camera block, subject block, style bible, etc. User can override any part.
- **TimelineEditor** — Horizontal strip of video thumbnails. Click between shots to set transition type. Play button for full preview.

---

## Coding Conventions

### General
- **TypeScript strict mode** everywhere
- **No `any` types** — define interfaces for everything
- **Zod validation** on all API inputs
- **Server Components by default** — use `"use client"` only when needed
- **Error boundaries** around every async operation
- **Optimistic updates** in UI with rollback on failure
- Prefer `async/await` over `.then()` chains
- Use named exports, not default exports (except page.tsx)

### API routes
- All API routes validate input with Zod schemas
- All mutations check credit balance before proceeding
- Return consistent response shape: `{ success: boolean, data?: T, error?: string }`
- Use try/catch with proper error classification (400 vs 401 vs 500)

### Database
- Always use Prisma transactions for credit operations
- Include `select` to limit returned fields
- Use `onDelete: Cascade` appropriately

### Kling API integration
- Abstract behind a client class in `src/lib/kling/client.ts`
- Handle rate limiting with exponential backoff
- Store raw API responses for debugging
- Map Kling's response format to our internal types

### Testing
- Write integration tests for the prompt assembly engine (critical path)
- Write unit tests for credit calculations
- Test the AI Director prompts with snapshot tests

---

## Environment Variables

```env
# Database
DATABASE_URL="postgresql://..."

# Auth
NEXTAUTH_SECRET="..."
NEXTAUTH_URL="http://localhost:3000"

# Kling AI
KLING_API_KEY="..."
KLING_API_BASE_URL="https://api.klingai.com/v1"  # or fal.ai endpoint

# Anthropic (AI Director)
ANTHROPIC_API_KEY="..."

# Storage
R2_ACCOUNT_ID="..."
R2_ACCESS_KEY_ID="..."
R2_SECRET_ACCESS_KEY="..."
R2_BUCKET_NAME="cinemaforge-media"
R2_PUBLIC_URL="https://media.cinemaforge.ai"

# Redis
REDIS_URL="redis://..."

# Stripe
STRIPE_SECRET_KEY="..."
STRIPE_WEBHOOK_SECRET="..."
STRIPE_PRICE_CREATOR="price_..."
STRIPE_PRICE_PRO="price_..."
STRIPE_PRICE_STUDIO="price_..."

# Optional
ELEVENLABS_API_KEY="..."  # for custom voice
```

---

## Development Workflow

### Getting started
```bash
npm install
npx prisma db push
npx prisma db seed        # seeds camera movements + genre presets
npm run dev                # starts Next.js dev server
npm run worker:dev         # starts BullMQ worker in dev mode
```

### Build order (implement in this sequence)
1. **Database schema** + Prisma setup
2. **Auth** — NextAuth with email/magic link
3. **Movie CRUD** — create, list, update, delete movies
4. **Concept → Script** — ConceptChat UI + AI Director integration
5. **Character system** — Character CRUD + reference image generation
6. **Camera movement database** — seed data + browser UI
7. **Genre presets** — seed data + style bible editor
8. **Shot planning** — Shot CRUD + AI suggestions + prompt assembly
9. **Prompt preview** — live prompt display with component highlighting
10. **Generation pipeline** — Kling API integration + BullMQ queue + worker
11. **Take management** — Upload handling + comparison UI + hero selection
12. **Timeline assembly** — Shot ordering + transitions + FFmpeg export
13. **Credit system** — Ledger, balance checks, Stripe integration
14. **Export** — Final MP4 generation + download

### Priorities
- Get the **Concept → Script → Shot Plan → Prompt Preview** loop working first — this is the core value proposition and requires no API keys
- Generation pipeline second
- Assembly and export third
- Credits and payments last (use unlimited credits in dev)

---

## Critical Kling 3.0 Prompt Rules (MUST FOLLOW)

These rules are derived from extensive testing and must be enforced by the prompt assembly engine:

1. **Write scene directions, not keyword lists** — natural sentences describing motion over time
2. **One camera movement per shot** — multiple movements confuse the model
3. **Describe camera relative to subject** — "camera follows her" not "camera moves right"
4. **Temporal action structure** — beginning → middle → end within each shot
5. **Name real light sources** — "flickering neon sign casting magenta" not "dramatic lighting"
6. **Don't re-describe reference images** — only describe what changes
7. **Use @ElementName syntax** for character references in Kling
8. **Face reference strength 70–85** — default 42 is too low, above 85 is too rigid
9. **Style Bible goes last** in every prompt
10. **Negative prompts**: enter exclusions without "no" prefix. Positive description often outperforms negation.
11. **Creativity slider 40–60%** for best prompt adherence
12. **5–8 second shots** produce the best quality; 10+ seconds increases artifact risk
13. **360° orbits require 10+ second duration**
14. **For continuity**: use last frame of shot N-1 as start frame of shot N
15. **For dialogue**: use format `[Character Name, voice description]: "Line"`
16. **Multi-shot max 6 cuts** per generation in storyboard mode

---

## Notes for Claude Code

- When in doubt about a UI pattern, build the simplest version first and iterate
- The AI Director's Claude prompts are the single most important thing to get right — invest heavily in prompt engineering for the system prompts
- The camera movement database should feel like a film school reference — descriptions should teach the user *why* to use each movement, not just *what* it is
- Every generation costs the user real credits — always confirm before spending, show estimated cost, and provide refunds on failures
- The prompt assembly engine should produce prompts that a filmmaker would recognize as well-structured scene directions
- Keep the free tier genuinely useful — 50 credits = ~3 draft shots or 1 standard shot, enough to understand the product

