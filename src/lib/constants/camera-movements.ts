export interface CameraMovement {
  id: string;
  name: string;
  category: "establishing" | "character" | "action" | "transition";
  description: string;
  bestFor: string;
  promptSyntax: string;
  minDuration: number;
  examplePrompt: string;
}

export const CAMERA_MOVEMENTS: CameraMovement[] = [
  // ─────────────────────────────────────────────────────────────────────────────
  // ESTABLISHING & ORIENTATION
  // ─────────────────────────────────────────────────────────────────────────────

  {
    id: "static-wide",
    name: "Static Wide",
    category: "establishing",
    description:
      "A locked-off wide shot with no camera movement. This is the filmmaker's equivalent of a deep breath — it tells the audience 'look at everything, take it in.' The stillness of the frame forces the viewer to scan the entire composition, discovering details on their own. Hitchcock used static wides to make the audience feel like an observer, quietly watching events unfold. The power here is restraint: when everything else in your film is moving, a static wide becomes an anchor.",
    bestFor:
      "Opening establishing shots, tableaux compositions, letting complex action play out in full context, moments of calm before chaos, wide landscapes, symmetrical compositions",
    promptSyntax: "Static tripod, wide shot",
    minDuration: 3,
    examplePrompt:
      "Static tripod, wide shot of an empty desert highway stretching to the horizon. A single car approaches from the distance, growing larger as heat shimmer distorts the air. Dust devils spin lazily at the roadside. Deep depth of field, golden hour light, long shadows stretching across cracked asphalt. Shot on 35mm film, anamorphic lens.",
  },

  {
    id: "crane-up-reveal",
    name: "Crane Up Reveal",
    category: "establishing",
    description:
      "The camera sweeps upward — often starting on a detail or a character — and rises to unveil the full scope of the scene. This is pure cinematic wonder. Think of the opening of The Shining, where the camera lifts over the mountains to reveal the hotel's isolation. The upward movement triggers an instinctive awe response in viewers. Use it when you want to say 'this is bigger than you thought.' The reveal should be the payoff — what the camera discovers at the top of its arc needs to be worth the journey.",
    bestFor:
      "Opening scenes, revealing the scale of a location, transitioning from intimate detail to epic scope, introducing a new world or environment",
    promptSyntax: "Crane shot sweeping upward to reveal the full scene",
    minDuration: 5,
    examplePrompt:
      "Crane shot sweeping upward from street level. Starting on a lone figure standing in fog, the camera rises steadily to reveal an enormous Gothic cathedral towering above, its spires disappearing into low-hanging clouds. Pigeons scatter as bells begin to toll. Volumetric fog, golden hour backlighting, deep depth of field. Shot on ARRI Alexa, anamorphic. 4K cinematic.",
  },

  {
    id: "crane-down",
    name: "Crane Down",
    category: "establishing",
    description:
      "The inverse of the crane up — the camera descends from a high vantage point, narrowing the world down to a specific subject or detail. Where the crane up says 'behold the world,' the crane down says 'but this is what matters.' It creates a funnel of attention, guiding the viewer from context to focus. Spielberg uses this to transition from spectacle to character — we see the battlefield, then we descend to find one soldier's face. The descent can feel protective (coming down to be with the character) or oppressive (the world closing in).",
    bestFor:
      "Transitioning from wide context to specific subject, landing on a character after an establishing shot, creating a sense of descent or arrival, moving from the abstract to the personal",
    promptSyntax: "Crane shot descending from above, settling on the subject",
    minDuration: 5,
    examplePrompt:
      "Crane shot descending from above a sprawling open-air market at dusk. The camera glides down through strings of warm Edison bulbs, past colorful fabric canopies, settling at eye level on a young woman examining a hand-painted ceramic bowl. Warm ambient light, shallow depth of field on her hands. Shot on 35mm film, natural grain.",
  },

  {
    id: "aerial-drone",
    name: "Aerial Drone",
    category: "establishing",
    description:
      "A sweeping, elevated shot that moves freely through three-dimensional space — forward, sideways, rising, or descending. Drone shots shattered the cost barrier of aerial cinematography and introduced a floating, omniscient perspective that feels distinctly modern. The key to a great drone shot is intentional movement: every drift should reveal something new. Avoid aimless hovering. Think of it as the camera of a curious god, scanning the world with purpose. The smoothness of drone footage gives scenes an ethereal, almost dreamlike quality.",
    bestFor:
      "Epic landscape establishing shots, following vehicles or subjects through open terrain, revealing geography, opening credit sequences, transitions between locations",
    promptSyntax: "Aerial drone shot gliding smoothly over the scene",
    minDuration: 5,
    examplePrompt:
      "Aerial drone shot gliding smoothly over a winding coastal road carved into sea cliffs. A vintage red convertible traces the curves far below, leaving a faint dust trail. Turquoise ocean crashes against black volcanic rock. The camera drifts higher, revealing the full coastline stretching into morning mist. Golden hour, deep saturation, 4K cinematic.",
  },

  {
    id: "slow-dolly-forward",
    name: "Slow Dolly Forward",
    category: "establishing",
    description:
      "A gradual, deliberate push forward into the scene. Unlike the faster dolly push-in (which targets a character), this establishing dolly is about crossing a threshold. The camera enters a space the way a person might walk into an unfamiliar room — cautiously, absorbing details. Kubrick was a master of the slow dolly forward: think of Danny's Big Wheel rolling through the Overlook corridors. The slowness is essential. It builds dread, anticipation, or reverence depending on what lies ahead.",
    bestFor:
      "Entering a new location for the first time, building suspense as we approach something, hallway and corridor shots, creating a sense of inevitability",
    promptSyntax: "Slow dolly forward, moving steadily into the scene",
    minDuration: 5,
    examplePrompt:
      "Slow dolly forward, moving steadily down a dimly lit museum corridor after hours. Display cases glow with soft spotlights on either side, illuminating ancient artifacts. The camera advances toward a single painting at the far end of the hall, its frame catching a sliver of moonlight from a skylight above. Quiet tension, deep shadows, polished marble floors reflecting ambient light. Shot on 35mm film, anamorphic.",
  },

  {
    id: "pull-out-reveal",
    name: "Pull-Out Reveal",
    category: "establishing",
    description:
      "The camera starts tight on a subject and slowly moves backward, expanding the frame to reveal the surrounding context. This is one of cinema's most powerful storytelling tools because it reverses expectations. The audience thinks they understand the scene — then the wider context reframes everything. A person sitting peacefully might be revealed to be on the edge of a rooftop. A cozy room might be revealed as a cell. The pull-out is the visual equivalent of the phrase 'but what you didn't know was...'",
    bestFor:
      "Contextual reveals that reframe the scene, showing isolation or scale, ending scenes by pulling away from a character, revealing unexpected surroundings",
    promptSyntax: "Camera pulls back slowly from the subject, revealing the wider scene",
    minDuration: 5,
    examplePrompt:
      "Camera pulls back slowly from a child's hand drawing with crayons on paper. As the frame widens, we see she is sitting alone in a vast, empty gymnasium, hundreds of folding chairs stacked against the walls. Morning light streams through high windows, casting long geometric shadows across the hardwood floor. The enormity of the space dwarfs the small figure. Shot on 16mm film, natural grain, muted tones.",
  },

  {
    id: "tilt-up",
    name: "Tilt Up",
    category: "establishing",
    description:
      "The camera tilts upward on a fixed axis, scanning from low to high — from feet to face, from base to summit, from ground to sky. Unlike a crane, the camera does not physically move; it pivots. This creates a measured, almost reverent unveiling. Tilt-ups are the camera's way of saying 'look up' — and humans associate looking up with wonder, power, or intimidation. Use a tilt-up to introduce a towering building, a powerful character, or a vast sky that swallows the frame.",
    bestFor:
      "Introducing tall structures or characters, conveying power or awe, scanning a subject from bottom to top, transitioning from ground-level detail to sky",
    promptSyntax: "Camera tilts upward from ground level",
    minDuration: 3,
    examplePrompt:
      "Camera tilts upward from muddy combat boots planted in wet earth, rising slowly along a soldier's rain-soaked uniform, past clenched fists holding dog tags, continuing up to reveal a face streaked with grime staring at the horizon. Rain falls in sheets. Overcast sky, desaturated palette, shallow depth of field. Shot on 35mm film, heavy grain.",
  },

  {
    id: "tilt-down",
    name: "Tilt Down",
    category: "establishing",
    description:
      "The camera tilts downward on a fixed axis, moving from high to low. Where the tilt-up evokes wonder, the tilt-down often grounds us — it brings attention back to earth, to the body, to the concrete. It can also create unease: tilting down to discover something at a character's feet (a dropped weapon, a shadow, a letter) is a classic suspense technique. The tilt-down answers the question the audience didn't know they were asking: 'what's down there?'",
    bestFor:
      "Revealing objects at ground level, grounding the viewer after a wide shot, discovering something a character has dropped, scanning from face to hands to reveal what they hold",
    promptSyntax: "Camera tilts downward from above",
    minDuration: 3,
    examplePrompt:
      "Camera tilts downward from a woman's tearful face, following a single tear that falls from her chin. The tilt continues down to her trembling hands, which hold a crumpled photograph of two people smiling on a sunlit beach. Soft window light, extremely shallow depth of field, intimate framing. Shot on 50mm lens, warm desaturated tones.",
  },

  {
    id: "bird-eye",
    name: "Bird's Eye View",
    category: "establishing",
    description:
      "A directly overhead shot looking straight down at the scene. This perspective is inherently unnatural for humans — we never see the world this way — which makes it immediately striking and slightly disorienting. Wes Anderson uses overhead shots for their graphic, almost diagrammatic quality: the world becomes a pattern, a map, a design. It strips away perspective and flattens everything into a 2D composition. Use it to show spatial relationships, create visual symmetry, or make the audience feel like they are watching from an impossible vantage point.",
    bestFor:
      "Showing spatial layouts and relationships, graphic compositions, overhead table scenes, maps and documents, symmetrical patterns, making characters look small against their environment",
    promptSyntax: "Bird's eye view, camera looking directly down from above",
    minDuration: 3,
    examplePrompt:
      "Bird's eye view, camera looking directly down from above onto a rain-soaked intersection at night. Neon signs from surrounding buildings paint the wet asphalt in smeared reds, blues, and greens. A lone figure holding a clear umbrella crosses diagonally, their reflection mirrored perfectly in a puddle. Symmetrical composition, deep saturated colors, 4K cinematic.",
  },

  // ─────────────────────────────────────────────────────────────────────────────
  // CHARACTER & EMOTION
  // ─────────────────────────────────────────────────────────────────────────────

  {
    id: "dolly-push-in",
    name: "Dolly Push-In",
    category: "character",
    description:
      "The camera moves steadily forward toward the subject, narrowing from a medium shot to a close-up. This is cinema's most intimate gesture — the visual equivalent of leaning in to listen. It creates a magnetic pull, drawing the audience into the character's emotional state. The key is subtlety: the movement should be smooth enough that viewers feel the effect without consciously noticing the camera. Scorsese uses push-ins at moments of quiet intensity — a character making a decision, a realization dawning, a lie being told.",
    bestFor:
      "Emotional beats, realizations, internal decisions, building tension during dialogue, emphasizing a character's reaction, moments of vulnerability",
    promptSyntax: "Slow dolly push-in from medium shot to close-up",
    minDuration: 5,
    examplePrompt:
      "Slow dolly push-in from medium shot to close-up. A detective sits alone at a diner counter late at night, coffee untouched. He stares at a case file photo, and something clicks behind his eyes. The camera drifts closer as his expression shifts from exhaustion to grim determination. Warm overhead diner light, neon glow through rain-streaked windows, shallow depth of field. Shot on 35mm film, anamorphic bokeh.",
  },

  {
    id: "static-medium",
    name: "Static Medium Shot",
    category: "character",
    description:
      "A locked-off shot framing the subject from roughly the waist up. The medium shot is the workhorse of filmmaking — it is close enough to read emotion but wide enough to see gesture and environment. Its power lies in its neutrality: it does not impose a perspective the way a low angle or close-up does. The audience sees the character as another person in the room might. This objectivity makes it ideal for dialogue, where the words and performance should carry the scene without the camera editorializing.",
    bestFor:
      "Dialogue scenes, interviews, balanced compositions showing character and environment, neutral storytelling moments, two-shots",
    promptSyntax: "Static tripod, medium shot",
    minDuration: 3,
    examplePrompt:
      "Static tripod, medium shot of a jazz musician sitting on a wooden stool in an empty rehearsal room. He cradles a battered saxophone, eyes closed, fingers tracing the keys from memory. A single pendant light hangs above. Warm tungsten glow, dust motes in the air, vintage wood-paneled walls. Shot on 16mm film, natural grain.",
  },

  {
    id: "static-close-up",
    name: "Static Close-Up",
    category: "character",
    description:
      "A locked-off shot framing the subject's face, filling most of the screen. The close-up is perhaps the most powerful shot in all of cinema — it grants the audience access to the interior life of a character through the landscape of the human face. Every micro-expression, every flicker of the eye, every suppressed emotion becomes visible. Bergman built entire films on close-ups because he understood that the face is the most complex visual in existence. Use it sparingly, and it will carry tremendous weight.",
    bestFor:
      "Key emotional moments, reaction shots, moments of truth, internal conflict visible on the face, dialogue emphasis, intimate character study",
    promptSyntax: "Static tripod, close-up shot",
    minDuration: 3,
    examplePrompt:
      "Static tripod, close-up shot of an elderly woman's face as she listens to a familiar song on the radio. Her eyes glisten with recognition, lips parting slightly as if about to sing along. Deep wrinkles map decades of expression. Soft natural window light from the left, warm tones, extremely shallow depth of field blurring everything beyond her face. Shot on 85mm lens.",
  },

  {
    id: "extreme-close-up",
    name: "Extreme Close-Up",
    category: "character",
    description:
      "The camera fills the frame with a single detail — an eye, a hand, a mouth, a key turning in a lock. Extreme close-ups wrench the audience out of normal spatial awareness and force laser focus on one element. They are inherently intense and slightly uncomfortable, which makes them perfect for moments of high stakes, suspense, or obsession. Leone built the climax of his Westerns on extreme close-ups of eyes — because in that moment, nothing else in the universe matters except what that character sees and decides.",
    bestFor:
      "Critical small details, eyes during tense moments, hands performing delicate tasks, objects of significance, building extreme tension, showing texture and detail invisible at wider framings",
    promptSyntax: "Extreme close-up, filling the frame with detail",
    minDuration: 3,
    examplePrompt:
      "Extreme close-up, filling the frame with a single eye. The iris is deep amber with flecks of gold, reflecting the orange glow of a fire. The pupil dilates slowly. A tear wells at the lower lid but does not fall. Every capillary and lash is visible. Macro lens, razor-thin depth of field, warm firelight. 4K cinematic.",
  },

  {
    id: "ots-dialogue",
    name: "Over-the-Shoulder",
    category: "character",
    description:
      "The camera looks past one character's shoulder at the other character facing us. This is the fundamental building block of dialogue scenes. The shoulder in the foreground does two critical things: it reminds the audience of the spatial relationship between characters, and it creates depth by layering foreground and background. The slight asymmetry of the framing creates visual tension that mirrors conversational dynamics. Alternate OTS shots between speakers to create the rhythmic back-and-forth of conversation.",
    bestFor:
      "Dialogue between two characters, interviews, confrontations, any scene where the spatial relationship between two people matters, creating conversational rhythm",
    promptSyntax: "Over-the-shoulder shot from behind one character, facing the other",
    minDuration: 3,
    examplePrompt:
      "Over-the-shoulder shot from behind a woman in a dark blazer, facing a man across a candlelit restaurant table. His expression is guarded, eyes avoiding hers. The woman's shoulder and hair are soft in the foreground. Warm candlelight flickers across both faces, rich bokeh from background diners. Shot on 50mm lens, shallow depth of field, anamorphic.",
  },

  {
    id: "dutch-angle",
    name: "Dutch Angle",
    category: "character",
    description:
      "The camera is tilted on its roll axis so the horizon line is diagonal. The Dutch angle (or Dutch tilt) immediately signals that something is wrong, unstable, or psychologically off-kilter. The human brain is wired to detect level horizons, so a tilted frame creates subconscious unease. Used sparingly, it is brilliant for conveying madness, disorientation, moral corruption, or a world out of balance. Overused, it becomes a crutch. The best Dutch angles are subtle — just enough tilt to make the viewer feel uncomfortable without knowing exactly why.",
    bestFor:
      "Psychological instability, villain introductions, disorientation, drug or alcohol effects, moral ambiguity, surreal or dreamlike sequences, something is wrong moments",
    promptSyntax: "Dutch angle, camera tilted off-axis",
    minDuration: 3,
    examplePrompt:
      "Dutch angle, camera tilted off-axis. A man in a rumpled suit stands at the end of a long, narrow corridor, fluorescent lights buzzing and flickering overhead. The tilted frame makes the walls seem to close in. He grips a manila envelope with white knuckles. Sickly green fluorescent light, deep shadows, oppressive geometry. Shot on 35mm film, high contrast, heavy grain.",
  },

  {
    id: "low-angle",
    name: "Low Angle",
    category: "character",
    description:
      "The camera is positioned below eye level, looking upward at the subject. Low angles make subjects appear larger, more powerful, more imposing — or more heroic. This is pure visual psychology: when we look up at someone in real life, they have power over us. Filmmakers exploit this instinct ruthlessly. A hero filmed from below looks like a monument. A villain filmed from below looks like a threat. Even architecture shot from below gains an oppressive, looming quality. The lower the angle, the stronger the effect.",
    bestFor:
      "Establishing power or dominance, hero introductions, making characters appear imposing or heroic, shooting tall architecture, conveying a child's perspective looking up at adults",
    promptSyntax: "Low angle, camera looking upward at the subject",
    minDuration: 3,
    examplePrompt:
      "Low angle, camera looking upward at a boxer standing in the corner of a ring between rounds. Sweat drips from his brow, chest heaving. The overhead lights create a halo behind his head. His trainer shouts instructions from below frame. Ring ropes frame the composition. Harsh overhead light, deep contrast, shallow depth of field. Shot on 35mm film, anamorphic.",
  },

  {
    id: "high-angle",
    name: "High Angle",
    category: "character",
    description:
      "The camera is positioned above eye level, looking downward at the subject. The inverse of the low angle — and the inverse of its psychology. High angles diminish the subject, making them appear smaller, more vulnerable, more overwhelmed. A character filmed from above looks trapped, exposed, at the mercy of forces greater than themselves. It is the angle of judgment, of surveillance, of fate looking down. Hitchcock used high angles when characters were at their most powerless, and the audience instinctively understood they were watching someone in danger.",
    bestFor:
      "Showing vulnerability or powerlessness, characters feeling overwhelmed, isolation in large spaces, judgment or surveillance perspective, showing a character is trapped or surrounded",
    promptSyntax: "High angle, camera looking down at the subject",
    minDuration: 3,
    examplePrompt:
      "High angle, camera looking down at a woman sitting alone on a park bench in the center of an enormous empty plaza. Autumn leaves scatter around her in the wind. The high perspective makes her look impossibly small against the expanse of gray stone. Overcast diffused light, muted earth tones, deep depth of field. Shot on 35mm film, desaturated.",
  },

  {
    id: "orbit-360",
    name: "360-Degree Orbit",
    category: "character",
    description:
      "The camera circles completely around the subject in a full 360-degree rotation. This is one of cinema's most dramatic and hypnotic movements. The orbit transforms the subject into the center of their own universe — everything else revolves around them. It is inherently heroic, mythic, and transformative. The rotating background creates a sense of time shifting, reality bending, or a character stepping into their destiny. The Matrix used it to stop time. Michael Bay uses it for hero poses. Spielberg uses it for moments of awe. Whatever your intent, the orbit commands attention.",
    bestFor:
      "Hero introductions, transformation moments, climactic decisions, dramatic emphasis, time-freezing effects, moments of awe or power, character standing their ground",
    promptSyntax: "Camera orbits 360 degrees around the subject",
    minDuration: 10,
    examplePrompt:
      "Camera orbits 360 degrees around a samurai standing in a bamboo forest clearing. Cherry blossom petals drift slowly through the air. As the camera circles, the warrior draws his katana in one fluid motion, blade catching shafts of sunlight filtering through the canopy. His robes settle as the camera completes its rotation. Volumetric light rays, shallow depth of field, green and gold palette. Shot on ARRI Alexa, anamorphic.",
  },

  {
    id: "rack-focus",
    name: "Rack Focus",
    category: "character",
    description:
      "Focus shifts from one depth plane to another within a single shot — foreground to background or vice versa. The rack focus is the camera's way of redirecting the audience's gaze without cutting. It says 'stop looking at that, look at this instead.' The shift can be sudden (snapping attention to a new subject) or slow (a gradual transfer of importance). It is inherently editorial — the filmmaker is making a choice about what matters in that moment. The blurred-to-sharp transition also creates a beautiful visual texture, with bokeh dissolving into clarity.",
    bestFor:
      "Shifting attention between two subjects in the same frame, revealing a background detail, connecting two characters at different depths, storytelling transitions within a shot, showing cause and effect",
    promptSyntax: "Rack focus from foreground to background",
    minDuration: 3,
    examplePrompt:
      "Rack focus from a wilted rose in sharp focus in the foreground to a woman sitting alone at a cafe table in the background. As focus shifts, the rose blurs into soft pink bokeh and the woman's melancholic expression sharpens. She stares at an empty chair across from her, fingers tracing the rim of an untouched wine glass. Soft overcast daylight, shallow depth of field, muted warm tones. Shot on 85mm lens.",
  },

  {
    id: "macro-close-up",
    name: "Macro Close-Up",
    category: "character",
    description:
      "An extreme magnification shot using a macro lens, revealing detail invisible to the naked eye. Macro shots transform the mundane into the extraordinary — a drop of water becomes a crystal sphere, skin becomes a landscape, a watch mechanism becomes an industrial marvel. This perspective shift is profoundly cinematic because it shows the audience something they have never truly seen before. The razor-thin depth of field at macro distances creates dreamy, almost abstract compositions where only a sliver of the subject is sharp.",
    bestFor:
      "Revealing hidden detail in objects, texture and material studies, product shots, scientific or nature imagery, abstract compositions, showing the passage of time on surfaces, emphasizing craftsmanship",
    promptSyntax: "Macro close-up, extreme detail",
    minDuration: 3,
    examplePrompt:
      "Macro close-up, extreme detail of a single drop of rain sliding down the surface of a bronze pocket watch. The drop magnifies the Roman numerals beneath it as it travels. The second hand ticks in the background, slightly out of focus. Razor-thin depth of field, warm backlight catching the water drop like a tiny lens. 4K cinematic, hyper-detailed.",
  },

  {
    id: "shoulder-shot",
    name: "Shoulder Shot",
    category: "character",
    description:
      "The camera sits just behind and slightly above the character's shoulder, showing roughly what they see but with their physical presence still anchoring the frame. This is more intimate than an OTS but less subjective than full POV. The audience travels with the character — we see the world from their vantage point while being reminded that we are watching someone experience it. It creates empathy without full identification. Video games use this framing constantly because it balances immersion with spatial awareness. In film, it is perfect for moments where we need to feel a character navigating their environment.",
    bestFor:
      "Following a character through a space, showing their perspective on an unfolding event, walking-and-talking scenes, approaching a doorway or threshold, navigating unfamiliar environments",
    promptSyntax: "Camera positioned just behind the subject's shoulder, looking forward",
    minDuration: 3,
    examplePrompt:
      "Camera positioned just behind the subject's shoulder, looking forward as a young astronaut walks down a curved white corridor toward an observation window. Through the glass, Earth slowly rotates, filling the view with blue oceans and swirling clouds. The astronaut's gloved hand reaches toward the glass. Soft ambient LED lighting, deep blacks of space, slight lens flare from the sun's edge. Shot on ARRI Alexa, anamorphic. 4K cinematic.",
  },

  // ─────────────────────────────────────────────────────────────────────────────
  // ACTION & MOVEMENT
  // ─────────────────────────────────────────────────────────────────────────────

  {
    id: "tracking-follow",
    name: "Tracking Follow",
    category: "action",
    description:
      "The camera moves behind the subject, following them as they move through space. The audience becomes a shadow, trailing the character on their journey. This creates forward momentum and a sense of destination — we are going somewhere with this person. The following distance matters: close behind creates urgency (we are chasing them), farther back creates observation (we are watching them go). Tracking follows are the visual engine of journey narratives, chase sequences, and any scene where movement through space tells the story.",
    bestFor:
      "Characters walking or running through environments, chase sequences, journey and travel moments, following someone through a crowd, corridor and hallway scenes",
    promptSyntax: "Tracking shot, camera follows behind the subject",
    minDuration: 5,
    examplePrompt:
      "Tracking shot, camera follows behind a detective as he pushes through a crowded night market. Neon signs in Mandarin and English blur past. Steam rises from sizzling woks at street stalls. The detective's trench coat catches the warm glow of paper lanterns. Handheld energy, shallow focus on the subject, anamorphic bokeh from neon lights. Shot on 35mm film.",
  },

  {
    id: "tracking-alongside",
    name: "Tracking Alongside",
    category: "action",
    description:
      "The camera moves parallel to the subject, keeping pace beside them. Unlike the follow shot, the alongside tracking shot keeps the subject in profile or three-quarter view, showing their expression as they move. This is inherently companionable — the camera is a travel partner, running alongside the character. It is how we see someone when we walk with them in real life. The lateral movement also creates a strong sense of speed because the background scrolls past like a landscape through a train window.",
    bestFor:
      "Walking-and-talking scenes, running or cycling sequences, driving shots through a car window, characters moving with purpose, showing speed through background motion",
    promptSyntax: "Tracking shot, camera moves alongside the subject at shoulder height",
    minDuration: 5,
    examplePrompt:
      "Tracking shot, camera moves alongside the subject at shoulder height as a young woman jogs through an autumn park at dawn. Fallen leaves crunch beneath her feet. Her breath forms clouds in the cold air. Golden light filters through half-bare trees, casting long striped shadows across the path. Smooth Steadicam movement, shallow depth of field, warm amber tones. Shot on ARRI Alexa.",
  },

  {
    id: "steadicam-float",
    name: "Steadicam Float",
    category: "action",
    description:
      "A smooth, gliding movement that seems to float through space, freed from the constraints of tracks or tripods. The Steadicam revolutionized cinema by giving filmmakers a camera that could go anywhere a person could walk — through doors, up stairs, around corners — with an eerily smooth, hovering quality. It feels like a ghost drifting through the scene. Kubrick and Scorsese used it to create the feeling of an omniscient presence moving through spaces. The smoothness is what distinguishes it from handheld: where handheld is human, Steadicam is supernatural.",
    bestFor:
      "Extended one-take sequences, moving through interior spaces, following characters through multiple rooms, ghostly or dreamlike atmosphere, elegant movement through complex environments",
    promptSyntax: "Steadicam, smooth gliding movement through the scene",
    minDuration: 5,
    examplePrompt:
      "Steadicam, smooth gliding movement through a grand ballroom during a masquerade. The camera weaves between dancing couples in elaborate Venetian masks, past a string quartet, under crystal chandeliers. Candlelight and gold reflections shimmer across marble floors. The camera never stops moving, floating like a phantom through the celebration. Warm amber light, soft focus on background, anamorphic. Shot on 35mm film.",
  },

  {
    id: "handheld",
    name: "Handheld",
    category: "action",
    description:
      "Intentionally imperfect, organic camera movement with natural sway, breath, and micro-adjustments. Handheld cinematography injects raw, visceral energy into a scene. The slight shake and unpredictability make the image feel alive, present, happening right now. It strips away the polish of mounted cameras and puts the audience in the physical space of the action. The Bourne films used handheld to make every fight feel like you were in the room. Documentaries use it because it communicates truth and authenticity. The key is controlled imperfection — enough movement to feel real, not so much that it becomes nauseating.",
    bestFor:
      "Fight scenes, chase sequences, moments of raw emotion, documentary realism, urgency and chaos, breaking the fourth wall of cinematic polish, verité authenticity",
    promptSyntax: "Handheld camera, organic movement",
    minDuration: 3,
    examplePrompt:
      "Handheld camera, organic movement, close behind a man sprinting through rain-slicked alley corridors at night. His breathing is audible, ragged. Brick walls blur past. Puddles explode underfoot. A chain-link fence rattles as he vaults over it. Flickering sodium streetlights create a strobing effect. Raw, urgent, 16mm film grain, desaturated, high contrast.",
  },

  {
    id: "whip-pan",
    name: "Whip Pan",
    category: "action",
    description:
      "An extremely fast horizontal pan that blurs the frame during the movement, snapping to a new subject or angle. The whip pan is cinema's exclamation point — sudden, jarring, and full of energy. The motion blur during the pan creates a natural wipe effect that can double as a transition between shots or scenes. Edgar Wright uses whip pans for comedic timing. Tarantino uses them for sudden shifts in attention. The key is speed and commitment: the blur should be total, and the arrival should be sharp and immediate, as if the camera was startled into looking somewhere new.",
    bestFor:
      "Comedic timing, sudden reveals, shifting between characters in conversation, transitions between scenes, moments of surprise, energetic montages, conveying a quick glance",
    promptSyntax: "Whip pan, camera snaps rapidly to the side",
    minDuration: 3,
    examplePrompt:
      "Whip pan, camera snaps rapidly from a poker player's confident smirk to his opponent's stone-cold stare across the table. The middle of the pan is pure motion blur across green felt and stacked chips. The landing is sharp and sudden on the opponent's unreadable face. Warm overhead lamp light, cigarette smoke curling, deep shadows around the table. Shot on 35mm film, anamorphic.",
  },

  {
    id: "speed-ramp",
    name: "Speed Ramp",
    category: "action",
    description:
      "The footage shifts between normal speed and slow motion within a single shot, creating a dramatic emphasis on a specific moment. Speed ramping is the temporal equivalent of a close-up — it says 'this moment matters, look closer at time itself.' The transition from full speed to slow motion (or the reverse) creates a visceral, almost physical sensation. Snyder uses it for action impacts. Woo used it for dramatic falls. The key is choosing the exact right frame to ramp — the bullet hitting glass, the fist connecting, the dancer reaching the peak of a leap.",
    bestFor:
      "Action impacts, athletic feats, dramatic emphasis on a single moment within motion, fight choreography, visual spectacle, moments of peak physical performance, emotional climaxes in movement",
    promptSyntax: "Speed ramp, transitioning from normal speed to slow motion",
    minDuration: 5,
    examplePrompt:
      "Speed ramp, transitioning from normal speed to slow motion. A parkour runner sprints across a rooftop at full speed, plants one foot on the ledge, and leaps. As he becomes airborne, time slows dramatically. His coat spreads like wings against the city skyline. Every water droplet from a rooftop puddle hangs suspended in mid-air. Time resumes as he lands on the next building. Golden hour backlighting, deep depth of field, 4K cinematic.",
  },

  {
    id: "fpv-first-person",
    name: "FPV / First Person",
    category: "action",
    description:
      "The camera becomes the character's eyes, showing exactly what they see as they move through the world. True POV puts the audience inside the character's body — their hands enter frame, objects approach at eye level, and the movement has the natural bob of walking or running. This creates maximum identification but also maximum disorientation. Gaspar Noe used it to devastating effect in Enter the Void. FPV drone versions push this further, creating impossible first-person flight through tight spaces. It is the most immersive camera technique available, but exhausting if sustained too long.",
    bestFor:
      "Immersive experiences, showing exactly what a character sees, FPV drone flights through tight spaces, video-game-style sequences, horror (seeing the threat approach), VR-inspired moments",
    promptSyntax: "First-person POV, camera as the character's eyes",
    minDuration: 3,
    examplePrompt:
      "First-person POV, camera as the character's eyes, walking slowly into an abandoned hospital ward. A hand reaches into frame to push open a creaking door. The hallway beyond is dark except for a single flickering fluorescent tube. Peeling paint and scattered papers on the floor. The camera steps forward cautiously, footsteps echoing. Desaturated, high contrast, deep shadows, 16mm film grain. Unsettling.",
  },

  {
    id: "crash-zoom",
    name: "Crash Zoom",
    category: "action",
    description:
      "A rapid zoom in or out, typically achieved with a zoom lens rather than camera movement. The crash zoom is deliberately unsubtle — it slams the audience's attention onto a subject with alarming speed. In the 1970s, it was a hallmark of exploitation and kung fu cinema. Today it is used for comedic effect (Edgar Wright, Wes Anderson), for horror jump scares, or as a stylistic homage. The slight optical distortion of a zoom (versus a dolly) makes the image feel compressed and surreal. Use it when you want the camera itself to seem startled or excited.",
    bestFor:
      "Comedic emphasis, sudden realizations, horror reveals, retro stylistic homage, drawing sudden attention to a detail, moments of shock or surprise",
    promptSyntax: "Crash zoom, rapid zoom into the subject",
    minDuration: 3,
    examplePrompt:
      "Crash zoom, rapid zoom into a man's face as he realizes the suitcase is empty. His eyes widen, pupils dilating. The crash zoom compresses the background, making the walls of the dingy motel room seem to close in behind him. Harsh overhead light, single bulb swinging slightly, casting moving shadows. Shot on 35mm film, 70s aesthetic, warm desaturated tones.",
  },

  {
    id: "truck-left",
    name: "Truck Left",
    category: "action",
    description:
      "The camera moves laterally to the left on a track or dolly, sliding parallel to the scene. A truck (or crab) move scans the environment horizontally, like reading a sentence from right to left. It reveals new information progressively — each foot of lateral movement adds something new to the frame on the left while removing something on the right. This creates a visual rhythm that is steady and controlled. Use it to move along a row of objects, scan across a group of characters, or create the sense of traveling past a scene like a passenger in a moving vehicle.",
    bestFor:
      "Scanning across environments, moving along a row of subjects, creating lateral motion, drive-by perspectives, revealing a scene progressively from right to left",
    promptSyntax: "Camera trucks smoothly to the left",
    minDuration: 4,
    examplePrompt:
      "Camera trucks smoothly to the left along a wall of missing persons flyers in a police station hallway. Each face tells a different story — smiling school portraits, grainy security camera stills, hand-drawn sketches. A detective's reflection glides across the glass covering the flyers. Cold fluorescent light, institutional green walls, deep focus. Shot on 35mm film, desaturated teal grade.",
  },

  {
    id: "truck-right",
    name: "Truck Right",
    category: "action",
    description:
      "The camera moves laterally to the right on a track or dolly, sliding parallel to the scene. The truck right reads like a sentence — left to right — which aligns with how Western audiences naturally scan images. This makes it feel slightly more natural and forward-progressing than a truck left. It is excellent for reveals that build sequentially: first we see A, then B, then C, each one adding to the story. The lateral movement also creates a strong sense of geography, establishing how elements in a scene relate to each other spatially.",
    bestFor:
      "Sequential reveals reading left to right, establishing spatial relationships, moving along a scene's geography, passing through time via objects on a shelf, scanning a crowd",
    promptSyntax: "Camera trucks smoothly to the right",
    minDuration: 4,
    examplePrompt:
      "Camera trucks smoothly to the right along a scientist's cluttered workbench. First a microscope with a glowing slide, then scattered notebooks full of equations, then an array of test tubes in a rack catching blue LED light, and finally the scientist herself, hunched over a laptop, face illuminated by the screen. Warm practical lighting, shallow depth of field, 4K cinematic.",
  },

  {
    id: "chase-cam",
    name: "Chase Cam",
    category: "action",
    description:
      "A dynamic, close-range tracking shot that stays locked onto a subject in rapid motion, capturing the chaos and urgency of pursuit. Unlike a smooth Steadicam follow, the chase cam deliberately incorporates some instability — the slight bounce, the near-misses of obstacles, the breathless pace. It puts the audience right in the middle of the action, as if they are the one doing the chasing (or being chased). The proximity and movement create an adrenaline response that no static shot can match.",
    bestFor:
      "Chase sequences on foot or in vehicles, pursuit scenes, urgent escapes, high-energy action, running through obstacles, conveying the physical intensity of motion",
    promptSyntax: "Chase cam, close behind the subject in rapid motion",
    minDuration: 4,
    examplePrompt:
      "Chase cam, close behind a woman in a leather jacket sprinting through a packed subway station. She leaps a turnstile, weaves between commuters, slides down a railing. The camera stays with her, matching every turn and dodge. Harsh fluorescent light mixes with warm underground glow. Motion blur on background figures, sharp focus on the subject. Handheld energy, 35mm film grain, anamorphic.",
  },

  {
    id: "low-angle-tracking",
    name: "Low-Angle Tracking",
    category: "action",
    description:
      "A tracking shot captured from a low camera position, following the subject while looking upward at them. This combines the power dynamics of a low angle with the energy of a tracking shot. The subject towers above the camera as they move, making them appear heroic, unstoppable, or menacing — depending on context. The low position also captures the ground texture — feet hitting pavement, dust kicked up, rain splashing — adding visceral physicality. Tarantino used low-angle tracking for his characters' most iconic walks: slow, powerful, the camera at boot level, world parting before them.",
    bestFor:
      "Power walks, hero arrivals, villain approaches, making characters appear dominant in motion, showing footwork and ground-level detail, imposing character introductions",
    promptSyntax: "Low-angle tracking shot, camera below the subject looking up while following",
    minDuration: 5,
    examplePrompt:
      "Low-angle tracking shot, camera below the subject looking up while following. Three figures in long coats walk abreast down a rain-soaked city street at night. Shot from knee height, they tower against a sky filled with neon reflections on wet pavement. Their coats billow slightly. Puddles splash with each deliberate step. Warm neon reds and blues, anamorphic flares, shallow depth of field, 35mm film grain.",
  },

  // ─────────────────────────────────────────────────────────────────────────────
  // TRANSITIONS & REVEALS
  // ─────────────────────────────────────────────────────────────────────────────

  {
    id: "pan-reveal",
    name: "Pan-to-Reveal",
    category: "transition",
    description:
      "The camera pans horizontally to discover something new in the scene — a character, an object, a landscape feature that recontextualizes everything. The pan-to-reveal exploits the audience's limited field of view within the frame. They can only see what the camera shows them, and the slow horizontal movement builds anticipation: what is the camera going to find? The reveal should always be worth the wait. The best pan-reveals change the meaning of the scene — what we thought we understood is transformed by what the camera discovers.",
    bestFor:
      "Plot reveals, surprises, showing what a character sees when they turn, transitioning attention to a new subject, building suspense before a discovery, connecting two elements in a scene",
    promptSyntax: "Camera pans slowly, revealing",
    minDuration: 5,
    examplePrompt:
      "Camera pans slowly to the right, moving away from a detective's shocked face. The pan gradually reveals a massive evidence board covering an entire wall — hundreds of photos, newspaper clippings, maps, and red string connecting clues in a web of conspiracy. The scope of the investigation becomes suddenly, overwhelmingly clear. Dim overhead light, warm desk lamp, deep shadows. Shot on 35mm film, anamorphic.",
  },

  {
    id: "dolly-zoom-vertigo",
    name: "Dolly Zoom (Vertigo Effect)",
    category: "transition",
    description:
      "The camera physically dollies forward while simultaneously zooming out (or dollies back while zooming in), keeping the subject the same size while the background warps dramatically. Invented for Hitchcock's Vertigo, this technique creates a profoundly disorienting visual effect — the world seems to stretch or compress around a fixed subject. It is the visual representation of a psychic shift: the moment when reality bends, when a character's perception of the world fundamentally changes. Spielberg used it in Jaws for Brody's realization on the beach. It should be reserved for your most pivotal moments.",
    bestFor:
      "Moments of realization or shock, psychological shifts, vertigo and disorientation, the instant everything changes, horror reveals, panic attacks, existential dread",
    promptSyntax: "Dolly zoom, background warping while subject stays fixed in frame",
    minDuration: 4,
    examplePrompt:
      "Dolly zoom, background warping while subject stays fixed in frame. A man stands at the edge of a rooftop, looking down at the street far below. As vertigo hits, the buildings in the background seem to stretch and elongate while he remains the same size. The ground appears to rush away. His hands grip the railing, knuckles white. Sunset light, long shadows, queasy perspective distortion. Shot on 35mm film, anamorphic.",
  },

  {
    id: "fade-in-black",
    name: "Fade In from Black",
    category: "transition",
    description:
      "The image gradually appears from total darkness. The fade-in is cinema's equivalent of opening your eyes — it is the first breath of a new scene, a new chapter, a new world. The speed of the fade matters enormously: a slow fade (3-4 seconds) feels contemplative and literary, like the opening of a novel. A faster fade (1-2 seconds) feels more like waking up from sleep. The fade-in also primes the audience to pay attention — as the image materializes from darkness, every emerging detail becomes significant because we are seeing it for the first time.",
    bestFor:
      "Opening shots of films or new scenes, returning from a time jump, beginning a new chapter, establishing a contemplative or literary tone, emerging from unconsciousness or memory",
    promptSyntax: "Fade in from black, the scene gradually materializes",
    minDuration: 4,
    examplePrompt:
      "Fade in from black, the scene gradually materializes. A dense pine forest at dawn, shrouded in heavy mist. The first rays of pale sunlight filter through the canopy. A narrow dirt path emerges, winding into the trees. Birdsong. Dew glistens on fern fronds. The world assembles itself piece by piece from the darkness. Muted greens, soft diffused light, deep atmospheric haze. Shot on 16mm film, natural grain.",
  },

  {
    id: "match-cut",
    name: "Match Cut",
    category: "transition",
    description:
      "A transition where the composition, movement, or shape in the final frame of one shot perfectly mirrors the opening frame of the next, creating a seamless visual bridge between different subjects, locations, or time periods. The match cut is one of cinema's most elegant techniques — it draws a visual metaphor between two things that are physically different but symbolically connected. Kubrick's bone-to-satellite in 2001 is the most famous match cut in history: a thrown bone becomes an orbiting space station, and four million years pass in a single edit. The match cut says 'these two things are secretly the same.'",
    bestFor:
      "Time jumps, connecting thematically related scenes, visual metaphors, transitions between locations, showing the passage of time, linking past and present, elegant scene changes",
    promptSyntax: "Match cut composition, the subject mirrors the shape and position of the previous shot",
    minDuration: 3,
    examplePrompt:
      "Match cut composition. A spinning basketball held aloft by a player's fingertip, perfectly round against a gymnasium ceiling. The ball's rotation, size, and position in frame are designed to match-cut to a spinning globe on a teacher's desk in the next scene. Warm gymnasium light, shallow depth of field, the ball rotating in slow motion. 4K cinematic.",
  },

  {
    id: "shot-reverse-shot",
    name: "Shot-Reverse-Shot",
    category: "transition",
    description:
      "The foundational dialogue editing pattern: one character speaks (shot), then we cut to the other character reacting or responding (reverse shot), and back again. This rhythm is so ingrained in cinematic language that audiences process it unconsciously — it is the visual grammar of conversation. The power lies in the reactions: we cut to the listener to see the impact of the words. The best shot-reverse-shot patterns break their own rhythm at key moments — holding on a reaction longer than expected, or cutting a beat early to create urgency. In single-shot generation, design for one half of the pattern at a time.",
    bestFor:
      "Dialogue scenes between two characters, arguments and confrontations, interviews, interrogations, romantic conversations, any two-person exchange where reactions matter",
    promptSyntax: "Medium close-up, dialogue framing",
    minDuration: 3,
    examplePrompt:
      "Medium close-up, dialogue framing. A woman leans forward in a dimly lit interrogation room, hands flat on the metal table. Her expression is controlled but her eyes betray urgency. A single overhead fluorescent light casts hard shadows under her cheekbones. The background is concrete and shadow. Shot on 35mm film, cool desaturated palette, shallow depth of field. Cinematic.",
  },

  {
    id: "pan-left",
    name: "Pan Left",
    category: "transition",
    description:
      "A horizontal pivot of the camera to the left on a fixed axis. Panning left feels like looking over your left shoulder or scanning backward — in Western visual language (which reads left to right), leftward movement can subtly suggest returning, retreating, or looking back in time. It is a contemplative, sometimes nostalgic direction. Use a pan left to draw attention to something the character has passed, to scan backward along a timeline of objects, or simply to reveal the left side of a scene. The speed of the pan controls the emotion: slow is thoughtful, fast is startled.",
    bestFor:
      "Scanning environments from right to left, revealing something behind or to the left of the current frame, looking back, nostalgic or reflective moments, shifting attention gradually",
    promptSyntax: "Camera pans slowly to the left",
    minDuration: 3,
    examplePrompt:
      "Camera pans slowly to the left across a mantelpiece lined with framed photographs spanning decades. First a recent digital print, then faded Polaroids, then a black-and-white wedding portrait, finally settling on a sepia-toned daguerreotype of a stern ancestor. Five generations in one slow pan. Warm firelight flickers across the frames. Shallow depth of field, rich warm tones. Shot on 50mm lens.",
  },

  {
    id: "pan-right",
    name: "Pan Right",
    category: "transition",
    description:
      "A horizontal pivot of the camera to the right on a fixed axis. Panning right aligns with the natural left-to-right reading direction of Western audiences, making it feel like forward progress, continuation, or 'what comes next.' It is the camera's way of turning the page. A slow pan right across a landscape feels expansive and explorative. A quick pan right to discover a new character or object feels like a natural shift of attention. It is perhaps the most neutral and versatile of all camera movements — useful in almost any context.",
    bestFor:
      "Revealing what is next, scanning environments naturally, following a character's gaze to the right, transitioning attention forward, establishing the breadth of a location",
    promptSyntax: "Camera pans slowly to the right",
    minDuration: 3,
    examplePrompt:
      "Camera pans slowly to the right across a bustling Moroccan spice market. Pyramids of turmeric gold, paprika red, and cinnamon brown fill wooden bins. Merchants gesture and call out. The pan continues past hanging brass lanterns and stacked ceramic tagines, finally arriving at a narrow alley entrance where a figure in a white djellaba waits in shadow. Warm saturated colors, natural sunlight, 4K cinematic.",
  },
];

/**
 * Look up a camera movement by its unique ID.
 * Returns undefined if no movement matches the given ID.
 */
export function getCameraMovement(id: string): CameraMovement | undefined {
  return CAMERA_MOVEMENTS.find((movement) => movement.id === id);
}
