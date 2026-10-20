# nook.fm: cinematic lo-fi landing (REANIMATED v2, Parts 1–12 implemented)

A real-time 3D landing page (Three.js 0.160 + GSAP + Lenis + Web Audio). A character comes home, puts on headphones and sinks into the couch. Then the site opens into a scrollable experience with **hidden secret portals** that open the owner's other apps.

**Upgrade plan: see [`ROADMAP.md`](ROADMAP.md)** (12 parts plus a status board) and [`SAMPLES.md`](SAMPLES.md) (the reference-video bible). Any AI can continue by being told "next part". **Parts 1–12 are implemented.** Parts 4–5 are preserved from the live Vibes deployment. Remaining launch validation: final-domain Lighthouse targets, social unfurls and physical-device checks; these are not claimed complete.

## Current project layout
The working static experience lives in `public/experience/`. The Next.js root forwards to `/experience/index.html` and preserves query flags. Source ES modules remain editable in `public/experience/js/`; the package scripts bundle them into `bundle.js` for self-contained delivery with no runtime CDN dependency. The deployed Parts 1–5 source, including Catalog and Shelf, was restored from `vanguard-psi-red.vercel.app/experience/` rather than replaced with the older attachments.

## Parts 11–12 delivered
- Listening console: three procedural radio stations (Midnight study, Rainy jazz, Daydream), 3-second crossfades, gesture-gated audio, volume and tape warmth/wow/crackle. Low/mid/high FFT bands drive the speakers, neon, string lights, bloom and City contour brightness; no fabricated beat-driven levels are used for these effects.
- Local-clock daylight; rain, storm, snow, clear-night shooting stars and fog. Precipitation, daylight and ambience blend between modes. Automatic thunder only occurs in storm mode (the original intro retains its scripted strike).
- Utilities: **A** for achievements, **backtick** for an allowlisted terminal, Konami sequence for pixel rendering/square-wave keys, all-portals bookshelf unlock with a quiet listening-alcove diorama, and keyboard-pausable credits. Achievements and player settings are per visit; only pre-existing device-local discoveries/doodles persist.
- Accessibility/resilience: native utility dialogs with focus restoration, portal-card tab containment, stronger muted-text contrast, corrected split-heading semantics, skip-to-directory link, 2D renderer-free mode and a server-rendered no-JavaScript project directory. Quality starts from hardware, reduced motion and save-data hints, then adapts to frame pacing.
- Launch metadata: generated social artwork, static-page and Next OG/Twitter fields, favicon, JSON-LD, safe `#portal=id` previews, and an optional `window.nookTrack(event, data)` hook (set or replace it to connect your analytics; no provider is required). `nook:track` custom events are also emitted for utility activity.
- Verified at 1280×800, 639×638 and 390×844 with graphics enabled: radio play, station/volume/warmth, five weather modes, badges, bookshelf unlock, terminal, Konami, deep links, credits, no-WebGL mode and the text directory. Production build, standalone TypeScript and whitespace checks pass. Axe WCAG 2/2.1 A/AA checks cover the mobile room and utility dialog. Desktop development-preview TTFB/FCP/LCP: 10.8/452/452ms; mobile: 15.6/680/680ms; reported CLS 0. These are browser lab measurements, not a Lighthouse score or physical-GPU result.

## Parts 8–10 delivered
- Project City: seven category-specific procedural buildings on a circular plot, shared aperture contours, staggered growth, reversible top-down/angled camera, raycast cover/host previews, accessible model selection and wrapping Previous/Next navigation. Buildings and links use the shared portal discovery engine.
- Logbook: cream editorial chapter with a seven-project table, host/stack/year metadata, SVG route draws and procedural cover reveals. A five-role crew timeline has a moving red dot. Mobile stacks remain visible under project names; scrolling upward fades back to the night room.
- Transitions: a final ShaderPass with warp, vinyl, rain, glitch, ink, iris, drawer and canal styles. Per-portal styles live in `portals.config.js`; drawers use drawer, city uses iris, and the Marker’s Follow the ink link uses ink. Native new-tab links remain intact; focus/visibility and session-scoped return state drive reverse transitions and welcome-back messages. Reduced motion uses a fade.
- Verified in graphics-enabled browsers at 1280×800, 639×638 and 390×844: model cycling, angled camera, building hover, table/cover reveals, crew timeline, live new-tab departure/return, all eight shader paths and reduced-motion fallback. Production build, standalone TypeScript check and whitespace checks pass. Physical touch hardware and representative GPU performance have not been measured.

