import manifest from '../data/image-manifest.json';
import { url } from './site.js';

/** Info for an image id such as "trio/studio-1" or "hero/hero". */
export function imageInfo(id) {
  const m = manifest[id];
  if (!m) throw new Error(`Unknown image id: ${id}`);
  const srcset = (fmt) => m.widths.map((w) => `${url(`img/${id}-${w}.${fmt}`)} ${w}w`).join(', ');
  /** Largest width not above `target`, used for the plain <img src> fallback. */
  const pick = (target) => [...m.widths].reverse().find((w) => w <= target) ?? m.widths[0];
  return { w: m.w, h: m.h, widths: m.widths, srcset, fallback: (target = 960) => url(`img/${id}-${pick(target)}.webp`) };
}
