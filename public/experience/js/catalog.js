import * as THREE from 'three';
import { PORTALS } from './portals.config.js';
import { clamp, lerp, rng } from './utils.js';

const apps = PORTALS.filter(p => p.enabled !== false);
const pad = n => String(n).padStart(2, '0');
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
const material = color => new THREE.MeshStandardMaterial({ color, roughness: .64 });

function canvasTexture(draw, w = 512, h = 512) {
  const canvas = document.createElement('canvas'); canvas.width = w; canvas.height = h;
  draw(canvas.getContext('2d'), w, h);
  const texture = new THREE.CanvasTexture(canvas); texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
}

export function buildCatalogCabinet(parent) {
  const oakTexture = canvasTexture((g, w, h) => {
    const random = rng(404); g.fillStyle = '#9e693e'; g.fillRect(0, 0, w, h);
    for (let i = 0; i < 450; i++) {
      g.strokeStyle = `rgba(${random() > .5 ? '255,210,152' : '51,23,10'},${random() * .19})`;
      g.beginPath(); const y = random() * h; g.moveTo(0, y);
      g.bezierCurveTo(w * .3, y + random() * 15, w * .7, y - random() * 15, w, y); g.stroke();
    }
  });
  const oak = new THREE.MeshStandardMaterial({ map: oakTexture, roughness: .62 });
  const dark = material('#352016');
  const brass = new THREE.MeshStandardMaterial({ color: '#bf985e', metalness: .78, roughness: .35 });
  const box = (w, h, d, mat, x, y, z, root = parent) => {
    const mesh = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat);
    mesh.position.set(x, y, z); mesh.castShadow = true; mesh.receiveShadow = true; root.add(mesh); return mesh;
  };
  box(1.76, 1.38, .56, dark, 0, .75, 0);
  box(1.84, .08, .64, oak, 0, 1.46, .01);
  box(1.84, .09, .61, oak, 0, .09, .01);
  [-.86, 0, .86].forEach(x => box(.055, 1.3, .62, oak, x, .77, .02));
  const drawers = apps.map((app, i) => {
    const root = new THREE.Group(); root.position.set(i % 2 ? .43 : -.43, 1.28 - Math.floor(i / 2) * .325, .02); parent.add(root);
    const faceMat = oak.clone();
    const front = box(.79, .285, .07, faceMat, 0, 0, .315, root);
    box(.75, .035, .48, dark, 0, -.11, .04, root);
    [-.37, .37].forEach(x => box(.025, .2, .48, oak, x, 0, .04, root));
    const plateTexture = canvasTexture((g, w, h) => {
      g.fillStyle = '#d0ad72'; g.fillRect(0, 0, w, h);
      g.strokeStyle = '#70522d'; g.lineWidth = 5; g.strokeRect(6, 6, w - 12, h - 12);
      g.fillStyle = '#352016'; g.font = '500 29px monospace'; g.textAlign = 'center'; g.fillText(`${pad(i + 1)}  /  SEALED`, w / 2, 65);
    }, 512, 96);
    const plate = new THREE.Mesh(new THREE.PlaneGeometry(.55, .095), new THREE.MeshStandardMaterial({ map: plateTexture, roughness: .5 }));
    plate.position.set(0, .035, .353); root.add(plate);
    box(.23, .025, .035, brass, 0, -.055, .38, root);
    [-.115, .115].forEach(x => box(.025, .05, .035, brass, x, -.04, .37, root));
    const colors = app.cover || ['#20140a', app.color, '#fff3df'];
    const coverTexture = canvasTexture((g, w, h) => {
      g.fillStyle = colors[0]; g.fillRect(0, 0, w, h);
      g.strokeStyle = colors[1]; g.lineWidth = 8;
      for (let k = 0; k < 8; k++) { g.beginPath(); g.arc(w / 2, h * .42, 25 + k * 22, 0, Math.PI * 2); g.stroke(); }
      g.fillStyle = colors[2]; g.font = '32px Georgia'; g.textAlign = 'center'; g.fillText(app.title, w / 2, h * .87, w - 35);
      g.font = '16px monospace'; g.fillText(`${pad(i + 1)} / VIBES RECORDS`, w / 2, h * .95);
    });
    const sleeve = box(.57, .012, .43, new THREE.MeshStandardMaterial({ map: coverTexture, roughness: .7 }), -.04, .04, .06, root);
    const vinyl = new THREE.Mesh(new THREE.CylinderGeometry(.2, .2, .009, 40), material('#110e13'));
    vinyl.position.set(.05, .03, -.05); root.add(vinyl);
    const label = new THREE.Mesh(new THREE.CylinderGeometry(.065, .065, .011, 24), material(app.color));
    label.position.copy(vinyl.position); label.position.y += .006; root.add(label);
    root.traverse(o => { if (o.isMesh) o.userData.catalogIndex = i; });
    return { app, root, front, faceMat, plate, sleeve, vinyl, k: 0, hover: 0, center: new THREE.Vector3() };
  });
  return { parent, drawers };
}

