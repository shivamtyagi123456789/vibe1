import * as THREE from 'three';
import { PORTALS } from './portals.config.js';
import { clamp, lerp } from './utils.js';

const apps = PORTALS.filter(app => app.enabled !== false);
const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
const pad = n => String(n).padStart(2, '0');

function texture(width, height, draw) {
  const canvas = document.createElement('canvas'); canvas.width = width; canvas.height = height;
  draw(canvas.getContext('2d'), width, height);
  const map = new THREE.CanvasTexture(canvas); map.colorSpace = THREE.SRGBColorSpace;
  return map;
}

export function createShelf({ scene, camera, canvas, navigate, openDrawer }) {
  const section = document.getElementById('shelf');
  const group = new THREE.Group(); group.name = 'project-shelf'; group.position.z = 20; scene.add(group);
  const row = new THREE.Group(); group.add(row);
  const fill = new THREE.PointLight('#fff3df', 0, 9, 2); fill.position.set(-1.3, 2.8, 23); scene.add(fill);
  const box = (w, h, d, mat, parent, x = 0, y = 0, z = 0) => {
    const mesh = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat);
    mesh.position.set(x, y, z); parent.add(mesh); return mesh;
  };
  const foil = new THREE.MeshStandardMaterial({ color: '#ffc56b', metalness: .82, roughness: .28 });
  const pages = new THREE.MeshStandardMaterial({ color: '#ded1b7', roughness: .95 });
  const books = apps.map((app, index) => {
    const root = new THREE.Group(); root.position.y = .55; row.add(root);
    const colors = app.cover || ['#20140a', app.color, '#fff3df'];
    const cloth = new THREE.MeshStandardMaterial({ color: colors[0], roughness: .83, emissive: colors[0], emissiveIntensity: .18 });
    const coverMap = texture(512, 768, (g, w, h) => {
      g.fillStyle = colors[0]; g.fillRect(0, 0, w, h);
      g.strokeStyle = app.color; g.lineWidth = 2; g.strokeRect(28, 28, w - 56, h - 56);
      g.globalAlpha = .55;
      for (let n = 0; n < 9; n++) { g.beginPath(); g.ellipse(w / 2, h * .4, 35 + n * 17, 45 + n * 17, index * .14, 0, Math.PI * 2); g.stroke(); }
      g.globalAlpha = 1; g.fillStyle = '#ffc56b'; g.textAlign = 'center';
      g.font = '20px Inter, sans-serif'; g.fillText(`VIBES EDITIONS / ${pad(index + 1)}`, w / 2, 80);
      g.font = '46px Fraunces, Georgia, serif';
      const words = app.title.split(' '); let lines = [''];
      words.forEach(word => { const last = lines.length - 1; if (g.measureText(`${lines[last]} ${word}`).width > 410) lines.push(word); else lines[last] = `${lines[last]} ${word}`.trim(); });
      lines.forEach((line, n) => g.fillText(line, w / 2, 590 + n * 55, 430));
      g.font = '16px Inter, sans-serif'; g.fillText(app.category || 'SELECTED WORK', w / 2, 704);
    });
    const goldMask = texture(128, 768, (g, w, h) => {
      g.fillStyle = '#fff'; g.textAlign = 'center'; g.font = '26px Fraunces, Georgia, serif';
      g.save(); g.translate(w / 2, h / 2); g.rotate(-Math.PI / 2); g.fillText(app.title, 0, 8, 510); g.restore();
      g.fillRect(20, 50, w - 40, 4); g.fillRect(20, h - 54, w - 40, 4);
      g.font = '22px serif'; g.fillText(pad(index + 1), w / 2, h - 86);
    });
    box(.87, 1.59, .27, pages, root, 0, .83);
    box(.96, 1.7, .045, cloth, root, 0, .85, -.165);
    box(.055, 1.7, .37, cloth, root, -.465, .85);
    const spine = new THREE.Mesh(new THREE.PlaneGeometry(.32, 1.58), new THREE.MeshStandardMaterial({ color: '#ffc56b', metalness: .82, roughness: .3, map: goldMask, transparent: true, alphaTest: .1 }));
    spine.position.set(-.496, .85, 0); spine.rotation.y = -Math.PI / 2; root.add(spine);
    const hinge = new THREE.Group(); hinge.position.set(-.47, 0, .165); root.add(hinge);
    box(.96, 1.7, .045, cloth, hinge, .47, .85);
    const cover = new THREE.Mesh(new THREE.PlaneGeometry(.9, 1.63), new THREE.MeshStandardMaterial({ map: coverMap, roughness: .64, metalness: .18, emissive: '#fff3df', emissiveMap: coverMap, emissiveIntensity: .16 }));
    cover.position.set(.47, .85, .025); hinge.add(cover);
    [-.61, .61].forEach(y => box(.065, .025, .38, foil, root, -.465, .85 + y));
    root.traverse(object => { if (object.isMesh) object.userData.shelfIndex = index; });
    return { root, hinge, app };
  });
  box(13, .12, 1.3, new THREE.MeshStandardMaterial({ color: '#2b1b20', roughness: .48, metalness: .18 }), group, 0, .46, -.1);
  box(13, .018, .025, foil, group, 0, .525, .54);

  const wordMap = texture(2048, 640, (g, w, h) => {
    g.fillStyle = '#fff'; g.textAlign = 'center'; g.font = '600 550px Fraunces, Georgia, serif'; g.fillText('Vibes', w / 2, 505, w - 60);
  });
  const wordMaterial = new THREE.ShaderMaterial({
    uniforms: { map: { value: wordMap }, time: { value: 0 } }, transparent: true, depthWrite: false,
    vertexShader: 'varying vec2 vUv; void main(){ vUv=uv; gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0); }',
    fragmentShader: 'uniform sampler2D map; uniform float time; varying vec2 vUv; void main(){ float a=texture2D(map,vUv).a; float shine=pow(max(0.0,sin(vUv.x*5.0-time*.35)),12.0); gl_FragColor=vec4(mix(vec3(.18,.12,.11),vec3(.4,.25,.15),shine*.45),a*.32); }',
  });
  const word = new THREE.Mesh(new THREE.PlaneGeometry(7.4, 2.3), wordMaterial); word.position.set(0, 2.25, -.8); group.add(word);
  const aim = new THREE.Vector3(0, 1.45, 20.2);
  let active = false, position = 0, selected = -1, hovered = -1;
  const picker = new THREE.Raycaster(), pointer = new THREE.Vector2();
  const index = section.querySelector('.shelf-index');
  const title = section.querySelector('.shelf-title');
  const author = section.querySelector('.shelf-author');
  const tagline = section.querySelector('.shelf-tagline');
  const dots = section.querySelector('.shelf-books');
  const controls = apps.map((app, i) => {
    const button = document.createElement('button'); button.type = 'button'; button.textContent = pad(i + 1);
    button.setAttribute('aria-label', `Select book ${pad(i + 1)}: ${app.title}`);
    button.onclick = () => choose(i); dots.append(button); return button;
  });
  function choose(i) {
    const next = clamp(i, 0, apps.length - 1);
    navigate(section.offsetTop + next / Math.max(1, apps.length - 1) * Math.max(1, section.offsetHeight - innerHeight));
  }
  section.querySelector('.shelf-prev').onclick = () => choose(selected - 1);
  section.querySelector('.shelf-next').onclick = () => choose(selected + 1);
  section.querySelector('.shelf-open').onclick = () => openDrawer(selected);
  section.querySelector('.shelf-controls').addEventListener('keydown', e => {
    if (e.key === 'ArrowLeft' || e.key === 'ArrowRight') { e.preventDefault(); choose(selected + (e.key === 'ArrowRight' ? 1 : -1)); }
    if (e.key === 'Home' || e.key === 'End') { e.preventDefault(); choose(e.key === 'Home' ? 0 : apps.length - 1); }
  });
  function pick(event) {
    pointer.set(event.clientX / innerWidth * 2 - 1, 1 - event.clientY / innerHeight * 2);
    picker.setFromCamera(pointer, camera);
    return picker.intersectObject(row, true)[0]?.object.userData.shelfIndex ?? -1;
  }
  canvas.addEventListener('pointermove', e => { if (active) hovered = pick(e); });
  canvas.addEventListener('pointerleave', () => { hovered = -1; });
  canvas.addEventListener('click', e => {
    if (!active) return;
    const hit = pick(e);
    if (hit >= 0) { if (hit === selected) openDrawer(hit); else choose(hit); }
  });
  return {
    group, aim,
    get active() { return active; },
    get selected() { return selected; },
    get color() { return apps[Math.max(0, selected)]?.color; },
    update(dt, time, sy, visible) {
      active = visible;
      group.visible = sy > section.offsetTop - innerHeight && sy < section.offsetTop + section.offsetHeight;
      document.body.classList.toggle('shelf-active', active);
      fill.intensity = group.visible ? 16 : 0;
      if (!group.visible) return;
      const progress = clamp((sy - section.offsetTop) / Math.max(1, section.offsetHeight - innerHeight), 0, 1);
      const target = progress * (apps.length - 1);
      position = reduced ? target : lerp(position, target, 1 - Math.exp(-dt * 9));
      const current = clamp(Math.round(position), 0, apps.length - 1);
      if (current !== selected) {
        selected = current; const app = apps[selected];
        index.textContent = `${pad(selected + 1)} / ${pad(apps.length)}`;
        title.textContent = app.title; author.textContent = `${app.category} / ${app.role || 'Vibes editions'}`;
        tagline.textContent = app.tagline;
        section.querySelector('.shelf-open').setAttribute('aria-label', `Open catalog drawer for ${app.title}`);
        controls.forEach((button, i) => button.setAttribute('aria-pressed', String(i === selected)));
        section.querySelector('.shelf-prev').disabled = selected === 0;
        section.querySelector('.shelf-next').disabled = selected === apps.length - 1;
        const caption = section.querySelector('.shelf-caption'); caption.classList.remove('changed'); void caption.offsetWidth; caption.classList.add('changed');
      }
      books.forEach((book, i) => {
        const delta = i - position, feature = Math.max(0, 1 - Math.abs(delta));
        book.root.position.x = delta * .7 + Math.tanh(delta * 3) * .43;
        book.root.position.z = feature * .5 + (i === hovered ? .06 : 0);
        book.root.rotation.y = lerp(Math.PI / 2, -.12, feature);
        book.root.position.y = .55 + feature * .4;
        book.hinge.rotation.y = -feature * .26;
      });
      wordMaterial.uniforms.time.value = reduced ? 0 : time;
    },
  };
}
