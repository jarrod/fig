import { contourLines, isClosed } from '../core/marching.js';
import { pct } from '../core/text.js';

const TAU = Math.PI * 2;

// The cavities, in units where the round ends have radius 1. Each has a
// signed inside test (negative inside), the wall it reflects waves in, a
// bounding box, and its outline.
function cavity(kind, a) {
  if (kind === 'cardioid') {
    // ρ = 1 + cos θ about the cusp, shifted so the box is centred.
    const sx = 0.875;
    const sdf = (x, y) => {
      const u = x + sx;
      const rho = Math.hypot(u, y);
      return rho < 1e-9 ? -1e-9 : rho - (1 + u / rho);
    };
    const outline = Array.from({ length: 241 }, (_, i) => {
      const th = -Math.PI + (i / 240) * TAU;
      const r = 1 + Math.cos(th);
      return [r * Math.cos(th) - sx, r * Math.sin(th)];
    });
    return { sdf, wall: sdf, box: [-1.125, -1.3, 1.125, 1.3], outline, width: 2.25 };
  }
  const stadium = (x, y) => Math.hypot(Math.max(Math.abs(x) - a, 0), y) - 1;
  const arc = (cx, from, to, n) => Array.from({ length: n + 1 }, (_, i) => {
    const th = from + ((to - from) * i) / n;
    return [cx + Math.cos(th), Math.sin(th)];
  });
  if (kind === 'quarter') {
    // One quarter of the stadium. Only the odd-odd modes of the whole
    // stadium fit it, so the wave is zero along both straight cut walls.
    const outline = [[0, 0], [a + 1, 0], ...arc(a, 0, Math.PI / 2, 40).slice(1), [0, 1], [0, 0]];
    return {
      sdf: (x, y) => Math.max(stadium(x, y), -x, -y),
      // Only the round and flat outer walls need images: the odd-odd waves
      // already vanish on the cut walls.
      wall: stadium,
      box: [0, 0, a + 1, 1],
      quarter: true,
      outline,
      width: a + 1,
    };
  }
  const outline = [...arc(a, -Math.PI / 2, Math.PI / 2, 60), ...arc(-a, Math.PI / 2, (3 * Math.PI) / 2, 60)];
  outline.push(outline[0]);
  return { sdf: stadium, wall: stadium, box: [-a - 1, -1, a + 1, 1], outline, width: 2 * (a + 1) };
}

const SHAPES = { stadium: 'Bunimovich stadium', quarter: 'quarter stadium', cardioid: 'cardioid' };
const cache = new Map();