export function createCatalog({ cabinet, camera, canvas, portals, hud, audio, onFocus, goto }) {
  const section = document.querySelector('#catalog');
  const list = section.querySelector('.catalog-list');
  section.querySelector('.catalog-note').innerHTML = `${pad(apps.length)} RECORDS · FIND THEIR SECRETS IN THE ROOM<br>Choose a drawer to take a closer look.`;
  const detail = document.createElement('aside'); detail.className = 'catalog-detail'; detail.hidden = true;
  detail.setAttribute('role', 'dialog'); detail.setAttribute('aria-modal', 'true'); detail.setAttribute('aria-labelledby', 'drawerTitle');
  document.body.append(detail);
  let active = false, selected = -1, hovered = -1, returnFocus = null, amount = 0, pending = -1;
  const ray = new THREE.Raycaster(), pointer = new THREE.Vector2(), center = new THREE.Vector3();
  let mouseX = 0, mouseY = 0;
  const buttons = cabinet.drawers.map((d, i) => {
    const button = document.createElement('button'); button.type = 'button'; button.dataset.index = i;
    button.addEventListener('pointerenter', () => hover(i)); button.addEventListener('pointerleave', () => hover(-1));
    button.addEventListener('focus', () => hover(i)); button.addEventListener('blur', () => hover(-1));
    button.addEventListener('click', () => open(i, button)); list.append(button); return button;
  });
  function refresh() {
    cabinet.drawers.forEach((d, i) => {
      const found = portals.isFound(d.app.id), title = found ? d.app.title : '???';
      buttons[i].innerHTML = `<span>${pad(i + 1)}</span><b>${esc(title)}</b><em>${found ? esc(d.app.category) : 'SEALED'}</em><i aria-hidden="true">→</i>`;
      buttons[i].setAttribute('aria-label', `Open drawer ${pad(i + 1)}: ${found ? d.app.title : 'undiscovered project'}`);
      buttons[i].setAttribute('aria-haspopup', 'dialog');
      if (d.found !== found) {
        d.found = found;
        const g = d.plate.material.map.image.getContext('2d'); g.fillStyle = '#d0ad72'; g.fillRect(8, 8, 496, 80);
        g.fillStyle = '#352016'; g.font = '500 27px monospace'; g.textAlign = 'center'; g.fillText(`${pad(i + 1)}  ${found ? d.app.title : '???'}`, 256, 63, 470); d.plate.material.map.needsUpdate = true;
      }
    });
  }
  refresh();
  function hover(i) {
    hovered = i;
    buttons.forEach((b, n) => b.classList.toggle('hovered', n === i));
    if (i >= 0 && active) hud.pill(portals.isFound(apps[i].id) ? apps[i].title : 'Sealed drawer', apps[i].category);
    else hud.hidePill();
  }
  function renderDetail() {
    const app = apps[selected], found = portals.isFound(app.id);
    detail.innerHTML = `<div class="cd-breadcrumb">THE CATALOG <span>/ DRAWER ${pad(selected + 1)} OF ${pad(apps.length)}</span></div>
      <button class="cd-close chip" type="button" aria-label="Close drawer">× <kbd>ESC</kbd> close drawer</button>
      <p class="eyebrow">${found ? esc(app.category) : 'AN UNDISCOVERED RECORD'}</p>
      <h2 id="drawerTitle">${found ? esc(app.title) : 'Some things<br><em>stay hidden.</em>'}</h2>
      <p class="cd-copy">${esc(found ? app.tagline : app.hint || 'Look around the room to uncover this record.')}</p>
      ${found ? `<dl>${[['Format', app.format], ['Stack', app.stack], ['Year', app.year], ['Role', app.role]].map(([k, v]) => `<div><dt>${k}</dt><dd>${esc(v || '—')}</dd></div>`).join('')}</dl>
      <a class="btn primary cd-launch" href="${esc(app.url)}" ${app.newTab ? 'target="_blank" rel="noopener noreferrer"' : ''}>Open project <span aria-hidden="true">→</span></a>` : '<p class="cd-seal">SEALED · FIND ITS PORTAL IN THE ROOM</p><button class="btn primary cd-find" type="button">Find in the room <span aria-hidden="true">→</span></button>'}
      <div class="cd-nav"><button type="button" class="cd-prev">← Previous</button><span>${pad(selected + 1)} / ${pad(apps.length)}</span><button type="button" class="cd-next">Next →</button></div>`;
    detail.querySelector('.cd-close').onclick = close;
    detail.querySelector('.cd-prev').onclick = () => open((selected + apps.length - 1) % apps.length);
    detail.querySelector('.cd-next').onclick = () => open((selected + 1) % apps.length);
    detail.querySelector('.cd-launch')?.addEventListener('click', e => portals.launch(app.id, e));
    detail.querySelector('.cd-find')?.addEventListener('click', () => { close(); goto('hero'); setTimeout(() => portals.scan(), 1500); });
  }
  function open(i, source) {
    if (!active) return;
    if (selected < 0) returnFocus = source || document.activeElement;
    selected = i; hover(-1); renderDetail(); detail.hidden = false;
    document.body.classList.add('catalog-open');
    cabinet.drawers[i].root.getWorldPosition(center); center.z += .4;
    onFocus(true, center, apps[i].color);
    audio.sfx('slide');
    detail.querySelector('.cd-close').focus({ preventScroll: true });
  }
  function close() {
    if (selected < 0) return;
    selected = -1; detail.hidden = true; document.body.classList.remove('catalog-open');
    onFocus(false); audio.sfx('slide'); returnFocus?.focus?.({ preventScroll: true });
  }
  window.addEventListener('keydown', e => {
    if (selected < 0) return;
    if (e.key === 'Escape') { e.preventDefault(); close(); }
    if (e.key === 'ArrowLeft') { e.preventDefault(); open((selected + apps.length - 1) % apps.length); }
    if (e.key === 'ArrowRight') { e.preventDefault(); open((selected + 1) % apps.length); }
    if (e.key === 'Tab') {
      const items = [...detail.querySelectorAll('button,a[href]')]; const first = items[0], last = items.at(-1);
      if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
      else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
    }
  });
  function pick(e) {
    pointer.set(e.clientX / innerWidth * 2 - 1, 1 - e.clientY / innerHeight * 2); ray.setFromCamera(pointer, camera);
    return ray.intersectObject(cabinet.parent, true)[0]?.object.userData.catalogIndex ?? -1;
  }
  canvas.addEventListener('pointermove', e => {
    mouseX = e.clientX / innerWidth - .5; mouseY = e.clientY / innerHeight - .5;
    if (active && selected < 0) hover(pick(e));
  });
  canvas.addEventListener('pointerleave', () => hover(-1));
  canvas.addEventListener('click', e => { if (active && selected < 0) { const i = pick(e); if (i >= 0) open(i); } });
  return {
    get open() { return selected >= 0; }, close,
    requestOpen(i) { if (Number.isInteger(i) && i >= 0 && i < apps.length) pending = i; },
    update(dt, isActive) {
      if (active !== isActive) { active = isActive; if (!active) { close(); hover(-1); } else refresh(); }
      if (active && pending >= 0) { const i = pending; pending = -1; open(i, buttons[i]); }
      document.body.classList.toggle('catalog-active', active);
      amount = reduced ? (selected >= 0 ? 1 : 0) : lerp(amount, selected >= 0 ? 1 : 0, 1 - Math.exp(-dt * 4));
      cabinet.drawers.forEach((d, i) => {
        d.k = reduced ? +(i === selected) : lerp(d.k, +(i === selected), 1 - Math.exp(-dt * 5));
        d.root.position.z = .02 + .38 * d.k + Math.sin(d.k * Math.PI) * .015;
        d.hover = lerp(d.hover, +(i === hovered || i === selected), 1 - Math.exp(-dt * 10));
        d.faceMat.emissive.set('#ffc56b'); d.faceMat.emissiveIntensity = .17 * d.hover;
        d.sleeve.rotation.set(mouseY * .1 * d.k, mouseX * .14 * d.k, -.08 * d.k);
        d.sleeve.visible = d.found;
      });
      if (selected >= 0) { cabinet.drawers[selected].root.getWorldPosition(center); center.z += .35; }
    },
    apply(goal) {
      if (amount < .001) return;
      const mobile = innerWidth < 760;
      const point = center.clone().add(new THREE.Vector3(mobile ? 0 : -.15, mobile ? 1.5 : 1.05, mobile ? 2.1 : 1.65));
      goal.p.lerp(point, amount);
      const aim = center.clone(); if (mobile) aim.y -= .65;
      goal.l.lerp(aim, amount); goal.f = lerp(goal.f, mobile ? 53 : 46, amount);
    },
  };
}
