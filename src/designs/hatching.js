import { makeNoise } from '../core/geometry.js';
import { makeFrame } from '../core/frame.js';
import { pct } from '../core/text.js';

const G = 40; // Density grid cells per side.

export default {
  id: 'hatching',
  kind: 'line',
  // Seconds per loop at normal speed, set from how fast it moves on screen.
  loopSeconds: 40,
  // Samples a patch of ground, so it can be shown in any frame shape.
  framed: true,

  describe: ({ strokes, relief, steepShare }) =>
    `Short strokes run across the slope of seeded noise terrain ${relief.toFixed(1)} units high, crowding where it is steep. Half of the ${strokes} strokes sit on the steepest ${pct(steepShare)}% of the ground.`,

  name: () => 'Slope hatching',

  draw(out, R, detail, time = 0, seed, frame = makeFrame()) {
    const { w, h } = frame;
    const noise = makeNoise(R);
    const freq = 0.12 + R() * 0.1;
    const height = 3 + R() * 3;
    const crowd = 1 + R() * 0.8;
    const len = 0.45 + R() * 0.25;
    const ox = Math.cos(time) * 1.2;
    const oy = Math.sin(time) * 1.2;
    // Two octaves of noise, sampled from a window that moves around a circle.
    const hgt = (x, y) => {
      const u = x * freq + ox;
      const v = y * freq + oy;
      return height * (0.5 + 0.4 * noise(u, v) + 0.08 * noise(u * 2.3 + 31, v * 2.3 + 17));
    };
    // Slope by forward differences, reusing the height already measured at the point.
    const grad = (x, y, z) => {
      const e = 0.04;
      return [(hgt(x + e, y) - z) / e, (hgt(x, y + e) - z) / e];
    };

    // A jittered grid of random pairs, fixed for the seed. Each pair is warped
    // to a point on the ground so that points crowd where the slope is steep.
    // The warp changes smoothly with the terrain, so every stroke glides
    // rather than jumps as the terrain moves.
    const side = Math.round(Math.sqrt((300 + detail * 130) * frame.scale));
    const strokes = side * side;
    const pairs = [];
    for (let a = 0; a < side; a++) for (let b = 0; b < side; b++) pairs.push([(a + R()) / side, (b + R()) / side]);

    // Density per cell centre: a little everywhere, much more on steep ground.
    const cellX = w / G;
    const cellY = h / G;
    const dens = new Float64Array((G + 1) * (G + 1));
    const steep = new Float64Array((G + 1) * (G + 1));
    let low = Infinity;
    let high = -Infinity;
    let steepest = 1e-9;
    for (let j = 0; j <= G; j++) {
      for (let i = 0; i <= G; i++) {
        const z = hgt(i * cellX, j * cellY);
        const [gx, gy] = grad(i * cellX, j * cellY, z);
        const s = Math.hypot(gx, gy);
        steep[j * (G + 1) + i] = s;
        steepest = Math.max(steepest, s);
        low = Math.min(low, z);
        high = Math.max(high, z);
      }
    }
    for (let i = 0; i < dens.length; i++) dens[i] = 0.06 + (steep[i] / steepest) ** crowd;
    // Density is linear along x between samples, so each row's cumulative
    // mass is exact, and blending two rows' cumulative mass by y stays smooth.
    const rowMass = new Float64Array((G + 1) * (G + 1));
    for (let j = 0; j <= G; j++) {
      let acc = 0;
      for (let i = 0; i < G; i++) {
        rowMass[j * (G + 1) + i] = acc;
        acc += (dens[j * (G + 1) + i] + dens[j * (G + 1) + i + 1]) / 2;
      }
      rowMass[j * (G + 1) + G] = acc;
    }
    // Mass of each band between rows j and j+1 (trapezoid), then cumulative.
    const colMass = new Float64Array(G + 1);
    for (let j = 0; j < G; j++) colMass[j + 1] = colMass[j] + (rowMass[j * (G + 1) + G] + rowMass[(j + 1) * (G + 1) + G]) / 2;

    // Solves a·t + b·t²/2 = m for t in 0..1 (mass under a line from a to a + b).
    const solve = (a, b, m) => {
      if (Math.abs(b) < 1e-9) return a > 0 ? Math.min(1, m / a) : 0.5;
      const d = a * a + 2 * b * m;
      return Math.min(1, Math.max(0, (-a + Math.sqrt(Math.max(0, d))) / b));
    };
    const find = (arr, off, n, m) => {
      let lo = 0;
      let hi = n - 1;
      while (lo < hi) {
        const mid = (lo + hi + 1) >> 1;
        if (arr[off + mid] <= m) lo = mid;
        else hi = mid - 1;
      }
      return Math.min(lo, n - 2);
    };

    // One step along the level line through (x, y, z): across the gradient.
    const stepAlong = (x, y, z, dir) => {
      const [gx, gy] = grad(x, y, z);
      const g = Math.hypot(gx, gy) || 1;
      const nx = x - (gy / g) * dir;
      const ny = y + (gx / g) * dir;
      return [nx, ny, hgt(nx, ny)];
    };

    const count = new Float64Array(G * G);
    pairs.forEach(([pu, pv], s) => {
      // Rows first: total row mass is linear in y within a band.
      const my = pv * colMass[G];
      const j = find(colMass, 0, G + 1, my);
      const ra = rowMass[j * (G + 1) + G];
      const rb = rowMass[(j + 1) * (G + 1) + G];
      const ty = solve(ra, rb - ra, my - colMass[j]);
      // Then along the row, from the two rows' cumulative mass blended by ty.
      const row = (i) => rowMass[j * (G + 1) + i] * (1 - ty) + rowMass[(j + 1) * (G + 1) + i] * ty;
      const mx = pu * row(G);
      let lo = 0;
      let hi = G - 1;
      while (lo < hi) {
        const mid = (lo + hi + 1) >> 1;
        if (row(mid) <= mx) lo = mid;
        else hi = mid - 1;
      }
      const d0 = dens[j * (G + 1) + lo] * (1 - ty) + dens[(j + 1) * (G + 1) + lo] * ty;
      const d1 = dens[j * (G + 1) + lo + 1] * (1 - ty) + dens[(j + 1) * (G + 1) + lo + 1] * ty;
      const tx = solve(d0, d1 - d0, mx - row(lo));
      const x = (lo + tx) * cellX;
      const y = (j + ty) * cellY;
      count[Math.min(G - 1, j) * G + Math.min(G - 1, lo)]++;

      // The stroke follows the level line (across the gradient) both ways
      // from its centre, in small steps so it bends with the ground.
      // Shorter where the strokes are packed tight, so they stay separate.
      const c = [x, y, hgt(x, y)];
      const [gx, gy] = grad(...c);
      const h = (len / 4) * (1 - 0.5 * Math.min(1, Math.hypot(gx, gy) / steepest));
      const a1 = stepAlong(...c, -h);
      const a2 = stepAlong(...a1, -h);
      const b1 = stepAlong(...c, h);
      const b2 = stepAlong(...b1, h);
      const p = [a2, a1, c, b1, b2].map(([px, py, pz]) => frame.to(px, py, pz));
      frame.push(out, { g: Math.floor(s / side), r: false, open: true, p });
    });

    // How many strokes the steepest cells hold: the smallest share of the
    // ground, steepest first, that holds half of all strokes.
    const order = [...Array(G * G).keys()].sort((a, b) => {
      const sa = steep[Math.floor(a / G) * (G + 1) + (a % G)];
      const sb = steep[Math.floor(b / G) * (G + 1) + (b % G)];
      return sb - sa;
    });
    let held = 0;
    let cells = 0;
    while (held < strokes / 2) held += count[order[cells++]];
    return { strokes, relief: high - low, steepShare: cells / (G * G) };
  },
};
