import { PORTALS } from './portals.config.js';

export function createHiddenLayer() {
  const apps = PORTALS.filter(p => p.enabled !== false), earned = new Set(), weatherSeen = new Set();
  let secretOpen = false, sequence = 0, returnFocus = null;
  const konami = ['ArrowUp','ArrowUp','ArrowDown','ArrowDown','ArrowLeft','ArrowRight','ArrowLeft','ArrowRight','b','a'];
  const escape = text => String(text).replace(/[&<>"']/g, c => ({ '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;' }[c]));
  const toolbar = document.createElement('nav'); toolbar.className = 'hidden-tools'; toolbar.setAttribute('aria-label', 'Room utilities');
  toolbar.innerHTML = '<button type="button" data-tool="directory">Portals</button><button type="button" data-tool="achievements">Badges <kbd>A</kbd></button><button type="button" data-tool="terminal" aria-label="Open mini terminal">Terminal</button><button type="button" data-tool="credits">Credits</button>';
  const dialog = document.createElement('dialog'); dialog.className = 'nook-dialog'; dialog.dataset.lenisPrevent = ''; dialog.setAttribute('aria-labelledby', 'hidden-title');
  dialog.innerHTML = '<button type="button" class="hidden-close" aria-label="Close dialog">×</button><div class="hidden-content"></div>';
  const live = document.createElement('p'); live.className = 'sr-only'; live.setAttribute('role','status');
  document.body.append(toolbar, dialog, live);
  const content = dialog.querySelector('.hidden-content');
  const names = { first: ['First light', 'Find your first portal.'], explorer: ['Every corner', 'Find all seven portals.'], dj: ['Night selector', 'Change the radio station.'], sky: ['Weather watcher', 'Try all five weather modes.'], pixel: ['Another frequency', 'Enter the Konami code.'], room: ['Behind the shelf', 'Enter the secret listening room.'] };
  function track(event, data = {}) {
    try { if (typeof window.nookTrack === 'function') window.nookTrack(event, data); } catch { /* Host analytics must never interrupt exploration. */ }
    window.dispatchEvent(new CustomEvent('nook:track', { detail: { event, ...data } }));
  }
  function award(id) {
    if (earned.has(id)) return;
    earned.add(id); live.textContent = `Achievement unlocked: ${names[id][0]}`; track('achievement', { id });
  }
  function sync() {
    const found = window.nookPortals?.found;
    if (found?.size) award('first');
    if (found?.size === apps.length) award('explorer');
  }
  function close() {
    dialog.close();
    if (secretOpen) { secretOpen = false; window.dispatchEvent(new CustomEvent('nook:secret', { detail: { open: false } })); }
    returnFocus?.focus({ preventScroll: true });
  }
  function show(tool) {
    sync();
    returnFocus = document.activeElement;
    if (secretOpen) { secretOpen = false; window.dispatchEvent(new CustomEvent('nook:secret', { detail: { open: false } })); }
    content.replaceChildren();
    if (tool === 'directory') {
      content.innerHTML = `<p class="console-eyebrow">EVERY PROJECT / KEYBOARD & SCREEN READER</p><h2 id="hidden-title">Choose a portal.</h2><p>No hovering, hunting, or WebGL required. <a href="?view=2d">Use 2D mode</a> · <a href="/projects">Text-only directory</a></p><ul class="portal-directory">${apps.map(p => `<li><a href="${escape(p.url)}" target="_blank" rel="noopener noreferrer" data-portal-id="${escape(p.id)}">${escape(p.title)} <span aria-hidden="true">↗</span></a><p>${escape(p.tagline || '')}</p><a class="portal-deep" href="#portal=${encodeURIComponent(p.id)}">Peek inside</a></li>`).join('')}</ul>`;
      content.querySelectorAll('[data-portal-id]').forEach(a => a.addEventListener('click', e => { if (window.nookPortals) window.nookPortals.launch(a.dataset.portalId, e); else track('portal_launch', { id: a.dataset.portalId, source: 'directory' }); }));
      content.querySelectorAll('.portal-deep').forEach(a => a.addEventListener('click', () => { close(); if (location.hash === a.hash) window.nookPortals?.peek(decodeURIComponent(a.hash.slice(8))); }));
    } else if (tool === 'achievements') {
      content.innerHTML = `<p class="console-eyebrow">THIS VISIT / ${earned.size} OF 6</p><h2 id="hidden-title">Little discoveries.</h2><ul class="achievement-list">${Object.entries(names).map(([id, [name, hint]]) => `<li class="${earned.has(id) ? 'earned' : ''}"><span>${earned.has(id) ? 'UNLOCKED' : 'WAITING'}</span><h3>${name}</h3><p>${hint}</p></li>`).join('')}</ul><button type="button" data-secret ${earned.has('explorer') ? '' : 'disabled'}>${earned.has('explorer') ? 'Open the bookshelf passage' : 'Find every portal to open the bookshelf'}</button>`;
      content.querySelector('[data-secret]').addEventListener('click', () => show('secret'));
    } else if (tool === 'secret') {
      if (!earned.has('explorer')) return;
      award('room'); secretOpen = true; window.dispatchEvent(new CustomEvent('nook:secret', { detail: { open: true } }));
      content.innerHTML = '<p class="console-eyebrow">ROOM 00 / BEHIND THE BOOKSHELF</p><h2 id="hidden-title">You found your quiet.</h2><div class="secret-diorama" role="img" aria-label="A quiet amber-lit listening alcove with a spinning record and a chair"><div class="secret-record"></div><div class="secret-chair"></div><span>STAY A WHILE</span></div><p>Every corner explored. Nothing left to rush toward.</p><button type="button" data-credits>Let the credits roll</button>';
      content.querySelector('[data-credits]').addEventListener('click', () => show('credits'));
    } else if (tool === 'credits') {
      content.innerHTML = '<p class="console-eyebrow">TWELVE CHAPTERS / ONE SMALL WORLD</p><h2 id="hidden-title">Made for slowing down.</h2><div class="credits-window" tabindex="0" role="region" aria-label="Scrolling credits; focus to pause"><div class="credits-roll"><p>nook.fm · Vibes</p><h3>A room to come home to.</h3><p>World & light · Three.js<br>Choreography · GSAP & Lenis<br>Radio · Web Audio synthesis<br>Type · Fraunces, Inter & Pacifico</p><p>Motion references</p><h3>PLOTBLOC · tidewend<br>Sootwick · feltip<br>Ashgrove · Venice after dark</h3><p>Seven projects. Twelve chapters.<br>And you, for staying.</p><h3>Plug in. Sink in.</h3></div></div>';
    } else {
      content.innerHTML = '<p class="console-eyebrow">NOOK SHELL / SAFE COMMANDS ONLY</p><h2 id="hidden-title">A quieter terminal.</h2><div class="terminal-output" tabindex="0" role="log" aria-label="Terminal output" aria-live="polite"></div><form class="terminal-form"><label for="terminal-command">guest@nook:~</label><input id="terminal-command" name="command" autocomplete="off" spellcheck="false" placeholder="help"><button type="submit">Run</button></form>';
      const output = content.querySelector('.terminal-output');
      const print = text => { const p = document.createElement('p'); p.textContent = text; output.append(p); while (output.children.length > 30) output.firstElementChild.remove(); output.scrollTop = output.scrollHeight; };
      print('Welcome home. Type help. No code is executed.');
      content.querySelector('form').addEventListener('submit', e => {
        e.preventDefault(); const input = content.querySelector('input'), command = input.value.trim().toLowerCase(); input.value = '';
        if (!command) return; print(`› ${command}`);
        const [cmd, arg] = command.split(/\s+/);
        if (cmd === 'help') print('help · portals · weather rain|storm|snow|clear|fog · station 1|2|3 · badges · room · pixel · credits · clear');
        else if (cmd === 'clear') output.replaceChildren();
        else if (cmd === 'portals') show('directory');
        else if (cmd === 'badges') show('achievements');
        else if (cmd === 'credits') show('credits');
        else if (cmd === 'room') earned.has('explorer') ? show('secret') : print('The shelf stays closed until every portal is found.');
        else if (cmd === 'pixel') { pixel(); print('Another frequency toggled.'); }
        else if (cmd === 'weather' && ['rain','storm','snow','clear','fog'].includes(arg) && window.nookWeather) { window.nookWeather.set(arg); const select = document.querySelector('[name=weather]'); if (select) select.value = arg; print(`Outside: ${arg}`); }
        else if (cmd === 'station' && /^[123]$/.test(arg) && window.nookAudio) { window.nookAudio.setStation(Number(arg) - 1); const select = document.querySelector('[name=station]'); if (select) select.value = Number(arg) - 1; award('dj'); print(`Station ${arg} · 3 second crossfade`); }
        else print('Unknown or unavailable command. Type help.');
      });
    }
    if (!dialog.open) dialog.showModal();
    requestAnimationFrame(() => (content.querySelector('input') || dialog.querySelector('.hidden-close')).focus());
    track('panel_open', { panel: tool });
  }
  function pixel() { document.body.classList.toggle('eight-bit'); award('pixel'); window.dispatchEvent(new Event('nook:pixel')); }
  toolbar.addEventListener('click', e => { const b = e.target.closest('[data-tool]'); if (b) show(b.dataset.tool); });
  dialog.querySelector('.hidden-close').addEventListener('click', close);
  dialog.addEventListener('cancel', e => { e.preventDefault(); close(); });
  dialog.addEventListener('click', e => { if (e.target === dialog) close(); });
  window.addEventListener('keydown', e => {
    if (e.isComposing || e.keyCode === 229 || e.repeat || e.metaKey || e.ctrlKey || e.altKey || e.target.closest?.('input,textarea,select,[contenteditable=true]')) return;
    const key = e.key.length === 1 ? e.key.toLowerCase() : e.key;
    if (key === konami[sequence]) { sequence++; if (sequence === konami.length) { sequence = 0; pixel(); e.preventDefault(); return; } }
    else sequence = key === konami[0] ? 1 : 0;
    if (key === 'a' && !sequence) show('achievements');
    if (key === '`') { e.preventDefault(); show('terminal'); }
  });
  window.addEventListener('nook:discover', e => { sync(); track('portal_discovered', e.detail); });
  window.addEventListener('nook:station', () => award('dj'));
  window.addEventListener('nook:weather', e => { weatherSeen.add(e.detail.weather); if (weatherSeen.size === 5) award('sky'); track('weather_change', e.detail); });
  weatherSeen.add('rain');
  window.addEventListener('nook:ready', sync, { once: true });
  const peek = () => { if (location.hash.startsWith('#portal=')) { let id; try { id = decodeURIComponent(location.hash.slice(8)); } catch { return; } if (apps.some(p => p.id === id)) { if (window.nookPortals) window.nookPortals.peek(id); else if (document.body.classList.contains('scene-fallback')) show('directory'); } } };
  window.addEventListener('hashchange', peek); window.addEventListener('nook:ready', peek, { once: true }); window.addEventListener('nook:fallback', peek);
  if (document.body.classList.contains('scene-fallback')) peek();
  return { show, earned };
}
