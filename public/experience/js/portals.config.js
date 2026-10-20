/* =========================================================
   nook.fm — SECRET PORTALS CONFIG  (the only file you need to edit)
   ---------------------------------------------------------
   Each portal is a hidden hotspot glued to a real object in the
   3D room. Visitors discover it by moving the cursor near the
   object (or pressing  S  to "scan" the room). Clicking it opens
   a card; "Enter" plays a warp transition and opens the URL.

   The upcoming showcase parts (Catalog drawers, Shelf, Project City,
   Logbook) ALSO read this list, so every app only lives here.

   - `url`      deployed link
   - `newTab`   true → new tab, false → warp then same-tab navigation
   - `anchor`   world position [x, y, z] (see ANCHORS or ?debug=portals)
                OR an object name (Part 2): 'cat' 'neon' 'turntable' 'pendant'
                'curtains' 'bookshelf' 'mug' 'window' 'speakers' 'door' 'plantL'
                'plantR' 'floorLamp' 'tableLamp' 'posterA/B/C' 'phones'. Named
                anchors follow the object; `fallback: [x,y,z]` if the name is unknown.
   - `enabled`  false hides a portal without deleting it
   - `category` short UPPERCASE label used by the cursor pill / catalog
   Part 4 (The Catalog) also reads, all optional:
   - `format` `stack` `year` `role`  → the drawer's side-panel specs
   - `cover`  [background, pattern, text] colours of the procedural record sleeve
   - `hint`   shown on the sealed "???" drawer until the secret is found in the room
   (years / stacks below are best guesses: edit freely)
   ========================================================= */

export const ANCHORS = {
  neon:      [-2.1, 2.35, -4.4],   // pink "nook" neon sign
  turntable: [5.05, 0.8, -4.0],   // record player
  posterA:   [4.35, 2.3, -4.42],  // big poster right of window
  posterB:   [5.4, 2.05, -4.42],  // small poster far right
  posterC:   [-0.55, 2.0, -4.42], // poster above side table
  window:    [1.3, 2.1, -4.6],   // rainy city through the window
  cat:       [2.62, 0.78, -3.75], // the sleepy cat on the couch arm
  bookshelf: [6.6, 1.45, -2.4],   // bookshelf on the right wall
  mug:       [1.58, 0.56, -1.9],  // steaming mug on the coffee table
  door:      [-4.2, 1.2, -4.5],   // front door / hallway
  lamp:      [-0.7, 0.9, -3.82],  // little table lamp next to the couch
  phones:    [0.75, 1.95, -3.6],  // the character's headphones (moves with him)
};

