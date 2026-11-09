// Product videos: H.264 MP4 (720p, no audio, web-optimised) + poster image → public/video/.
// Config: src/data/videos.json. Sources live in _source/video (not in git).
// Run: npm run video
import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import ffmpeg from 'ffmpeg-static';

const ROOT = path.resolve(import.meta.dirname, '..');
const videos = JSON.parse(fs.readFileSync(path.join(ROOT, 'src', 'data', 'videos.json'), 'utf8'));
const OUT = path.join(ROOT, 'public', 'video');
fs.mkdirSync(OUT, { recursive: true });

for (const [slug, v] of Object.entries(videos).filter(([k]) => !k.startsWith('_'))) {
  const src = path.join(ROOT, '_source', 'video', v.source);
  const mp4 = path.join(OUT, `${slug}.mp4`);
  const poster = path.join(OUT, `${slug}-poster.jpg`);
  const run = (args) => {
    const r = spawnSync(ffmpeg, ['-hide_banner', '-loglevel', 'error', '-y', ...args], { stdio: 'inherit' });
    if (r.status !== 0) throw new Error('ffmpeg failed for ' + slug);
  };
  // the picture is silent, so the audio track is dropped; faststart lets playback begin before the file is fully loaded
  run(['-i', src, '-vf', 'scale=1280:-2', '-c:v', 'libx264', '-preset', 'slow', '-crf', '26', '-pix_fmt', 'yuv420p', '-profile:v', 'main', '-movflags', '+faststart', '-an', mp4]);
  run(['-ss', String(v.posterAt ?? 0.3), '-i', src, '-frames:v', '1', '-vf', 'scale=1280:-2', '-q:v', '3', poster]);
  console.log(`${slug}: ${(fs.statSync(mp4).size / 1048576).toFixed(2)} MB video, ${(fs.statSync(poster).size / 1024).toFixed(0)} KB poster`);
}
