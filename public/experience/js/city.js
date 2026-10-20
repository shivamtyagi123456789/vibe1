import * as THREE from 'three';
import { PORTALS } from './portals.config.js';
import { vnoise, SEG } from './aperture.js';
import { clamp, smooth } from './utils.js';

const apps = PORTALS.filter(p => p.enabled !== false);
const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
const pad = n => String(n).padStart(2, '0');

export function createCity({ scene, camera, canvas, launch }) {
  const section = document.querySelector('#city'), stage = section.querySelector('.city-stage');
  const group = new THREE.Group(); group.name = 'project-city'; group.position.set(55, 0, 0); group.visible = false; scene.add(group);
  const mat = color => new THREE.MeshBasicMaterial({ color });
  const stone = mat('#34343d'), pale = mat('#d3d1c6'), dark = mat('#13141c'), gold = mat('#dbbc79');
  function mesh(geometry, material, parent, x = 0, y = 0, z = 0) { const o = new THREE.Mesh(geometry, material); o.position.set(x, y, z); parent.add(o); return o; }
  const box = (w, h, d, m, p, x, y, z) => mesh(new THREE.BoxGeometry(w, h, d), m, p, x, y, z);
  const plot = mesh(new THREE.CylinderGeometry(5.3, 5.5, .35, 96), dark, group, 0, -.2, 0);
  const rim = mesh(new THREE.TorusGeometry(5.32, .018, 6, 96), gold, group, 0, -.015, 0); rim.rotation.x = Math.PI / 2;
  const road = mesh(new THREE.RingGeometry(2.55, 3.1, 64), mat('#292a33'), group, 0, .005, 0); road.rotation.x = -Math.PI / 2;
  const buildings = apps.map((app, i) => {
    const root = new THREE.Group(), body = new THREE.Group(); group.add(root); root.add(body);
    const a = i / apps.length * Math.PI * 2 - Math.PI / 2;
    root.position.set(Math.cos(a) * 3.6, 0, Math.sin(a) * 3.6); root.rotation.y = -a;
    const tint = mat(app.color), wall = mat(new THREE.Color(app.color).multiplyScalar(.44));
    box(1.45, .12, 1.4, stone, body, 0, .06, 0);
    if (app.category === 'PLATFORM') {
      box(1.15, 1.05, .95, wall, body, 0, .65, 0);
      [-.57, .57].forEach(x => { box(.33, 1.75, .38, tint, body, x, .94, .4); for (let n = 0; n < 3; n++) box(.08, .15, .42, pale, body, x + (n - 1) * .12, 1.85, .4); });
    } else if (app.category === 'ARCHIVE') {
      for (let j = 0; j < 5; j++) box(1.12 - j * .09, .36, .9, j % 2 ? wall : tint, body, j % 2 ? .17 : -.1, .3 + j * .4, 0);
    } else if (app.category === 'TIMETABLE') {
      box(1.1, .65, 1.05, wall, body, 0, .45, 0);
      box(.45, 1.9, .48, tint, body, 0, 1.1, 0);
      const clock = mesh(new THREE.CircleGeometry(.16, 24), pale, body, 0, 1.72, .247);
      box(.025, .12, .02, dark, body, 0, 1.76, .26); box(.1, .025, .02, dark, body, .04, 1.72, .26);
      mesh(new THREE.ConeGeometry(.4, .45, 4), wall, body, 0, 2.22, 0).rotation.y = Math.PI / 4;
    } else if (app.category === 'DASHBOARD') {
      [0, 1, 2].forEach(j => box(.48, 1.05 + j * .55, .85, j === 1 ? tint : wall, body, (j - 1) * .45, .65 + j * .275, 0));
    } else if (app.category === 'PRESENTATION') {
      box(1.1, 1.25, .7, wall, body, 0, .75, 0);
      ['#dc5961', '#dbbc79', '#72bbae'].forEach((c, j) => mesh(new THREE.CircleGeometry(.13, 20), mat(c), body, 0, 1.1 - j * .32, .36));
    } else if (app.category === 'ORIGINAL') {
      mesh(new THREE.CylinderGeometry(.63, .68, 1.2, 32), wall, body, 0, .75, 0);
      mesh(new THREE.ConeGeometry(.77, .65, 32), tint, body, 0, 1.65, 0);
    } else {
      box(.9, .85, .9, wall, body, 0, .55, 0);
      mesh(new THREE.IcosahedronGeometry(.58, 0), tint, body, 0, 1.45, 0);
    }
    if (!['PRESENTATION', 'TIMETABLE'].includes(app.category)) for (let r = 0; r < 3; r++) for (let c = 0; c < 3; c++) box(.12, .13, .025, pale, body, (c - 1) * .3, .45 + r * .32, .54);
    const ring = mesh(new THREE.RingGeometry(.88, .93, 48), tint, root, 0, .025, 0); ring.rotation.x = -Math.PI / 2;
    body.traverse(o => { if (o.isMesh) o.userData.cityIndex = i; });
    return { root, body, ring, app };
  });
  let selected = 0, hovered = -1, live = false, growth = 0, elapsed = 0, pointerDown = null;
  const ray = new THREE.Raycaster(), pointer = new THREE.Vector2(), focus = new THREE.Vector3(), projected = new THREE.Vector3();
  const list = section.querySelector('.city-models'), card = section.querySelector('.city-card'), link = section.querySelector('.city-open');
  const buttons = apps.map((app, i) => {
    const b = document.createElement('button'); b.type = 'button'; b.textContent = pad(i + 1); b.setAttribute('aria-label', `Select building: ${app.title}`); b.style.setProperty('--model-color', app.color);
    b.addEventListener('click', () => select(i)); list.appendChild(b); return b;
  });
  function showCard(i) {
    const app = apps[i]; card.style.setProperty('--model-color', app.color); card.style.setProperty('--cover-color', app.cover?.[0] || '#17131e');
    card.querySelector('h3').textContent = app.title; card.querySelector('.city-category').textContent = `${pad(i + 1)} / ${app.category}`;
    card.querySelector('.city-host').textContent = new URL(app.url).host; card.querySelector('.city-cover span').textContent = pad(i + 1);
  }
  function select(i) {
    selected = (i + apps.length) % apps.length; showCard(selected);
    buttons.forEach((b, n) => b.setAttribute('aria-pressed', String(n === selected)));
    const app = apps[selected]; link.href = app.url; link.target = app.newTab ? '_blank' : '_self'; link.rel = 'noopener noreferrer';
    link.setAttribute('aria-label', `Open the model: ${app.title}`);
    section.querySelector('.city-index').textContent = `${pad(selected + 1)} | ${pad(apps.length)} MODELS`;
  }
  section.querySelector('[data-city=prev]').addEventListener('click', () => select(selected - 1));
  section.querySelector('[data-city=next]').addEventListener('click', () => select(selected + 1));
  link.addEventListener('click', e => launch(apps[selected].id, e));
  const hoverLink = document.createElement('a'); hoverLink.className = 'city-hover-link'; hoverLink.tabIndex = -1; hoverLink.textContent = 'Enter building →'; stage.appendChild(hoverLink);
  hoverLink.addEventListener('click', e => { select(hovered < 0 ? selected : hovered); launch(apps[selected].id, e); });
  function hit(e) { pointer.set(e.clientX / innerWidth * 2 - 1, 1 - e.clientY / innerHeight * 2); ray.setFromCamera(pointer, camera); return ray.intersectObjects(buildings.map(b => b.body), true)[0]?.object.userData.cityIndex ?? -1; }
  window.addEventListener('pointermove', e => {
    if (!live || e.target.closest('button,a,.city-card')) return;
    const next = hit(e); if (next === hovered) return; hovered = next;
    stage.classList.toggle('model-hover', hovered >= 0);
    if (hovered >= 0) { showCard(hovered); hoverLink.href = apps[hovered].url; hoverLink.target = apps[hovered].newTab ? '_blank' : '_self'; hoverLink.rel = 'noopener noreferrer'; }
    else showCard(selected);
  }, { passive: true });
  window.addEventListener('pointerdown', e => { pointerDown = live && !e.target.closest('button,a,.city-card') ? { x: e.clientX, y: e.clientY, index: hit(e) } : null; }, { passive: true });
  window.addEventListener('pointerup', e => { if (!document.body.classList.contains('transition-running') && pointerDown && pointerDown.index >= 0 && Math.hypot(e.clientX - pointerDown.x, e.clientY - pointerDown.y) < 8) { select(pointerDown.index); if (apps[selected].newTab) window.open(apps[selected].url, '_blank', 'noopener,noreferrer'); launch(apps[selected].id, e); } pointerDown = null; }, { passive: true });
  select(0);

  const contour = section.querySelector('.city-contours'), ctx = contour.getContext('2d'); let lastTopo = -1;
  function drawContours(time) {
    const w = innerWidth, h = innerHeight, cell = 22, nx = Math.ceil(w / cell) + 1, ny = Math.ceil(h / cell) + 1;
    if (contour.width !== w || contour.height !== h) { contour.width = w; contour.height = h; }
    const values = new Float32Array(nx * ny), cx = w * .5, cy = h * .55, radius = Math.min(w, h) * .36;
    for (let j = 0; j < ny; j++) for (let i = 0; i < nx; i++) values[j * nx + i] = Math.hypot(i * cell - cx, j * cell - cy) / 23 + vnoise(i * .08 + time * .01, j * .08) * 3;
    ctx.clearRect(0, 0, w, h); ctx.strokeStyle = `rgba(170,144,144,${0.2 + (window.nookAudio?.bands.mid || 0) * 0.5})`; ctx.lineWidth = .7; ctx.beginPath();
    for (let j = 0; j < ny - 1; j++) for (let i = 0; i < nx - 1; i++) {
      if (Math.hypot(i * cell - cx, j * cell - cy) < radius) continue;
      const k = j * nx + i, a = values[k], b = values[k + 1], c = values[k + nx + 1], d = values[k + nx];
      for (let l = Math.ceil(Math.min(a,b,c,d)); l < Math.max(a,b,c,d); l++) {
        const edges = SEG[(a > l ? 8 : 0) | (b > l ? 4 : 0) | (c > l ? 2 : 0) | (d > l ? 1 : 0)];
        edges.forEach((edge,n) => { let x = i * cell, y = j * cell;
          if (edge === 0) x += (l-a)/(b-a)*cell;
          if (edge === 1) { x += cell; y += (l-b)/(c-b)*cell; }
          if (edge === 2) { x += (l-d)/(c-d)*cell; y += cell; }
          if (edge === 3) y += (l-a)/(d-a)*cell;
          if (n % 2) ctx.lineTo(x,y); else ctx.moveTo(x,y);
        });
      }
    }
    ctx.stroke();
  }
  return {
    group, select,
    apply(goal, progress) {
      const tilt = reduced ? 1 : smooth(clamp(progress * 3, 0, 1));
      const b = buildings[selected]; focus.copy(b.root.position).multiplyScalar(.18);
      goal.p.set(55 + 7 * tilt + focus.x, 17 - 7 * tilt, 9 * tilt + focus.z);
      goal.l.set(55 + focus.x, .4, focus.z); goal.f = innerWidth < 600 ? 88 : 48;
    },
    update(dt, on) {
      if (on !== live) { live = on; group.visible = on; section.classList.toggle('city-live', on); document.body.classList.toggle('city-active', on); if (!on) { growth = 0; hovered = -1; stage.classList.remove('model-hover'); } }
      if (!live) return;
      if (hovered >= 0 && innerWidth > 700) {
        projected.copy(buildings[hovered].root.position).add(group.position); projected.y = 2.5; projected.project(camera);
        card.style.left = `${clamp((projected.x * .5 + .5) * innerWidth - 130, 35, innerWidth - 295)}px`;
        card.style.top = `${clamp((-projected.y * .5 + .5) * innerHeight - 110, 90, innerHeight - 240)}px`;
        card.style.right = 'auto'; card.style.bottom = 'auto';
      } else { card.style.left = ''; card.style.top = ''; card.style.right = ''; card.style.bottom = ''; }
      elapsed += dt; growth = reduced ? 3 : growth + dt;
      buildings.forEach((b, i) => { const y = smooth(clamp((growth - i * .09) / .8, 0, 1)); b.body.scale.y = Math.max(.001, y); b.ring.material.opacity = 1; b.ring.visible = i === selected || i === hovered; b.body.position.y = i === hovered ? .12 : 0; });
      if (elapsed - lastTopo > .1) { drawContours(reduced ? 0 : elapsed); lastTopo = elapsed; }
    },
    get state() { return { selected, hovered, live, buildings: buildings.length }; },
  };
}
