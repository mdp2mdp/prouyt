// Category page: mechanism filter + keep the active section visible in the mobile strip.
const select = document.querySelector('[data-filter-mechanism]');
const items = [...document.querySelectorAll('[data-grid] > li')];
const status = document.querySelector('[data-filter-status]');

select?.addEventListener('change', () => {
  const v = select.value;
  let shown = 0;
  items.forEach((li) => {
    const ok = !v || li.dataset.mechanism === v;
    li.hidden = !ok;
    if (ok) shown++;
  });
  if (status) status.textContent = v ? `Показано моделей: ${shown} из ${items.length}` : '';
});

const active = document.querySelector('[data-cnav] .is-active');
const strip = document.querySelector('[data-cnav]');
if (active && strip && strip.scrollWidth > strip.clientWidth) {
  strip.scrollLeft = active.parentElement.offsetLeft - 16;
}
