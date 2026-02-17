# CinemaForge — Product Specification

**AI-Guided Movie Creation Platform**
Version 0.1 · February 2026

---

## 1. Vision & Problem Statement

### The Problem

Creating short films with AI video generators like Kling 3.0 today requires deep expertise in prompt engineering, character consistency techniques, cinematography vocabulary, and multi-tool orchestration. A creator who wants to make a 2-minute narrative film must currently:

- Write a script manually, then translate it into shot-by-shot Kling prompts
- Understand 70+ camera movement terms and when to use each
- Manually manage character consistency across dozens of generations (face lock settings, element references, style bibles)
- Generate 10–20× more clips than needed and curate the best takes
- Assemble everything in DaVinci Resolve with color matching
- Handle audio, dialogue, and sound design separately

This means the people who *most want* AI filmmaking tools — storytellers, marketers, content creators — are the least equipped to use them. The bottleneck isn't the AI's capability; it's the filmmaker's craft in directing it.

### The Vision

**CinemaForge is a guided AI movie creation platform that turns ideas into 1–3 minute short films.** It acts as an AI director, cinematographer, and editor rolled into one — guiding non-technical users through script → storyboard → generation → assembly while applying professional filmmaking knowledge automatically.

The user provides the *what* (story, mood, characters). CinemaForge handles the *how* (prompts, camera moves, consistency, pacing, assembly).

### Target Users

1. **Content creators & influencers** — Need short narrative content for YouTube, TikTok, Instagram Reels
2. **Marketers & brand teams** — Product story videos, brand films, ad concepts
3. **Indie storytellers** — Short film hobbyists without production budgets
4. **Educators** — Explainer videos with narrative elements
5. **AI enthusiasts** — People exploring AI video but frustrated by the learning curve

### Key Differentiator

Not another "type a prompt, get a video" tool. CinemaForge is a **structured creative workflow** that understands filmmaking — it suggests camera angles based on emotional beats, automatically manages character consistency across scenes, builds shot lists from narrative structure, and assembles final cuts with pacing and transitions.

---

## 2. Core Concepts

### Movie

A Movie is the top-level project container. It has a title, genre, target duration (30s–3min initially, extensible to 10min+), aspect ratio, and visual style.

### Script

A structured narrative document with:
- **Synopsis** — 1–2 sentence summary
- **Scenes** — Logical story units (e.g., "INT. COFFEE SHOP — MORNING")
- **Beats** — Emotional/narrative moments within each scene
- **Dialogue** — Character lines with emotional direction

### Characters

Persistent character definitions including:
- **Name** and role description
- **Visual description** — Detailed appearance (age, build, hair, clothing)
- **Reference images** — Up to 4 uploaded or AI-generated reference photos
- **Voice profile** — Voice type, accent, emotional range (for Kling audio)
- **Style Bible entry** — Frozen text snippet appended to every prompt featuring this character

### Shot

The atomic unit of video generation. Each shot maps to one Kling generation (3–15 seconds). A shot contains:
- **Shot type** — Wide, medium, close-up, extreme close-up, OTS, POV, etc.
- **Camera movement** — Selected from curated list with preview descriptions
- **Subject/action** — What happens in this shot
- **Dialogue** — If any, with character and emotion tags
- **Environment** — Location, time of day, weather
- **Lighting** — Specific sources and mood
- **Duration** — Target seconds (3–15)
- **Generated prompt** — The actual Kling-formatted prompt (auto-generated, user-editable)
- **Takes** — 1–N generation results, with user-selected "hero take"

### Style Bible

A persistent set of style directives applied to every prompt in the movie:
- **Film stock / camera** — e.g., "shot on 35mm film, ARRI Alexa"
- **Color palette** — e.g., "teal-orange blockbuster grade"
- **Texture keywords** — e.g., "film grain, shallow depth of field, bokeh"
- **Negative prompt** — Universal exclusions
- **Aspect ratio and resolution** — 16:9, 9:16, 1:1, 21:9

### Timeline

An ordered sequence of shots with:
- Transition types between shots (cut, crossfade, fade to black)
- Pacing metadata (beat timing)
- Audio layers (dialogue, music, SFX)

---

## 3. User Flow & Features

### Phase 1: Concept → Script

**Entry point:** User describes their movie idea in natural language.

```
"I want to make a 90-second noir detective story set in a rainy
city at night. A detective finds a mysterious note in an alley
and follows the clues to an abandoned warehouse."
```

