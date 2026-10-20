/* =========================================================
   nook.fm REANIMATED — PART 3 (second half): DEPTH OF FIELD
   - three.js BokehPass, ONLY enabled while something is in focus
     (Part 2 focus dolly; Part 4 drawer mode will reuse setTarget)
   - focus distance = view-axis distance to the target, every frame,
     so the dolly stays sharp on the object while the room melts
   - blur ramps in/out with maxblur (no pop when the pass toggles)
   - the depth pre-pass hides additive / transparent FX (dust,
     shafts, rain, glass, neon, sprites) so they don't write fake
     depth; warm() renders it once at boot → no first-use hitch
   - low tier: never enabled
   API: createDOF({ scene, camera, tier }) → { pass, setTarget(v3|null),
        update(dt), warm(composer), setTier(t), k }
   ========================================================= */
import * as THREE from 'three';
import { BokehPass } from 'three/addons/postprocessing/BokehPass.js';

export function createDOF({ scene, camera, tier = 'high' }) {
  const pass = new BokehPass(scene, camera, { focus: 2, aperture: 0.022, maxblur: 0 });
  pass.enabled = false;
  const U = pass.uniforms;

  let target = null, k = 0, hide = null;
  const fwd = new THREE.Vector3(), d = new THREE.Vector3();

  // objects that must not write into the depth pre-pass
  function collect() {
    hide = [];
    scene.traverse((o) => {
      if (o.name === 'atmos') { hide.push(o); return; }
      const m = o.material;
      if (o.isPoints || o.isLine || o.isSprite) hide.push(o);
      else if (o.isMesh && m && !Array.isArray(m) && m.transparent && !m.depthWrite) hide.push(o);
    });
  }
  const vis = [];
  const baseRender = pass.render.bind(pass);
  pass.render = (renderer, writeBuffer, readBuffer, deltaTime, maskActive) => {
    if (!hide) collect();
    // hide only for the depth render: BokehPass draws depth first, then the blur quad.
    // We wrap renderer.render once so the colour composite is untouched.
    const orig = renderer.render;
    renderer.render = function (s, c) {
      if (s === scene) {
        const bg = s.background; s.background = null; // keep the white "far" clear, not the bg colour
        for (let i = 0; i < hide.length; i++) { vis[i] = hide[i].visible; hide[i].visible = false; }
        orig.call(this, s, c);
        for (let i = 0; i < hide.length; i++) hide[i].visible = vis[i];
        s.background = bg;
      } else orig.call(this, s, c);
    };
    try { baseRender(renderer, writeBuffer, readBuffer, deltaTime, maskActive); }
    finally { renderer.render = orig; }
  };

  function setTarget(v) { target = v || null; }

  function update(dt) {
    const goal = target && tier !== 'low' ? 1 : 0;
    k += (goal - k) * (1 - Math.exp(-dt * (goal ? 2.4 : 3.2)));
    if (k < 0.004 && !goal) k = 0;
    pass.enabled = k > 0.004;
    if (!pass.enabled) return;
    if (target) {
      camera.getWorldDirection(fwd);
      const dist = Math.max(0.2, d.copy(target).sub(camera.position).dot(fwd));
      U.focus.value += (dist - U.focus.value) * (1 - Math.exp(-dt * 10));
    }
    U.aspect.value = camera.aspect;
    U.maxblur.value = 0.0095 * k;
  }

  // render once with the pass on so MeshDepthMaterial + the bokeh shader compile at boot
  function warm(composer) {
    collect();
    const was = pass.enabled;
    pass.enabled = true; U.maxblur.value = 0.0001;
    composer.render();
    pass.enabled = was; U.maxblur.value = 0;
  }

  function setTier(t) { tier = t; }

  return { pass, setTarget, update, warm, setTier, refresh: collect, get k() { return k; } };
}