export const PORTALS = [
  {
    id: 'window',
    anchor: ANCHORS.window,
    title: 'Beyond the Fort',
    tagline: 'Gwalior heritage events & verified guides, crowd-aware.',
    tags: ['heritage', 'tourism', 'srs'],
    category: 'PLATFORM',
    url: 'https://caffiene-coders-beyond-the-fort-ver.vercel.app',
    color: '#ffc56b',
    icon: '♜',
    newTab: true,
    enabled: true,
    format: 'Web platform', stack: 'React · Vite · Vercel', year: '2025', role: 'Team build · front-end',
    cover: ['#2a1b0e', '#ffc56b', '#fff3df'], hint: 'Look out of the rainy window. The fort is out there somewhere.',
  },
  {
    id: 'neon',
    anchor: ANCHORS.neon,
    title: 'ERRATA',
    tagline: 'The Failing Archive: a glitchy collection of beautiful mistakes.',
    tags: ['archive', 'experimental'],
    category: 'ARCHIVE',
    url: 'https://dist-one-lovat-39.vercel.app',
    color: '#ff4f7b',
    icon: '✦',
    newTab: true,
    enabled: true,
    format: 'Web archive', stack: 'Vite · JavaScript · CSS', year: '2025', role: 'Solo · design + code',
    cover: ['#1a0a12', '#ff4f7b', '#fff3df'], hint: 'Something pink hums on the wall.',
  },
  {
    id: 'bookshelf',
    anchor: ANCHORS.bookshelf,
    title: 'Amon',
    tagline: 'A timetable that is honest about today: classes, cancellations, notes.',
    tags: ['timetable', 'students', 'live'],
    category: 'TIMETABLE',
    url: 'https://glistening-pika-308184.netlify.app',
    color: '#5fd4cf',
    icon: '❦',
    newTab: true,
    enabled: true,
    format: 'Live timetable', stack: 'HTML · JavaScript · Netlify', year: '2025', role: 'Solo · product + build',
    cover: ['#0e2626', '#5fd4cf', '#fff3df'], hint: 'Every good timetable starts on the bookshelf.',
  },
  {
    id: 'posterA',
    anchor: ANCHORS.posterA,
    title: 'UniDash',
    tagline: 'One dashboard for uni life.',
    tags: ['dashboard', 'web app'],
    category: 'DASHBOARD',
    url: 'https://unidash-eta.vercel.app',
    color: '#c6a2ff',
    icon: '▣',
    newTab: true,
    enabled: true,
    format: 'Dashboard', stack: 'Web app · Vercel', year: '2025', role: 'Solo',
    cover: ['#1c1430', '#c6a2ff', '#ffc56b'], hint: 'The big poster to the right of the window.',
  },
  {
    id: 'mug',
    anchor: ANCHORS.mug,
    title: 'Traffic Light',
    tagline: 'Red, amber, green: the presentation, built for the web.',
    tags: ['presentation', 'slides'],
    category: 'PRESENTATION',
    url: 'https://trafficlightppt.vercel.app',
    color: '#ff7a95',
    icon: '◍',
    newTab: true,
    enabled: true,
    format: 'Presentation', stack: 'HTML slides · Vercel', year: '2024', role: 'Presenter · build',
    cover: ['#2a0f16', '#ff7a95', '#5fd4cf'], hint: 'Still warm, on the coffee table.',
  },
  {
    id: 'turntable',
    anchor: 'turntable',
    fallback: [5.05, 1.6, -4.0],
    title: 'nook v1',
    tagline: 'Drop the needle on the original room, before the reanimation.',
    tags: ['three.js', 'web audio'],
    category: 'ORIGINAL',
    url: 'https://nook-six-pearl.vercel.app',
    color: '#f0a35e',
    icon: '◉',
    newTab: true,
    enabled: true,
    format: 'Interactive room', stack: 'Three.js · Web Audio', year: '2025', role: 'Solo · everything',
    cover: ['#20140a', '#f0a35e', '#ff4f7b'], hint: 'Drop the needle on the record player.',
  },
  {
    id: 'lamp',
    anchor: ANCHORS.lamp,
    title: 'Lily',
    tagline: 'A little light in the corner, still under wraps.',
    tags: ['secret'],
    category: 'MYSTERY',
    url: 'https://magnificent-lily-ef7239.netlify.app',
    color: '#ffb45c',
    icon: '✺',
    newTab: true,
    enabled: true,
    format: 'Mystery', stack: 'Under wraps', year: '—', role: '—',
    cover: ['#1e1508', '#ffb45c', '#fff3df'], hint: 'A little light in the corner, next to the couch.',
  },
  /* ---- spare slots: set enabled:true + url when you ship a new app ---- */
  { id: 'cat', anchor: 'cat', fallback: ANCHORS.cat, title: 'Purr Bot', tagline: 'Psst… the cat knows a secret.', tags: ['soon'], category: 'SOON', url: 'https://vercel.com', color: '#f0a35e', icon: '🐾', newTab: true, enabled: false },
  { id: 'posterC', anchor: ANCHORS.posterC, title: 'Sketchbook', tagline: 'Small creative-coding sketches.', tags: ['soon'], category: 'SOON', url: 'https://vercel.com', color: '#5fd4cf', icon: '✎', newTab: true, enabled: false },
  { id: 'door', anchor: ANCHORS.door, title: 'The Exit', tagline: 'Leave the nook, say hi.', tags: ['contact'], category: 'CONTACT', url: 'https://vercel.com', color: '#e7b98a', icon: '⌂', newTab: true, enabled: false },
];

/* Tuning knobs for discovery */
export const PORTAL_SETTINGS = {
  revealRadius: 150,   // px — how close the cursor must get before a hotspot shimmers in
  scanKey: 's',        // press to sonar-scan the room
  scanDuration: 2.8,   // seconds hotspots stay visible after a scan
  secretWord: 'nook',  // type this anywhere to reveal ALL portals for good
  storageKey: 'nook.portals.found',
};
