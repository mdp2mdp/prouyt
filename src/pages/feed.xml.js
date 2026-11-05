import { buildYml } from '../lib/feed.js';
import { url } from '../lib/site.js';

export function GET({ site }) {
  const origin = new URL(url(''), site).href;
  return new Response(buildYml(origin), { headers: { 'Content-Type': 'application/xml; charset=utf-8' } });
}
