# nook.fm: cinematic lo-fi landing (REANIMATED v2, in progress)

A real-time 3D landing page (Three.js 0.160 + GSAP + Lenis + Web Audio). A character comes home, puts on headphones and sinks into the couch. Then the site opens into a scrollable experience with **hidden secret portals** that open the owner's other apps.

**Upgrade plan: see [`ROADMAP.md`](ROADMAP.md)** (12 parts plus a status board) and [`SAMPLES.md`](SAMPLES.md) (the reference-video bible). Any AI can continue by being told "next part". **Next = Part 8: Project City.** Parts 4–5 are preserved from the live Vibes deployment; Parts 6–7 are now implemented.

## Current project layout
The working static experience lives in `public/experience/`. The Next.js root forwards to `/experience/index.html` and preserves query flags. Source ES modules remain editable in `public/experience/js/`; the package scripts bundle them into `bundle.js` for self-contained delivery with no runtime CDN dependency. The deployed Parts 1–5 source, including Catalog and Shelf, was restored from `vanguard-psi-red.vercel.app/experience/` rather than replaced with the older attachments.

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

## Not deployed
These are project files only. Nothing has been published from this session.