**CinemaForge responds with:**
1. A structured **script breakdown** — scenes, beats, estimated shot count
2. **Genre-appropriate suggestions** — "Noir films benefit from low-angle shots, hard side-lighting, and desaturated teal color grades. Shall I apply a noir style bible?"
3. **Character extraction** — "I've identified 1 character: The Detective. Let's define their appearance."
4. **Duration estimate** — "This story works well at 8–12 shots, approximately 60–90 seconds."

**AI guidance features:**
- Suggest narrative structure improvements ("Your story needs a stronger turning point — what if the note contains a personal message?")
- Estimate shot count and credit cost before proceeding
- Offer genre templates (Noir, Sci-Fi, Romance, Horror, Commercial, Documentary)
- Allow iterating on the script with conversation

### Phase 2: Character Design

For each identified character:

1. **Visual definition wizard** — Guided form: age, gender, ethnicity, build, hair (color, style, length), clothing, distinguishing features
2. **Reference image generation** — Generate 4 reference images in different angles and expressions using Kling Image 3.0 or DALL-E/Flux
3. **Multi-angle library** — Auto-generate a "character audition" video showing the character from multiple angles, extract key frames as reference library
4. **Consistency preview** — Show test generations of the character in different environments to verify consistency
5. **Voice assignment** — Select voice profile (language, accent, tone) for dialogue scenes

**Output:** A Character Card with all visual references, style bible entry, and Kling Element configuration.

### Phase 3: Storyboard & Shot Planning

Transform the script into a visual shot list:

1. **Auto-generated shot list** — AI suggests shot type, camera movement, and duration for each beat based on the emotional arc and genre conventions
2. **Smart camera suggestions:**
   - Establishing shots → suggest wide/crane shots
   - Emotional moments → suggest slow dolly push-in, close-up
   - Action beats → suggest tracking shots, low-angle, speed ramps
   - Dialogue → suggest shot-reverse-shot, OTS
   - Reveals → suggest pan-to-reveal, dolly zoom
   - Transitions → suggest matching action cuts, fade-to-black
3. **Visual storyboard** — Generate a static image for each shot as a storyboard frame
4. **Shot duration optimizer** — Warn if the total exceeds target length, suggest cuts
5. **Prompt preview** — Show the exact Kling prompt for each shot, with editable fields

**Camera movement browser:**
Searchable, categorized list of 70+ camera movements with:
- Name and description
- Visual example (GIF or short video reference)
- Best use cases ("Use crane shots for establishing grandeur")
- Prompt syntax ("The camera cranes upward, revealing...")

### Phase 4: Generation

Batch-generate all shots with intelligent management:

1. **Batch queue** — Queue all shots for generation with priority ordering
2. **Smart retries** — Auto-retry failed generations (Kling has ~30–40% failure rate)
3. **Multi-take generation** — Generate 2–3 takes per shot by default
4. **Character consistency enforcement:**
   - Auto-inject character Element references (@CharacterName)
   - Apply face reference at optimal strength (75–85)
   - Append style bible to every prompt
   - Use last frame of previous shot as start frame for next (continuity chaining)
5. **Quality tiers:**
   - **Draft mode** — Fast preview generations (720p, 5-second, low credits)
   - **Standard mode** — Production quality (1080p)
   - **Cinema mode** — Maximum quality (4K/60fps)
6. **Take selection UI** — Side-by-side comparison of takes, one-click selection of hero take
7. **Regeneration with tweaks** — Adjust prompt and re-generate individual shots

### Phase 5: Assembly & Export

Automatic timeline assembly:

1. **Auto-edit** — Assemble hero takes in sequence with intelligent trimming
2. **Transition insertion** — Apply cuts, crossfades, or fades based on scene breaks
3. **Audio mixing:**
   - Kling native dialogue (generated with video)
   - Background music (from library or AI-generated)
   - Sound effects layer
   - Ambient audio
4. **Color consistency pass** — Apply uniform color grade across all clips
5. **Preview player** — Watch the assembled movie in-app
6. **Export options:**
   - MP4 (1080p or 4K)
   - Individual shots as separate files
   - Project file (for import to DaVinci Resolve / Premiere Pro)
   - Aspect ratio variants (16:9, 9:16 vertical, 1:1 square)

---

## 4. Prompt Intelligence Engine

The heart of CinemaForge. This system translates user intent into optimized Kling prompts.

### Prompt Template System

Every shot prompt is assembled from composable blocks:

```
[CAMERA_BLOCK] + [SUBJECT_BLOCK] + [ACTION_BLOCK] + [ENVIRONMENT_BLOCK] + [LIGHTING_BLOCK] + [STYLE_BIBLE]
```