## Parts 6–7 delivered
- Marker: procedural 3D pen/holder, spring cursor following, variable-width strokes, word circling, eraser/undo/clear, keyboard circle action, Esc and pointer-cancel cleanup, device-local vector saves.
- Canal: reversible window flight, foreground striped pole, procedural buildings and bridge, bobbing gondolas, lamps, stars, ripple water, mirrored geometry and low-tier color fallback, shared-config bridge portal.
- Browser checks: desktop 1280px and mobile viewport 390px. Physical touch hardware has not been tested. Production build and TypeScript validation pass.

## Entry points
| Path | What |
|---|---|
| `index.html` | The real site (aperture prologue → intro film → reveal) |
| `demo.html` | Feedback demo: skips the intro, shows portal coordinates, auto-scans |
| `index.html?t=17` | Skip the aperture and the intro |
| `?aperture=0` | Skip only the aperture prologue |
| `?quality=low\|med\|high` | Force a quality tier (dust count, light shafts, DOF) |
| `?debug=portals` | Show every hotspot and its xyz |
| `?freeze`, `?chapter=n` | Freeze the timeline / jump to a chapter |
| `?view=2d` | Skip WebGL entirely; keep content and utility directory |
| `/projects` | Lightweight, server-rendered directory; works without JavaScript |
| `#portal=neon` | Skip the intro and preview the ERRATA portal (all config IDs work) |
| `_test.html` | Console self-test for Parts 2+3 (reactions, pick grid, shafts, focus + DOF) |
| `_focus.html` | Opens the test page in focus mode on the turntable (for screenshots) |

## Completed
- Original 3D room, character, procedural music and scroll chapters (from https://nook-six-pearl.vercel.app)
- v1: Secret portals (10 hotspots, proximity reveal, `S` scan, cheat word `nook`, card plus warp)
- **v2 Part 1:** aperture prologue (topographic contours, void iris, room build-up, sky-to-room flight) and the cinematic HUD (scene tag, chapter rail, camera readout, reticle, cursor pill)
- **v2 Part 2:** living-room interaction. You can hover, click or tap 17 objects, each with its own reaction and synth sfx. There are a glow, corner brackets, the pill and a reticle snap. Dwelling 600ms hover-zooms toward an object; double-click or double-tap gives a focus dolly (Esc returns). A "Click to interact" chip shows the first time.
- **v2 Part 3:** light and air:
  - God-ray shafts for the moon, pendant and lamps
  - GPU dust (6k/3.5k/2k) that glows inside the beams and swirls around the cursor
  - A hero spotlight helper (`atmos.spot`)
  - BokehPass depth of field, only in focus mode
  - A warm lift/gamma/gain grade
  - Low-tier fallback

**Verified 2026-10-19** in a headless browser (desktop 1280 + mobile 390): Parts 1–3 render and work. `_test.html` now waits for `body.settled`, so its checks run against the live scene.

## Adding your apps
Edit **`js/portals.config.js`** only (title, url, color, anchor = xyz or an object name like `'cat'`).

## Storage
Only device-local browser storage, as requested in the roadmap. Existing portal/interaction preferences are preserved. Marker doodles use the versioned `vibes.marker.guestbook.v1` key; they are not shared publicly. No backend or database.

## Launch notes
- Publish from the top-right control in v0 when ready; no deployment was initiated in this session. The existing build script bundles the experience and builds Next.js; no third-party keys or database are needed.
- The root redirects to `/experience/index.html`. `/projects` provides a lightweight alternative. Share `/experience/index.html#portal=<id>` for individual previews, never an arbitrary destination URL.
- On the final production domain, check HTTPS response headers, favicon and social-card unfurls (including resolution of `/images/vibes-social.png`); use absolute production-domain OG image URLs if the target unfurl service requires them. Next metadata resolves its origin from Vercel deployment variables.
- Run production Lighthouse on a representative mobile profile: **performance 80+ and accessibility 95+ are targets, not measured results**. The workspace lacks a local Chrome audit binary, so these checks remain open. Axe checks and preview Web Vitals do not replace Lighthouse or assistive-technology testing.
- Check touch navigation, audio after device lock/unlock, a real midrange GPU, reduced-motion settings and the `?view=2d` path. Headless graphics rendering is not representative GPU-performance evidence.
- Optional analytics: assign `window.nookTrack = (event, data) => { ... }` without collecting sensitive input. Hook failures are isolated from navigation. Terminal commands never evaluate JavaScript.
