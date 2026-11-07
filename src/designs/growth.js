import { project, rng, makeNoise } from '../core/geometry.js';

// Growing the loop takes too long to repeat every frame, so each (seed, detail)
// is grown once and its snapshots kept. Frames only pick and project one.
const cache = new Map();
const CACHE_SIZE = 20;
const SNAPSHOTS = 40;

// Differential growth on a closed loop of points. Each step, every point is
// pulled toward the middle of its two neighbours (keeping the line smooth) and
// pushed away from any other point closer than one unit (so the line never
// crosses itself). Edges that stretch too long are split in two, adding points,
// and the extra length has nowhere to go but into folds.
function grow({ start, points, pull, push, split, wobble, bias, noiseSeed, simSeed }) {
  const R = rng(simSeed);
  const noise = makeNoise(rng(noiseSeed));
  let x = [];
  let y = [];
  for (let i = 0; i < start; i++) {
    const a = (i / start) * Math.PI * 2;
    const r = (start * split * 0.7) / (Math.PI * 2) * (1 + wobble * noise(Math.cos(a) * 1.5, Math.sin(a) * 1.5));
    x.push(Math.cos(a) * r);
    y.push(Math.sin(a) * r);
  }
  const snaps = [];
  let step = 0;
  // Snapshots are taken as the point count passes evenly spaced marks, so the
  // replay moves at an even pace through the growth.
  const mark = (n) => start + ((points - start) * n) / (SNAPSHOTS - 1);
  const keep = () => {
    snaps.push(Float64Array.from(x.flatMap((v, i) => [v, y[i]])));
  };
  keep();
  // Points are bucketed into one-unit cells (a counting sort into flat
  // arrays), so each point only checks the nine cells around it.
  let cellOf = new Int32Array(0);
  let order = new Int32Array(0);
  while (x.length < points && step < 4000) {
    step++;
    const n = x.length;
    let minX = Infinity;
    let minY = Infinity;
    let maxX = -Infinity;
    let maxY = -Infinity;
    for (let i = 0; i < n; i++) {
      minX = Math.min(minX, x[i]);
      maxX = Math.max(maxX, x[i]);
      minY = Math.min(minY, y[i]);
      maxY = Math.max(maxY, y[i]);
    }
    const cols = Math.floor(maxX - minX) + 1;
    const rows = Math.floor(maxY - minY) + 1;
    const first = new Int32Array(cols * rows + 1);
    if (cellOf.length < n) {
      cellOf = new Int32Array(n * 2);
      order = new Int32Array(n * 2);
    }
    for (let i = 0; i < n; i++) {
      cellOf[i] = Math.floor(x[i] - minX) * rows + Math.floor(y[i] - minY);
      first[cellOf[i] + 1]++;
    }
    for (let c = 0; c < cols * rows; c++) first[c + 1] += first[c];
    const fill = first.slice();
    for (let i = 0; i < n; i++) order[fill[cellOf[i]]++] = i;
    const nx = new Float64Array(n);
    const ny = new Float64Array(n);
    for (let i = 0; i < n; i++) {
      const a = (i + n - 1) % n;
      const b = (i + 1) % n;
      const px = x[i];
      const py = y[i];
      let fx = ((x[a] + x[b]) / 2 - px) * pull;
      let fy = ((y[a] + y[b]) / 2 - py) * pull;
      const cx = Math.floor(px - minX);
      const cy = Math.floor(py - minY);
      for (let u = Math.max(0, cx - 1); u <= Math.min(cols - 1, cx + 1); u++) {
        for (let v = Math.max(0, cy - 1); v <= Math.min(rows - 1, cy + 1); v++) {
          const c = u * rows + v;
          for (let m = first[c]; m < first[c + 1]; m++) {
            const j = order[m];
            const dx = px - x[j];
            const dy = py - y[j];
            const d2 = dx * dx + dy * dy;
            if (d2 >= 1 || d2 === 0) continue;
            const d = Math.sqrt(d2);
            const f = ((1 - d) / d) * push;
            fx += dx * f;
            fy += dy * f;
          }
        }
      }
      // A cap on each move keeps the crowded folds from blowing apart.
      const f = Math.hypot(fx, fy);
      const k = f > 0.08 ? 0.08 / f : 1;
      nx[i] = px + fx * k;
      ny[i] = py + fy * k;
    }
    // Split long edges. Edges in the faster-growing patches of a seeded noise
    // field also split early, now and then, so some parts fold more than others.
    const ox = [];
    const oy = [];
    for (let i = 0; i < n; i++) {
      const j = (i + 1) % n;
      ox.push(nx[i]);
      oy.push(ny[i]);
      const len = Math.hypot(nx[j] - nx[i], ny[j] - ny[i]);
      if (len < split * 0.5 || ox.length + n - i > points) continue;
      const mx = (nx[i] + nx[j]) / 2;
      const my = (ny[i] + ny[j]) / 2;
      const fast = len > split ? 1 : 0.5 + 0.5 * noise(mx * 0.08 + 20, my * 0.08 + 20);
      if (len > split || R() < (0.6 + 0.4 * bias) * (0.25 + fast * fast) * 0.05) {
        ox.push(mx);
        oy.push(my);
      }
    }
    x = ox;
    y = oy;
    while (snaps.length < SNAPSHOTS - 1 && x.length >= mark(snaps.length)) keep();
  }
  while (snaps.length < SNAPSHOTS) keep();
  // Lengths of the outline, start and finish, for the card text.
  const length = (s) => {
    let sum = 0;
    for (let i = 0; i < s.length; i += 2) {
      const j = (i + 2) % s.length;
      sum += Math.hypot(s[j] - s[i], s[j + 1] - s[i + 1]);
    }
    return sum;
  };
  // One scale for every snapshot (from the finished loop), so the replay grows
  // instead of zooming to fit each stage.
  const last = snaps.at(-1);
  let lo = [Infinity, Infinity];
  let hi = [-Infinity, -Infinity];
  for (let i = 0; i < last.length; i += 2) {
    lo = [Math.min(lo[0], last[i]), Math.min(lo[1], last[i + 1])];
    hi = [Math.max(hi[0], last[i]), Math.max(hi[1], last[i + 1])];
  }
  const scale = 12 / Math.max(hi[0] - lo[0], hi[1] - lo[1]);
  const mid = [(lo[0] + hi[0]) / 2, (lo[1] + hi[1]) / 2];
  const placed = snaps.map((s) => {
    const out = [];
    for (let i = 0; i < s.length; i += 2) out.push([6 + (s[i] - mid[0]) * scale, 6 + (s[i + 1] - mid[1]) * scale]);
    return out;
  });
  return { placed, stretch: length(last) / length(snaps[0]), finalCount: last.length / 2, finalSteps: step };
}

