# nook.fm REANIMATED: 12-Part Roadmap (v2)

> **FOR ANY AI PICKING THIS UP:** When the user says **"next part"**, do this:
> 1. Read this file + `README.md`.
> 2. Find the first part with status `⏳ TODO` in the **Status board**. That's the part you build.
> 3. Read every file listed under "Touches" before editing. **Do not rewrite systems that work.** Add new modules (`js/<feature>.js`) and wire them into `js/main.js` with small, commented edits.
> 4. Follow the **Global rules** and the **Sample bible** (what each reference video contributes).
> 5. When you finish: set the part to `✅ DONE`, fill in "Delivered", add leftovers, update `README.md`, verify in a browser (desktop 1280 + mobile 390). `index.html?t=17` skips the aperture and intro.
> 6. The user wants each part done in one go. **Don't ask questions unless something blocks you.** Respect the User feedback log.

---

## Vision (v2)
The base stays the same: a real-time 3D lo-fi room (Three.js). A character comes home, puts on headphones and sinks into the couch, and the room hides **secret portals** to the owner's apps.
**v2 re-animates the whole site** using the motion language of 6 reference videos (and more). Every chapter becomes its own "scene" with its own camera language. The page should feel like a set of linked dioramas, not a page with a 3D background.

## Sample bible (the 6 references, minimum, so use more than that)
| # | Reference | What we take from it | Used in parts |
|---|---|---|---|
| S1 | **PLOTBLOC / Aldersey Freight**: topographic contour field, a black void circle, the model "grows" inside it, top-down camera tilts to an angle, "01 / 08 MODELS" index, hover shows a photo pop-up, prev/next models | Aperture prologue, site-plan view, room build-up, index counter, hover preview cards, prev/next model nav | 1, 2, 8 |
| S2 | **tidewend**: aerial coastline, "SCROLL TO GLIDE", logo letters spread on hover with an outline, reticle/crosshair cursor, hover-zoom on a harbour, "Click to interact", cream editorial sections (Logbook, Crew roles with a moving red dot) | Reticle cursor, logo hover, rotated side label, hover-zoom focus, editorial logbook | 1, 2, 9 |
| S3 | **Sootwick booksellers**: dark library, featured 3D book under a spotlight, a row of spines, a giant serif wordmark behind, dust motes, slow drift | Book-spine carousel, giant wordmark, dust, spotlight | 3, 5 |
| S4 | **feltip**: you pick up a 3D marker and draw ink that circles words in the headline, an eraser wipes, "PICK UP THE MARKER" | 3D marker + ink layer over the DOM, guestbook doodles | 6 |
| S5 | **Ashgrove studio**: oak card catalog with 6 drawers, hovering a drawer shows a cursor pill ("Oda Bakehouse / IDENTITY"), god rays plus dust, a click dollies the camera in, the drawer slides out showing a record sleeve, side panel with details, prev/next, "ESC close drawer" | **Main projects showcase**, cursor pill, god rays, drawer dolly | 1 (pill), 3, 4 |
| S6 | **Venice canal at night**: reflective water, gondolas, striped mooring pole wiping past the lens (foreground parallax), lamps, stars, "BACINO DI SAN MARCO" scene tag + "● LIVE" | Scene-name HUD, the window world (night canal), foreground wipes between chapters, reflections | 1 (HUD), 7 |
| + | Extra (ours) | Shader portal transitions, audio-reactive room, weather, achievements, terminal | 10, 11, 12 |

## Global rules
- Stack: plain static site. ES modules, Three.js 0.160 (importmap, jsDelivr), GSAP + ScrollTrigger, Lenis. **No build step, no frameworks.** No image/video/audio downloads in the 3D scene. Everything is procedural (canvas textures, Web Audio).
- **All app links live in `js/portals.config.js`.** Never hard-code a URL anywhere else. Showcase parts (4, 5, 8) read the same `PORTALS` list.
- Performance: 60fps on a mid laptop, 30fps or better on phones. Every effect needs a low-tier fallback. New lights or clipping planes must be **created before `renderer.compile`** in `boot()` (adding them later recompiles every shader and causes a hitch). Animate intensities, not light counts.
- Mobile: no hover-only features. Test at 390px. Accessibility: real `<button>`s, aria-labels, Esc closes overlays, focus is managed, and `prefers-reduced-motion` skips heavy motion.
- Sound: Web Audio only (`LofiAudio`). SFX only when `audio.enabled`.
- Palette: `--pink #ff4f7b`, `--amber #ffc56b`, `--teal #5fd4cf`, bg `#0b0712`, ink `#fff3df`. Fonts: Fraunces, Inter, Pacifico. Each new scene may add **one** accent (S5 oak `#b9814a`, S6 canal blue `#2a4a78`, S2 cream `#f4ecdc` for editorial sections).
- Debug flags: `?t=<sec>` (also skips the aperture), `?aperture=0`, `?freeze`, `?chapter=n`, `?debug=portals`.

