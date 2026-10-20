export function createPlayer({ audio, timeline, weather, quality }) {
  const panel = document.createElement('details');
  panel.className = 'listening-console';
  panel.innerHTML = `<summary><span class="console-dot" aria-hidden="true"></span> Listening room <span aria-hidden="true">+</span></summary>
    <div class="console-body"><p class="console-eyebrow">PROCEDURAL RADIO / NO STREAMS</p>
    <label>Station<select name="station"><option value="0">01 · Midnight study</option><option value="1">02 · Rainy jazz</option><option value="2">03 · Daydream</option></select></label>
    <button type="button" class="console-play" aria-pressed="false">Play radio</button>
    <label>Volume <output id="volume-readout">70%</output><input aria-label="Radio volume" type="range" name="volume" min="0" max="100" value="70"></label>
    <label>Tape warmth <output id="lofi-readout">50%</output><input aria-label="Lo-fi amount" type="range" name="lofi" min="0" max="100" value="50"></label>
    <label>Outside<select name="weather"><option value="rain">Rain</option><option value="storm">Thunderstorm</option><option value="snow">Snow</option><option value="clear">Clear / shooting stars</option><option value="fog">Fog</option></select></label>
    <p class="console-status" role="status">Sound starts only when you ask.</p><p class="console-foot">Local sky · <span data-day></span> / <span data-quality>${quality}</span> quality</p></div>`;
  document.body.append(panel);
  const play = panel.querySelector('.console-play'), status = panel.querySelector('.console-status');
  let stationTimer;
  play.addEventListener('click', async () => {
    try {
      if (audio.enabled) audio.disable(); else await audio.enable(timeline());
      document.querySelector('#soundBtn')?.setAttribute('aria-pressed', String(audio.enabled));
      status.textContent = audio.enabled ? 'Live synthesis · headphones recommended.' : 'Radio paused.';
    } catch { status.textContent = 'Audio unavailable. You can still explore silently.'; }
  });
  panel.querySelector('[name=station]').addEventListener('change', e => {
    audio.setStation(Number(e.target.value));
    const name = e.target.selectedOptions[0].textContent.slice(5);
    status.textContent = `Crossfading to ${name} · 3 seconds`;
    clearTimeout(stationTimer);
    stationTimer = setTimeout(() => { status.textContent = `${name} · ${audio.enabled ? 'live synthesis' : 'ready when you are'}`; }, 3000);
    window.dispatchEvent(new CustomEvent('nook:station', { detail: { station: audio.station } }));
  });
  for (const name of ['volume', 'lofi']) panel.querySelector(`[name=${name}]`).addEventListener('input', e => {
    audio[name === 'volume' ? 'setVolume' : 'setLofi'](Number(e.target.value) / 100);
    panel.querySelector(`#${name}-readout`).textContent = `${e.target.value}%`;
  });
  panel.querySelector('[name=weather]').addEventListener('change', e => weather.set(e.target.value));
  let wasEnabled;
  return { panel, update(day, tier) {
    if (audio.enabled !== wasEnabled) {
      wasEnabled = audio.enabled;
      play.textContent = audio.enabled ? 'Pause radio' : 'Play radio'; play.setAttribute('aria-pressed', String(audio.enabled));
      const sound = document.querySelector('#soundBtn');
      sound?.setAttribute('aria-pressed', String(audio.enabled));
      if (sound?.querySelector('em')) sound.querySelector('em').textContent = audio.enabled ? 'Sound on' : 'Sound off';
    }
    if (!panel.open) return;
    panel.querySelector('[data-day]').textContent = day;
    panel.querySelector('[data-quality]').textContent = tier;
  } };
}