export default {
  id: 'billiards',
  kind: 'line',
  // Seconds per loop at normal speed. Every wave turns one whole cycle.
  loopSeconds: 40,

  describe: ({ kind, aspect, waves, across, lines, domains, wall, scar }) => {
    const shape = kind === 'cardioid' ? 'a cardioid' : `a ${SHAPES[kind]} ${aspect.toFixed(2)} times as long as it is ${kind === 'quarter' ? 'tall' : 'wide'}`;
    return `${waves} plane waves of one wavelength, ${across.toFixed(1)} wavelengths to the width, reflected to vanish on the wall of ${shape}${scar ? ', with a bouncing-ball scar between the flat walls' : ''}. The ${lines} nodal lines split it into ${domains} regions of one sign, and ${pct(wall)}% of them end on the wall.`;
  },

  name: ({ kind }) => (kind === 'cardioid' ? 'Quantum billiard' : 'Stadium eigenmode'),

  draw(out, R, detail, time = 0, seed) {
    // Reduce time so 2π lands exactly on 0.
    const t = time % TAU;
    const pick = R();
    const kind = pick < 0.45 ? 'stadium' : pick < 0.72 ? 'quarter' : 'cardioid';
    const a = 0.7 + R() * 0.7;
    const cav = cavity(kind, a);
    const quarter = Boolean(cav.quarter);
    const [bx0, by0, bx1, by1] = cav.box;

    // Wavelengths across the width: detail packs more in, but few enough that
    // the lines stay apart at card size. A quarter is drawn larger, so it
    // takes proportionally fewer.
    const across = (5 + detail * 0.65) * (0.85 + R() * 0.3) * (quarter ? 0.8 : 1);
    const k = (TAU * across) / cav.width;
    const lambda = TAU / k;

    // Berry's random waves: one wavenumber, random directions, amplitudes and
    // phases. Each phase turns a whole number of times per loop, either way.
    const waves = 28 + Math.floor(R() * 10);
    const list = [];
    for (let i = 0; i < waves; i++) {
      const th = R() * TAU;
      const amp = 0.4 + R();
      const phase = R() * TAU;
      // A third turn twice, so the second half of the loop differs from the
      // first (with every wave turning once, ψ(t + π) = −ψ(t)).
      const turn = (R() < 0.5 ? 1 : -1) * (R() < 1 / 3 ? 2 : 1);
      list.push({ kx: k * Math.cos(th), ky: k * Math.sin(th), amp, ph: phase + turn * t });
    }
    // Some stadiums carry a scar: extra weight on the bouncing-ball orbit,
    // straight up and down between the flat walls, faded over the round ends.
    const scar = kind !== 'cardioid' && R() < 0.4 ? 0.8 + R() * 0.6 : 0;
    const scarPhase = R() * TAU;
    const rms = Math.sqrt(list.reduce((s, wv) => s + wv.amp * wv.amp, 0) / (quarter ? 8 : 2));
    const swing = scar * rms * (0.8 + 0.2 * Math.cos(t + scarPhase));
    const scarY = R() * TAU;
    const scarX = (x) => {
      const f = Math.min(1, Math.max(0, (a + 0.3 - Math.abs(x)) / 0.8));
      return swing * f * f * (3 - 2 * f) * (quarter ? Math.tanh(x * k * 0.5) : 1);
    };

    // The quarter only takes the odd-odd modes of the whole stadium, so the
    // wave is zero on both cut walls: each wave is folded into sin · sin.
    const psi = (x, y) => {
      let v = 0;
      if (quarter) for (const wv of list) v += wv.amp * Math.cos(wv.ph) * Math.sin(wv.kx * x) * Math.sin(wv.ky * y);
      else for (const wv of list) v += wv.amp * Math.cos(wv.kx * x + wv.ky * y + wv.ph);
      if (scar) v += scarX(x) * (quarter ? Math.sin(k * y) : Math.cos(k * y + scarY));
      return v;
    };

    // Grid samples sit half a step off the cut walls of the quarter, so the
    // zero along them falls between samples.
    const step = lambda / 9;
    const nx = Math.ceil((bx1 - bx0) / step) + 4;
    const ny = Math.ceil((by1 - by0) / step) + 4;
    const ox = quarter ? -1.5 * step : (bx0 + bx1) / 2 - ((nx - 1) * step) / 2;
    const oy = quarter ? -1.5 * step : (by0 + by1) / 2 - ((ny - 1) * step) / 2;
    const gx = (i) => ox + i * step;
    const gy = (j) => oy + j * step;
    // Lines stop this far inside the wall.
    const eps = step * 0.4;
    const inside = (x, y) => cav.sdf(x, y) < -eps;

    // Seed-only geometry: which samples sit near the wall, where their mirror
    // image across the wall is, and how much of it to subtract.
    const key = `${seed}:${detail}`;
    let geo = cache.get(key);
    if (!geo || geo.nx !== nx || geo.ny !== ny) {
      const band = [];
      const reach = lambda * 0.6;
      const wallF = cav.wall;
      for (let j = 0; j < ny; j++) {
        for (let i = 0; i < nx; i++) {
          const x = gx(i);
          const y = gy(j);
          const f = wallF(x, y);
          if (Math.abs(f) > reach) continue;
          const h = 1e-4;
          const fx = (wallF(x + h, y) - wallF(x - h, y)) / (2 * h);
          const fy = (wallF(x, y + h) - wallF(x, y - h)) / (2 * h);
          const g2 = fx * fx + fy * fy || 1;
          const u = 1 - Math.abs(f) / reach;
          band.push(j * nx + i, x - (2 * f * fx) / g2, y - (2 * f * fy) / g2, u * u * (3 - 2 * u));
        }
      }
      const flags = new Uint8Array(nx * ny);
      for (let j = 0; j < ny; j++) for (let i = 0; i < nx; i++) flags[j * nx + i] = inside(gx(i), gy(j)) ? 1 : 0;
      geo = { nx, ny, band, flags };
      if (cache.size > 24) cache.clear();
      cache.set(key, geo);
    }

    // The field on the grid, a sum of separable products.
    const field = new Float64Array(nx * ny);
    const Xc = new Float64Array(nx);
    const Xs = new Float64Array(nx);
    const Yc = new Float64Array(ny);
    const Ys = new Float64Array(ny);
    for (const wv of list) {
      if (quarter) {
        const c = wv.amp * Math.cos(wv.ph);
        for (let i = 0; i < nx; i++) Xs[i] = c * Math.sin(wv.kx * gx(i));
        for (let j = 0; j < ny; j++) Ys[j] = Math.sin(wv.ky * gy(j));
        for (let j = 0; j < ny; j++) {
          const row = j * nx;
          const s = Ys[j];
          for (let i = 0; i < nx; i++) field[row + i] += Xs[i] * s;
        }
        continue;
      }
      for (let i = 0; i < nx; i++) {
        const q = wv.kx * gx(i) + wv.ph;
        Xc[i] = wv.amp * Math.cos(q);
        Xs[i] = wv.amp * Math.sin(q);
      }
      for (let j = 0; j < ny; j++) {
        Yc[j] = Math.cos(wv.ky * gy(j));
        Ys[j] = Math.sin(wv.ky * gy(j));
      }
      for (let j = 0; j < ny; j++) {
        const row = j * nx;
        const c = Yc[j];
        const s = Ys[j];
        for (let i = 0; i < nx; i++) field[row + i] += Xc[i] * c - Xs[i] * s;
      }
    }
    if (scar) {
      for (let j = 0; j < ny; j++) {
        const yv = quarter ? Math.sin(k * gy(j)) : Math.cos(k * gy(j) + scarY);
        const row = j * nx;
        for (let i = 0; i < nx; i++) field[row + i] += scarX(gx(i)) * yv;
      }
    }
    // Method of images: near the wall, subtract the wave at the mirror point,
    // so the wave vanishes on the wall and nodal lines meet it square on.
    const { band, flags } = geo;
    const base = field.slice();
    for (let b = 0; b < band.length; b += 4) {
      const [ix, mx, my, wgt] = [band[b], band[b + 1], band[b + 2], band[b + 3]];
      // Sample the image from the grid when it lands on it, else evaluate.
      const fi = (mx - ox) / step;
      const fj = (my - oy) / step;
      const i0 = Math.floor(fi);
      const j0 = Math.floor(fj);
      let v;
      if (i0 >= 0 && j0 >= 0 && i0 < nx - 1 && j0 < ny - 1) {
        const u = fi - i0;
        const w = fj - j0;
        const r = j0 * nx + i0;
        v = (base[r] * (1 - u) + base[r + 1] * u) * (1 - w) + (base[r + nx] * (1 - u) + base[r + nx + 1] * u) * w;
      } else v = psi(mx, my);
      field[ix] -= wgt * v;
    }

    // The cavity wall.
    out.push({ g: 1, r: false, open: true, p: cav.outline });

    // Trace the zero set and keep the parts inside the wall, cut where they
    // cross it.
    const cut = (p, q) => {
      let lo = p;
      let hi = q;
      for (let n = 0; n < 12; n++) {
        const m = [(lo[0] + hi[0]) / 2, (lo[1] + hi[1]) / 2];
        if (inside(m[0], m[1])) lo = m;
        else hi = m;
      }
      return lo;
    };
    let lines = 0;
    let walled = 0;
    const emit = (run, ends, loop = false) => {
      let len = 0;
      for (let n = 1; n < run.length; n++) len += Math.hypot(run[n][0] - run[n - 1][0], run[n][1] - run[n - 1][1]);
      // Specks and tiny loops hugging the wall are left over from the images.
      // Loops further in shrink away on their own, so they are all kept.
      const hugs = (depth) => run.every(([x, y]) => cav.sdf(x, y) > -lambda * depth);
      if (loop ? len < lambda && hugs(0.35) : len < lambda * 0.3 || (len < lambda * 0.7 && hugs(0.15))) return;
      lines++;
      if (ends) walled++;
      // A fixed start and direction, so a line keeps its points in the same
      // order from one moment to the next.
      const keyOf = ([x, y]) => x + 0.618 * y;
      if (loop) {
        const body = run.slice(0, -1);
        let at = 0;
        body.forEach((q, n) => keyOf(q) < keyOf(body[at]) && (at = n));
        run = [...body.slice(at), ...body.slice(0, at)];
        let turn = 0;
        run.forEach((q, n) => {
          const r = run[(n + 1) % run.length];
          turn += q[0] * r[1] - r[0] * q[1];
        });
        if (turn < 0) run.reverse();
        run.push(run[0]);
      } else if (keyOf(run[run.length - 1]) < keyOf(run[0])) run = run.slice().reverse();
      out.push({ g: 0, r: false, open: true, p: run });
    };
    for (const line of contourLines(field, nx, ny, 0)) {
      if (line.length < 2) continue;
      let pts = line.map(([i, j]) => [ox + i * step, oy + j * step]);
      const inn = pts.map(([x, y]) => inside(x, y));
      if (inn.every(Boolean)) {
        emit(pts, false, isClosed(line));
        continue;
      }
      // Start a loop outside, so each inside run comes out in one piece.
      let fl = inn;
      if (isClosed(line)) {
        const at = inn.findIndex((v) => !v);
        pts = [...pts.slice(at, -1), ...pts.slice(0, at + 1)];
        fl = [...inn.slice(at, -1), ...inn.slice(0, at + 1)];
      }
      let run = null;
      let touched = false;
      for (let n = 0; n < pts.length; n++) {
        if (fl[n]) {
          if (!run) {
            run = [];
            touched = n > 0;
            if (n > 0) run.push(cut(pts[n], pts[n - 1]));
          }
          run.push(pts[n]);
        } else if (run) {
          run.push(cut(pts[n - 1], pts[n]));
          emit(run, true);
          run = null;
        }
      }
      if (run) emit(run, touched);
    }

    // Nodal domains: regions of one sign inside the wall, counted by flood fill.
    const seen = new Uint8Array(nx * ny);
    for (let s = 0; s < nx * ny; s++) seen[s] = flags[s] ? 0 : 1;
    let domains = 0;
    const stack = [];
    for (let s = 0; s < nx * ny; s++) {
      if (seen[s]) continue;
      const sign = field[s] >= 0;
      let size = 0;
      seen[s] = 1;
      stack.push(s);
      while (stack.length) {
        const c = stack.pop();
        size++;
        const i = c % nx;
        for (const d of [i > 0 ? c - 1 : -1, i < nx - 1 ? c + 1 : -1, c - nx, c + nx]) {
          if (d < 0 || d >= nx * ny || seen[d] || field[d] >= 0 !== sign) continue;
          seen[d] = 1;
          stack.push(d);
        }
      }
      // Slivers along the wall are not domains.
      if (size > 3) domains++;
    }

    return { kind, aspect: a + 1, waves, across, lines, domains, wall: lines ? walled / lines : 0, scar: scar > 0 };
  },
};
