import { makeFrame } from '../core/frame.js';
import { makeNoise } from '../core/geometry.js';
import { contourLines, isClosed } from '../core/marching.js';
import { pct } from '../core/text.js';

const TAU = Math.PI * 2;
// The closest two drawn lines may sit, in ground units.
const GAP = 0.16;

export default {
  id: 'marble',
  kind: 'line',
  // Seconds per loop at normal speed. The swirls fold slowly.
  loopSeconds: 36,
  // Samples a patch of ground, so it can be shown in any frame shape.
  framed: true,

  describe: ({ warp, stretch, levels, lines, closed, length, where }) =>
    `Noise is read at points pushed around twice by more noise, ${warp.toFixed(1)} units at a time${stretch > 1.15 ? `, with the ground drawn out ${stretch.toFixed(1)} times along one direction` : ''}, and traced at ${levels} heights ${where}. The ${lines} contour lines average ${length.toFixed(1)} units long, and ${pct(closed)}% close into loops.`,

  name: () => 'Domain-warped noise',

  draw(out, R, detail, time = 0, seed, frame = makeFrame()) {
    const { w, h } = frame;
    // Reduce time so 2π lands exactly on 0.
    const t = time % TAU;
    const noise = makeNoise(R);

    // Noise units per ground unit: one to two noise cells across the square.
    const freq = 0.09 + R() * 0.06;
    const warp = 1.5 + R() * 1.1;
    const octaves = 2;
    R();
    // A stretch along one direction combs the swirls into the long veins of
    // marbled paper; some seeds stay round.
    const stretch = R() < 0.6 ? 1.3 + R() * 1.4 : 1 + R() * 0.1;
    const angle = R() * Math.PI;
    const levels = 10 + Math.floor(R() * 5) + detail;
    const shift = R();
    R(); // Unused draw, kept so each seed keeps its look.
    // Seeded offsets keep the noise channels apart.
    const off = Array.from({ length: 10 }, () => R() * 100);
    // The inner warp's sampling point circles in time, so the swirls fold and return.
    const orbit = 0.22 + R() * 0.2;
    const mx = off[0] + Math.cos(t) * orbit;
    const my = off[1] + Math.sin(t) * orbit;

    const fbm = (x, y, oct) => {
      let v = 0;
      let a = 0.5;
      for (let o = 0; o < oct; o++) {
        v += a * noise(x, y);
        // Rotate and double between octaves to hide the grid.
        const nx = 1.6 * x - 1.2 * y;
        y = 1.2 * x + 1.6 * y;
        x = nx;
        a *= 0.5;
      }
      return v;
    };

    const n = 34 + detail * 6;
    const nx = Math.round((n * w) / 12);
    const ny = Math.round((n * h) / 12);
    const sx = w / (nx - 1);
    const sy = h / (ny - 1);
    const ca = Math.cos(angle);
    const sa = Math.sin(angle);
    const field = new Float32Array(nx * ny);
    for (let j = 0; j < ny; j++) {
      const gy = j * sy - h / 2;
      for (let i = 0; i < nx; i++) {
        const gx = i * sx - w / 2;
        // Ground to noise space: rotate, then squeeze one axis.
        const px = ((gx * ca + gy * sa) / stretch) * freq;
        const py = (-gx * sa + gy * ca) * freq;
        // q = fbm(p), r = fbm(p + k·q), value = fbm(p + k·r).
        const qx = fbm(px + mx, py + my, 1);
        const qy = fbm(px + off[2], py + off[3], 1);
        const rx = fbm(px + warp * qx + off[4], py + warp * qy + off[5], 1);
        const ry = fbm(px + warp * qx + off[6], py + warp * qy + off[7], 1);
        const v = fbm(px + warp * rx + off[8], py + warp * ry + off[9], octaves);
        field[j * nx + i] = v;
      }
    }

    // Levels sit half way between even steps in value (between the 1st and
    // 99th percentile) and even fractions of the ground, so flat stretches
    // still get lines.
    // Where the warp folds the field steeply they would pack into a smudge, so
    // each level is thinned there: level i has a coarseness (how many times 2
    // divides it), and it is only drawn where the levels at least that coarse
    // still sit GAP ground units apart. Steep folds keep every 2nd, 4th or 8th
    // line, like the index contours of a map, and flat ground keeps them all.
    const count = nx * ny;
    const sorted = field.slice().sort();
    const quantile = (q) => {
      const at = q * (count - 1);
      const i = Math.floor(at);
      return sorted[i] + (sorted[Math.min(count - 1, i + 1)] - sorted[i]) * (at - i);
    };
    const lo = quantile(0.01);
    const hi = quantile(0.99);
    const step = (hi - lo) / levels;
    const levelAt = (x) => 0.5 * (lo + (x + shift) * step) + 0.5 * quantile(Math.min(1, Math.max(0, 0.01 + (0.98 * (x + shift)) / levels)));

    // Slope of the field per ground unit, at each grid point.
    const slope = new Float32Array(count);
    for (let j = 0; j < ny; j++) {
      const j0 = j > 0 ? j - 1 : j;
      const j1 = j < ny - 1 ? j + 1 : j;
      for (let i = 0; i < nx; i++) {
        const i0 = i > 0 ? i - 1 : i;
        const i1 = i < nx - 1 ? i + 1 : i;
        const gx = (field[j * nx + i1] - field[j * nx + i0]) / ((i1 - i0) * sx);
        const gy = (field[j1 * nx + i] - field[j0 * nx + i]) / ((j1 - j0) * sy);
        slope[j * nx + i] = Math.sqrt(gx * gx + gy * gy);
      }
    }
    const slopeAt = (x, y) => {
      const i = Math.min(nx - 2, Math.floor(x));
      const j = Math.min(ny - 2, Math.floor(y));
      const fx = x - i;
      const fy = y - j;
      const k = j * nx + i;
      return (slope[k] * (1 - fx) + slope[k + 1] * fx) * (1 - fy) + (slope[k + nx] * (1 - fx) + slope[k + nx + 1] * fx) * fy;
    };

    let lines = 0;
    let closed = 0;
    let length = 0;
    const lineLength = (p) => {
      let len = 0;
      for (let k = 1; k < p.length; k++) len += Math.hypot((p[k][0] - p[k - 1][0]) * sx, (p[k][1] - p[k - 1][1]) * sy);
      return len;
    };
    const emit = (p, l, loop) => {
      const len = lineLength(p);
      // Skip specks: tiny pieces read as dust, not marbling.
      if (len < (loop ? 0.8 : 0.4)) return;
      lines++;
      if (loop) closed++;
      length += len;
      frame.push(out, { g: l % 4, r: false, open: true, p: p.map(([x, y]) => frame.to(x * sx, y * sy, 0)) });
    };
    for (let l = 0; l < levels; l++) {
      const level = levelAt(l);
      let coarse = 0;
      while (coarse < 4 && ((l + 1) >> coarse) % 2 === 0) coarse++;
      // The steepest slope at which this level still clears the gap.
      const reach = 2 ** coarse;
      const limit = (levelAt(l + reach) - levelAt(l - reach)) / 2 / GAP;
      for (let line of contourLines(field, nx, ny, level)) {
        if (line.length < 3) continue;
        const s = line.map(([x, y]) => slopeAt(x, y) - limit);
        const loop = isClosed(line);
        if (s.every((v) => v <= 0)) {
          emit(line, l, loop);
          continue;
        }
        // Start a loop at a dropped point, so each kept run is in one piece.
        let pts = line;
        let sl = s;
        if (loop) {
          const at = s.findIndex((v) => v > 0);
          pts = [...line.slice(at, -1), ...line.slice(0, at + 1)];
          sl = [...s.slice(at, -1), ...s.slice(0, at + 1)];
        }
        // Keep the runs below the limit, cut exactly where the slope crosses it.
        let run = null;
        for (let k = 0; k < pts.length; k++) {
          if (sl[k] <= 0) {
            if (!run) {
              run = [];
              if (k > 0) {
                const t = sl[k - 1] / (sl[k - 1] - sl[k]);
                run.push([pts[k - 1][0] + (pts[k][0] - pts[k - 1][0]) * t, pts[k - 1][1] + (pts[k][1] - pts[k - 1][1]) * t]);
              }
            }
            run.push(pts[k]);
          } else if (run) {
            const t = sl[k - 1] / (sl[k - 1] - sl[k]);
            run.push([pts[k - 1][0] + (pts[k][0] - pts[k - 1][0]) * t, pts[k - 1][1] + (pts[k][1] - pts[k - 1][1]) * t]);
            if (run.length > 1) emit(run, l, false);
            run = null;
          }
        }
        if (run && run.length > 1) emit(run, l, false);
      }
    }
    return { warp, stretch, levels, lines, closed: lines ? closed / lines : 0, length: lines ? length / lines : 0, where: frame.where };
  },
};
