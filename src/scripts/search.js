// Header search: loads the small static index on first open and filters it in the browser.
const root = document.querySelector('[data-search]');
const openers = document.querySelectorAll('[data-search-open]');

if (root && openers.length) {
  const input = root.querySelector('[data-search-input]');
  const form = root.querySelector('[data-search-form]');
  const list = root.querySelector('[data-search-results]');
  const hint = root.querySelector('[data-search-hint]');
  const status = root.querySelector('[data-search-status]');
  const indexUrl = root.dataset.index;
  let data = null;
  let loading = null;
  let results = [];
  let active = -1;
  let lastOpener = null;

  // ё→е, lower case, only letters/digits/spaces
  const norm = (s) => s.toLowerCase().replaceAll('ё', 'е').replace(/[^a-zа-я0-9]+/g, ' ').trim();
  // typed on the wrong keyboard layout (e.g. "nhbj" instead of "трио")
  const LAT = "qwertyuiop[]asdfghjkl;'zxcvbnm,.";
  const CYR = 'йцукенгшщзхъфывапролджэячсмитьбю';
  const swap = (s) => [...s.toLowerCase()].map((ch) => { const i = LAT.indexOf(ch); return i >= 0 ? CYR[i] : ch; }).join('');

  const load = () => (loading ??= fetch(indexUrl).then((r) => r.json()).then((d) => {
    d.items.forEach((it) => { it.hay = norm([it.n, it.t, it.c, it.m, it.k].join(' ')); it.name = norm(it.n); });
    data = d;
    return d;
  }));

  const score = (it, tokens) => {
    let total = 0;
    for (const t of tokens) {
      if (!it.hay.includes(t)) return 0;
      total += it.name.startsWith(t) ? 5 : it.name.split(' ').some((w) => w.startsWith(t)) ? 4 : it.name.includes(t) ? 3 : it.hay.split(' ').some((w) => w.startsWith(t)) ? 2 : 1;
    }
    return total;
  };
  const find = (q) => {
    const run = (text) => {
      const tokens = norm(text).split(' ').filter(Boolean);
      if (!tokens.length) return [];
      return data.items.map((it, i) => ({ it, i, s: score(it, tokens) })).filter((x) => x.s > 0).sort((a, b) => b.s - a.s || a.i - b.i).map((x) => x.it);
    };
    const direct = run(q);
    return direct.length ? direct : run(swap(q));
  };

  const esc = (s) => s.replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const render = () => {
    const q = input.value.trim();
    active = -1;
    input.setAttribute('aria-expanded', 'false');
    input.removeAttribute('aria-activedescendant');
    if (!data) { list.hidden = true; hint.hidden = false; hint.textContent = 'Загружаем каталог…'; return; }
    if (!q) {
      results = [];
      list.hidden = true; list.innerHTML = '';
      hint.hidden = false;
      hint.innerHTML = `Начните вводить название: Трио, Оскар, Кельн… Или откройте раздел:<div class="search__chips">${data.categories.map((c) => `<a href="${c.u}">${esc(c.n)}</a>`).join('')}</div>`;
      status.textContent = '';
      return;
    }
    results = find(q).slice(0, 8);
    if (!results.length) {
      list.hidden = true; list.innerHTML = '';
      hint.hidden = false;
      hint.innerHTML = `Ничего не найдено. Попробуйте другое слово или позвоните нам: <a href="${root.dataset.phone}">${esc(root.dataset.phoneText)}</a>.`;
      status.textContent = 'Ничего не найдено';
      return;
    }
    hint.hidden = true;
    list.hidden = false;
    input.setAttribute('aria-expanded', 'true');
    list.innerHTML = results.map((it, i) => `
      <li role="presentation"><a class="search__item" role="option" id="sr-${i}" aria-selected="false" href="${it.u}">
        <span class="search__thumb">${it.i ? `<img src="${it.i}" alt="" width="80" height="53" loading="lazy" decoding="async">` : ''}</span>
        <span><span class="search__name">${esc(it.n)}</span><span class="search__meta" style="display:block">${esc(it.t)}${it.d ? ' · ' + esc(it.d) : ''}</span></span>
        <span class="search__price">${esc(it.p)}</span>
      </a></li>`).join('');
    status.textContent = `Найдено моделей: ${results.length}`;
  };

  const setActive = (i) => {
    const links = list.querySelectorAll('.search__item');
    if (!links.length) return;
    active = (i + links.length) % links.length;
    links.forEach((a, k) => { a.classList.toggle('is-active', k === active); a.setAttribute('aria-selected', String(k === active)); });
    input.setAttribute('aria-activedescendant', links[active].id);
    links[active].scrollIntoView({ block: 'nearest' });
  };

  const open = (opener) => {
    lastOpener = opener ?? lastOpener;
    root.hidden = false;
    document.documentElement.style.overflow = 'hidden';
    lastOpener?.setAttribute('aria-expanded', 'true');
    render();
    load().then(render).catch(() => { hint.hidden = false; hint.textContent = 'Не удалось загрузить каталог. Обновите страницу.'; });
    input.focus();
  };
  const close = () => {
    root.hidden = true;
    document.documentElement.style.overflow = '';
    lastOpener?.setAttribute('aria-expanded', 'false');
    lastOpener?.focus();
  };

  openers.forEach((b) => b.addEventListener('click', () => open(b)));
  root.querySelectorAll('[data-search-close]').forEach((b) => b.addEventListener('click', close));
  input.addEventListener('input', render);
  form.addEventListener('submit', (e) => { e.preventDefault(); const a = list.querySelector('.search__item.is-active') ?? list.querySelector('.search__item'); if (a) location.href = a.href; });
  root.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') { e.preventDefault(); close(); }
    else if (e.key === 'ArrowDown') { e.preventDefault(); setActive(active + 1); }
    else if (e.key === 'ArrowUp') { e.preventDefault(); setActive(active - 1); }
    else if (e.key === 'Tab') {
      // keep focus inside the dialog
      const f = [...root.querySelectorAll('input, button, a[href]')].filter((el) => el.offsetParent !== null);
      if (!f.length) return;
      const first = f[0], last = f[f.length - 1];
      if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
      else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
    }
  });
  list.addEventListener('click', (e) => { if (e.target.closest('a')) document.documentElement.style.overflow = ''; });
  document.addEventListener('keydown', (e) => {
    // "/" opens the search when no field is focused
    if (e.key === '/' && root.hidden && !/input|textarea|select/i.test(document.activeElement?.tagName ?? '') && !e.metaKey && !e.ctrlKey) { e.preventDefault(); open(openers[0]); }
  });
}
