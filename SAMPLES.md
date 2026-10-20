# nook.fm: SAMPLE BIBLE (permanent, written reference)

> **Why this file exists:** the owner should never have to re-upload the 6 reference videos.
> Everything a future part needs from them is written down here: layout, motion, timing, easing,
> type, colour, micro-UI and atmosphere, plus **ready-made "recipes"** with numbers that match our stack
> (Three.js 0.160 + GSAP + Lenis + CSS). If a part says "S5 drawer", look it up here, not in a video.
>
> Rule of thumb: **we borrow motion language, not branding.** Always translate into the nook palette
> (`--pink #ff4f7b`, `--amber #ffc56b`, `--teal #5fd4cf`, bg `#0b0712`, ink `#fff3df`) and our fonts
> (Fraunces serif · Inter sans · ui-monospace for readouts · Pacifico only for the neon).

---

## Shared DNA (all 6 samples agree on these)
| Trait | Spec we use |
|---|---|
| **Film grain** | Always on. CSS `.grain` (opacity .035) + lens shader `uGrain .028`. Never remove. |
| **Vignette** | Heavy dark edges. Lens `uVig .85` + CSS `.vignette`. |
| **Mono micro-labels** | 9–11px `ui-monospace`, UPPERCASE, `letter-spacing .14–.24em`, ink-3 colour, values in teal/amber. |
| **Index counters** | `01 / 07` or `01 — 07 MODELS`. Two-digit padded, current number brighter. |
| **"● LIVE" dot** | 6px red/pink dot with 1.4s opacity pulse, next to a scene name. |
| **Lagging cursor** | Small dot follows exactly, ring/pill follows with exp-lerp (`k = 1 - exp(-dt*9…14)`). |
| **Heavy damping** | Camera never snaps. Exp-lerp λ ≈ 2–3, or SmoothDamp 0.6–1.2s. Mouse parallax ≤ 0.15m. |
| **Ease family** | `cubic-bezier(.22,1,.36,1)` (CSS `--ease`) / GSAP `power3.out` / `power4.inOut` for dollies / `expo.out` for mechanical. |
| **Text entry** | Lines fade + slide up 20–28px, stagger 70–120ms. Labels scramble-decode (0.5s + 20ms/char). |
| **Serif + sans pairing** | Big high-contrast serif headline (tight `-0.03…-0.045em`), small sans body, mono specs. |

---

## S1: PLOTBLOC / "Aldersey Freight" (site-plan diorama)
**What it is:** a dark site showing architectural models of places. A circular "plot" sits in the middle of a field of **topographic contour lines**.
**Layout:** logo top-left · centred nav pills (City / Index / Studio) · CTA "Commission a model" top-right · left column: index `01 — 08 MODELS`, huge sans/serif title, 3-line description, tag pills (one highlighted amber/yellow) · bottom corners **Previous / Next** · bottom-centre **"Open the model ↓"**.
**Sequence:**
1. 0–5s: black **void circle** (silhouette) on the contour field, thin white glowing rim.
2. 5–8s: the mask opens (radial wipe from centre) and the 3D model is revealed; buildings **grow up from the ground** (scale-Y/clip, staggered by distance from centre); camera starts **top-down** and slowly tilts to ~35–45° while dollying in (ease-out-quad, ~3s).
3. 8s+: idle slow orbit (≈ 2°/s). Hovering a building pops a **photo card** above it (scale .9 → 1, slight elastic, 250ms), the card follows the building's projected position.
**Micro-UI:** 1px borders, 4px radius tag pills, chevron arrows, mono counters, faint halo behind the plot.
**Palette:** black `#000`, contour grey `#333`, safety yellow `#FFB800` accents → in nook: contours ink-3, highlights amber.
**Atmosphere:** strong top-down key light with crisp shadows, glow halo behind the disc, contours parallax slightly with the cursor.
**We use it for:** Part 1 aperture (done), Part 2 hover pop-up info card, Part 8 Project City (buildings per app, prev/next).

