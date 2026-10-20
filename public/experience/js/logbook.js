import { PORTALS } from './portals.config.js';

export function createLogbook({ launch }) {
  const section = document.querySelector('#logbook'), tbody = section.querySelector('tbody');
  const apps = PORTALS.filter(app => app.enabled !== false);
  const esc = s => String(s).replace(/[&<>"']/g, c => ({ '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;' }[c]));
  const rows = apps.map((app, i) => {
    const row = document.createElement('tr'); row.className = 'logbook-row'; row.style.setProperty('--row-color', app.color);
    const host = new URL(app.url).host;
    row.innerHTML = `<th scope="row"><a href="${esc(app.url)}" ${app.newTab ? 'target="_blank" rel="noopener noreferrer"' : ''}><span class="logbook-number">${String(i + 1).padStart(2,'0')}</span><span>${esc(app.title)}<small class="logbook-mobile-stack">${esc(app.stack || 'Not specified')}</small></span><span class="logbook-arrow" aria-hidden="true">→</span></a><svg class="logbook-route" viewBox="0 0 500 40" preserveAspectRatio="none" aria-hidden="true"><path pathLength="1" d="M0 33 C80 33 70 8 150 8 S220 34 290 20 S380 4 500 4"/></svg><div class="row-cover" aria-hidden="true" style="--cover-bg:${app.cover?.[0] || '#17131e'}"><b>${String(i+1).padStart(2,'0')}</b><span>${esc(app.category)}</span></div></th><td><span class="logbook-host">${esc(host)}</span></td><td>${esc(app.stack || 'Not specified')}</td><td>${esc(app.year || '—')}</td>`;
    row.querySelector('a').addEventListener('click', e => launch(app.id, e));
    tbody.appendChild(row); return row;
  });
  const roles = [
    ['01', 'Product & direction', 'Finding the useful question before building the answer.'],
    ['02', 'Interface & identity', 'Type, rhythm and small details with a reason to exist.'],
    ['03', 'Creative development', 'Interactive worlds in Three.js, JavaScript and the browser.'],
    ['04', 'Front-end engineering', 'Responsive interfaces, real interactions, careful delivery.'],
    ['05', 'Collaboration', 'From classroom ideas to shared, shipped experiments.'],
  ];
  const container = section.querySelector('.crew-roles'), dot = section.querySelector('.crew-dot');
  let selected = 0;
  const buttons = roles.map(([number, title, description], i) => {
    const b = document.createElement('button'); b.type = 'button'; b.className = 'crew-role';
    b.innerHTML = `<span>${number}</span><span><strong>${title}</strong><small>${description}</small></span><span aria-hidden="true">→</span>`;
    const activate = () => { selected = i; buttons.forEach((item, n) => item.setAttribute('aria-pressed', String(n === selected))); placeDot(); };
    b.addEventListener('pointerenter', activate); b.addEventListener('focus', activate); b.addEventListener('click', activate);
    container.appendChild(b); return b;
  });
  function placeDot() { const b = buttons[selected]; dot.style.transform = `translateY(${b.offsetTop + b.offsetHeight / 2 - 5}px)`; }
  const observer = new IntersectionObserver(entries => entries.forEach(entry => { entry.target.classList.toggle('in-view', entry.isIntersecting); }), { threshold: .12 });
  [...rows, ...section.querySelectorAll('.crew,.logbook-deck')].forEach((el, i) => { el.style.setProperty('--reveal-delay', `${i % 3 * 45}ms`); observer.observe(el); });
  new ResizeObserver(placeDot).observe(container);
  buttons[0].setAttribute('aria-pressed', 'true'); placeDot();
  return { update() {
    const r = section.getBoundingClientRect(), blend = Math.max(0, Math.min(1, (innerHeight * .55 - r.top) / (innerHeight * .3)));
    document.body.classList.toggle('logbook-active', r.top < innerHeight * .45 && r.bottom > 0);
    document.documentElement.style.setProperty('--editorial-blend', blend.toFixed(3));
  }, get state() { return { rows: rows.length, role: selected }; } };
}
