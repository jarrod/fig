import { project } from '../core/geometry.js';
import { pct } from '../core/text.js';

// The two maps. Each sends a point to a new one through sines and cosines of
// its coordinates, with four seeded coefficients.
const MAPS = [
  ([a, b, c, d]) => (x, y) => [Math.sin(a * y) + c * Math.cos(a * x), Math.sin(b * x) + d * Math.cos(b * y)],
  ([a, b, c, d]) => (x, y) => [Math.sin(a * y) - Math.cos(b * x), Math.sin(c * x) - Math.cos(d * y)],
];

const SLIDE = 0.035;
const GRID = 48;

// Coefficients a and b move around a small circle over the loop.
const at = (k, time) => [k[0] + SLIDE * Math.cos(time), k[1] + SLIDE * Math.sin(time), k[2], k[3]];

// The share of a grid over the orbit's bounding box that the orbit touches.
// Low cover means it settled on a few points or a thin loop.
function cover(f, n) {
  let x = 0.1;
  let y = 0.1;
  const pts = [];
  const lo = [Infinity, Infinity];
  const hi = [-Infinity, -Infinity];
  for (let i = 0; i < n + 100; i++) {
    [x, y] = f(x, y);
    if (i < 100) continue;
    pts.push([x, y]);
    lo[0] = Math.min(lo[0], x);
    lo[1] = Math.min(lo[1], y);
    hi[0] = Math.max(hi[0], x);
    hi[1] = Math.max(hi[1], y);
  }
  if (hi[0] - lo[0] < 0.5 || hi[1] - lo[1] < 0.5) return { share: 0, pts, lo, hi };
  const seen = new Uint8Array(GRID * GRID);
  let count = 0;
  for (const [px, py] of pts) {
    const cell = Math.floor(((px - lo[0]) / (hi[0] - lo[0] + 1e-9)) * GRID) * GRID + Math.floor(((py - lo[1]) / (hi[1] - lo[1] + 1e-9)) * GRID);
    if (!seen[cell]) count++;
    seen[cell] = 1;
  }
  return { share: count / (GRID * GRID), pts, lo, hi };
}

// Picks a map and coefficients, retrying until the orbit spreads into a cloud
// at the still drawing and at four points around the loop. None of this
// depends on time.
function search(R) {
  const map = R() < 0.5 ? 0 : 1;
  let k;
  let base;
  for (let tries = 0; tries < 40; tries++) {
    k = map === 0
      ? [(1.3 + R() * 0.8) * (R() < 0.5 ? -1 : 1), (1.3 + R() * 0.8) * (R() < 0.5 ? -1 : 1), (0.5 + R() * 1.0) * (R() < 0.5 ? -1 : 1), (0.5 + R() * 1.0) * (R() < 0.5 ? -1 : 1)]
      : [0, 0, 0, 0].map(() => (1.2 + R() * 1.8) * (R() < 0.5 ? -1 : 1));
    base = cover(MAPS[map](k), 3000);
    if (base.share > 0.12 && [1, 2, 3, 4].every((j) => cover(MAPS[map](at(k, (j * Math.PI) / 2)), 1200).share > 0.08)) break;
  }
  return { map, k, base };
}

const cache = new Map();

export default {
  id: 'cliffords',
  kind: 'line',

  describe: ({ map, strokes, k, share }) =>
    `${strokes.toLocaleString('en')} short strokes, each a tiny segment on the attractor sent four times through the ${map ? 'de Jong' : 'Clifford'} map (a ${k[0]}, b ${k[1]}, c ${k[2]}, d ${k[3]}), which stretches it along the attractor's threads. The orbit they start from touches ${pct(share)}% of a 48 by 48 grid laid over it.`,

  name: ({ map }) => (map ? 'de Jong attractor' : 'Clifford attractor'),

  draw(out, R, detail, time = 0, seed) {
    // The search below is the slow part, so it is kept per seed. A cached seed
    // still uses up the same random numbers, so what follows is unchanged.
    const hit = seed !== undefined && cache.get(seed);
    if (hit) {
      for (let i = 0; i < hit.calls; i++) R();
      return strokesFrom(out, R, detail, time, hit);
    }
    let calls = 0;
    const count = () => (calls++, R());
    const found = search(count);
    found.calls = calls;
    if (seed !== undefined) {
      if (cache.size > 200) cache.clear();
      cache.set(seed, found);
    }
    return strokesFrom(out, R, detail, time, found);
  },
};

// Draws the strokes for one frame from a found map.
function strokesFrom(out, R, detail, time, { map, k, base }) {
  const strokes = 400 + detail * 140;
  const lengths = Array.from({ length: strokes }, () => 2 + Math.floor(R() * 5));
  const turns = Array.from({ length: strokes }, () => R() * Math.PI);
  const lift = 0.1 + R() * 0.3;
  const seg = 0.0015 + R() * 0.0025;
  const f = MAPS[map](at(k, time));
  const [lo, hi] = [base.lo, base.hi];
  const scale = 12 / Math.max(hi[0] - lo[0], hi[1] - lo[1]);
  const place = (x, y, z) => project((x - (lo[0] + hi[0]) / 2) * scale + 6, (y - (lo[1] + hi[1]) / 2) * scale + 6, z);
  const far = 0.6 / scale; // 0.6 world units.
  for (let i = 0; i < strokes; i++) {
    // Each stroke starts as a tiny segment on the still drawing's orbit. Four
    // trips through the (moved) map stretch it along the attractor's threads.
    // A fractional stride, so orbits that hop between bands are all sampled.
    const [sx, sy] = base.pts[Math.floor((i * base.pts.length) / strokes)];
    const p = [];
    let last;
    for (let s = 0; s < lengths[i]; s++) {
      let x = sx + Math.cos(turns[i]) * seg * s;
      let y = sy + Math.sin(turns[i]) * seg * s;
      let px = x;
      let py = y;
      for (let j = 0; j < 4; j++) {
        px = x;
        py = y;
        [x, y] = f(x, y);
      }
      // Height is the length of the point's last jump, kept low.
      let here = [x, y, lift * Math.hypot(x - px, y - py)];
      // A point that lands far from the one before is a jump, not a thread:
      // repeat the previous point instead, so the point count never changes.
      if (last && Math.hypot(x - last[0], y - last[1]) > far) here = last;
      last = here;
      p.push(place(...here));
    }
    out.push({ g: i, r: false, open: true, p });
  }
  const round = (v) => Math.round(v * 100) / 100;
  return { map, strokes, k: k.map(round), share: base.share };
}
