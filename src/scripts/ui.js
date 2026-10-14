// Mobile menu, scroll reveal, current year. No dependencies.
const nav = document.querySelector('[data-nav]');
const burger = document.querySelector('[data-burger]');

function setMenu(open) {
  if (!nav || !burger) return;
  nav.classList.toggle('is-open', open);
  burger.setAttribute('aria-expanded', String(open));
  burger.setAttribute('aria-label', open ? 'Закрыть меню' : 'Открыть меню');
}
burger?.addEventListener('click', () => setMenu(burger.getAttribute('aria-expanded') !== 'true'));
nav?.addEventListener('click', (e) => {
  if (e.target.closest('a')) setMenu(false);
});
document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape' && burger?.getAttribute('aria-expanded') === 'true') {
    setMenu(false);
    burger.focus();
  }
});
window.matchMedia('(min-width: 900px)').addEventListener('change', (e) => {
  if (e.matches) setMenu(false);
});

document.querySelectorAll('[data-year]').forEach((el) => {
  el.textContent = String(new Date().getFullYear());
});

const items = document.querySelectorAll('[data-reveal]');
if (items.length) {
  if (!('IntersectionObserver' in window) || window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
    items.forEach((el) => el.classList.add('is-visible'));
  } else {
    const io = new IntersectionObserver(
      (entries) => {
        entries.forEach((en) => {
          if (en.isIntersecting) {
            en.target.classList.add('is-visible');
            io.unobserve(en.target);
          }
        });
      },
      { rootMargin: '0px 0px -8% 0px', threshold: 0.08 },
    );
    items.forEach((el) => io.observe(el));
  }
}

// Hero scroll effect fallback for browsers without CSS scroll-driven animations.
// (Where animation-timeline is supported the same effect is pure CSS and this block does nothing.)
const stage = document.querySelector('[data-hero-stage]');
const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
if (stage && !reduced && !(window.CSS && CSS.supports('animation-timeline: scroll()'))) {
  const clamp = (v) => Math.min(1, Math.max(0, v));
  let ticking = false;
  let active = true;
  const update = () => {
    ticking = false;
    const vh = window.innerHeight;
    stage.style.setProperty('--p', clamp(window.scrollY / (0.26 * vh)).toFixed(3));
    stage.style.setProperty('--q', clamp(window.scrollY / (0.16 * vh)).toFixed(3));
  };
  window.addEventListener('scroll', () => {
    if (active && !ticking) { ticking = true; requestAnimationFrame(update); }
  }, { passive: true });
  // stop work once the hero stage is far out of view
  new IntersectionObserver(([e]) => { active = e.isIntersecting; if (active) update(); }).observe(stage);
  update();
}