## S2: tidewend (coastline sailing)
**What it is:** an aerial 3D coastline; editorial cream sections below.
**Layout:** nav left (COVES · PASSAGES), logo centre, pill CTA "BOOK A BERTH" with a round compass icon right · rotated vertical label on the left edge ("CHART") · hero text "HUG THE COAST" bottom-left (heavy condensed caps), paragraph bottom-right · "SCROLL TO GLIDE" bottom-centre.
**Motion:**
- Hero camera: high nadir drone view, slow drift + slight roll. Scroll = glide forward.
- **Logo hover:** letters spread apart from the centre and a thin outline box draws around it (done in Part 1).
- **Reticle cursor:** circle + centre dot + thin crosshair ticks over the 3D; label **"Click to interact"** next to it the first time.
- **Hover-zoom:** resting the cursor over the harbour makes the camera ease ~15% toward it (~0.6s delay, ~1s ease); leaving eases back. Click = full orbit/focus mode with damped orbit.
- White-flash cut between hero and editorial sections.
- Editorial: cream `#F2F0E4` pages, table "THE LOGBOOK" with 1px rules, crew timeline with a **red dot `#E63946` that glides** to the hovered row.
**Type:** heavy condensed sans caps for heroes, editorial serif body, mono 10–12px labels `+0.1em`.
**Palette:** sea teal `#2D5F5D → #77C9C3`, sand `#F2F0E4`, charcoal `#1A1A1B`, alert red `#E63946`.
**We use it for:** reticle + logo (Part 1), **hover-zoom + "Click to interact" chip (Part 2)**, Logbook (Part 9).

## S3: Sootwick booksellers (dark library shelf)
**What it is:** a dark bookshop page; one row of 3D books.
**Layout:** top-left "Booksellers & Small Press · Est. 1987", top-right "● Live" + opening hours · a **giant serif wordmark "SOOTWICK"** behind the books · a horizontal row of book spines centred · bottom-left title / author / blurb · bottom-right `N° 02 / 12`, genre, "Add to pile" pill. A thin shelf line grounds the row.
**Motion:** camera is fixed; **books move**. The active book slides forward on Z and rotates ~90° to show its cover, then opens slightly; previous one slides back into the row (`power2.inOut`, ~0.8s). Scrolling moves the active index laterally. Caption cross-fades (fade + 10px rise); blurb sweeps in.
**Atmosphere:** single top spotlight on the centre book, soft wall shadow, dust motes drifting slowly, grain.
**Palette:** `#121212` bg, cream `#F5F5DC` text, books forest `#2D4030`, oxblood `#8B0000`, mustard `#E1AD01`.
**We use it for:** Part 2 book slide-out reaction (mini version), Part 3 dust + spotlight, Part 5 The Shelf.

## S4: feltip (pick up the marker)
**What it is:** a cream dotted-paper whiteboard product page.
**Layout:** big heavy serif headline left (~80px), small sans sub, black pill CTA "Start a board" · diagrams right · bottom tool dock (Undo · Pen · Ink · Highlight · Eraser), active tool marked by a red dot · "Autosaved" with green pulse top-right · "Board 01 · 100%" bottom-right.
**Motion:** a floating hint **"PICK UP THE MARKER"** follows the cursor. Click → a 3D marker lifts (tilt ~25°) and follows the cursor with spring lag. Dragging draws ink whose width varies with velocity. A word in the headline gets **circled**: after ~200ms the scribble snaps/morphs into a clean ellipse (`power2.inOut`). Eraser wipes. "Tidy up" morphs scribbles into perfect shapes.
**Palette:** paper `#F2F0E9`, ink black, signal red `#FF4D00`, dock charcoal `#2A2A2A` → nook: pink ink on dark, cream on the Join panel.
**We use it for:** Part 6 The Marker (+ guestbook doodles).