**Camera block examples:**
```
"Slow dolly push-in from medium shot to close-up"
"Low-angle tracking shot, camera follows alongside the subject"
"Static tripod, wide establishing shot"
"Crane shot sweeping upward to reveal the cityscape"
"Handheld, following close behind the subject through the crowd"
```

**Subject block construction:**
```
"A [age] [gender] [descriptor] @CharacterName wearing [outfit], [expression], [posture]"
→ "A 35-year-old man in a worn trench coat @Detective, jaw clenched, standing alone"
```

**Action block (temporal):**
```
"[Beginning]: The detective stops at the alley entrance.
 [Middle]: He crouches down and picks up a crumpled note.
 [End]: He unfolds it, eyes widening as he reads."
```

**Environment block:**
```
"Narrow rain-soaked alley at night, puddles reflecting neon signs,
 dumpsters lining brick walls, steam rising from a grate"
```

**Lighting block:**
```
"Hard side-light from a single flickering neon sign casting magenta
 and cyan across wet pavement, deep shadows, rim lighting on subject's coat"
```

**Style bible (appended to all prompts):**
```
"Desaturated teal grade, crushed blacks, shot on 35mm film, anamorphic lens,
 film grain, shallow depth of field, cinematic. 4K."
```

### Negative prompt builder

Auto-constructed based on genre + user preferences:
```
"blur, flicker, distorted faces, warped limbs, unrealistic proportions, morphing,
 deformed hands, extra fingers, mutation, disfigured, low quality, artifacts,
 glitch, smiling [if serious scene]"
```

### Multi-shot storyboard formatting

For Kling 3.0's native multi-shot mode (up to 6 cuts per generation):
```
Shot 1 (3s): [Camera], @Character [action]. [Dialogue if any]
Shot 2 (2s): [Camera], [action]. [Dialogue]
Shot 3 (3s): [Camera], [action]. [Dialogue]
```

### Prompt suggestion engine

When the user describes a scene, CinemaForge suggests:
- **3 camera angle options** ranked by genre convention and emotional fit
- **Lighting presets** matched to time-of-day and mood
- **Pacing recommendation** — duration and number of cuts
- **Reference prompt examples** — "Here's a similar scene that works well: [example]"

---

## 5. Technical Architecture

### Stack Overview

```
┌─────────────────────────────────────┐
│          Frontend (Next.js)          │
│  React · Tailwind · Zustand/Redux   │
├─────────────────────────────────────┤
│          Backend (Node.js)           │
│  Express/Fastify · Prisma · BullMQ  │
├──────────┬──────────┬───────────────┤
│ Kling AI │ Image    │ Audio         │
│ API      │ Gen API  │ Services      │
│ (video)  │ (refs)   │ (ElevenLabs)  │
├──────────┴──────────┴───────────────┤
│  PostgreSQL  │  Redis  │  S3/R2     │
│  (projects)  │ (queue) │ (media)    │
└──────────────┴─────────┴────────────┘
```

### Data Model (Core)

```
User
  ├── id, email, plan, credits_balance
  │
  ├── Movie[]
  │     ├── id, title, genre, target_duration, aspect_ratio, status
  │     ├── style_bible (JSON)
  │     ├── script (JSON: scenes → beats → dialogue)
  │     │
  │     ├── Character[]
  │     │     ├── id, name, role, visual_description
  │     │     ├── reference_images[] (S3 URLs)
  │     │     ├── voice_profile (JSON)
  │     │     ├── style_bible_entry (text)
  │     │     └── kling_element_id (from Kling API)
  │     │
  │     ├── Shot[]
  │     │     ├── id, scene_id, order, shot_type, camera_movement
  │     │     ├── subject, action, environment, lighting, dialogue
  │     │     ├── duration_seconds, generated_prompt, negative_prompt
  │     │     ├── start_frame_url, end_frame_url
  │     │     ├── status (draft|queued|generating|complete|failed)
  │     │     │
  │     │     └── Take[]
  │     │           ├── id, video_url, thumbnail_url, is_hero
  │     │           ├── kling_task_id, generation_params
  │     │           └── quality_score (auto-assessed)
  │     │
  │     └── Timeline
  │           ├── id, ordered_shot_ids[]
  │           ├── transitions[] (type, duration per cut)
  │           ├── audio_layers[] (music, sfx, ambient)
  │           └── exported_video_url
  │
  └── CreditLedger[]
        ├── amount, type (purchase|usage|bonus)
        ├── movie_id, shot_id (for usage entries)
        └── timestamp
```

### API Integrations

