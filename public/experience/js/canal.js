import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { rng, clamp, smooth } from './utils.js';
import { PORTALS } from './portals.config.js';
import { softDot } from './textures.js';

export function createCanal({ scene, camera, W, tier = 'high', launch }) {
  const R = rng(707), group = new THREE.Group(); group.name = 'canale-di-nook'; scene.add(group);
  const architecture = new THREE.Group(); group.add(architecture);
  const materials = new Map();
  const basic = (color, options = {}) => {
    if (Object.keys(options).length) return new THREE.MeshBasicMaterial({ color, ...options });
    const value = new THREE.Color(color), key = value.toArray().join(',');
    if (!materials.has(key)) materials.set(key, new THREE.MeshBasicMaterial({ color: value }));
    return materials.get(key);
  };
  const stone = basic('#56475b'), stoneTop = basic('#887486'), paving = basic('#413c50');
  const dark = basic('#131526'), brass = basic('#9e7654');
  const glowMat = basic(new THREE.Color('#ffc56b').multiplyScalar(2.3));
  const mesh = (geometry, material, x, y, z, parent = architecture) => { const o = new THREE.Mesh(geometry, material); o.position.set(x, y, z); parent.add(o); return o; };
  const box = (x, y, z, a, b, c, material, parent) => mesh(new THREE.BoxGeometry(a, b, c), material, x, y, z, parent);
  const windowGeo = new THREE.PlaneGeometry(.26, .42);
  const lampHalos = new THREE.Group(); group.add(lampHalos);
  const haloTexture = softDot();
  function halo(x, y, z, size = 1.4) {
    const material = new THREE.SpriteMaterial({ map: haloTexture, color: '#ffc56b', transparent: true, opacity: .22, blending: THREE.AdditiveBlending, depthWrite: false });
    const sprite = new THREE.Sprite(material); sprite.position.set(x, y, z); sprite.scale.setScalar(size); lampHalos.add(sprite);
  }
  function lamp(x, z) {
    mesh(new THREE.CylinderGeometry(.025, .04, 1.8, 8), brass, x, 1.25, z);
    box(x, 2.18, z, .22, .34, .22, dark);
    box(x, 2.18, z + .115, .14, .24, .015, glowMat);
    box(x + .115, 2.18, z, .015, .24, .14, glowMat);
    mesh(new THREE.ConeGeometry(.19, .16, 4), dark, x, 2.43, z).rotation.y = Math.PI / 4;
    halo(x, 2.18, z);
  }
  for (let side = -1; side <= 1; side += 2) {
    box(1.3 + side * 5.7, .12, -22, 4.4, .55, 34, paving);
    box(1.3 + side * 3.65, .32, -22, .16, .42, 34, stoneTop);
    for (let i = 0; i < 9; i++) {
      const z = -8 - i * 3.45, height = 3 + R() * 3.2, width = 2.9 + R() * .35;
      const colors = ['#593949', '#6b4b53', '#59465b', '#70554f', '#3b4258'];
      const color = new THREE.Color(colors[(i + (side > 0 ? 2 : 0)) % colors.length]);
      const materials = [basic(color.clone().multiplyScalar(.7)), basic(color.clone().multiplyScalar(.9)), basic(color.clone().multiplyScalar(1.2)), basic(color.clone().multiplyScalar(.55)), basic(color), basic(color.clone().multiplyScalar(.75))];
      const x = 1.3 + side * (5.6 + R() * .6);
      box(x, height / 2 + .4, z, 3.3, height, width, materials);
      box(x, height + .45, z, 3.5, .12, width + .2, stone);
      for (let row = 0; row < Math.floor(height / .85); row++) for (let col = 0; col < 3; col++) {
        const y = 1.05 + row * .85, wz = z - .9 + col * .85;
        const window = mesh(windowGeo, R() > .28 ? glowMat : basic('#222232'), x - side * 1.66, y, wz);
        window.rotation.y = -side * Math.PI / 2;
        box(x - side * 1.69, y - .25, wz, .1, .055, .38, stoneTop);
      }
      if (i % 2 === 0) lamp(1.3 + side * 3.25, z);
    }
  }
  const arch = new THREE.Shape();
  arch.moveTo(-3.7, .4); arch.quadraticCurveTo(0, 3.8, 3.7, .4);
  arch.lineTo(3.7, -.35); arch.quadraticCurveTo(0, 2.8, -3.7, -.35); arch.closePath();
  const bridgeGeo = new THREE.ExtrudeGeometry(arch, { depth: .24, bevelEnabled: true, bevelSegments: 1, steps: 1, bevelSize: .025, bevelThickness: .025, curveSegments: 30 });
  const bridge = new THREE.Group(); bridge.position.set(1.3, .35, -21); architecture.add(bridge);
  mesh(bridgeGeo, stoneTop, 0, 0, -.8, bridge);
  mesh(bridgeGeo, stone, 0, 0, .6, bridge);
  for (let i = 0; i < 31; i++) {
    const x = -3.65 + i / 30 * 7.3, y = .42 + 1.7 * (1 - (x / 3.7) ** 2);
    const step = box(x, y - .2, 0, .25, .2, 1.6, stone, bridge);
    step.rotation.z = -Math.atan(x / 4) * .5;
    if (i % 2 === 0) {
      box(x, y + .12, -.7, .07, .6, .07, stoneTop, bridge);
      box(x, y + .12, .7, .07, .6, .07, stoneTop, bridge);
    }
  }
  lamp(-2.2, -20); lamp(4.8, -20);
  const boats = [];
  for (let i = 0; i < 3; i++) {
    const boat = new THREE.Group(); boat.position.set(-.8 + i * 1.6, .12, -12 - i * 7); boat.rotation.y = -.25 + i * .3; architecture.add(boat);
    mesh(new THREE.SphereGeometry(1, 20, 10), basic('#12131d'), 0, 0, 0, boat).scale.set(.36, .17, 1.45);
    box(0, .15, 0, .44, .1, 1.5, basic('#6b3049'), boat);
    for (const z of [-.6, .6]) box(0, .25, z, .58, .07, .16, brass, boat);
    for (const z of [-1.3, 1.3]) { const tip = mesh(new THREE.TorusGeometry(.21, .025, 6, 12, Math.PI), brass, 0, .1, z, boat); tip.rotation.y = Math.PI / 2; }
    const oar = mesh(new THREE.CylinderGeometry(.014, .02, 2.3, 6), brass, .55, .3, .15, boat); oar.rotation.z = -.95;
    boats.push({ boat, base: boat.position.clone(), phase: i * 2.1 });
  }
  const stripeCanvas = document.createElement('canvas'); stripeCanvas.width = 128; stripeCanvas.height = 256;
  const c = stripeCanvas.getContext('2d'); c.fillStyle = '#fff3df'; c.fillRect(0, 0, 128, 256);
  c.fillStyle = '#a43c5b';
  for (let y = -256; y < 512; y += 80) { c.beginPath(); c.moveTo(0, y); c.lineTo(128, y + 90); c.lineTo(128, y + 130); c.lineTo(0, y + 40); c.fill(); }
  const stripeTexture = new THREE.CanvasTexture(stripeCanvas); stripeTexture.colorSpace = THREE.SRGBColorSpace;
  const poleMat = basic('#ffffff', { map: stripeTexture });
  for (const [x, z, height] of [[1.35, -7.4, 4.6], [-1.5, -15, 2.6], [4.2, -24, 2.8], [-1.4, -27, 2.5]]) {
    mesh(new THREE.CylinderGeometry(.11, .14, height, 16), poleMat, x, height / 2 - .2, z);
    mesh(new THREE.SphereGeometry(.14, 12, 8), brass, x, height - .16, z);
  }
  const batches = new Map(), staticMeshes = [];
  architecture.updateMatrixWorld(true);
  architecture.traverse(o => {
    if (!o.isMesh) return;
    let parent = o.parent;
    while (parent && parent !== architecture) {
      if (boats.some(b => b.boat === parent)) return;
      parent = parent.parent;
    }
    const geometry = o.geometry.index ? o.geometry.toNonIndexed() : o.geometry.clone();
    const parts = Array.isArray(o.material) ? geometry.groups : [{ start: 0, count: geometry.attributes.position.count, materialIndex: 0 }];
    parts.forEach(part => {
      const material = Array.isArray(o.material) ? o.material[part.materialIndex] : o.material;
      const piece = new THREE.BufferGeometry();
      for (const name of ['position', 'normal', 'uv']) {
        const attribute = geometry.attributes[name];
        piece.setAttribute(name, new THREE.BufferAttribute(attribute.array.slice(part.start * attribute.itemSize, (part.start + part.count) * attribute.itemSize), attribute.itemSize));
      }
      piece.applyMatrix4(o.matrixWorld);
      if (!batches.has(material)) batches.set(material, []);
      batches.get(material).push(piece);
    });
    geometry.dispose(); staticMeshes.push(o);
  });
  staticMeshes.forEach(o => o.removeFromParent());
  batches.forEach((parts, material) => {
    architecture.add(new THREE.Mesh(mergeGeometries(parts, false), material));
    parts.forEach(part => part.dispose());
  });
  // A mirrored copy costs no extra render target or second scene render.
  const reflection = architecture.clone(true); reflection.name = 'canal-reflection'; reflection.scale.y = -1; reflection.position.y = -.06;
  const reflectMaterials = new Map();
  reflection.traverse(o => {
    if (!o.isMesh) return;
    const tint = m => { if (!reflectMaterials.has(m)) { const copy = m.clone(); copy.color.multiplyScalar(.4); copy.transparent = true; copy.opacity = .45; copy.depthWrite = false; reflectMaterials.set(m, copy); } return reflectMaterials.get(m); };
    o.material = Array.isArray(o.material) ? o.material.map(tint) : tint(o.material);
  });
  group.add(reflection);
  const waterMat = new THREE.ShaderMaterial({
    uniforms: { uTime: { value: 0 }, uLow: { value: tier === 'low' ? 1 : 0 } },
    vertexShader: 'varying vec3 vP; void main(){ vec4 p=modelMatrix*vec4(position,1.);vP=p.xyz;gl_Position=projectionMatrix*viewMatrix*p; }',
    fragmentShader: `uniform float uTime,uLow; varying vec3 vP;
      float hash(vec2 p){return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453);}
      void main(){vec2 p=vP.xz;float t=uTime;
        float waves=sin(p.x*6.+p.y*3.+t*.8)*sin(p.y*8.-t*.6);
        vec2 cell=floor(p*1.3);vec2 q=fract(p*1.3)-.5;float phase=fract(t*.32+hash(cell));
        float rings=sin((length(q)-phase*.7)*70.)*exp(-abs(length(q)-phase*.45)*18.)*(1.-phase);
        float shimmer=pow(max(0.,sin(p.x*13.+sin(p.y*5.+t)*.8)),12.);
        float warm=exp(-pow((abs(p.x-1.3)-2.8)*1.4,2.))*shimmer;
        vec3 color=vec3(.035,.072,.13)+vec3(.035,.05,.07)*(waves*.3+rings*.18);
        color+=vec3(.24,.13,.06)*warm*(.25+uLow*.8);
        gl_FragColor=vec4(color,.67+uLow*.32); }`,
    transparent: true, depthWrite: false, side: THREE.DoubleSide,
  });
  const water = mesh(new THREE.PlaneGeometry(10, 40), waterMat, 1.3, -.02, -24, group); water.rotation.x = -Math.PI / 2; water.renderOrder = 2;
  const starsGeo = new THREE.BufferGeometry(), stars = [];
  for (let i = 0; i < 220; i++) stars.push((R() - .5) * 70, 8 + R() * 20, -28 - R() * 20);
  starsGeo.setAttribute('position', new THREE.Float32BufferAttribute(stars, 3));
  group.add(new THREE.Points(starsGeo, new THREE.PointsMaterial({ color: '#c6c9ef', size: .045, transparent: true, opacity: .65, depthWrite: false })));
  mesh(new THREE.SphereGeometry(1, 24, 16), basic('#fff0d4'), -5, 10, -37, group); halo(-5, 10, -37, 7);
  const p = PORTALS.find(p => p.id === 'window' && p.enabled !== false) || PORTALS.find(p => p.enabled !== false);
  const link = document.createElement('a'); link.className = 'canal-portal'; link.hidden = true;
  if (p) { link.href = p.url; link.target = p.newTab ? '_blank' : '_self'; link.rel = 'noopener noreferrer'; link.setAttribute('aria-label', `Bridge portal: ${p.title}`); link.innerHTML = '<svg viewBox="0 0 24 24" width="24" height="24" fill="none" stroke="currentColor" stroke-width="1.5" aria-hidden="true"><path d="M7 17 17 7M7 7h10v10"/></svg><small>THE BRIDGE / ENTER PORTAL</small>'; }
  document.body.append(link); link.addEventListener('click', e => { if (p) launch?.(p.id, e); });
  const anchor = new THREE.Vector3(1.3, 2.65, -20.5), projected = new THREE.Vector3();
  const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
  function setTier(next) { tier = next; reflection.visible = tier !== 'low'; waterMat.uniforms.uLow.value = tier === 'low' ? 1 : 0; }
  setTier(tier);
  function update(t, dt, active) {
    waterMat.uniforms.uTime.value = reduce ? 0 : t;
    boats.forEach(({ boat, base, phase }) => { boat.position.y = base.y + (reduce ? 0 : Math.sin(t * .7 + phase) * .055); boat.rotation.z = reduce ? 0 : Math.sin(t * .6 + phase) * .025; });
    document.body.classList.toggle('in-canal', active);
    const outside = active && camera.position.z < -8;
    if (outside && p) {
      projected.copy(anchor).project(camera);
      const x = (projected.x * .5 + .5) * innerWidth, y = (-projected.y * .5 + .5) * innerHeight;
      const visible = projected.z > -1 && projected.z < 1 && x > 30 && x < innerWidth - 30 && y > 100 && y < innerHeight - 140;
      link.hidden = !visible;
      if (visible) link.style.transform = `translate3d(${x - 24}px,${y - 24}px,0)`;
    } else link.hidden = true;
    W.glass.visible = camera.position.z > -4.5;
  }
  function apply(goal, progress) {
    // Cross above the sash and left of its mullion; the striped pole supplies the wipe.
    const k = reduce ? .86 : smooth(clamp(progress, 0, 1));
    goal.p.set(THREE.MathUtils.lerp(.72, 2.5, k * k), THREE.MathUtils.lerp(2.7, 1.9, k), THREE.MathUtils.lerp(-2.1, -14.4, k));
    goal.l.set(THREE.MathUtils.lerp(.72, 1.3, k), THREE.MathUtils.lerp(2.7, 1.8, k), THREE.MathUtils.lerp(-9, -23, k));
    goal.f = camera.aspect < .9 ? 64 : 52;
  }
  return { update, apply, setTier, group, reflection, water, bridge, get state() { return { tier, outside: camera.position.z < -8, portalVisible: !link.hidden }; } };
}
