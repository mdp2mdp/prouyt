// Product page: scroll-snap gallery (arrows, thumbnails, swipe, keyboard) and tabs.
const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

function initGallery(root) {
  const track = root.querySelector('[data-track]');
  const thumbs = [...root.querySelectorAll('[data-thumb]')];
  const prev = root.querySelector('[data-prev]');
  const next = root.querySelector('[data-next]');
  const count = root.querySelector('[data-count]');
  const slides = [...track.children];
  let index = 0;

  const go = (i, smooth = true) => {
    const n = Math.max(0, Math.min(slides.length - 1, i));
    track.scrollTo({ left: n * track.clientWidth, behavior: smooth && !reduce ? 'smooth' : 'auto' });
    return n;
  };
  const sync = (i) => {
    if (i === index && root.dataset.ready) return;
    index = i;
    root.dataset.ready = '1';
    thumbs.forEach((t, k) => {
      if (k === i) {
        t.setAttribute('aria-current', 'true');
        const box = t.closest('[data-thumbs]');
        if (box) box.scrollTo({ left: t.offsetLeft - box.clientWidth / 2 + t.clientWidth / 2, behavior: reduce ? 'auto' : 'smooth' });
      } else t.removeAttribute('aria-current');
    });
    if (count) count.textContent = `${i + 1} / ${slides.length}`;
    if (prev) prev.disabled = i === 0;
    if (next) next.disabled = i === slides.length - 1;
  };

  let raf = 0;
  track.addEventListener('scroll', () => {
    cancelAnimationFrame(raf);
    raf = requestAnimationFrame(() => sync(Math.round(track.scrollLeft / track.clientWidth)));
  }, { passive: true });
  prev?.addEventListener('click', () => go(index - 1));
  next?.addEventListener('click', () => go(index + 1));
  thumbs.forEach((t, k) => t.addEventListener('click', () => go(k)));
  track.addEventListener('keydown', (e) => {
    if (e.key === 'ArrowRight') { e.preventDefault(); go(index + 1); }
    if (e.key === 'ArrowLeft') { e.preventDefault(); go(index - 1); }
    if (e.key === 'Home') { e.preventDefault(); go(0); }
    if (e.key === 'End') { e.preventDefault(); go(slides.length - 1); }
  });
  window.addEventListener('resize', () => go(index, false));
  sync(0);
}

function initTabs(root) {
  const tabs = [...root.querySelectorAll('[role="tab"]')];
  const panels = tabs.map((t) => document.getElementById(t.getAttribute('aria-controls')));
  const select = (i, focus = false) => {
    tabs.forEach((t, k) => {
      const on = k === i;
      t.setAttribute('aria-selected', String(on));
      t.tabIndex = on ? 0 : -1;
      panels[k].hidden = !on;
    });
    if (focus) tabs[i].focus();
  };
  tabs.forEach((t, i) => {
    t.addEventListener('click', () => select(i));
    t.addEventListener('keydown', (e) => {
      const k = e.key === 'ArrowRight' ? i + 1 : e.key === 'ArrowLeft' ? i - 1 : e.key === 'Home' ? 0 : e.key === 'End' ? tabs.length - 1 : null;
      if (k === null) return;
      e.preventDefault();
      select((k + tabs.length) % tabs.length, true);
    });
  });
  select(0);
}

document.querySelectorAll('[data-gallery]').forEach(initGallery);
document.querySelectorAll('[data-tabs]').forEach(initTabs);
