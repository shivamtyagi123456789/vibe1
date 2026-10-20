/* =========================================================
   nook.fm — stylised character rig
   Hierarchical joints (every limb segment hangs along -Y),
   FK walk cycle + analytic two-bone IK for arms and legs,
   look-at head, blink, breathing, headphones prop.
   ========================================================= */
import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { clamp, lerp } from './utils.js';

const std = (color, o = {}) => new THREE.MeshStandardMaterial({ color, roughness: 0.75, metalness: 0, ...o });
const fabric = (color, o = {}) => new THREE.MeshPhysicalMaterial({ color, roughness: 0.9, sheen: 1, sheenRoughness: 0.6, sheenColor: new THREE.Color('#ffffff').multiplyScalar(0.35), ...o });

const _v1 = new THREE.Vector3(), _v2 = new THREE.Vector3(), _v3 = new THREE.Vector3(), _v4 = new THREE.Vector3();
const _q1 = new THREE.Quaternion(), _q2 = new THREE.Quaternion(), _q3 = new THREE.Quaternion();
const _m = new THREE.Matrix4();
const _x = new THREE.Vector3(), _y = new THREE.Vector3(), _z = new THREE.Vector3();
// scratch objects reused every frame (no GC pauses → no hitches)
const _S = new THREE.Vector3(), _T = new THREE.Vector3(), _E2 = new THREE.Vector3(), _dn = new THREE.Vector3(), _dn2 = new THREE.Vector3();
const _fw = new THREE.Vector3(), _nPrev = new THREE.Vector3(), _tgt = new THREE.Vector3(), _fwd = new THREE.Vector3(), _bend = new THREE.Vector3();
const _qa = new THREE.Quaternion(), _qb = new THREE.Quaternion(), _eu = new THREE.Euler();

function mesh(geo, mat, parent, x = 0, y = 0, z = 0) {
  const m = new THREE.Mesh(geo, mat);
  m.position.set(x, y, z); m.castShadow = true; m.receiveShadow = true;
  parent.add(m); return m;
}
const joint = (parent, x = 0, y = 0, z = 0) => { const g = new THREE.Group(); g.position.set(x, y, z); parent.add(g); return g; };
const capsule = (r, len) => new THREE.CapsuleGeometry(r, len, 6, 16);

/* world quaternion from basis where local -Y points along `down` and local +Z leans to `fwd` */
function basisQuat(down, fwd, out) {
  _y.copy(down).multiplyScalar(-1).normalize();
  _z.copy(fwd).addScaledVector(_y, -fwd.dot(_y)).normalize();
  _x.crossVectors(_y, _z).normalize();
  _m.makeBasis(_x, _y, _z);
  return out.setFromRotationMatrix(_m);
}
/* set a joint's local quaternion from a desired world quaternion, blended by w */
function setWorldQuat(bone, worldQ, w) {
  bone.parent.getWorldQuaternion(_q3).invert();
  _q2.copy(_q3).multiply(worldQ);
  bone.quaternion.slerp(_q2, w);
  bone.updateMatrixWorld(true);
}

