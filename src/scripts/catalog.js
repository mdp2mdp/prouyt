// Category page: custom rounded mechanism filter (listbox) + keep the active section visible in the mobile strip.
const root = document.querySelector('[data-filter]');
const items = [...document.querySelectorAll('[data-grid] > li')];

if (root) {
  root.hidden = false;
  const btn = root.querySelector('[data-dd-btn]');
  const list = root.querySelector('[data-dd-list]');
  const valueEl = root.querySelector('[data-dd-value]');
  const status = root.querySelector('[data-filter-status]');
  const opts = [...list.querySelectorAll('[role="option"]')];
  let active = 0;

  const setActive = (i) => {
    active = (i + opts.length) % opts.length;
    opts.forEach((o, k) => o.classList.toggle('is-active', k === active));
    opts[active].scrollIntoView({ block: 'nearest' });
  };
  const open = () => {
    list.hidden = false;
    btn.setAttribute('aria-expanded', 'true');
    setActive(Math.max(0, opts.findIndex((o) => o.getAttribute('aria-selected') === 'true')));
    list.focus();
  };
  const close = (focusBtn = true) => {
    list.hidden = true;
    btn.setAttribute('aria-expanded', 'false');
    opts.forEach((o) => o.classList.remove('is-active'));
    if (focusBtn) btn.focus();
  };
  const choose = (i) => {
    const o = opts[i];
    opts.forEach((x) => x.setAttribute('aria-selected', String(x === o)));
    valueEl.textContent = o.querySelector('span').childNodes[0].textContent.trim();
    const v = o.dataset.value;
    let shown = 0;
    items.forEach((li) => {
      const ok = !v || li.dataset.mechanism === v;
      li.hidden = !ok;
      if (ok) shown++;
    });
    status.textContent = v ? `Показано моделей: ${shown} из ${items.length}` : '';
    close();
  };

  btn.addEventListener('click', () => (list.hidden ? open() : close()));
  btn.addEventListener('keydown', (e) => {
    if (e.key === 'ArrowDown' || e.key === 'ArrowUp') { e.preventDefault(); if (list.hidden) open(); }
  });
  opts.forEach((o, i) => {
    o.addEventListener('click', () => choose(i));
    o.addEventListener('mousemove', () => setActive(i));
  });
  list.addEventListener('keydown', (e) => {
    if (e.key === 'ArrowDown') { e.preventDefault(); setActive(active + 1); }
    else if (e.key === 'ArrowUp') { e.preventDefault(); setActive(active - 1); }
    else if (e.key === 'Home') { e.preventDefault(); setActive(0); }
    else if (e.key === 'End') { e.preventDefault(); setActive(opts.length - 1); }
    else if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); choose(active); }
    else if (e.key === 'Escape') { e.preventDefault(); close(); }
    else if (e.key === 'Tab') close(false);
  });
  document.addEventListener('click', (e) => { if (!list.hidden && !root.querySelector('[data-dd]').contains(e.target)) close(false); });
}

const activeNav = document.querySelector('[data-cnav] .is-active');
const strip = document.querySelector('[data-cnav]');
if (activeNav && strip && strip.scrollWidth > strip.clientWidth) {
  strip.scrollLeft = activeNav.parentElement.offsetLeft - 16;
}