**Kling AI API (Primary — via fal.ai or direct):**
- `POST /text-to-video` — Text prompt → video generation
- `POST /image-to-video` — Image + prompt → video
- `POST /elements` — Upload/manage character elements
- `POST /storyboard` — Multi-shot generation (up to 6 cuts)
- `GET /task/{id}` — Poll generation status
- Key parameters: `model` (kling-v3), `mode` (standard|professional), `duration`, `aspect_ratio`, `camera_control`, `subject_reference`

**Image Generation (for reference images):**
- Kling Image 3.0 API or Midjourney API (via third-party) or DALL-E / Flux

**Audio (supplementary):**
- ElevenLabs API — Custom voice cloning and TTS for supplementary dialogue
- AI music generation API (Udio/Suno) — Background scores

**LLM (Prompt intelligence):**
- Claude API — Script analysis, prompt generation, creative suggestions, shot planning
- Used as the "AI Director" brain for all guidance features

### Generation Pipeline

```
1. User finalizes shot list
2. For each shot:
   a. Compose prompt from template blocks + style bible + character refs
   b. If shot has predecessor: extract last frame as start_frame
   c. Submit to Kling API (standard or multi-shot mode)
   d. Poll for completion (webhook or polling)
   e. On success: store video, generate thumbnail, notify user
   f. On failure: auto-retry up to 3x with slight prompt variation
3. When all shots complete:
   a. Run auto-assembly pipeline
   b. Apply color consistency filter
   c. Mix audio layers
   d. Generate preview
   e. Notify user
```

---

## 6. Pricing & Credit System

### Credit Model

Credits are the universal currency. Different operations cost different amounts.

| Operation | Credits | Notes |
|---|---|---|
| **Script generation** (AI director) | 0 | Included in all plans |
| **Reference image** (per image) | 1 | Character reference generation |
| **Draft video** (5s, 720p) | 5 | Fast preview, for iteration |
| **Standard video** (5s, 1080p) | 15 | Production quality |
| **Standard video** (10s, 1080p) | 25 | Longer shot |
| **Cinema video** (5s, 4K/60fps) | 40 | Maximum quality |
| **Cinema video** (10s, 4K/60fps) | 65 | Maximum quality, longer |
| **Multi-shot storyboard** (up to 6 cuts, 15s) | 50 | Kling 3.0 native multi-shot |
| **Auto-assembly** (final export) | 10 | Timeline assembly + export |
| **Voice generation** (per line) | 3 | ElevenLabs custom voice |
| **Music generation** (per track) | 10 | AI background score |

### Plans

| Plan | Monthly Price | Credits/Month | Key Features |
|---|---|---|---|
| **Free** | $0 | 50 | 720p only, watermark, 1 active movie, basic camera presets |
| **Creator** | $19/mo | 500 | 1080p, no watermark, 5 active movies, all camera presets, 2 takes/shot |
| **Pro** | $49/mo | 1,500 | 4K, priority generation, 20 active movies, 3 takes/shot, custom voice, advanced style bible |
| **Studio** | $99/mo | 4,000 | 4K/60fps, fastest generation, unlimited movies, 5 takes/shot, team collaboration (up to 3 seats), API access, batch export |

### Credit economics

A typical **60-second movie** (10 shots × 6 seconds average):
- 2 character reference sets: ~8 credits
- 10 shots × 2 takes in Standard: 10 × 2 × 15 = 300 credits
- Assembly + export: 10 credits
- **Total: ~318 credits** → fits comfortably in Pro plan

A typical **3-minute movie** (25 shots):
- Character refs: ~12 credits
- 25 shots × 2 takes Standard: 25 × 2 × 15 = 750 credits
- Assembly: 10 credits
- **Total: ~772 credits** → fits in Pro plan with room to spare

### Credit add-ons

- 200 credits: $9
- 500 credits: $19
- 1,500 credits: $49

Credits roll over for 2 months. Unused credits expire after that.

---

## 7. Prompt & Camera Reference Library

### Built-in Camera Movement Database

Organized by category with descriptions, use cases, and prompt syntax:

**Establishing & Orientation:**
- Wide establishing shot (static) — "Show the full location"
- Crane/boom shot — "Sweeping vertical reveal for grandeur"
- Aerial/drone — "Bird's eye establishing context"
- Slow dolly forward — "Drawing the audience into the scene"
- 360° orbit — "Introducing a key character or object" (needs 10s min)

**Character & Emotion:**
- Medium shot (static) — "Standard dialogue framing"
- Close-up (static or slow push-in) — "Emotional emphasis"
- Extreme close-up — "Critical detail or intense emotion"
- OTS (over-the-shoulder) — "Dialogue perspective"
- Dutch angle — "Unease, disorientation"
- Low-angle — "Power, authority, threat"
- High-angle — "Vulnerability, smallness"

