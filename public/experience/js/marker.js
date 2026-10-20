import * as THREE from 'three';
import { clamp, SmoothDamp } from './utils.js';

const KEY = 'vibes.marker.guestbook.v1';
const MAX_STROKES = 100;

export function createMarker({ audio, onDrawing = () => {} } = {}) {
  const board = document.querySelector('.marker-board');
  if (!board) return null;
  const ink = board.querySelector('.marker-ink'), g = ink.getContext('2d');
  const objectCanvas = board.querySelector('.marker-object');
  const status = board.querySelector('.marker-status');
  const pen = board.querySelector('[data-marker="pen"]');
  const eraser = board.querySelector('[data-marker="eraser"]');
  const done = board.querySelector('[data-marker="done"]');
  const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
  let strokes = [], tool = null, drawing = null, pointerId = null;
  let w = 1, h = 1, live = false, saveTimer, lastPoint = null;
  let renderer, model, holder, modelScene, modelCamera, hovering = false;
  const cursor = { x: 0, y: 0 }, follower = { x: 0, y: 0 };
  const spring = new SmoothDamp(2);
  function message(text) { status.textContent = text; }
  function validPoint(p) { return Array.isArray(p) && p.length === 3 && p.every(Number.isFinite) && p[0] >= 0 && p[0] <= 1 && p[1] >= 0 && p[1] <= 1 && p[2] > 0 && p[2] <= 30; }
  try {
    const data = JSON.parse(localStorage.getItem(KEY) || 'null');
    if (data?.version === 1 && Array.isArray(data.strokes)) {
      strokes = data.strokes.slice(-MAX_STROKES).filter(s => ['pen', 'eraser'].includes(s.tool) && Array.isArray(s.points) && s.points.length <= 1200 && s.points.every(validPoint));
      if (strokes.length) message('YOUR DOODLE, RIGHT WHERE YOU LEFT IT');
    }
  } catch { message('DRAW HERE · STORAGE UNAVAILABLE'); }
  function save() {
    clearTimeout(saveTimer);
    try { localStorage.setItem(KEY, JSON.stringify({ version: 1, strokes })); message('SAVED ON THIS DEVICE'); }
    catch { message('DRAWING KEPT OPEN · COULD NOT SAVE'); }
  }
  function drawStroke(s) {
    if (s.circle) s.points = wordPoints();
    if (!s.points.length) return;
    g.globalCompositeOperation = s.tool === 'eraser' ? 'destination-out' : 'source-over';
    g.strokeStyle = '#ff4f7b'; g.fillStyle = '#ff4f7b'; g.lineCap = 'round'; g.lineJoin = 'round';
    const scale = Math.min(w / 620, 1.3);
    const first = s.points[0];
    g.beginPath(); g.arc(first[0] * w, first[1] * h, first[2] * scale / 2, 0, Math.PI * 2); g.fill();
    for (let i = 1; i < s.points.length; i++) {
      const a = s.points[i - 1], b = s.points[i];
      g.lineWidth = (a[2] + b[2]) / 2 * scale;
      g.beginPath(); g.moveTo(a[0] * w, a[1] * h); g.lineTo(b[0] * w, b[1] * h); g.stroke();
    }
    g.globalCompositeOperation = 'source-over';
  }
  function redraw() { g.clearRect(0, 0, w, h); strokes.forEach(drawStroke); if (drawing) drawStroke(drawing); }
  function resize() {
    w = board.clientWidth; h = board.clientHeight;
    const dpr = Math.min(devicePixelRatio || 1, 2);
    ink.width = Math.round(w * dpr); ink.height = Math.round(h * dpr);
    g.setTransform(dpr, 0, 0, dpr, 0, 0); redraw();
  }
  new ResizeObserver(resize).observe(board);
  try {
    renderer = new THREE.WebGLRenderer({ canvas: objectCanvas, alpha: true, antialias: true });
    renderer.setPixelRatio(Math.min(devicePixelRatio || 1, 1.5)); renderer.setSize(130, 180, false);
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    modelScene = new THREE.Scene(); modelCamera = new THREE.PerspectiveCamera(32, 130 / 180, .1, 20); modelCamera.position.set(0, .1, 5);
    modelScene.add(new THREE.HemisphereLight('#fff3df', '#34213e', 3));
    const light = new THREE.DirectionalLight('#fff3df', 3); light.position.set(2, 3, 5); modelScene.add(light);
    model = new THREE.Group();
    const cream = new THREE.MeshStandardMaterial({ color: '#fff3df', roughness: .38 });
    const pink = new THREE.MeshStandardMaterial({ color: '#ff4f7b', roughness: .45 });
    const dark = new THREE.MeshStandardMaterial({ color: '#191221', roughness: .6 });
    const cylinder = (r1, r2, height, material, y) => { const m = new THREE.Mesh(new THREE.CylinderGeometry(r1, r2, height, 20), material); m.position.y = y; model.add(m); return m; };
    cylinder(.115, .115, 1.35, cream, .12); cylinder(.123, .123, .43, pink, .98);
    cylinder(.118, .118, .08, dark, -.56); cylinder(.045, .1, .22, dark, -.71);
    cylinder(.038, .025, .14, pink, -.89);
    const band = cylinder(.118, .118, .18, pink, .25); band.rotation.z = 0;
    const clip = new THREE.Mesh(new THREE.BoxGeometry(.055, .35, .035), pink); clip.position.set(.105, .92, .08); model.add(clip);
    model.rotation.set(.2, .1, -.4); modelScene.add(model);
    holder = new THREE.Mesh(new THREE.CylinderGeometry(.22, .28, .32, 24, 1, true), new THREE.MeshStandardMaterial({ color: '#5f445b', roughness: .8, side: THREE.DoubleSide }));
    holder.position.set(-.18, -.95, 0); modelScene.add(holder);
  } catch { objectCanvas.hidden = true; }
  function finish() {
    if (!drawing) return;
    strokes.push(drawing); strokes = strokes.slice(-MAX_STROKES); drawing = null; lastPoint = null;
    if (pointerId !== null && ink.hasPointerCapture(pointerId)) ink.releasePointerCapture(pointerId);
    pointerId = null; document.documentElement.classList.remove('marker-drawing'); onDrawing(false); redraw(); save();
  }
  function select(next) {
    finish(); tool = next;
    board.classList.toggle('marker-active', !!tool);
    board.classList.toggle('marker-erasing', tool === 'eraser');
    pen.setAttribute('aria-pressed', String(tool === 'pen')); eraser.setAttribute('aria-pressed', String(tool === 'eraser'));
    pen.lastChild.textContent = tool === 'pen' ? ' Marker in hand' : ' Pick up the marker';
    done.hidden = !tool;
    if (!tool) hovering = false;
    message(tool ? (tool === 'pen' ? 'DRAG TO DRAW · TAP “WAITING” TO CIRCLE' : 'DRAG TO ERASE · ESC TO PUT DOWN') : 'YOUR LOCAL GUESTBOOK');
    audio?.sfx('click', { v: .35 });
  }
  board.querySelectorAll('[data-marker]').forEach(button => button.addEventListener('click', () => {
    const action = button.dataset.marker;
    if (action === 'pen' || action === 'eraser') { select(tool === action ? null : action); return; }
    if (action === 'done') { select(null); pen.focus({ preventScroll: true }); return; }
    finish();
    if (action === 'circle') { drawing = { tool: 'pen', circle: true, points: [] }; circleWord(); finish(); return; }
    if (action === 'undo') strokes.pop();
    if (action === 'clear') strokes = [];
    redraw(); save();
  }));
  function position(e) { const r = board.getBoundingClientRect(); return { x: clamp(e.clientX - r.left, 0, w), y: clamp(e.clientY - r.top, 0, h), t: performance.now(), pressure: e.pointerType === 'pen' ? e.pressure : .5 }; }
  function wordPoints() {
    const r = board.getBoundingClientRect(), word = board.querySelector('[data-marker-word]').getBoundingClientRect();
    const cx = word.left - r.left + word.width / 2, cy = word.top - r.top + word.height / 2;
    const rx = word.width / 2 + 10, ry = word.height / 2 + 7;
    return Array.from({ length: 85 }, (_, i) => { const a = i / 80 * Math.PI * 2 - .35; return [clamp((cx + Math.cos(a) * rx) / w, 0, 1), clamp((cy + Math.sin(a) * ry) / h, 0, 1), 3 + .6 * Math.sin(a * 3)]; });
  }
  function circleWord() { drawing.points = wordPoints(); redraw(); }
  let circleTimer;
  ink.addEventListener('pointerdown', e => {
    if (!tool || e.button !== 0 || drawing) return;
    e.preventDefault(); hovering = true; pointerId = e.pointerId; ink.setPointerCapture(pointerId);
    const p = position(e); cursor.x = p.x; cursor.y = p.y;
    drawing = { tool, points: [[p.x / w, p.y / h, tool === 'eraser' ? 28 : 4]] }; lastPoint = p;
    const word = board.querySelector('[data-marker-word]').getBoundingClientRect();
    drawing.circle = tool === 'pen' && e.clientX >= word.left - 12 && e.clientX <= word.right + 12 && e.clientY >= word.top - 10 && e.clientY <= word.bottom + 10;
    if (drawing.circle) circleTimer = setTimeout(() => { if (drawing?.circle) circleWord(); }, reduce ? 0 : 200);
    document.documentElement.classList.add('marker-drawing'); onDrawing(true); redraw();
  });
  ink.addEventListener('pointermove', e => {
    const p = position(e); cursor.x = p.x; cursor.y = p.y; hovering = true;
    if (!drawing || e.pointerId !== pointerId || drawing.circle) return;
    const distance = Math.hypot(p.x - lastPoint.x, p.y - lastPoint.y);
    if (distance < 1.5 || drawing.points.length >= 1200) return;
    const speed = distance / Math.max(1, p.t - lastPoint.t);
    const width = tool === 'eraser' ? 28 : clamp(5.2 - speed * 1.3, 2, 5.2) * (.65 + p.pressure * .7);
    drawing.points.push([p.x / w, p.y / h, width]); lastPoint = p; redraw();
  });
  ink.addEventListener('pointerup', () => { clearTimeout(circleTimer); if (drawing?.circle) circleWord(); finish(); });
  ink.addEventListener('pointercancel', () => { clearTimeout(circleTimer); finish(); });
  ink.addEventListener('lostpointercapture', () => { if (drawing) finish(); });
  ink.addEventListener('pointerleave', () => { if (!drawing) hovering = false; });
  window.addEventListener('keydown', e => { if (e.key === 'Escape' && tool) { select(null); pen.focus({ preventScroll: true }); } });
  window.addEventListener('pagehide', () => { finish(); });
  function update(dt, t, isLive) {
    if (!isLive && live && tool) select(null);
    live = isLive;
    if (!live || !renderer) return;
    const dock = pen.getBoundingClientRect(), r = board.getBoundingClientRect();
    const x = tool && hovering ? cursor.x : dock.left - r.left + 25;
    const y = tool && hovering ? cursor.y : dock.top - r.top - 45;
    follower.x = reduce ? x : spring.step(follower.x, x, 0, .12, dt);
    follower.y = reduce ? y : spring.step(follower.y, y, 1, .12, dt);
    objectCanvas.style.transform = `translate3d(${follower.x - 65}px,${follower.y - 130}px,0)`;
    model.rotation.z = tool ? -.55 : -.22; model.rotation.x = tool ? .35 : .1;
    model.position.y = tool && !reduce ? Math.sin(t * 2) * .025 : 0;
    holder.visible = !tool;
    model.visible = tool !== 'eraser'; renderer.render(modelScene, modelCamera);
  }
  resize();
  return { update, putDown: () => select(null), get state() { return { tool, strokes: strokes.length, drawing: !!drawing, live }; } };
}