export default {
  id: 'growth',
  kind: 'line',
  // Seconds per loop at normal speed, set from how fast it moves on screen.
  loopSeconds: 20,

  describe({ start, finalCount, finalSteps, stretch, layers }) {
    const base = `A closed loop of ${start} points grew to ${finalCount} over ${finalSteps} steps: each point is pulled toward its neighbours and pushed from any other point nearby, and long edges split in two, sooner in some patches than others. The folded outline is ${stretch.toFixed(1)} times its starting length.`;
    return layers > 1 ? `${base} ${layers === 2 ? 'An earlier stage floats' : 'Two earlier stages float'} above it.` : base;
  },

  name: () => 'Differential growth',

  draw(out, R, detail, time = 0, seed) {
    const start = 20 + Math.floor(R() * 40);
    const points = 400 + detail * 200;
    const pull = 0.15 + R() * 0.25;
    const push = 0.03 + R() * 0.04;
    const split = 0.4 + R() * 0.25;
    const wobble = R() * 0.4;
    const bias = R();
    const stack = R();
    const layers = stack < 0.4 ? 1 : stack < 0.75 ? 2 : 3;
    const noiseSeed = Math.floor(R() * 2 ** 32);
    const simSeed = Math.floor(R() * 2 ** 32);
    const key = seed == null ? null : `${seed}/${detail}`;
    let sim = key !== null && cache.get(key);
    if (!sim) {
      sim = grow({ start, points, pull, push, split, wobble, bias, noiseSeed, simSeed });
      if (key !== null) {
        cache.set(key, sim);
        if (cache.size > CACHE_SIZE) cache.delete(cache.keys().next().value);
      }
    }
    // Replay the growth: the full loop at time 0, the starting ring at time π.
    const reach = (0.5 + 0.5 * Math.cos(time)) * (SNAPSHOTS - 1);
    const now = Math.round(reach);
    // Earlier stages, if any, are stacked above at even fractions of the
    // current stage, smallest on top.
    for (let k = 0; k < layers; k++) {
      const snap = sim.placed[Math.round((now * (layers - k)) / layers)];
      const z = k * 6;
      const p = snap.map(([x, y]) => project(x, y, z));
      p.push(p[0]);
      out.push({ g: k, r: false, open: true, p });
    }
    return { start, finalCount: sim.finalCount, finalSteps: sim.finalSteps, stretch: sim.stretch, layers };
  },
};
