// Builds the embedded geography block inside src/EICMap.jsx.
// Natural Earth 1:50m (world-atlas) → Mercator → organic "historic regions"
// made from noise-warped Voronoi seeds clipped to the coastline.
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import * as topojson from 'topojson-client';
import { Delaunay } from 'd3-delaunay';
import { contours } from 'd3-contour';
import pc from 'polygon-clipping';
import simplify from 'simplify-js';

const require = createRequire(import.meta.url);
const world = require('world-atlas/countries-50m.json');
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const TARGET = path.join(ROOT, 'src/EICMap.jsx');

// Projection (mirrored in the component)
const LON0 = 60.5, LAT1 = 37, K = 27;
const merc = (lat) => (Math.log(Math.tan(Math.PI / 4 + (lat * Math.PI) / 360)) * 180) / Math.PI;
const W = Math.round((97.5 - LON0) * K);
const H = Math.round((merc(LAT1) - merc(5)) * K);
const P = ([lon, lat]) => [(lon - LON0) * K, (merc(LAT1) - merc(lat)) * K];

const PAD = 40;
const BOX = [[[-PAD, -PAD], [W + PAD, -PAD], [W + PAD, H + PAD], [-PAD, H + PAD], [-PAD, -PAD]]];

const projGeom = (g) => {
  const polys = g.type === 'Polygon' ? [g.coordinates] : g.coordinates;
  return polys.map((poly) => poly.map((ring) => ring.map(P)));
};

const SUB = ['India', 'Pakistan', 'Bangladesh', 'Nepal', 'Bhutan', 'Siachen Glacier'];
const geoms = world.objects.countries.geometries;
const byName = (n) => geoms.filter((g) => g.properties.name === n);

const subLand = pc.intersection(projGeom(topojson.merge(world, geoms.filter((g) => SUB.includes(g.properties.name)))), BOX);
const allLand = pc.intersection(projGeom(topojson.merge(world, geoms)), BOX);
const country = (n) => pc.intersection(projGeom(topojson.merge(world, byName(n))), BOX);

// Context borders between non-subcontinent countries (and the outer frontier)
const mesh = topojson.mesh(world, world.objects.countries, (a, b) => a !== b && !(SUB.includes(a.properties.name) && SUB.includes(b.properties.name)));
const borderLines = [];
for (const line of mesh.coordinates) {
  let run = [];
  for (const c of line) {
    const p = P(c);
    if (p[0] > -PAD && p[0] < W + PAD && p[1] > -PAD && p[1] < H + PAD) run.push(p);
    else { if (run.length > 1) borderLines.push(run); run = []; }
  }
  if (run.length > 1) borderLines.push(run);
}

