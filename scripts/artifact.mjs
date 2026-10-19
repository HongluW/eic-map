// Turns the single-file build (dist-single/index.html) into an Artifact page body:
// the host wraps it in its own <html>/<head>/<body>, so strip ours.
import fs from 'node:fs';
const src = fs.readFileSync('dist-single/index.html', 'utf8');
const out = src
  .replace(/<!doctype html>/i, '')
  .replace(/<\/?html[^>]*>/gi, '')
  .replace(/<\/?head>/gi, '')
  .replace(/<\/?body>/gi, '')
  .replace(/<meta charset="UTF-8" \/>/i, '')
  .replace(/<meta name="viewport"[^>]*>/i, '')
  .trim();
fs.mkdirSync('dist-single', { recursive: true });
fs.writeFileSync('dist-single/anarchy-atlas.html', out + '\n');
console.log('wrote dist-single/anarchy-atlas.html', (out.length / 1024).toFixed(0) + ' KB');