export function buildCharacter() {
  const C = {};
  const M = {
    skin: std('#f0bd96', { roughness: 0.55 }),
    skinDark: std('#e2a27c', { roughness: 0.6 }),
    hoodie: fabric('#ee8350'),
    hoodieDark: fabric('#cf6a3e'),
    pants: fabric('#27345a'),
    shoe: std('#f5f0e8', { roughness: 0.5 }),
    sole: std('#ff4f7b', { roughness: 0.6 }),
    beanie: fabric('#2f7f80'),
    hair: std('#3a2218', { roughness: 0.8 }),
    eye: std('#15101c', { roughness: 0.25 }),
    white: new THREE.MeshBasicMaterial({ color: '#ffffff' }),
    blush: new THREE.MeshBasicMaterial({ color: '#ff8a8a', transparent: true, opacity: 0.35, depthWrite: false }),
    mouth: std('#7a3030', { roughness: 0.6 }),
  };

  const root = new THREE.Group(); C.root = root;
  const pelvis = joint(root, 0, 0.975, 0);
  mesh(new RoundedBoxGeometry(0.31, 0.17, 0.2, 3, 0.07), M.pants, pelvis, 0, -0.02, 0);

  /* ---------- torso ---------- */
  const spine = joint(pelvis, 0, 0.06, 0);
  const belly = mesh(new THREE.SphereGeometry(0.17, 24, 18), M.hoodie, spine, 0, 0.08, 0);
  belly.scale.set(1.0, 0.9, 0.72);
  const pocket = mesh(new RoundedBoxGeometry(0.2, 0.08, 0.04, 2, 0.02), M.hoodieDark, spine, 0, 0.04, 0.11);
  pocket.rotation.x = -0.15;
  // hoodie hem
  const hem = mesh(new THREE.TorusGeometry(0.15, 0.028, 10, 28), M.hoodieDark, spine, 0, -0.04, 0);
  hem.rotation.x = Math.PI / 2; hem.scale.set(1.05, 0.72, 1);

  const chest = joint(spine, 0, 0.17, 0);
  const torso = mesh(capsule(0.165, 0.16), M.hoodie, chest, 0, 0.1, 0);
  torso.scale.set(1.15, 1, 0.74);
  // shoulders (soft) + hood bunch
  [-1, 1].forEach((k) => { const s = mesh(new THREE.SphereGeometry(0.075, 16, 12), M.hoodie, chest, k * 0.16, 0.2, 0); s.scale.set(1.2, 0.9, 1); });
  const hood = mesh(new THREE.TorusGeometry(0.1, 0.045, 12, 28), M.hoodieDark, chest, 0, 0.27, -0.02);
  hood.rotation.x = Math.PI / 2 + 0.25; hood.scale.set(1.15, 1, 1);
  // drawstrings
  [-1, 1].forEach((k) => {
    const s = mesh(new THREE.CylinderGeometry(0.006, 0.006, 0.13, 6), std('#f5f0e8'), chest, k * 0.035, 0.18, 0.12);
    s.rotation.x = -0.12;
    mesh(new THREE.SphereGeometry(0.01, 8, 6), std('#f5f0e8'), chest, k * 0.035, 0.115, 0.13);
  });

  /* ---------- neck + head ---------- */
  const neck = joint(chest, 0, 0.27, 0);
  mesh(new THREE.CylinderGeometry(0.045, 0.05, 0.1, 14), M.skin, neck, 0, 0.03, 0);
  const head = joint(neck, 0, 0.06, 0);
  const skull = mesh(new THREE.SphereGeometry(0.135, 32, 24), M.skin, head, 0, 0.13, 0.005);
  skull.scale.set(1, 1.07, 1.02);
  const jaw = mesh(new THREE.SphereGeometry(0.11, 24, 16), M.skin, head, 0, 0.075, 0.03);
  jaw.scale.set(1, 0.75, 0.95);
  // ears
  [-1, 1].forEach((k) => { const e = mesh(new THREE.SphereGeometry(0.03, 12, 10), M.skinDark, head, k * 0.135, 0.12, 0); e.scale.set(0.5, 1, 0.8); });
  // nose
  const nose = mesh(new THREE.SphereGeometry(0.022, 14, 10), M.skinDark, head, 0, 0.105, 0.14);
  nose.scale.set(1, 0.85, 0.9);
  // eyes (with lids for blink)
  const eyes = [];
  [-1, 1].forEach((k) => {
    const g = joint(head, k * 0.05, 0.135, 0.122);
    const e = mesh(new THREE.SphereGeometry(0.019, 14, 10), M.eye, g); e.scale.set(1, 1.15, 0.55);
    const hl = mesh(new THREE.SphereGeometry(0.0055, 8, 6), M.white, g, 0.006, 0.007, 0.009); hl.castShadow = false;
    const brow = mesh(new RoundedBoxGeometry(0.042, 0.009, 0.01, 2, 0.004), M.hair, head, k * 0.052, 0.178, 0.122);
    brow.rotation.z = -k * 0.12;
    eyes.push({ g, brow });
    const b = mesh(new THREE.CircleGeometry(0.022, 16), M.blush, head, k * 0.085, 0.085, 0.112); b.castShadow = false;
    b.rotation.y = k * 0.55;
  });
  // closed-eye arcs (shown when vibing)
  const closed = [];
  [-1, 1].forEach((k) => {
    const a = mesh(new THREE.TorusGeometry(0.016, 0.0045, 6, 14, Math.PI), M.eye, head, k * 0.05, 0.13, 0.128);
    a.rotation.z = Math.PI; a.visible = false; closed.push(a);
  });
  // smile
  const smile = mesh(new THREE.TorusGeometry(0.03, 0.0065, 8, 18, Math.PI * 0.8), M.mouth, head, 0, 0.068, 0.128);
  smile.rotation.z = Math.PI + Math.PI * 0.1;
  // hair + beanie
  const hairBack = mesh(new THREE.SphereGeometry(0.142, 24, 18, 0, Math.PI * 2, 0, Math.PI * 0.62), M.hair, head, 0, 0.14, -0.012);
  hairBack.rotation.x = -0.5;
  [[-0.09, 0.2, 0.11, 0.5], [-0.04, 0.215, 0.125, 0.25], [0.02, 0.215, 0.127, -0.1], [0.075, 0.205, 0.115, -0.45]].forEach(([x, y, z, r]) => {
    const t = mesh(capsule(0.018, 0.03), M.hair, head, x, y, z); t.rotation.set(0.5, 0, r);
  });
  [-1, 1].forEach((k) => { const s = mesh(capsule(0.012, 0.03), M.hair, head, k * 0.128, 0.155, 0.03); s.rotation.z = k * 0.1; });
  const beanie = mesh(new THREE.SphereGeometry(0.15, 32, 20, 0, Math.PI * 2, 0, Math.PI * 0.5), M.beanie, head, 0, 0.19, -0.005);
  beanie.scale.set(1, 0.92, 1.03);
  const cuff = mesh(new THREE.TorusGeometry(0.143, 0.03, 12, 36), M.beanie, head, 0, 0.2, -0.005);
  cuff.rotation.x = Math.PI / 2 - 0.12; cuff.scale.set(1, 1.03, 1);
  // ribbing lines on cuff
  for (let i = 0; i < 28; i++) {
    const a = (i / 28) * Math.PI * 2;
    const r = mesh(new THREE.BoxGeometry(0.004, 0.05, 0.004), std('#256a6b'), head, Math.sin(a) * 0.17, 0.2 + Math.cos(a) * 0.02, Math.cos(a) * 0.17 - 0.005);
    r.castShadow = false;
  }
  const tag = mesh(new THREE.BoxGeometry(0.03, 0.02, 0.006), std('#ff4f7b'), head, 0.08, 0.2, 0.15); tag.rotation.y = 0.5;

  /* ---------- arms (k=+1 → local +x side "A", k=-1 → "B") ---------- */
  const arm = (k) => {
    const sh = joint(chest, k * 0.19, 0.215, 0);
    mesh(capsule(0.056, 0.2), M.hoodie, sh, 0, -0.14, 0);
    const el = joint(sh, 0, -0.29, 0);
    mesh(capsule(0.049, 0.18), M.hoodie, el, 0, -0.12, 0);
    const cuffM = mesh(new THREE.TorusGeometry(0.043, 0.016, 8, 20), M.hoodieDark, el, 0, -0.245, 0); cuffM.rotation.x = Math.PI / 2;
    const hand = joint(el, 0, -0.27, 0);
    const palm = mesh(new THREE.SphereGeometry(0.048, 16, 12), M.skin, hand, 0, -0.04, 0.005); palm.scale.set(0.62, 1.1, 0.85);
    const fing = mesh(capsule(0.026, 0.04), M.skin, hand, 0, -0.085, 0.012); fing.scale.set(1.2, 1, 0.9); fing.rotation.x = 0.25;
    const thumb = mesh(capsule(0.014, 0.03), M.skin, hand, -k * 0.0, -0.035, 0.04); thumb.rotation.x = 0.8;
    return { sh, el, hand, k, a: 0.29, b: 0.27 };
  };
  const armA = arm(1), armB = arm(-1);

  /* ---------- legs ---------- */
  const leg = (k) => {
    const hip = joint(pelvis, k * 0.095, -0.04, 0);
    mesh(capsule(0.072, 0.3), M.pants, hip, 0, -0.21, 0);
    const knee = joint(hip, 0, -0.44, 0);
    mesh(capsule(0.06, 0.3), M.pants, knee, 0, -0.2, 0);
    const roll = mesh(new THREE.TorusGeometry(0.058, 0.018, 8, 20), M.pants, knee, 0, -0.37, 0); roll.rotation.x = Math.PI / 2;
    const ankle = joint(knee, 0, -0.42, 0);
    const shoe = mesh(new RoundedBoxGeometry(0.115, 0.085, 0.27, 3, 0.04), M.shoe, ankle, 0, -0.025, 0.055);
    const sole = mesh(new RoundedBoxGeometry(0.12, 0.028, 0.275, 2, 0.012), M.sole, ankle, 0, -0.065, 0.055);
    const lace = mesh(new THREE.BoxGeometry(0.06, 0.012, 0.08), std('#ff9db5'), ankle, 0, 0.018, 0.09); lace.rotation.x = -0.25;
    return { hip, knee, ankle, k, a: 0.44, b: 0.42 };
  };
  const legL = leg(1), legR = leg(-1);
  // ankle → sole bottom = 0.079 ; standing pelvis height = 0.04 + 0.44 + 0.42 + 0.079
  C.STAND_H = 0.04 + 0.44 + 0.42 + 0.079;
  pelvis.position.y = C.STAND_H;

  Object.assign(C, { pelvis, spine, chest, neck, head, armA, armB, legL, legR, eyes, closed, smile });

  /* ---------- solvers ---------- */
  // two-bone IK in world space. bendDir: world-space hint for where the middle joint should go.
  C.ik = (limb, target, bendDir, w, isLeg) => {
    if (w <= 0.0001) return;
    const upper = isLeg ? limb.hip : limb.sh, lower = isLeg ? limb.knee : limb.el;
    upper.updateWorldMatrix(true, false);
    const S = upper.getWorldPosition(_S);
    const a = limb.a, b = limb.b;
    const dir = _v2.copy(target).sub(S);
    // soft reach limit: ease into full extension instead of snapping straight (removes elbow/knee pops)
    const maxR = a + b - 0.002, minR = Math.abs(a - b) + 0.01;
    let d = dir.length();
    const soft = maxR * 0.94;
    if (d > soft) d = soft + (maxR - soft) * (1 - Math.exp(-(d - soft) / (maxR - soft)));
    d = clamp(d, minR, maxR);
    dir.normalize();
    const cosA = clamp((a * a + d * d - b * b) / (2 * a * d), -1, 1), sinA = Math.sqrt(1 - cosA * cosA);
    const n = _v3.copy(bendDir).addScaledVector(dir, -bendDir.dot(dir));
    if (n.lengthSq() < 1e-6) n.copy(limb.nPrev || _nPrev.set(0, 0, 1)); // degenerate: keep last plane
    n.normalize();
    // temporally smooth the bend plane so the elbow never flips between frames
    if (!limb.nPrev) limb.nPrev = n.clone(); else { limb.nPrev.lerp(n, 0.5).normalize(); n.copy(limb.nPrev); }
    const E = _v4.copy(S).addScaledVector(dir, cosA * a).addScaledVector(n, sinA * a);
    const T = _T.copy(S).addScaledVector(dir, d);
    const down = _dn.subVectors(E, S);
    _fw.copy(n); if (!isLeg) _fw.negate();
    basisQuat(down, _fw, _q1);
    setWorldQuat(upper, _q1, w);
    lower.updateWorldMatrix(true, false);
    const E2 = lower.getWorldPosition(_E2);
    const down2 = _dn2.subVectors(T, E2);
    _fw.copy(n); if (!isLeg) _fw.negate();
    basisQuat(down2, _fw, _q1);
    setWorldQuat(lower, _q1, w);
  };

  const yawQ = new THREE.Quaternion(), tmpE = new THREE.Euler();

  /* ---------- per-frame pose ----------
     s = { x,z,yaw, hipY, phase, walkW, spineX, chestY, sitW,
           legIK:{w, L:Vec3, R:Vec3, tap}, armA:{w,target,bend}, armB:{...},
           look:{w,target}, blink, vibe, nod, breathe } */
  C.apply = (s, t) => {
    const φ = s.phase, w = s.walkW, sit = s.sitW || 0;
    root.position.set(s.x, 0, s.z);
    root.rotation.set(0, s.yaw, 0);
    const br = Math.sin(t * 1.7) * 0.5 + 0.5; // breathing

    pelvis.position.y = s.hipY + w * (0.03 * Math.abs(Math.cos(φ)) - 0.018);
    pelvis.position.x = w * 0.022 * Math.sin(φ);
    pelvis.rotation.set(s.pelvisX || 0, 0.13 * w * Math.sin(φ), 0.045 * w * Math.cos(φ));
    spine.rotation.set((s.spineX || 0) + 0.06 * w - br * 0.015, 0, -0.03 * w * Math.cos(φ));
    chest.rotation.set((s.chestX || 0) - br * 0.02, -0.2 * w * Math.sin(φ) + (s.chestY || 0), 0);
    chest.scale.set(1 + br * 0.012, 1 + br * 0.008, 1 + br * 0.02);

    // legs FK: walk cycle blended with sitting base pose
    [legL, legR].forEach((L) => {
      const p = φ + (L.k > 0 ? 0 : Math.PI);
      const swing = Math.max(0, Math.cos(p));
      let th = -0.46 * w * Math.sin(p);
      let kn = w * (0.06 + 0.95 * Math.pow(swing, 1.3)) + (1 - w) * 0.03;
      th = lerp(th, -1.45, sit); kn = lerp(kn, 1.35, sit);
      L.hip.rotation.set(th - (s.pelvisX || 0) - (s.kneeBend || 0) * 0.5, 0, L.k * 0.02);
      L.knee.rotation.set(kn + (s.kneeBend || 0), 0, 0);
      const toe = w * (Math.sin(p) < 0 && swing < 0.35 ? -0.25 * Math.sin(p) * (1 - swing) : -0.1 * swing);
      L.ankle.rotation.set(-(th + kn) * (1 - sit * 0.5) + toe, 0, 0);
    });
    // arms FK: counter-swing + relaxed bend
    [armA, armB].forEach((A) => {
      const p = φ + (A.k > 0 ? 0 : Math.PI);
      A.sh.rotation.set(0.38 * w * Math.sin(p) + 0.05 - sit * 0.15, 0, A.k * (0.1 + br * 0.01));
      A.el.rotation.set(-(0.22 + 0.25 * w * (0.5 + 0.5 * Math.sin(p))) - sit * 0.6, 0, 0);
      A.hand.rotation.set(-0.1, 0, -A.k * 0.08);
    });
    neck.rotation.set(-0.06 * w * Math.abs(Math.cos(φ)) + (s.nod || 0) * 0.6, 0, 0);
    head.rotation.set((s.nod || 0) * 0.5, 0, (s.tilt || 0));
    root.updateMatrixWorld(true);

    // legs IK (feet planted)
    if (s.legIK && s.legIK.w > 0) {
      yawQ.setFromEuler(tmpE.set(0, s.yaw, 0));
      _bend.set(Math.sin(s.yaw), 0.1, Math.cos(s.yaw));
      for (let i = 0; i < 2; i++) {
        const L = i ? legR : legL, P = i ? s.legIK.R : s.legIK.L, tap = i ? (s.legIK.tap || 0) : 0;
        _tgt.copy(P); _tgt.y = 0.079 + tap * 0.035;
        C.ik(L, _tgt, _bend, s.legIK.w, true);
        // keep sole flat (+ toe tap)
        _qa.copy(yawQ).multiply(_qb.setFromEuler(_eu.set(-tap * 0.35, 0, 0)));
        setWorldQuat(L.ankle, _qa, s.legIK.w);
      }
    }
    // arms IK
    for (let i = 0; i < 2; i++) {
      const A = i ? armB : armA, P = i ? s.armB : s.armA;
      if (!P || P.w <= 0) continue;
      const tgt = typeof P.target === 'function' ? P.target() : P.target;
      C.ik(A, tgt, P.bend, P.w, false);
      if (P.handQ) setWorldQuat(A.hand, P.handQ, P.w);
    }
    // look-at (distributed over neck + head)
    if (s.look && s.look.w > 0) {
      neck.parent.updateWorldMatrix(true, false);
      const local = neck.parent.worldToLocal(_tgt.copy(s.look.target));
      local.y -= neck.position.y + 0.18;
      const yaw = clamp(Math.atan2(local.x, local.z), -1.1, 1.1);
      const pitch = clamp(-Math.atan2(local.y, Math.hypot(local.x, local.z)), -0.6, 0.7);
      neck.rotation.y = lerp(neck.rotation.y, yaw * 0.45, s.look.w);
      head.rotation.y = lerp(head.rotation.y, yaw * 0.55, s.look.w);
      neck.rotation.x = lerp(neck.rotation.x, pitch * 0.5 + (s.nod || 0) * 0.6, s.look.w);
      head.rotation.x = lerp(head.rotation.x, pitch * 0.5 + (s.nod || 0) * 0.5, s.look.w);
      neck.updateMatrixWorld(true);
    }
    // face (vibe is a 0..1 blend now → eyes ease shut instead of popping)
    const bl = s.blink || 0, vibe = s.vibe || 0;
    eyes.forEach((e, i) => {
      e.g.scale.y = Math.max(0.06, 1 - bl) * Math.max(0.06, 1 - vibe) + 0.0001;
      e.g.visible = vibe < 0.85;
      closed[i].visible = vibe >= 0.85;
      e.brow.position.y = 0.178 + (s.browUp || 0) * 0.012 - vibe * 0.004;
    });
    smile.scale.set(1 + vibe * 0.25 + (s.smile || 0) * 0.2, 1 + vibe * 0.35, 1);
    root.updateMatrixWorld(true);
  };

  C.root.traverse((o) => { if (o.isMesh) { o.castShadow = true; } });
  return C;
}