// ---- Historic regions ----------------------------------------------------
const REGIONS = {
  kashmir: [[74.8, 34.1], [76.5, 34.6], [75.0, 33.0], [74.3, 35.9], [73.2, 36.2], [77.6, 34.2], [78.6, 33.5], [76.3, 35.6]],
  peshawar: [[71.6, 34.0], [72.0, 35.2], [70.6, 32.6], [70.4, 31.4], [71.2, 33.2]],
  punjab: [[74.3, 31.55], [73.05, 33.4], [72.4, 32.2], [71.5, 30.2], [75.8, 31.0], [76.5, 30.4], [73.1, 30.7], [74.9, 32.3]],
  sindh: [[68.4, 25.4], [68.8, 27.7], [67.6, 24.9], [69.6, 25.2], [68.3, 26.6], [69.8, 27.9]],
  balochistan: [[66.6, 29.0], [65.0, 27.5], [63.5, 26.2], [67.0, 30.4], [68.4, 29.2], [62.4, 27.6], [64.8, 25.6]],
  hills: [[77.2, 31.8], [78.5, 30.5], [79.9, 29.8], [78.1, 32.4], [76.6, 32.6]],
  delhi: [[77.2, 28.6], [78.0, 27.2], [77.5, 29.6], [76.6, 28.4], [77.0, 27.6]],
  doab: [[79.4, 27.1], [80.3, 26.4], [78.9, 26.8]],
  rohilkhand: [[79.4, 28.4], [78.8, 29.2], [80.1, 28.1], [78.6, 28.4]],
  awadh: [[80.95, 26.85], [82.15, 26.75], [81.6, 27.6], [80.6, 27.6], [82.9, 26.5]],
  allahabad: [[81.85, 25.45], [80.9, 25.95], [81.3, 25.1]],
  benares: [[83.0, 25.3], [83.6, 25.65], [82.8, 24.7]],
  bihar: [[85.1, 25.6], [86.5, 25.3], [84.6, 26.4], [85.3, 23.4], [86.8, 24.2], [84.2, 24.5], [85.9, 26.3], [87.3, 25.6], [86.3, 23.4]],
  bengal: [[88.27, 24.18], [89.4, 24.6], [88.6, 25.5], [90.4, 23.7], [89.5, 22.8], [91.5, 24.6], [90.9, 22.8], [89.2, 25.8]],
  calcutta: [[88.4, 22.45], [88.55, 22.0]],
  burdwan: [[87.85, 23.25], [87.3, 22.4], [87.0, 23.1]],
  chittagong: [[91.85, 22.35], [92.1, 21.5], [92.4, 22.9]],
  orissa: [[85.85, 20.45], [86.4, 21.2], [85.0, 20.2], [84.4, 20.7], [85.5, 21.6]],
  assam: [[91.75, 26.2], [93.5, 26.5], [94.8, 27.3], [93.9, 24.8], [92.6, 25.4], [95.6, 27.8], [91.6, 23.6], [92.9, 23.4]],
  nepal: [[85.3, 27.7], [83.0, 28.3], [81.0, 29.0], [87.3, 27.3], [88.5, 27.5], [82.0, 28.8]],
  bhutan: [[90.4, 27.4], [91.5, 27.3], [89.6, 27.3]],
  rajputana: [[75.8, 26.9], [73.0, 26.3], [71.0, 26.9], [73.3, 28.0], [73.7, 24.6], [75.7, 25.3], [70.6, 25.6], [74.6, 26.4], [74.8, 28.6]],
  gujarat: [[72.6, 23.0], [70.8, 22.3], [69.6, 23.3], [71.5, 21.5], [73.2, 22.3], [73.4, 23.6], [70.2, 21.6]],
  surat: [[72.95, 21.15], [73.3, 20.85]],
  malwa: [[75.85, 22.72], [75.78, 23.18], [77.4, 23.25], [76.2, 24.2], [78.0, 25.8], [77.5, 24.8], [76.8, 22.4]],
  bundelkhand: [[79.6, 25.0], [80.4, 24.6], [78.8, 24.6], [79.0, 25.6]],
  nagpur: [[79.1, 21.15], [77.0, 20.9], [81.6, 21.25], [80.5, 22.5], [82.0, 19.1], [80.3, 19.9], [83.2, 22.0], [81.5, 23.3], [79.9, 23.2], [82.9, 20.5]],
  deccan: [[73.86, 18.52], [74.75, 19.1], [74.2, 17.7], [75.3, 21.0], [76.2, 21.3], [74.3, 16.7], [75.7, 16.8], [75.1, 15.4], [74.2, 20.4], [75.6, 18.0]],
  konkan: [[73.3, 17.0], [73.15, 18.3], [73.05, 19.6], [73.6, 15.9], [72.95, 20.4]],
  hyderabad: [[78.47, 17.38], [75.35, 19.88], [77.3, 19.15], [76.6, 18.4], [77.5, 17.9], [79.5, 18.0], [78.5, 16.3], [77.5, 16.2], [78.8, 19.4], [76.6, 17.0]],
  circars: [[82.2, 16.95], [83.3, 17.7], [84.6, 19.2], [80.9, 16.4], [80.3, 16.0], [81.5, 17.3], [83.8, 18.4]],
  ceded: [[77.6, 14.7], [76.9, 15.1], [78.8, 14.5], [78.05, 15.8], [76.4, 15.6], [79.0, 15.4]],
  carnatic: [[79.37, 12.9], [79.6, 14.4], [79.75, 13.65], [78.7, 10.75], [79.0, 12.2], [78.1, 9.9], [77.7, 8.75], [78.9, 9.4], [79.65, 15.4], [79.55, 11.6]],
  tanjore: [[79.13, 10.78], [79.6, 10.6], [79.5, 10.25]],
  jagir: [[79.95, 12.6], [80.08, 13.2]],
  mysore: [[76.65, 12.3], [77.6, 12.97], [76.1, 13.4], [75.8, 12.4], [76.7, 13.9], [75.6, 14.2], [77.1, 13.4]],
  baramahal: [[78.1, 11.65], [78.3, 12.5], [77.8, 12.1]],
  coimbatore: [[76.96, 11.0], [77.6, 11.3], [77.97, 10.4], [77.3, 10.6]],
  malabar: [[75.78, 11.25], [75.4, 11.9], [76.2, 10.5], [76.1, 10.9], [75.1, 12.4]],
  canara: [[74.85, 12.87], [75.0, 13.9], [74.5, 14.8], [74.3, 15.6]],
  travancore: [[76.95, 8.5], [76.6, 9.4], [77.1, 9.6], [76.4, 10.0]],
};

const seeds = [];
for (const [id, pts] of Object.entries(REGIONS)) for (const ll of pts) seeds.push({ id, p: P(ll) });
const delaunay = Delaunay.from(seeds.map((s) => s.p));

