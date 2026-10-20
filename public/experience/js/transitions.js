import * as THREE from 'three';
import { ShaderPass } from 'three/addons/postprocessing/ShaderPass.js';
import { safeSession } from './utils.js';

export const TRANSITION_TYPES = ['warp', 'vinyl', 'rain', 'glitch', 'ink', 'iris', 'drawer', 'canal'];
export function createTransitions() {
  const reduced = matchMedia('(prefers-reduced-motion: reduce)');
  let uniforms = { tDiffuse: { value: null }, uProgress: { value: 0 }, uType: { value: 0 }, uColor: { value: new THREE.Color('#dbbc79') }, uCenter: { value: new THREE.Vector2(.5, .5) }, uReduced: { value: 0 }, uAspect: { value: innerWidth / innerHeight } };
  const pass = new ShaderPass({ uniforms, vertexShader: `varying vec2 vUv; void main(){vUv=uv;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}`, fragmentShader: `
    uniform sampler2D tDiffuse;uniform float uProgress,uType,uReduced,uAspect;uniform vec3 uColor;uniform vec2 uCenter;varying vec2 vUv;
    float hash(vec2 p){return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453);}
    float noise(vec2 p){vec2 i=floor(p),f=fract(p);f=f*f*(3.-2.*f);return mix(mix(hash(i),hash(i+vec2(1.,0.)),f.x),mix(hash(i+vec2(0.,1.)),hash(i+vec2(1.)),f.x),f.y);}
    void main(){float p=clamp(uProgress,0.,1.);vec2 uv=vUv,d=uv-uCenter;float r=length(d*vec2(uAspect,1.));float ca=0.;float mask=p;
      if(uReduced<.5){
        if(uType<.5){uv=uCenter+d*(1.-p*.65);ca=p*.025;mask=pow(p,3.);}
        else if(uType<1.5){float a=p*(1.-smoothstep(0.,1.2,r))*5.;uv=uCenter+mat2(cos(a),-sin(a),sin(a),cos(a))*d;ca=p*.008;mask=pow(p,4.);}
        else if(uType<2.5){uv.y+=p*p*(.15+noise(vec2(uv.x*35.,0.))*.5);uv.x+=sin(uv.y*90.)*.007*p;mask=smoothstep(1.-p-.1,1.-p+.1,uv.y);}
        else if(uType<3.5){float band=floor(uv.y*30.);uv.x+=(hash(vec2(band,floor(p*24.)))-.5)*p*.5;ca=p*.035;mask=p*p;}
        else if(uType<4.5){float n=noise(uv*12.)*.65+noise(uv*40.)*.35;mask=smoothstep(n-.07,n+.07,p*1.2-.1);}
        else if(uType<5.5){mask=smoothstep((1.-p)*1.5-.06,(1.-p)*1.5+.01,r);}
        else if(uType<6.5){uv.x+=p*p*.8;uv=uCenter+(uv-uCenter)*(1.-p*.4);mask=smoothstep(1.-p-.12,1.-p+.08,vUv.x);}
        else {uv+=normalize(d+vec2(.0001))*sin(r*65.-p*14.)*p*.045;ca=p*.008;mask=p*p;}
      }
      vec4 col=texture2D(tDiffuse,clamp(uv,0.,1.));col.r=texture2D(tDiffuse,clamp(uv+vec2(ca,0.),0.,1.)).r;col.b=texture2D(tDiffuse,clamp(uv-vec2(ca,0.),0.,1.)).b;
      gl_FragColor=vec4(mix(col.rgb,uColor,clamp(mask,0.,1.)),1.);
    }` });
  uniforms = pass.uniforms;
  pass.enabled = false;
  const overlay = document.createElement('div'); overlay.className = 'portal-transition-cover'; overlay.setAttribute('aria-hidden', 'true'); document.body.appendChild(overlay);
  const toast = document.createElement('div'); toast.className = 'portal-return-toast'; toast.setAttribute('role', 'status'); document.body.appendChild(toast);
  const key = 'nook.portal.return.v2'; let pending = null, away = false, phase = 'idle', start = 0, progress = 0, action = null, finish = null, newTab = true, timer;
  try { const saved = JSON.parse(safeSession.getItem(key)); if (saved && typeof saved.title === 'string' && Date.now() - saved.at < 43200000) { pending = saved; away = true; } else safeSession.removeItem(key); } catch { safeSession.removeItem(key); }
  function configure(p, center) {
    const type = TRANSITION_TYPES.includes(p.transition) ? p.transition : 'warp'; uniforms.uType.value = TRANSITION_TYPES.indexOf(type);
    uniforms.uColor.value.set(/^#[\da-f]{6}$/i.test(p.color) ? p.color : '#dbbc79');
    uniforms.uCenter.value.set(center?.x ?? .5, 1 - (center?.y ?? .5)); uniforms.uReduced.value = reduced.matches ? 1 : 0;
    overlay.style.setProperty('--transition-color', /^#[\da-f]{6}$/i.test(p.color) ? p.color : '#dbbc79'); overlay.dataset.type = type;
  }
  function clear() { progress = 0; uniforms.uProgress.value = 0; pass.enabled = false; overlay.style.opacity = '0'; phase = 'idle'; document.body.classList.remove('transition-running'); const cb = finish; finish = null; cb?.(); }
  function reverse(welcome = false) {
    if (!pending && welcome) return;
    if (pending) configure(pending);
    phase = 'reverse'; start = performance.now(); document.body.classList.add('transition-running'); pass.enabled = true;
    if (welcome) { const title = pending.title; safeSession.removeItem(key); pending = null; away = false; clearTimeout(timer); timer = setTimeout(() => { toast.textContent = `Welcome back. ${title} will be right where you left it.`; toast.classList.add('show'); timer = setTimeout(() => toast.classList.remove('show'), 3600); }, reduced.matches ? 200 : 800); }
  }
  function play(p, done, center, onFinish) {
    if (phase !== 'idle') return false;
    configure(p, center); pending = { title: p.title, color: p.color, transition: p.transition || 'warp', at: Date.now() }; safeSession.setItem(key, JSON.stringify(pending));
    away = false; newTab = p.newTab; action = done; finish = onFinish; phase = 'forward'; start = performance.now(); pass.enabled = true; document.body.classList.add('transition-running'); return true;
  }
  function returning() { if (!document.hidden && away && pending) reverse(true); }
  window.addEventListener('blur', () => { if (pending) away = true; });
  window.addEventListener('focus', returning);
  document.addEventListener('visibilitychange', () => { if (document.hidden && pending) away = true; else returning(); });
  window.addEventListener('pageshow', e => { if (e.persisted && pending) { away = true; returning(); } });
  if (pending) requestAnimationFrame(returning);
  return { pass, play,
    update() {
      if (phase === 'idle' || phase === 'departed') return;
      const duration = reduced.matches ? 220 : phase === 'forward' ? 1050 : 800;
      const t = Math.min(1, (performance.now() - start) / duration);
      progress = phase === 'forward' ? t : 1 - t;
      uniforms.uProgress.value = progress; uniforms.uAspect.value = innerWidth / innerHeight;
      const type = TRANSITION_TYPES[uniforms.uType.value];
      overlay.style.opacity = String(reduced.matches ? progress : Math.pow(progress, 3));
      const x = uniforms.uCenter.value.x * 100, y = (1 - uniforms.uCenter.value.y) * 100;
      overlay.style.clipPath = reduced.matches ? 'none' : type === 'iris' ? `circle(${progress * 150}% at ${x}% ${y}%)` : type === 'drawer' ? `inset(0 ${(1-progress)*100}% 0 0)` : 'none';
      if (t < 1) return;
      if (phase === 'reverse') { clear(); return; }
      const done = action; action = null;
      if (!newTab && done) { phase = 'departed'; done(); return; }
      if (!document.hidden) reverse(false);
    },
    get state() { return { phase, progress, type: TRANSITION_TYPES[uniforms.uType.value], pending: pending?.title || null, reduced: reduced.matches }; },
  };
}