## S5: Ashgrove studio (oak card catalog)
**What it is:** a dim warm room with a 6-drawer oak card catalog against a textured wall; books, glasses, frame and a twig vase on top.
**Layout:** headline + bio top-left (≈40% width) · project list bottom-left with mono indices `01–06` · "● LIVE" top-right · the cabinet centred.
**Motion:**
- Idle camera "breathes" (tiny float).
- **Hover a drawer:** it brightens and a **two-part cursor pill** appears ("Oda Bakehouse | IDENTITY"), lagging behind the cursor (lerp). The list item highlights too (two-way sync).
- **Click:** camera dollies in + tilts down (`power4.inOut`, ~1.2s); the drawer slides out on Z with a small mechanical overshoot; the camera ends looking down into the drawer at a record sleeve/vinyl. Objects inside tilt toward the mouse.
- Detail view: landing text fades out; left panel staggers in (Format / Print / Pressing / Year). Breadcrumb `DRAWER 03 / 06`. Bottom-left **PREV / NEXT**, bottom-centre **"ESC close drawer"**.
**Atmosphere:** strong warm key light from top-left (window) with **god rays + dust** in the beam, heavy vignette, slight chromatic aberration, subtle bloom.
**Palette:** tobacco shadow `#2A1B0E`, lit oak `#C4A484`, dark oak `#3D2B1F`, cream text → our accent **oak `#b9814a`**.
**We use it for:** cursor pill (Part 1), **hover pill + click dolly + Esc pattern (Part 2 focus mode)**, god rays (Part 3), The Catalog (Part 4).

## S6: Venice canal at night ("Bacino di San Marco")
**What it is:** a stylised low-poly Venetian canal at night.
**Layout:** top-left scene name in small mono caps "BACINO DI SAN MARCO" · top-right "● LIVE" · full-bleed 3D.
**Motion:** camera pans right with high inertia; a **striped mooring pole (palina) wipes past the lens** in the foreground as a transition; then a near-static "handheld" sway. Hovering the bridge shows a small square **hover icon** (arrow/eye) at the cursor; click glides closer. Objects appear with scale .9 → 1 + fade.
**Atmosphere:** reflective water with soft blurred reflections and gentle ripple normals; warm window/lamp point lights vs. cool blue moonlight; stars.
**Palette:** terracotta `#A0522D`, ochre `#DAA520`, deep red `#8B0000`, water navy `#0A192F`, window gold `#FFD700` → our accent **canal blue `#2a4a78`**.
**We use it for:** scene-tag HUD (Part 1), hover icon on interactive objects (Part 2), Through the window (Part 7).

---

## Recipes (copy these numbers)
| Recipe | Values |
|---|---|
| **Hover rim glow** (S5/S6) | Add `emissive` = object colour or `#ffc56b`, `emissiveIntensity` 0 → .35 with exp-lerp λ 10. Additive materials: multiply colour by 1.4. |
| **Hover-zoom** (S2) | Dwell 600ms → camera position lerps 15% toward the object, look-at lerps 35% toward it, ease λ ≈ 2.4 (main camera damping). Leave → ease back. |
| **Focus dolly** (S5) | Double-click / double-tap → shot built from the object's bounding sphere: distance = r × 3.2 (min .9m), FOV 34, offset toward the room's open side. Damping λ 2.2. Esc / ✕ returns. Rail shows `FOCUS`. |
| **Cursor pill** (S5) | `hud.pill('Vinyl Player', 'TURNTABLE')`; serif italic left half on cream, mono amber right half on dark glass. |
| **Reticle snap** (S2) | On hover the reticle shrinks to 30px and snaps (lerp) to the object's projected centre with a 35% pull. |
| **"Click to interact" chip** (S2) | First hover only, sits 22px right of the cursor, mono 10px caps, auto-hides after first click or 4s. Stored in `localStorage nook.interact.chip`. |
| **Scramble decode** | 0.5s + 0.02s × chars, glyphs `A–Z0–9·/#`. |
| **Grow-in** (S1) | scale-Y 0 → 1 or rising clip plane, stagger by distance (40ms/m), `power3.out` 1.2s. |
| **Drawer slide** (S5) | Z +0.35m in 1.2s `power3.out` with 4% overshoot, camera `power4.inOut` 1.2s. |
| **Foreground wipe** (S6) | Pole at 0.4–0.8m from lens crossing the frame in 0.5–0.7s, motion-blurred. |
| **Info card pop** (S1) | scale .9 → 1, opacity 0 → 1, 250ms `cubic-bezier(.34,1.56,.64,1)`; follows the projected point. |

## How to use this file in a part
1. Read the sample section(s) listed in the ROADMAP part.
2. Use the Recipes table for numbers. If a new sample-derived recipe is invented, **add it here**.
3. Don't ask the owner for the videos. If something truly isn't described here, pick the option most consistent with "Shared DNA" and note it in the part's "Leftovers".