// value noise for domain warping (gives organic, hand-drawn-looking frontiers)
function makeNoise(seed) {
  let s = seed; const rnd = () => ((s = (s * 16807) % 2147483647) / 2147483647);
  const perm = Array.from({ length: 512 }, () => rnd());
  const h = (x, y) => perm[((x * 73856093) ^ (y * 19349663)) & 511];
  const sm = (t) => t * t * (3 - 2 * t);
  return (x, y) => {
    const xi = Math.floor(x), yi = Math.floor(y), xf = sm(x - xi), yf = sm(y - yi);
    const a = h(xi, yi), b = h(xi + 1, yi), c = h(xi, yi + 1), d = h(xi + 1, yi + 1);
    return (a + (b - a) * xf + (c - a) * yf + (a - b - c + d) * xf * yf) * 2 - 1;
  };
}
const nx = makeNoise(17), ny = makeNoise(9091), nx2 = makeNoise(311), ny2 = makeNoise(7717);
const R = 2; // raster cell size in px
const GW = Math.ceil((W + 2 * PAD) / R), GH = Math.ceil((H + 2 * PAD) / R);
const ids = Object.keys(REGIONS);
const label = new Uint8Array(GW * GH);
let last = 0;
for (let j = 0; j < GH; j++) for (let i = 0; i < GW; i++) {
  const x = i * R - PAD, y = j * R - PAD;
  const wx = x + 11 * nx(x / 46, y / 46) + 3.5 * nx2(x / 13, y / 13);
  const wy = y + 11 * ny(x / 46, y / 46) + 3.5 * ny2(x / 13, y / 13);
  last = delaunay.find(wx, wy, last);
  label[j * GW + i] = ids.indexOf(seeds[last].id);
}

const round = (v) => Math.round(v * 10) / 10;
const cleanRings = (mp, tol = 0.45, minArea = 4) => {
  const out = [];
  for (const poly of mp) for (const ring of poly) {
    let pts = simplify(ring.map(([x, y]) => ({ x, y })), tol, true).map((p) => [round(p.x), round(p.y)]);
    let a = 0; for (let k = 0; k < pts.length - 1; k++) a += pts[k][0] * pts[k + 1][1] - pts[k + 1][0] * pts[k][1];
    if (Math.abs(a / 2) < minArea || pts.length < 4) continue;
    out.push(pts.slice(0, -1));
  }
  return out;
};
const centroid = (rings) => {
  let best = null, ba = 0;
  for (const r of rings) {
    let a = 0, cx = 0, cy = 0;
    for (let k = 0; k < r.length; k++) {
      const [x0, y0] = r[k], [x1, y1] = r[(k + 1) % r.length];
      const f = x0 * y1 - x1 * y0; a += f; cx += (x0 + x1) * f; cy += (y0 + y1) * f;
    }
    if (Math.abs(a) > ba) { ba = Math.abs(a); best = [round(cx / (3 * a)), round(cy / (3 * a))]; }
  }
  return best;
};

const regionsOut = {};
const gen = contours().size([GW, GH]).thresholds([0.5]);
ids.forEach((id, idx) => {
  const vals = new Float64Array(GW * GH);
  for (let k = 0; k < vals.length; k++) vals[k] = label[k] === idx ? 1 : 0;
  const mp = gen(vals)[0].coordinates.map((poly) => poly.map((ring) => ring.map(([x, y]) => [x * R - PAD - R / 2, y * R - PAD - R / 2])));
  const clipped = pc.intersection(mp, subLand);
  const rings = cleanRings(clipped);
  regionsOut[id] = { c: centroid(rings), r: rings };
});

const ceylon = cleanRings(country('Sri Lanka'));
regionsOut.ceylon = { c: centroid(ceylon), r: ceylon };
const afg = cleanRings(country('Afghanistan'), 0.6);
regionsOut.afghanistan = { c: centroid(afg), r: afg };
const persia = cleanRings(country('Iran'), 0.6);
regionsOut.persia = { c: centroid(persia), r: persia };

const geo = {
  W, H, proj: { lon0: LON0, lat1: LAT1, k: K },
  land: cleanRings(allLand, 0.5, 6),
  borders: borderLines.map((l) => simplify(l.map(([x, y]) => ({ x, y })), 0.6, true).map((p) => [round(p.x), round(p.y)])).filter((l) => l.length > 1),
  regions: regionsOut,
};

const enc = (rings) => rings.map((r) => r.map((p) => p.join(',')).join(' ')).join('|');
const out = {
  W, H, proj: geo.proj,
  land: enc(geo.land),
  borders: enc(geo.borders),
  regions: Object.fromEntries(Object.entries(geo.regions).map(([k, v]) => [k, { c: v.c, r: enc(v.r) }])),
};
const block = `// @geo-begin (generated by scripts/build-geo.mjs — Natural Earth 1:50m, Mercator)\nconst GEO = ${JSON.stringify(out)};\n// @geo-end`;
const src = fs.readFileSync(TARGET, 'utf8');
const next = src.replace(/\/\/ @geo-begin[\s\S]*?\/\/ @geo-end/, block);
fs.writeFileSync(TARGET, next);
console.log('W', W, 'H', H, 'bytes', block.length, 'regions', Object.keys(regionsOut).length,
  'empty:', Object.entries(regionsOut).filter(([, v]) => !v.r.length).map(([k]) => k).join(',') || 'none');
