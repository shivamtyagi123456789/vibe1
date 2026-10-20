(() => {
  window.nookTrack = window.nookTrack || (() => {});
  import('./hidden.js').then(({ createHiddenLayer }) => { window.nookHidden = createHiddenLayer(); }).catch(() => {});
  let recovered = false;
  const fallback = () => {
    if (recovered) return;
    recovered = true;
    document.documentElement.classList.remove('locked');
    document.body.classList.remove('intro', 'aperture', 'has-cursor');
    document.body.classList.add('started', 'revealed', 'scene-fallback', 'no-gsap');
    document.querySelector('#loader')?.remove();
    document.querySelector('#aperture')?.remove();
    document.querySelectorAll('.panel').forEach(p => p.classList.add('in'));
    document.querySelectorAll('[data-count]').forEach(p => p.textContent = p.dataset.count + (p.dataset.suf || ''));
    document.querySelectorAll('[data-goto]').forEach(a => a.addEventListener('click', () => document.querySelector('#' + a.dataset.goto)?.scrollIntoView()));
    import('./portals.config.js').then(({ PORTALS }) => {
      const list = document.querySelector('.catalog-list');
      if (!list) return;
      list.replaceChildren();
      PORTALS.filter(p => p.enabled !== false).forEach(p => {
        const link = document.createElement('a'); link.href = p.url;
        link.target = '_blank'; link.rel = 'noopener noreferrer'; link.textContent = p.title;
        const arrow = document.createElement('span'); arrow.textContent = '↗'; link.append(arrow); list.append(link);
        document.querySelector('.shelf-fallback')?.append(link.cloneNode(true));
      });
    }).catch(() => {});
    window.dispatchEvent(new Event('nook:fallback'));
  };
  window.nookFallback = fallback;
  const timer = setTimeout(() => {
    if (document.body.classList.contains('started')) return;
    const message = document.querySelector('.ld-pct');
    if (message) message.textContent = 'The room is taking longer than expected.';
    const button = document.createElement('button');
    button.className = 'btn ghost'; button.textContent = 'Continue without 3D';
    button.onclick = fallback;
    document.querySelector('.ld-inner')?.append(button);
  }, 12000);
  if (new URLSearchParams(location.search).get('view') === '2d') { clearTimeout(timer); fallback(); }
  else requestAnimationFrame(() => requestAnimationFrame(() => import('./bundle.js').catch(fallback)));
  window.addEventListener('nook:ready', () => clearTimeout(timer), { once: true });
})();