## File map
| File | Role |
|---|---|
| `index.html` | DOM overlay: loader, top bar, sections, now-playing, controls |
| `demo.html` | Feedback page: skips aperture + intro, auto-scans portals |
| `css/style.css` | All styles. Each part has its own marked block (`REANIMATED PART n`) |
| `js/main.js` | Director: boot, renderer, post FX, intro timeline, camera, scroll, main loop |
| `js/world.js` | The room. `LAYOUT` = coordinates |
| `js/character.js` / `js/audio.js` / `js/textures.js` / `js/utils.js` | Rig, procedural music, canvas textures, math + keyframes |
| `js/ui.js` | Loader, captions, split text, counters, magnetic buttons, base cursor |
| `js/portals.config.js` | **EDIT ME:** apps (title, url, color, anchor, …) |
| `js/portals.js` | Secret portals engine (v1 Part 1, kept) |
| `js/aperture.js` | **v2 Part 1:** topographic prologue, void iris, room build-up, sky-to-room camera flight |
| `js/hud.js` | **v2 Part 1:** scene tag, chapter rail, live camera readout, reticle cursor, cursor pill, logo letters |
| `js/interact.js` | **v2 Part 2:** raycast hover, glow, brackets, reactions, hover-zoom, focus dolly, "Click to interact" chip |
| `js/atmos.js` | **v2 Part 3:** light shafts, GPU dust, hero spotlight helper `atmos.spot(v3, color)` |
| `js/dof.js` | **v2 Part 3:** BokehPass depth of field, only on while `dof.setTarget(v3)` is set |
| `_test.html` / `_focus.html` | Test pages: console checks for Parts 2+3 / focus-mode screenshot (turntable) |

---

## Status board
| # | Part | Samples | Status |
|---|---|---|---|
| 0 | (v1) Secret portals foundation | – | ✅ DONE (kept) |
| 1 | **Aperture prologue + cinematic HUD** | S1 S2 S5 S6 | ✅ DONE (awaiting feedback) |
| 2 | Living room: raycast hover, object reactions, hover-zoom focus | S2 S1 S6 | ✅ DONE (awaiting feedback) |
| 3 | Light & air: god rays, dust motes, depth of field, warm grade | S5 S3 | ✅ DONE (awaiting feedback) |
| 4 | **The Catalog**: oak card-catalog drawers = your apps | S5 | DONE — preserved from live deployment |
| 5 | The Shelf: book-spine carousel + giant wordmark | S3 | DONE — preserved from live deployment |
| 6 | The Marker: pick up a 3D marker, ink on the page | S4 | DONE |
| 7 | Through the window: night canal world + foreground wipes | S6 | DONE |
| 8 | Project City: site plan of every app (grow-in models, hover previews) | S1 | DONE |
| 9 | The Logbook: editorial cream chapter (timeline, crew, logbook table) | S2 | DONE |
| 10 | Portal transitions v2 (GLSL, one style per scene) | all | DONE |
| 11 | Audio-reactive room, mini player, day/night + weather | + | ⏳ TODO |
| 12 | Hidden layer, mobile/perf/a11y pass, SEO + launch | + | ⏳ TODO |

### New page flow (target after Part 12)
`Aperture (S1)` → `Intro film` → `Hero / couch` → `Stations (decks)` → `The Catalog (S5)` → `The Shelf (S3)` → `Through the window (S6)` → `Project City (S1)` → `Logbook (S2)` → `Join + Marker guestbook (S4)`

---