/* ---------------- headphones ---------------- */
export function buildHeadphones() {
  const g = new THREE.Group();
  const body = std('#fff1e4', { roughness: 0.35, metalness: 0.05 });
  const accent = std('#ff4f7b', { roughness: 0.4 });
  const metal = std('#d9c7b0', { roughness: 0.25, metalness: 0.85 });
  const pad = fabric('#2b2236');
  const ledMat = new THREE.MeshBasicMaterial({ color: new THREE.Color('#ff4f7b').multiplyScalar(0.2), toneMapped: false });
  // headband arc over +Y (origin = midpoint between the cups)
  const band = new THREE.Mesh(new THREE.TorusGeometry(0.178, 0.015, 12, 48, Math.PI), body);
  band.scale.set(1, 1.08, 1.6); g.add(band);
  const cushion = new THREE.Mesh(new THREE.TorusGeometry(0.166, 0.012, 10, 40, Math.PI * 0.6), pad);
  cushion.rotation.z = Math.PI * 0.2; cushion.scale.set(1, 1.08, 1.6); g.add(cushion);
  const cups = [];
  [-1, 1].forEach((k) => {
    const yoke = new THREE.Mesh(new THREE.TorusGeometry(0.062, 0.006, 8, 24, Math.PI), metal);
    yoke.rotation.y = Math.PI / 2; yoke.position.set(k * 0.18, 0.01, 0); g.add(yoke);
    const cup = new THREE.Group(); cup.position.set(k * 0.18, -0.015, 0); g.add(cup);
    const shell = new THREE.Mesh(new THREE.CylinderGeometry(0.058, 0.062, 0.05, 32), body);
    shell.rotation.z = Math.PI / 2; shell.position.x = k * 0.012; cup.add(shell);
    const cap = new THREE.Mesh(new THREE.CylinderGeometry(0.044, 0.044, 0.012, 32), accent);
    cap.rotation.z = Math.PI / 2; cap.position.x = k * 0.04; cup.add(cap);
    const led = new THREE.Mesh(new THREE.TorusGeometry(0.05, 0.004, 8, 32), ledMat);
    led.rotation.y = Math.PI / 2; led.position.x = k * 0.039; cup.add(led);
    const cush = new THREE.Mesh(new THREE.TorusGeometry(0.046, 0.017, 12, 28), pad);
    cush.rotation.y = Math.PI / 2; cush.position.x = -k * 0.016; cup.add(cush);
    cups.push(cup);
  });
  g.traverse((o) => { if (o.isMesh) { o.castShadow = true; o.receiveShadow = true; } });
  g.userData = { cups, ledMat };
  return g;
}
