import { clipPolyline, makeFrame } from '../core/frame.js';
import { contourLines, isClosed } from '../core/marching.js';
import { plural } from '../core/text.js';

const TAU = Math.PI * 2;
const WORDS = ['no', 'one', 'two', 'three', 'four', 'five', 'six'];
const signed = (v, digits = 0) => `${v > 0 ? '+' : '−'}${Math.abs(v).toFixed(digits)}`;
const list = (items) => (items.length < 2 ? items.join('') : `${items.slice(0, -1).join(', ')} and ${items[items.length - 1]}`);

// Evenly spaced points along a polyline, by arc length.
function resample(pts, count) {
  const len = [0];
  for (let i = 1; i < pts.length; i++) len.push(len[i - 1] + Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]));
  const total = len[len.length - 1];
  const out = [];
  let j = 1;
  for (let k = 0; k < count; k++) {
    const s = (k / (count - 1)) * total;
    while (j < pts.length - 1 && len[j] < s) j++;
    const t = len[j] > len[j - 1] ? (s - len[j - 1]) / (len[j] - len[j - 1]) : 0;
    out.push([pts[j - 1][0] + (pts[j][0] - pts[j - 1][0]) * t, pts[j - 1][1] + (pts[j][1] - pts[j - 1][1]) * t]);
  }
  return out;
}