## Part 1: Aperture prologue + cinematic HUD ✅
**Goal:** the first 10 seconds look like S1. Then a persistent "film HUD" (S6/S2/S5) ties every later scene together.
**Delivered:**
- `js/aperture.js`, the prologue that runs before the intro film:
  - Full-screen **animated topographic contour field** (marching squares on a 2D noise field, about 30fps). The contours wrap concentrically around the void and **bend around your cursor**. Every 4th contour line is highlighted.
  - A **black void circle** with a breathing pink/amber rim, a rotating dashed orbit and a tick ring. "Tune in ♪" (click the void, with sound) or "Enter silently". Space, Enter, wheel and swipe also enter. It auto-enters after 14s.
  - **Room build-up (S1 "buildings grow")**: a world-space clipping plane rises from the floor to the ceiling (0 → 4.4m in 2.4s). A glowing teal **scan frame** rides the cut, and a live `ELEV 2.13 M` readout sits on the rim. The camera is a top-down **site plan** that slowly orbits.
  - A temporary hemisphere "plan light" (created before compile and kept at intensity 0 afterwards, so there's no recompile).
  - **Sky-to-room flight**: the circle irises open to full screen while the camera swoops down a bezier curve from the plan view into the intro's first shot. The last frame of the flight matches the intro camera, so there's no pop. Then the intro timeline starts.
  - S1-style info block ("01 | 07 PORTALS", "The Nook", copy, tags), Gwalior coordinates and an index footer.
  - Skipped by `?t=`, `?aperture=0`, `demo.html` and reduced motion. "Skip intro" and Esc during the aperture skip everything.
- `js/hud.js`, the persistent cinematic HUD:
  - **Scene tag (S6)** under the brand, like "● LIVE · THE COUCH". It changes per chapter with a scramble-decode (SITE PLAN → THE DOORWAY → THE COUCH → THE DECKS → THE WINDOW → THE NEON WALL → THE WIDE SHOT).
  - **Left chapter rail (S1 index + S2 rotated label)**: a rotated scene name, 5 clickable ticks, a `01/05` counter and a live camera readout (`x y z · fov`). Hidden below 760px.
  - **Reticle cursor (S2)**: over the 3D scene, the ring becomes a crosshair reticle.
  - **Cursor pill (S5)**: any element with `data-pill="Title|CATEGORY"` shows a lagging two-part pill (used on the void, rail ticks, nav and CTAs).
  - **Logo letter-spread (S2)**: on hover the "nook.fm" letters spread out from the center and an outline box draws in.
- `js/portals.config.js`: the owner's real links are wired in (7 portals enabled, 3 spare portals disabled).
- `main.js`: about 15 small edits (create the aperture before compile, hold the timeline while the aperture is active, camera override, lens fade, skip, HUD update).
**Leftovers / ideas:** contour colors could react to music once Part 11 exposes bands. S1's hover photo pop-up is planned for Part 8 (Project City).

## Part 2: Living room: interaction + hover-zoom
**Samples:** S2 (hover-zoom on the harbour, "Click to interact"), S1 (hover pop-up), S6 (hover icon).
**Touches:** `world.js` (expose meshes: `W.neon, W.cat, W.platter, W.speakers, W.pBulb, curtains, books, mug`), new `js/interact.js`, `portals.js`, `hud.js` (pill API).
**Spec:**
- Throttled raycaster on the pointer. Hovering shows an emissive rim glow, the HUD pill (`hud.pill('Vinyl Player', 'TURNTABLE')`) and the reticle snaps/tightens to the object (S2).
- Reactions: the cat wakes and meows (synth) and its tail swishes. The neon flickers and the word cycles (nook → open → play). The turntable scratches (pitch dip). The pendant swings (pendulum). Curtains part. A book slides out. The mug's steam bursts. The window triggers `W.strike`.
- **Hover-zoom (S2):** holding over an object for 600ms makes the camera ease 15% toward it, and it eases back on leave. Double-click gives a full focus dolly (reuse the `goal`/`cam` damping). Esc returns.
- First-time "Click to interact" chip (S2) near the first hovered object.
- Portals can attach to a mesh name (`anchor: 'cat'`), with xyz as the fallback.
**Done when:** 8+ objects have distinct reactions and 60fps holds.
**Status: ✅ DONE.**
**Delivered:**
- `js/interact.js`: a raycaster throttled to about 20Hz (desktop) against all 442 room meshes plus the character, so walls and he block hits. Each target gets a private cloned material, so the amber emissive glow only lights that object. Live materials (lamp shades, neon, bulb, city) are driven by `world.js` through `W.hover[id]` instead.
- **17 interactive objects**, each with its own reaction (`W.react` in `world.js`) and a synth sfx (`audio.js`):
  - The cat wakes, its ears perk up and its tail swishes (meow).
  - The neon flickers and cycles its word: nook → open → play (buzz).
  - The turntable scratches backwards with a tape-stop pitch dip (`audio.dip()`).
  - The pendant swings as a two-axis damped pendulum, and the key light follows it (clink).
  - The curtains part or close (swish).
  - The bookshelf slides out the clicked book (slide).
  - The mug's steam bursts and the mug wobbles (hiss).
  - The window triggers lightning plus thunder.
  - The speakers thump (bass).
  - The door rattles (knock).
  - The two plants rustle.
  - The floor and table lamps toggle on and off.
  - The three posters swing on their nails (tap).
- Hover shows the HUD pill (title | category), which changes to the state after a click (e.g. `NEON SIGN | OPEN`). Corner brackets with an `03/17 · TURNTABLE` tag snap around the object, and the reticle is pulled 35% toward its centre.
- **Hover-zoom (S2):** after 600ms of dwell the camera eases 15% toward the object. **Focus dolly (S5):** double-click or double-tap. The focus bar has `FOCUS 03 / 17 Vinyl Player` and a ✕ ESC button. Esc, ✕ or the wheel goes back. Lenis is stopped while focused.
- Touch: a tap reacts and briefly shows the brackets, and a double-tap focuses. The first-time "Click / Tap to interact" chip is shown once (`localStorage nook.interact.chip`).
- Portal anchors accept object names (resolved through `interact.object(name)`, plus `'phones'`).
**Leftovers:** the S1 hover photo pop-up is still planned for Part 8.

## Part 3: Light & air
**Samples:** S5 (god rays + dust in a sunbeam), S3 (dust motes, spotlight on the hero object).
**Touches:** `world.js`, `main.js` post chain, new `js/atmos.js`.
**Spec:**
- Volumetric light cones: additive, depth-faded cone meshes with a noise shader through the window (moonlight), from the table lamp and the pendant.
- Dust: a GPU `Points` system (2–6k by quality tier), brighter inside the cones (cone SDF in the shader), drifting with curl noise and drawn toward the cursor.
- `BokehPass` used only in focus mode (Part 2) and drawer mode (Part 4). A warm LUT-style color grade in the lens shader (lift/gamma/gain uniforms).
- A spotlight that "follows the hero object" (helper reused by Parts 4 and 5).
**Done when:** god rays and dust are visible in the hero and stations shots, and the low tier disables cones and halves the dust.
**Status: ✅ DONE.**
**Delivered:**
- `js/atmos.js`:
  - **Volumetric shafts:** additive, view-angle (fresnel) faded, noise-streaked open cylinders. There's a 4-sided moon beam through the window plus cones for the pendant (follows its swing), the floor lamp and the table lamp. Their intensity is read from the real lights every frame, so lamp toggles, the light switch and lightning flashes all show in the beams.
  - **GPU dust:** 6000 / 3500 / 2000 points (high / med / low), animated fully in the vertex shader. A cone SDF per shaft makes motes brighter (and cooler blue in the moon beam) inside the light. Moving the cursor pulls the motes into a swirl around the pointer ray. The old 240 CPU motes are hidden.
  - **Hero spotlight helper:** `atmos.spot(vector3 | null, color?)`. It uses one `SpotLight` created before compile (intensity 0 when idle, so there's no recompile and no shadow cost) plus its own visible beam and dust SDF slot. It glides between targets from above, leaning toward the camera. Part 2 focus uses it now; Parts 4 and 5 should call it for the active drawer or book.
- `js/dof.js`: **BokehPass** added after the RenderPass but **disabled unless a target is set**. `dof.setTarget(v3)` is called by the focus dolly, and Part 4 drawer mode should call it too. The focus distance follows the target along the view axis every frame. Blur fades in and out with `maxblur`, so there's no pop. The depth pre-pass hides dust, shafts, rain, glass, neon and sprites, so they don't write fake depth. `dof.warm()` compiles the depth and bokeh shaders at boot, so there's no first-use hitch. The vignette deepens slightly in focus.
- **Warm grade:** lift / gamma / gain plus a teal-shadow / amber-highlight split tone in the lens shader (`uLift uGamma uGain uGrade`).
- **Tiers:** `?quality=low|med|high`. Phones start on med. The perf probe (more than 33ms per frame) drops to low: shafts hidden, dust at 2000, DOF off.
**Leftovers:** a real LUT texture could replace the analytic grade. Bloom threshold tuning per scene is for Part 11 (audio-reactive).

## Part 4: The Catalog (main projects showcase)
**Samples:** S5 (Ashgrove card catalog), S1 (index + prev/next).
**Touches:** `world.js` (replace or extend the record cabinet near the turntable with an oak card catalog of N drawers, one per enabled portal), new `js/catalog.js`, `index.html` (new chapter `#catalog` after Stations, plus a nav link), `portals.config.js` (add `category`, `year`, `stack`, `role`, `cover` colors), `main.js` (`catalog` shot in `SHOTS`/`ORDER`).
**Spec:**
- A brass number plate on each drawer (canvas texture: "01 Beyond the Fort"). Hover lights the drawer and shows the pill ("ERRATA | ARCHIVE") (S5).
- A list on the left (01–07) is synced two-way with the 3D hover.
- Click: the camera dollies in and down, the drawer slides out (power3.out, 1.2s), and a record sleeve plus vinyl inside shows the app's cover (procedural). A side panel shows Format/Stack/Year/Role and an **Open** button (portal transition). Prev/Next buttons and "ESC close drawer".
- Undiscovered secret portals still show, but as "???" drawers with a hint. Secrets stay rewarding.
- Mobile: tap opens; bottom-sheet panel.
**Done when:** every enabled app is a drawer and open, close, prev and next all work on desktop and mobile.

## Part 5: The Shelf
**Samples:** S3 (Sootwick).
**Touches:** new `js/shelf.js` (separate small scene rendered in the same canvas via scissor, or a group placed in the room's bookshelf), `index.html` chapter `#shelf`.
**Spec:** a horizontal, scroll-scrubbed row of 3D book spines (procedural covers in each app's color, gold-foil titles with metalness). The centered book rotates to face the camera and opens slightly under a spotlight. A giant serif wordmark "nook" sits behind with a shimmer. The caption at the bottom cross-fades (title / author = app / tagline). Uses Part 3 dust.
**Done when:** scrolling glides through all books smoothly, and clicking a book opens its catalog drawer or its portal.

## Part 6: The Marker
**Samples:** S4 (feltip).
**Touches:** new `js/marker.js`, `index.html` (Join chapter), `style.css`.
**Spec:** a 3D felt-tip marker (Three.js, rendered on a small overlay canvas) rests in a holder. "PICK UP THE MARKER": click and it lifts with a tilt, then follows the cursor with spring lag. Dragging draws pressure-varied ink strokes (canvas over the DOM, multiply blend, pink ink) and **auto-circles** the word it starts on (snap to the word's bounding box). An eraser wipes. Doodles are saved locally (localStorage) as a "guestbook". On mobile, touch drawing works and scroll is locked while drawing.
**Done when:** the marker can circle "waiting" in the Join headline and the eraser works.

**Status: DONE (2026-10-20).**
**Delivered:** `public/experience/js/marker.js` and the Join drawing surface. Procedural Three.js marker and holder; spring-follow pickup; pointer capture; velocity/pen-pressure widths; word-bound ellipse after a short dwell; keyboard-accessible Circle word action; eraser, undo, clear and Esc/Put down. Local vector guestbook uses `vibes.marker.guestbook.v1` with bounded, validated stroke data, responsive circle positioning and unavailable-storage feedback. Drawing locks scrolling and pauses Lenis until pointer-up/cancel. Copy explicitly says this is device-local, not a shared guestbook.
**Verified:** desktop 1280px and mobile 390px drawing tools, word-circle, eraser, undo/clear, scroll lock/release and persistence after reload. Physical touch-device testing remains outside this browser check.
**Leftovers:** optional additional ink colors and public guestbook syncing are not part of this milestone.

## Part 7: Through the window
**Samples:** S6 (Venice canal at night).
**Touches:** `world.js` (replace the flat city plane with a 3D night-canal diorama outside the window: water with planar reflection or a cheap mirrored-scene trick, arched bridge, gondolas bobbing, striped mooring poles, lamps + bloom, stars), `main.js` (the `rooms` chapter becomes a camera push **through the window**), `hud.js` (the scene tag becomes the canal name).
**Spec:** while scrolling the Rooms chapter, the camera moves through the window frame into the canal world. A striped mooring pole **wipes past the lens** (foreground parallax, S6). Rain ripples on the water. A hover icon appears on the bridge (opens a portal). The scene tag changes to "CANALE DI NOOK · ● LIVE".
**Done when:** the window flight is smooth both ways and the low tier swaps reflection for an env-color fake.

**Status: DONE (2026-10-20).**
**Delivered:** `public/experience/js/canal.js`, replacing the flat skyline with a procedural night canal. Shaded facades, warm windows and lamps, arched bridge, three bobbing gondolas, striped mooring poles, moon/stars, water ripple shader and a tinted mirrored-geometry reflection. Static architecture is batched by material. The extended Rooms chapter scrubs a reversible flight above the sash and past a foreground pole; the final segment returns to the room before Mixes. HUD reads CANALE DI NOOK. The bridge link uses the window portal from `portals.config.js`, including existing discovery and warp behavior. Low tier disables mirrored geometry and uses shader-colored shimmer; reduced motion holds an exterior view.
**Verified:** desktop forward/back flight and reflections, mobile 390px low-tier rendering and return, bridge new-tab navigation and discovery, no browser errors during the checked flows. Production build and TypeScript checks pass.
**Leftovers:** the reflection is deliberately an inexpensive mirrored-scene approximation, not a planar-reflection render target.

## Part 8: Project City
**Samples:** S1 (PLOTBLOC models).
**Touches:** new `js/city.js`, `index.html` chapter `#city`, reuses `aperture.js` contour field and void iris.
**Spec:** a circular plot (the void again) where **each app is a small procedural building** (shape picked by category). The buildings grow up on enter (clipping or scale-Y, stagger). Top-down → angled camera. A "0X | 07 MODELS" index with **Previous / Open the model / Next**. Hovering a building shows a pop-up card (S1 photo pop-up) with the app's color cover plus its live host. Click opens the portal.
**Done when:** every app is a building and the index nav cycles them with camera moves.

**Status: DONE (2026-10-20).**
**Delivered:** `city.js`, the `#city` chapter and `chapters-8-10.css`. Seven procedural models (fort, archive, clocktower, dashboard towers, signal hall, record pavilion and mystery lantern), circular plot/rim, staggered growth and scroll-driven top-down-to-angle tilt. Reuses aperture noise and marching-squares primitives. Numbered buttons and wrapping Previous/Next update the selected camera focus and portal link; raycast hover shows projected cover/host cards, and direct clicks launch portals. All project data comes from the shared config.
**Verified:** desktop 1280px, current-preview 639px and mobile 390px rendering; model selection/wrap, camera tilt, hover raycast and shared-config links. Mobile plot fits inside the viewport.
**Leftovers:** covers and buildings are procedural artwork, not photographs or imported models. Physical touch hardware and representative GPU performance are unmeasured.

## Part 9: The Logbook
**Samples:** S2 (tidewend Logbook + Crew).
**Touches:** `index.html` (new cream editorial chapter `#logbook`), `style.css` (cream `#f4ecdc` theme, a scrim covering the 3D view), new `js/logbook.js`.
**Spec:** a hard cut from the night room into a cream editorial page. A "THE LOGBOOK" table of apps (PROJECT / FROM / STACK / YEAR). Hovering a row draws its SVG route line. "SAIL WITH THE CREW" becomes a list of skills/roles with a **red dot that glides** along a vertical timeline to the hovered role. Stagger reveals plus clip-path image (cover) reveals.
**Done when:** it reads as a premium editorial section and scrolling back up returns to the night room with a smooth fade.

**Status: DONE (2026-10-20).**
**Delivered:** `logbook.js` and the cream `#logbook` chapter: project/host/stack/year table, hover/focus SVG route draws and clip-path cover reveals, staggered intersection reveals, five skill/role controls with a sliding red timeline dot, and a back-to-room link. Header chrome switches to ink-on-cream; a reversible scrim fades between the editorial page and the night scene. Mobile shows stack notes beneath project titles instead of dropping the metadata.
**Verified:** desktop and 390px table/crew layout, route and cover reveal, crew hover state/dot position, no horizontal overflow, and return to the night room with the cream scrim fully cleared.
**Leftovers:** metadata is inherited from the owner's catalog and remains self-described; no claims that guessed stacks/dates were independently verified.

## Part 10: Portal transitions v2
**Touches:** `main.js` post chain (`TransitionPass` ShaderPass), `portals.js`, new `js/transitions.js`.
**Spec:** uniforms `uProgress, uType, uColor, uCenter`. Types: `warp` (radial zoom + chromatic split), `vinyl` (groove swirl), `rain` (melt), `glitch`, `ink` (noise dissolve, used by the Marker), `iris` (the S1 void closes onto the hotspot), `drawer` (the S5 slide-and-dolly whiteout), `canal` (S6 ripple). Per-portal `transition`. A reverse transition plus a "welcome back" toast on return. Reduced motion falls back to a fade.

**Status: DONE (2026-10-20).**
**Delivered:** `transitions.js`, replacing the old canvas-star warp with a final compositor ShaderPass and DOM departure veil. Live uniforms: progress/type/color/center; all eight GLSL styles are implemented. Portal config selects the default; Catalog, City and Marker apply drawer/iris/ink context overrides. Native new-tab links retain their user gesture, same-tab departures wait for the shader, and focus/visibility/pageshow plus guarded session storage restore a reverse transition and welcome-back toast. Reduced motion uses a short fade.
**Verified:** all eight shader paths enable the expected live uniforms and reset cleanly without browser shader errors; live City link opens the configured app and returning shows the welcome-back toast; medium-quality reduced-motion mode builds all seven models immediately and uses the fade uniform. Production build, standalone TypeScript check and whitespace check pass.
**Leftovers:** cross-origin tabs remain native browser navigation; the app does not inspect external app contents or control the destination. Automated graphics rendering is not a physical-GPU performance benchmark.

## Part 11: Audio-reactive + player + day/night/weather
**Touches:** `audio.js` (bands low/mid/high), `world.js`, new `js/player.js`, `js/atmosphere.js`.
**Spec:** the string lights, speakers, neon, bloom and topo contours all react to the bands. A mini player with 3 stations, volume and a "lo-fi amount" knob. Time of day follows the local clock. Weather: rain, storm, snow, clear (shooting stars), fog. 3s crossfades. Ambience changes with the weather.

## Part 12: Hidden layer, quality & launch
**Spec:** achievements (`A`), Konami 8-bit mode, a secret room behind the bookshelf (unlocked when all portals are found), a mini terminal (`` ` ``). Auto-detected quality tiers (low/med/high), a 2D no-WebGL fallback, keyboard paths and a screen-reader portal list. Lighthouse targets: mobile performance 80+, accessibility 95+. OG/Twitter meta, favicon, JSON-LD, `#portal=id` deep links, a `window.nookTrack` hook, and a credits roll. Deploy notes.

---

## Owner's apps (source of truth = `js/portals.config.js`)
| App | URL | Note |
|---|---|---|
| nook v1 (original) | https://nook-six-pearl.vercel.app | the original version of this site |
| Beyond the Fort | https://caffiene-coders-beyond-the-fort-ver.vercel.app | Gwalior heritage tourism platform |
| ERRATA | https://dist-one-lovat-39.vercel.app | "The Failing Archive" |
| Amon | https://glistening-pika-308184.netlify.app | live class timetable, MITS Gwalior CSE |
| UniDash | https://unidash-eta.vercel.app | dashboard (content not inspected, title guessed) |
| Traffic Light | https://trafficlightppt.vercel.app | presentation (content not inspected) |
| Lily (mystery) | https://magnificent-lily-ef7239.netlify.app | returned 401 (password-protected?), so the title is a placeholder |

## User feedback log
- 2026-10-20: the user requested “now 8 9 10”. All three are delivered together while preserving Parts 1–7. **Next part = 11.**
*(Add the user's feedback after every demo. Later parts must respect it.)*
- v1 Part 1: superseded by the v2 plan. The user asked to "reanimate the complete site using all 6 samples (minimum), rewrite the part-wise plan, build Part 1".
- v2 Part 1: awaiting feedback.
- v2 Parts 2 + 3: the user asked to "complete till part 3 in 1 go". Both are done and awaiting feedback. **Next part = 4 (The Catalog).**
- 2026-10-19: the user asked again to "complete till part 3 in 1 go". Parts 1–3 were re-checked in a browser: the room renders, the shafts track the lights, dust shows, and focus on the turntable gives DOF + the hero spot (desktop + 390 mobile). One fix: `_test.html` now waits for `body.settled` instead of `revealed`, which is set at boot when the intro is skipped, so its checks had been running before the scene was live. **Next part is still 4.**
