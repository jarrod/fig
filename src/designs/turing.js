import { makeFrame } from '../core/frame.js';
import { contourLines, isClosed } from '../core/marching.js';
import { plural } from '../core/text.js';

// Feed and kill rates known to settle into a pattern, with Du = 0.16, Dv = 0.08.
const FAMILIES = [
  [0.0367, 0.0649], // splitting spots
  [0.035, 0.065], // spots
  [0.029, 0.057], // maze
  [0.046, 0.063], // worms
  [0.0545, 0.062], // coral
  [0.037, 0.06], // fingerprint
  [0.03, 0.062], // dense spots
  [0.04, 0.06], // labyrinth
];
const STEPS = 3000;
const cache = new Map();

// Gray–Scott: U is fed in and V eats it (U + 2V → 3V), while V decays. Both
// diffuse, U twice as fast, on a grid that wraps around at the edges.
function simulate(nx, ny, feed, kill, spots) {
  let u = new Float32Array(nx * ny).fill(1);
  let v = new Float32Array(nx * ny);
  let u2 = new Float32Array(nx * ny);
  let v2 = new Float32Array(nx * ny);
  for (const [sx, sy, r] of spots) {
    const cx = Math.floor(sx * nx);
    const cy = Math.floor(sy * ny);
    for (let dy = -r; dy <= r; dy++) {
      for (let dx = -r; dx <= r; dx++) {
        if (dx * dx + dy * dy > r * r) continue;
        const i = ((cy + dy + ny) % ny) * nx + ((cx + dx + nx) % nx);
        u[i] = 0.5;
        v[i] = 0.25;
      }
    }
  }
  const fk = feed + kill;
  for (let t = 0; t < STEPS; t++) {
    for (let y = 0; y < ny; y++) {
      const row = y * nx;
      const up = ((y + ny - 1) % ny) * nx;
      const down = ((y + 1) % ny) * nx;
      for (let x = 0; x < nx; x++) {
        const l = x ? x - 1 : nx - 1;
        const r = x < nx - 1 ? x + 1 : 0;
        const i = row + x;
        const U = u[i];
        const V = v[i];
        const uvv = U * V * V;
        u2[i] = U + 0.16 * (u[row + l] + u[row + r] + u[up + x] + u[down + x] - 4 * U) - uvv + feed * (1 - U);
        v2[i] = V + 0.08 * (v[row + l] + v[row + r] + v[up + x] + v[down + x] - 4 * V) + uvv - fk * V;
      }
    }
    [u, u2] = [u2, u];
    [v, v2] = [v2, v];
  }
  return v;
}

export default {
  id: 'turing',
  kind: 'line',
  // Seconds per loop at normal speed, set from how fast it moves on screen.
  loopSeconds: 15,
  // Samples a patch of ground, so it can be shown in any frame shape.
  framed: true,

  describe({ pattern, lines, levels, steps }) {
    const shape = { spots: 'separate spots', holes: 'a sheet with round holes', maze: 'winding stripes' }[pattern];
    return `Two simulated chemicals feed on and diffuse into each other for ${steps} steps from a few seeded drops, settling into ${shape}. The second chemical is traced at ${plural(levels, 'level')}, giving ${plural(lines, 'line')}.`;
  },

  name: () => 'Gray–Scott reaction–diffusion',

  draw(out, R, detail, time = 0, seed, frame = makeFrame()) {
    const { w, h } = frame;
    // Every random value is drawn first, the same way each frame, so the
    // cached field and the random sequence always agree.
    const [f0, k0] = FAMILIES[Math.floor(R() * FAMILIES.length)];
    const feed = f0 + (R() - 0.5) * 0.002;
    const kill = k0 + (R() - 0.5) * 0.001;
    const levels = 1 + Math.floor(R() * 3);
    const base = 0.35 + R() * 0.2;
    const swing = 0.08 + R() * 0.1;
    const spots = Array.from({ length: 8 + Math.floor(R() * 12) }, () => [R(), R(), 2 + Math.floor(R() * 3)]);
    // Grid cells per side of the original 12-unit square, kept per unit here.
    const n = 62 + detail * 3;
    const nx = Math.round((n * w) / 12);
    const ny = Math.round((n * h) / 12);

    const key = `${seed}/${detail}/${feed}/${kill}/${nx}x${ny}`;
    let entry = cache.get(key);
    if (!entry) {
      const field = simulate(nx, ny, feed, kill, spots);
      let min = Infinity;
      let max = -Infinity;
      for (const v of field) {
        min = Math.min(min, v);
        max = Math.max(max, v);
      }
      entry = { field, min, max };
      if (cache.size >= 20) cache.delete(cache.keys().next().value);
      cache.set(key, entry);
    }
    const { field, min, max } = entry;
    const at = (frac) => min + (max - min) * frac;

    // The traced levels slide up and down together through the field.
    const sx = w / (nx - 1);
    const sy = h / (ny - 1);
    const shift = swing * Math.sin(time);
    let lines = 0;
    let closed = 0;
    let above = 0;
    const mid = at(base);
    for (const v of field) if (v >= mid) above++;
    for (let l = 0; l < levels; l++) {
      const level = at(base + shift + (l - (levels - 1) / 2) * 0.12);
      for (const line of contourLines(field, nx, ny, level)) {
        if (line.length < 3) continue;
        lines++;
        if (isClosed(line)) closed++;
        frame.push(out, { g: l, r: false, open: true, p: line.map(([x, y]) => frame.to(x * sx, y * sy, 0)) });
      }
    }

    // The pattern, measured from the field: closed outlines around a little
    // of the area are spots, around most of it are holes, otherwise a maze.
    const cover = above / field.length;
    const loops = lines ? closed / lines : 0;
    const pattern = loops > 0.7 && cover < 0.35 ? 'spots' : loops > 0.7 && cover > 0.6 ? 'holes' : 'maze';
    return { pattern, lines, levels, steps: STEPS };
  },
};