export default {
  id: 'fieldlines',
  kind: 'line',
  loopSeconds: 30,
  framed: true,

  name: ({ vortex }) => (vortex ? 'Point vortex streamlines' : 'Electric field lines'),

  describe(f) {
    if (f.vortex) {
      return `${WORDS[f.count][0].toUpperCase()}${WORDS[f.count].slice(1)} point vortices of strength ${list(f.strengths.map((s) => signed(s, 1)))} stir the fluid ${f.where}. Its stream function is traced at ${f.levels} levels that share the area evenly, giving ${plural(f.lines, 'streamline')}, ${f.closed} of them closed loops.`;
    }
    const eq = f.equi ? ` ${WORDS[f.equi][0].toUpperCase()}${WORDS[f.equi].slice(1)} equipotentials cross them.` : '';
    return `${WORDS[f.count][0].toUpperCase()}${WORDS[f.count].slice(1)} point charges of ${list(f.strengths.map((s) => signed(s)))} sit ${f.where}. ${f.lines} field lines are traced from the ${f.from} charges: ${f.ended} reach a charge of the other sign and ${f.left} ${f.left === 1 ? 'runs' : 'run'} off the edge.${eq}`;
  },

  draw(out, R, detail, time = 0, seed, frame = makeFrame()) {
    const { w, h } = frame;
    const vortex = R() < 0.3;
    const count = vortex ? 2 + Math.floor(R() * 4) : 2 + Math.floor(R() * 5);
    // Charges sit apart from each other in the middle of the patch, and each
    // moves on its own small closed path: a Lissajous figure with whole-number
    // frequencies, so every path closes once per loop.
    const cx = w / 2;
    const cy = h / 2;
    const charges = [];
    for (let i = 0; i < count; i++) {
      let x = cx;
      let y = cy;
      for (let tries = 0; tries < 40; tries++) {
        const a = R() * TAU;
        const r = Math.sqrt(R());
        x = cx + Math.cos(a) * r * w * 0.3;
        y = cy + Math.sin(a) * r * h * 0.3;
        if (charges.every((c) => Math.hypot(c.x - x, c.y - y) > 2.6)) break;
      }
      const q = vortex ? (0.5 + R()) * (R() < 0.5 ? -1 : 1) : (1 + Math.floor(R() * 3)) * (R() < 0.5 ? -1 : 1);
      charges.push({ x, y, q, rad: 0.25 + R() * 0.45, fx: 1 + Math.floor(R() * 2), fy: 1 + Math.floor(R() * 2), px: R() * TAU, py: R() * TAU, turn: R() * TAU });
    }
    // Field lines need both signs.
    if (!vortex && charges.every((c) => Math.sign(c.q) === Math.sign(charges[0].q))) charges[count - 1].q *= -1;
    const equiWanted = !vortex && R() < 0.5;
    const at = charges.map((c) => [
      c.x + c.rad * (Math.cos(c.fx * time + c.px) - Math.cos(c.px)),
      c.y + c.rad * (Math.sin(c.fy * time + c.py) - Math.sin(c.py)),
    ]);
    const strengths = charges.map((c) => c.q);

    // The grid for contours, kept at the same density per unit of ground.
    const n = 40 + detail * 8;
    const nx = Math.round((n * w) / 12);
    const ny = Math.round((n * h) / 12);
    const sx = w / (nx - 1);
    const sy = h / (ny - 1);
    const potential = () => {
      const field = new Float32Array(nx * ny);
      for (let k = 0; k < count; k++) {
        const [qx, qy] = at[k];
        const q = charges[k].q;
        for (let j = 0; j < ny; j++) {
          const dy = j * sy - qy;
          for (let i = 0; i < nx; i++) {
            const dx = i * sx - qx;
            field[j * nx + i] += q * 0.5 * Math.log(dx * dx + dy * dy + 1e-4);
          }
        }
      }
      return field;
    };
    const quantiles = (field, levels, lo, hi) => {
      const sorted = Float32Array.from(field).sort();
      return Array.from({ length: levels }, (_, l) => sorted[Math.floor((lo + ((hi - lo) * (l + 0.5)) / levels) * (sorted.length - 1))]);
    };
    const contours = (field, values, g) => {
      let lines = 0;
      let closed = 0;
      for (const level of values) {
        for (const line of contourLines(field, nx, ny, level)) {
          if (line.length < 4) continue;
          // Skip specks: tiny loops around a core or a corner cut by the grid.
          let len = 0;
          for (let i = 1; i < line.length; i++) len += Math.hypot((line[i][0] - line[i - 1][0]) * sx, (line[i][1] - line[i - 1][1]) * sy);
          if (len < 0.8) continue;
          lines++;
          if (isClosed(line)) closed++;
          frame.push(out, { g, r: false, open: true, p: line.map(([x, y]) => frame.to(x * sx, y * sy, 0)) });
        }
      }
      return { lines, closed };
    };

    if (vortex) {
      // The stream function of point vortices is the same sum of logarithms as
      // a potential. Levels split the patch into bands of equal area, so the
      // streamlines stay evenly spread rather than crowding into each core.
      const levels = 8 + Math.round(detail * 1.4);
      const field = potential();
      const q = quantiles(field, levels, 0.02, 0.98);
      // Half way between levels that share the area and levels evenly spaced
      // in value: the first keeps the outer flow even, the second rings the cores.
      const values = q.map((v, l) => 0.5 * v + 0.5 * (q[0] + ((q[levels - 1] - q[0]) * l) / (levels - 1)));
      const { lines, closed } = contours(field, values, 0);
      return { vortex, count, strengths, levels, lines, closed, where: frame.where };
    }

    // Lines start from the sign with more total charge, so every charge of
    // that sign sends out lines, evenly spaced, in proportion to its size.
    const total = strengths.reduce((s, q) => s + q, 0);
    const from = total >= 0 ? 1 : -1;
    const perUnit = 5 + Math.round(detail * 0.8);
    const start = 0.14;
    const hstep = 0.05;
    const maxSteps = Math.ceil((4 * (w + h)) / hstep);
    const dir = (x, y) => {
      let ex = 0;
      let ey = 0;
      for (let k = 0; k < count; k++) {
        const dx = x - at[k][0];
        const dy = y - at[k][1];
        const r2 = dx * dx + dy * dy + 1e-9;
        const q = charges[k].q / r2;
        ex += q * dx;
        ey += q * dy;
      }
      const m = Math.sqrt(ex * ex + ey * ey) || 1;
      return [(from * ex) / m, (from * ey) / m];
    };
    const sinkAt = (x, y) => {
      for (let k = 0; k < count; k++) {
        if (Math.sign(charges[k].q) === from) continue;
        const dx = x - at[k][0];
        const dy = y - at[k][1];
        if (dx * dx + dy * dy < start * start) return k;
      }
      return -1;
    };
    // How weak the field is against the sum of each charge's own pull: near 0
    // only close to a saddle point, where the field cancels.
    const weakness = (x, y) => {
      let ex = 0;
      let ey = 0;
      let sum = 0;
      for (let k = 0; k < count; k++) {
        const dx = x - at[k][0];
        const dy = y - at[k][1];
        const r2 = dx * dx + dy * dy + 1e-9;
        const q = charges[k].q / r2;
        ex += q * dx;
        ey += q * dy;
        sum += Math.abs(charges[k].q) / Math.sqrt(r2);
      }
      return Math.sqrt(ex * ex + ey * ey) / sum;
    };
    // Lines are followed past the patch edge, so one that leaves and comes back
    // is drawn as two pieces rather than ending at the edge.
    const mx = w;
    const my = h;
    const clipRect = (a, b) => {
      let t0 = 0;
      let t1 = 1;
      for (const [d, lo, hi, s0] of [[b[0] - a[0], 0, w, a[0]], [b[1] - a[1], 0, h, a[1]]]) {
        if (Math.abs(d) < 1e-12) {
          if (s0 < lo || s0 > hi) return null;
          continue;
        }
        let ta = (lo - s0) / d;
        let tb = (hi - s0) / d;
        if (ta > tb) [ta, tb] = [tb, ta];
        t0 = Math.max(t0, ta);
        t1 = Math.min(t1, tb);
        if (t0 >= t1) return null;
      }
      return [t0, t1];
    };
    const EPS = 0.12;
    let lines = 0;
    let ended = 0;
    let left = 0;
    for (let k = 0; k < count; k++) {
      const c = charges[k];
      if (Math.sign(c.q) !== from) continue;
      const m = Math.abs(c.q) * perUnit;
      for (let l = 0; l < m; l++) {
        const a = c.turn + (l / m) * TAU;
        let x = at[k][0] + Math.cos(a) * start;
        let y = at[k][1] + Math.sin(a) * start;
        const pts = [at[k], [x, y]];
        let end = 'stall';
        // The weakest point along the line, past the first stretch.
        let low = Infinity;
        let lowAt = 0;
        for (let s = 0; s < maxSteps; s++) {
          const [k1x, k1y] = dir(x, y);
          const [k2x, k2y] = dir(x + k1x * hstep * 0.5, y + k1y * hstep * 0.5);
          const [k3x, k3y] = dir(x + k2x * hstep * 0.5, y + k2y * hstep * 0.5);
          const [k4x, k4y] = dir(x + k3x * hstep, y + k3y * hstep);
          x += ((k1x + 2 * k2x + 2 * k3x + k4x) * hstep) / 6;
          y += ((k1y + 2 * k2y + 2 * k3y + k4y) * hstep) / 6;
          pts.push([x, y]);
          if (x < -mx || x > w + mx || y < -my || y > h + my) {
            end = 'edge';
            break;
          }
          const sink = sinkAt(x, y);
          if (sink >= 0) {
            pts.push(at[sink]);
            end = 'sink';
            break;
          }
          if (s > 4) {
            const v = weakness(x, y);
            if (v < low) {
              low = v;
              lowAt = pts.length - 1;
            }
          }
        }
        // A line that passes close to a saddle point is about to turn one way
        // or the other, and which way flips as the charges move. So past the
        // saddle it is cut short, the more so the closer it came, and the flip
        // happens out of sight.
        let path = pts;
        if (low < EPS) {
          const x0 = low / EPS;
          const keep = Math.round((0.5 * x0 * x0) / (1 - x0) / hstep);
          path = pts.slice(0, Math.min(pts.length, lowAt + 1 + keep));
          end = 'saddle';
        }
        lines++;
        if (end === 'sink') ended++;
        else if (end === 'edge') left++;
        // Every other step: points sit at fixed distances along the line, so a
        // change at its far end leaves the rest where it was.
        const even = path.filter((_, i) => i % 2 === 0 || i === path.length - 1);
        for (const run of clipPolyline(even, clipRect)) frame.push(out, { g: 0, r: false, open: true, p: run.map(([px, py]) => frame.to(px, py, 0)) });
      }
    }

    let equi = 0;
    if (equiWanted) {
      const field = potential();
      const values = quantiles(field, 5, 0.08, 0.92);
      equi = values.length;
      contours(field, values, 1);
    }
    return { vortex, count, strengths, lines, ended, left, equi, from: from > 0 ? 'positive' : 'negative', where: frame.where };
  },
};