**Action & Movement:**
- Tracking/following — "Camera alongside moving subject"
- Steadicam float — "Smooth immersive following"
- Handheld — "Raw energy, documentary feel"
- Whip-pan — "Fast transition, surprise"
- Speed ramp — "Acceleration/deceleration for drama"
- FPV (first-person) — "Immersive action POV"
- Crash zoom — "Sudden dramatic emphasis"

**Transitions & Reveals:**
- Pan-to-reveal — "Slow lateral discovery"
- Dolly zoom (Vertigo) — "Subject stays, background warps"
- Rack focus — "Shift attention between planes"
- Pull-out reveal — "Widening context"
- Fade-in from black — "Scene opening"

### Genre-Specific Style Presets

**Film Noir:**
```
Style: "Desaturated teal grade, crushed blacks, hard side-lighting,
  wet reflective surfaces, shot on 35mm film, anamorphic lens,
  heavy film grain, narrow depth of field"
Negative: "bright colors, sunny, cheerful, overexposed"
Camera bias: Low angles, slow pans, static wide shots
```

**Sci-Fi Cinematic:**
```
Style: "Cool blue-steel palette, volumetric lighting, lens flares,
  shot on ARRI Alexa, anamorphic, clean sharp focus, futuristic,
  neon accents, atmospheric haze"
Negative: "vintage, warm tones, film grain, natural settings"
Camera bias: Slow crane shots, tracking, symmetrical framing
```

**Horror/Thriller:**
```
Style: "Desaturated, high contrast, deep shadows, flickering light,
  handheld slight shake, 35mm film grain, claustrophobic framing,
  muted greens and yellows"
Negative: "bright, colorful, happy, wide open spaces"
Camera bias: Dutch angles, slow push-ins, static with sudden movement
```

**Commercial/Product:**
```
Style: "Clean, bright, professional, shot on RED Komodo, shallow
  depth of field, soft diffused lighting, high production value,
  color-accurate, 4K sharp"
Negative: "dark, gritty, noisy, amateur, shaky"
Camera bias: Slow orbits, macro details, smooth dolly
```

**Documentary:**
```
Style: "Natural lighting, handheld feel, observational, 16mm film
  aesthetic, muted earth tones, authentic, unpolished"
Negative: "dramatic lighting, neon, fantasy, CGI"
Camera bias: Handheld following, static observational, interview framing
```

---

## 8. MVP Scope (v0.1)

### In scope for MVP:
- [x] Conversational movie concept → structured script
- [x] Character creation wizard with reference image generation
- [x] AI-suggested shot list from script (shot type, camera, duration)
- [x] Prompt assembly engine with style bible
- [x] Shot-by-shot generation via Kling 3.0 API
- [x] Take comparison and hero selection
- [x] Basic timeline assembly with cuts
- [x] MP4 export (1080p)
- [x] Credit system and 4-tier pricing
- [x] Camera movement browser with 30+ presets
- [x] 5 genre style presets

### Deferred to v0.2+:
- [ ] Multi-shot storyboard mode (Kling native 6-cut)
- [ ] Custom voice cloning (ElevenLabs integration)
- [ ] AI music generation
- [ ] Advanced color grading / LUT application
- [ ] 4K/60fps export
- [ ] Team collaboration
- [ ] Template marketplace (community-shared style bibles, scripts)
- [ ] DaVinci Resolve project export
- [ ] Vertical (9:16) and square (1:1) format support
- [ ] Movie extension beyond 3 minutes
- [ ] Kling Custom Face Model training integration
- [ ] API for programmatic movie creation

---

## 9. Success Metrics

| Metric | Target (3 months post-launch) |
|---|---|
| Registered users | 10,000 |
| Paid conversion rate | 5% |
| Movies created (total) | 25,000 |
| Movies completed (exported) | 8,000 |
| Average movie length | 45 seconds |
| Credits purchased (monthly) | $15,000 MRR |
| NPS score | > 40 |

---

## 10. Open Questions

1. **Kling API access model** — Direct API vs. fal.ai proxy vs. other third-party? Pricing implications?
2. **Video assembly** — Server-side FFmpeg pipeline vs. client-side? Latency vs. cost tradeoff.
3. **Image generation for references** — Should we build our own image gen or use Kling Image 3.0 exclusively?
4. **Competitor positioning** — How do we differentiate from Artlist Max, Runway Stories, and Pika Scenes?
5. **Content moderation** — What guardrails on generated content? NSFW filtering?
6. **Mobile support** — Web-first or also native app? The editing UI is complex for mobile.
7. **Offline/local generation** — Any demand for running on local hardware for privacy?
