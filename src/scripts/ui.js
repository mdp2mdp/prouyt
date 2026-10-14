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
  const hero = stage.querySelector('.hero');
  const update = () => {
    ticking = false;
    const vh = window.innerHeight;
    const pinEnd = Math.max(0, stage.offsetHeight - hero.offsetHeight); // scroll distance at which the pin ends
    const fade = 0.12 * vh;
    stage.style.setProperty('--p', clamp(window.scrollY / (pinEnd + fade)).toFixed(3));
    stage.style.setProperty('--q', clamp((window.scrollY - pinEnd) / fade).toFixed(3));
  };
  window.addEventListener('scroll', () => {
    if (active && !ticking) { ticking = true; requestAnimationFrame(update); }
  }, { passive: true });
  // stop work once the hero stage is far out of view
  new IntersectionObserver(([e]) => { active = e.isIntersecting; if (active) update(); }).observe(stage);
  update();
}

// In-page anchors (#catalog, #about, #contacts): smooth scroll without leaving a #hash in the address bar,
// so a page refresh restores the previous scroll position instead of jumping to the anchor.
const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
const trim = (p) => (p.length > 1 && p.endsWith(String.fromCharCode(47)) ? p.slice(0, -1) : p);
const here = trim(location.pathname);
document.addEventListener('click', (e) => {
  const a = e.target.closest('a[href*="#"]');
  if (!a || e.defaultPrevented || e.metaKey || e.ctrlKey || e.shiftKey || a.target) return;
  const u = new URL(a.href, location.href);
  if (!u.hash || u.origin !== location.origin || trim(u.pathname) !== here) return;
  const target = document.getElementById(decodeURIComponent(u.hash.slice(1)));
  if (!target) return;
  e.preventDefault();
  target.scrollIntoView({ behavior: reduceMotion ? 'auto' : 'smooth', block: 'start' });
  history.replaceState(null, '', location.pathname + location.search);
});
// Arriving from another page with a #hash: the browser jumps to the anchor, then the hash is dropped from the URL.
if (location.hash) window.addEventListener('load', () => setTimeout(() => history.replaceState(null, '', location.pathname + location.search), 0), { once: true });
