import { clipPolyline, makeFrame } from '../core/frame.js';
import { pct } from '../core/text.js';

const TAU = Math.PI * 2;

// Light falls straight down through a wavy water surface h(x, y) and bends at
// it. For gentle waves, the ray through surface point x lands on the floor at
//   X = x − c ∇h(x),
// where c grows with the depth of the water. A dense family of evenly spaced
// lines is ruled on the surface and every point is sent down to the floor, like
// an engraving of the light: the lines crowd together where the light focuses
// and fold over along the caustics, so the bright web of a swimming-pool floor
// shows up as line density.
export default {
  id: 'caustics',
  kind: 'line',
  // Seconds per loop at normal speed. The web drifts and reforms slowly.
  loopSeconds: 32,
  // Samples a patch of floor, so it can be shown in any frame shape.
  framed: true,

  describe: ({ waves, shortest, longest, depth, lines, families, cross, folded, bright, where }) =>
    `${lines} ${families > 1 ? `lines ruled on the water in two directions ${cross} degrees apart` : 'parallel lines ruled on the water'} carry light through ${waves} travelling waves ${shortest.toFixed(1)} to ${longest.toFixed(1)} units long onto a floor ${depth.toFixed(2)} times as deep as where a typical crest first brings light to a point, ${where}. ${pct(folded)}% of the light lands past a fold, and the brightest tenth of the floor gathers ${pct(bright)}% of it.`,

  name: () => 'Water caustics',

  draw(out, R, detail, time = 0, seed, frame = makeFrame()) {
    const { w, h } = frame;
    // Reduce time so 2π lands exactly on 0.
    const t = time % TAU;

    // Waves from all round, spread evenly with some jitter so the web forms
    // cells rather than stripes. Some seeds favour the wind's direction.
    const count = 6 + Math.floor(R() * 4);
    const wind = R() * TAU;
    const bias = R() < 0.5 ? 0 : 0.4 + R() * 0.6;
    const waves = [];
    let shortest = Infinity;
    let longest = 0;
    for (let k = 0; k < count; k++) {
      const angle = wind + ((k + (R() - 0.5) * 0.7) / count) * TAU;
      const length = 1.9 + R() * 1.7;
      const kn = TAU / length;
      // Each wave bends light about as much as any other: amplitude ∝ λ².
      const weight = (0.6 + R() * 0.8) * (1 + bias * Math.cos(angle - wind) ** 2);
      // A whole number of wavelengths per loop, so the web returns exactly.
      const speed = R() < 0.75 ? 1 : 2;
      const phase = R() * TAU;
      waves.push({ kx: kn * Math.cos(angle), ky: kn * Math.sin(angle), a: weight / (kn * kn), weight, speed, phase: phase - speed * t });
      shortest = Math.min(shortest, length);
      longest = Math.max(longest, length);
    }
    // Depth, as a multiple of the depth at which a crest of typical (rms)
    // curvature first brings light to a point.
    const depth = 1.1 + R() * 0.5;
    const total = Math.sqrt(waves.reduce((s, wv) => s + wv.weight * wv.weight, 0) / 2);
    const c = depth / total;

    // A second family of lines, crossing the first, gives some seeds a woven look.
    const families = R() < 0.4 ? 2 : 1;
    const cross = R() < 0.5 ? 60 : 90;
    const turn = R() * Math.PI;

    // Lines per 12 units of surface; a fixed spacing keeps the density the
    // same in every frame shape.
    const gap = (12 / (40 + detail * 5)) * (families > 1 ? 1.6 : 1);
    const ds = shortest / 15;
    let reach = 0.3;
    for (const wv of waves) reach += c * wv.a * Math.hypot(wv.kx, wv.ky);
    const cx = w / 2;
    const cy = h / 2;
    const half = Math.hypot(w, h) / 2 + reach;
    const nr = Math.ceil((2 * half) / gap);
    const ns = Math.ceil((2 * half) / ds) + 1;

    // Keeps the part of a segment inside the floor patch, as [t0, t1], so the
    // diamond frame (which does not clip) ends at the patch edge too.
    const patch = (a, b) => {
      let t0 = 0;
      let t1 = 1;
      const d = [b[0] - a[0], b[1] - a[1]];
      for (const [axis, lo, hi] of [[0, 0, w], [1, 0, h]]) {
        if (Math.abs(d[axis]) < 1e-12) {
          if (a[axis] < lo || a[axis] > hi) return null;
          continue;
        }
        let u0 = (lo - a[axis]) / d[axis];
        let u1 = (hi - a[axis]) / d[axis];
        if (u0 > u1) [u0, u1] = [u1, u0];
        t0 = Math.max(t0, u0);
        t1 = Math.min(t1, u1);
        if (t0 >= t1) return null;
      }
      return [t0, t1];
    };

    let lines = 0;
    let samples = 0;
    let folded = 0;
    // Light per half-unit cell of the floor, counted from the samples.
    const bw = Math.ceil(w * 2);
    const bh = Math.ceil(h * 2);
    const light = new Float32Array(bw * bh);
    const X = new Float64Array(ns);
    const Y = new Float64Array(ns);
    for (let f = 0; f < families; f++) {
      const ang = turn + (f * cross * Math.PI) / 180;
      // Along the line (u) and across it (n).
      const ux = Math.cos(ang);
      const uy = Math.sin(ang);
      const nxv = -uy;
      const nyv = ux;
      // Each wave's phase splits into a part along the line and a part across:
      // tables of cos and sin along s are shared by every line of the family.
      const tabs = waves.map((wv) => {
        const ku = wv.kx * ux + wv.ky * uy;
        const cs = new Float64Array(ns);
        const sn = new Float64Array(ns);
        for (let j = 0; j < ns; j++) {
          const q = ku * (-half + j * ds);
          cs[j] = Math.cos(q);
          sn[j] = Math.sin(q);
        }
        return { cs, sn, kn: wv.kx * nxv + wv.ky * nyv };
      });
      for (let i = 0; i <= nr; i++) {
        const r = -half + i * gap;
        const bx = cx + r * nxv;
        const by = cy + r * nyv;
        // Only the stretch of line whose light can reach the floor patch.
        let s0 = -half;
        let s1 = half;
        for (const [b, u, lo, hi] of [[bx, ux, -reach, w + reach], [by, uy, -reach, h + reach]]) {
          if (Math.abs(u) < 1e-9) {
            if (b < lo || b > hi) s1 = -Infinity;
            continue;
          }
          const a0 = (lo - b) / u;
          const a1 = (hi - b) / u;
          s0 = Math.max(s0, Math.min(a0, a1));
          s1 = Math.min(s1, Math.max(a0, a1));
        }
        if (s1 <= s0) continue;
        const j0 = Math.max(0, Math.floor((s0 + half) / ds));
        const j1 = Math.min(ns - 1, Math.ceil((s1 + half) / ds));
        for (let j = j0; j <= j1; j++) {
          const sv = -half + j * ds;
          X[j] = bx + sv * ux;
          Y[j] = by + sv * uy;
        }
        for (let k = 0; k < waves.length; k++) {
          const wv = waves[k];
          const tb = tabs[k];
          const q0 = wv.kx * cx + wv.ky * cy + tb.kn * r + wv.phase;
          const c0 = Math.cos(q0);
          const s0 = Math.sin(q0);
          const amp = c * wv.a;
          const ex = amp * wv.kx;
          const ey = amp * wv.ky;
          for (let j = j0; j <= j1; j++) {
            // sin of q0 + ku·s.
            const sv = s0 * tb.cs[j] + c0 * tb.sn[j];
            X[j] += ex * sv;
            Y[j] += ey * sv;
          }
        }
        const pts = [];
        for (let j = j0; j <= j1; j++) pts.push([X[j], Y[j]]);
        // How much of the light lands past a fold, and where it lands.
        for (let j = j0 + 1; j <= j1; j++) {
          const x = X[j];
          const y = Y[j];
          if (x < 0 || y < 0 || x > w || y > h) continue;
          samples++;
          const along = ((x - X[j - 1]) * ux + (y - Y[j - 1]) * uy) / ds;
          if (along < 0) folded++;
          light[Math.min(bh - 1, Math.floor(y * 2)) * bw + Math.min(bw - 1, Math.floor(x * 2))]++;
        }
        const runs = clipPolyline(pts, patch);
        if (runs.length) lines++;
        for (const run of runs) frame.push(out, { g: f, r: false, open: true, p: run.map(([x, y]) => frame.to(x, y, 0)) });
      }
    }
    const sorted = light.slice().sort().reverse();
    const top = Math.ceil(sorted.length / 10);
    let lit = 0;
    for (let k = 0; k < top; k++) lit += sorted[k];
    const bright = samples ? lit / samples : 0;
    return { waves: count, shortest, longest, depth, lines, families, cross, folded: samples ? folded / samples : 0, bright, where: frame.where };
  },
};
