import * as THREE from 'three';

export function createWeather({ scene, W, audio, reducedMotion }) {
  let weather = 'rain', wet = 1, snow = 0, fog = 0, lastMinute = -1, day = 0, label = 'night';
  const color = new THREE.Color();
  const star = new THREE.Line(new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(0, 0, 0), new THREE.Vector3(-0.5, 0.15, 0)]), new THREE.LineBasicMaterial({ color: '#fff3df', transparent: true, opacity: 0 }));
  star.position.set(-1, 3, -7); star.frustumCulled = false; W.group.add(star);
  const api = {
    set(value) {
      if (!['rain', 'storm', 'snow', 'clear', 'fog'].includes(value)) return;
      weather = value; W.weather = value; audio.setWeather(value);
      window.dispatchEvent(new CustomEvent('nook:weather', { detail: { weather } }));
    },
    get current() { return weather; }, get day() { return label; },
    update(t, dt) {
      const date = new Date(), minute = date.getHours() * 60 + date.getMinutes();
      if (minute !== lastMinute) {
        lastMinute = minute;
        day = Math.max(0, Math.sin((minute / 60 - 6) / 12 * Math.PI));
        label = day > 0.6 ? 'daylight' : day > 0 ? 'golden hour' : 'night';
      }
      const k = Math.min(1, dt / 3);
      wet += ((weather === 'rain' || weather === 'storm' ? 1 : 0) - wet) * k * 3;
      snow += ((weather === 'snow' ? 1 : 0) - snow) * k * 3;
      fog += ((weather === 'fog' ? 1 : 0) - fog) * k * 3;
      W.snowAmount = snow;
      W.rain.material.opacity = 0.35 * wet + 0.65 * snow;
      W.drops.material.opacity = 0.55 * wet;
      W.moonRect.color.copy(color.set('#8aa2ff').lerp(new THREE.Color('#ffdda0'), day));
      W.moonRect.intensity *= 1 + day * 1.6;
      W.hemi.intensity += day * 0.5;
      scene.fog.density = 0.03 + fog * 0.055;
      const u = t % 17;
      star.visible = weather === 'clear' && day < 0.2 && !reducedMotion && u < 1.3;
      if (star.visible) {
        star.position.set(-4 + u * 3, 4 - u, -7);
        star.material.opacity = Math.sin(u / 1.3 * Math.PI);
      }
    },
  };
  W.weather = weather;
  return api;
}
