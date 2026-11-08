import { makeFrame } from '../core/frame.js';
import { contourLines, isClosed } from '../core/marching.js';
import { pct } from '../core/text.js';

const TAU = Math.PI * 2;
const WORDS = ['', 'one', 'two', 'three'];

export default {
  id: 'chladni',
  kind: 'line',
  // Seconds per loop at normal speed. The modes trade weight slowly.
  loopSeconds: 24,
  // Samples a patch of ground, so it can be shown in any frame shape.
  framed: true,

  describe: ({ modes, levels, lines, closed, where }) => {
    const each = modes.map(([n, m, s]) => `(${n}, ${m}${s > 0 ? '' : ', antisymmetric'})`);
    const pairs = each.length > 1 ? `${each.slice(0, -1).join(', ')} and ${each[each.length - 1]}` : each[0];
    const traced = levels === 1 ? 'traced where they cancel' : `traced where they cancel and at ${levels - 1} levels close by`;
    return `${WORDS[modes.length][0].toUpperCase()}${WORDS[modes.length].slice(1)} standing-wave mode${modes.length > 1 ? 's' : ''} ${pairs} of a square plate, ${modes.length > 1 ? 'mixed and ' : ''}${traced}, ${where}. Of the ${lines} lines, ${pct(closed)}% close into loops.`;
  },

  name: () => 'Chladni figure',

  draw(out, R, detail, time = 0, seed, frame = makeFrame()) {
    const { w, h } = frame;
    // Reduce time so 2π lands exactly on 0.
    const t = time % TAU;

    // Each mode is a pair of whole numbers n ≠ m and a sign: the classic
    // cos(nπx)cos(mπy) ± cos(mπx)cos(nπy) figure of a square plate.
    const count = 1 + Math.floor(R() * 3);
    const modes = [];
    for (let k = 0; k < count; k++) {
      const n = 1 + Math.floor(R() * 6);
      let m = 4 + Math.floor(R() * 5);
      if (m === n) m = n + 1 + Math.floor(R() * 2);
      else R();
      const s = R() < 0.5 ? 1 : -1;
      // The first mode leads; the rest join at smaller weights.
      const base = k === 0 ? 1 : 0.3 + R() * 0.4;
      const swing = 0.25 + R() * 0.35;
      const phase = R() * TAU;
      const turns = 1 + Math.floor(R() * 2);
      modes.push({ n, m, s, base, swing, phase, turns });
    }
    // Extra levels either side of the nodal line draw it as a band, like sand
    // piling up where the plate is still. Detail adds levels within the band.
    const extra = Math.floor(R() * 2) + Math.floor((detail + 1) / 4);
    const band = 0.08 + R() * 0.14;
    const gap = extra ? band / extra : 0;
    const lift = R() * 0.2;

    // The plate is the original 12-unit square, centred on the ground patch.
    const n = 40 + detail * 9;
    const nx = Math.round((n * w) / 12);
    const ny = Math.round((n * h) / 12);
    const sx = w / (nx - 1);
    const sy = h / (ny - 1);
    const ox = (w - 12) / 2;
    const oy = (h - 12) / 2;

    // The sum is separable, so each axis gets a table of cosines per mode number.
    const table = (len, step, off, k) => {
      const a = new Float32Array(len);
      for (let i = 0; i < len; i++) a[i] = Math.cos((k * Math.PI * (i * step - off)) / 12);
      return a;
    };
    const field = new Float32Array(nx * ny);
    let total = 0;
    for (const md of modes) {
      // Weights move around a circle, so the figure morphs and comes back.
      const a = md.base + md.swing * Math.cos(md.turns * t + md.phase);
      total += Math.abs(md.base) + md.swing;
      const xn = table(nx, sx, -ox, md.n);
      const xm = table(nx, sx, -ox, md.m);
      const yn = table(ny, sy, -oy, md.n);
      const ym = table(ny, sy, -oy, md.m);
      for (let j = 0; j < ny; j++) {
        const cn = a * yn[j];
        const cm = a * md.s * ym[j];
        const row = j * nx;
        for (let i = 0; i < nx; i++) field[row + i] += xm[i] * cn + xn[i] * cm;
      }
    }

    // Level 0 is the nodal line; the extra levels sit in pairs either side of it.
    const levelList = [0];
    for (let e = 1; e <= extra; e++) levelList.push(e * gap * total, -e * gap * total);
    let lines = 0;
    let closed = 0;
    levelList.forEach((level, l) => {
      for (const line of contourLines(field, nx, ny, level)) {
        if (line.length < 3) continue;
        lines++;
        if (isClosed(line)) closed++;
        frame.push(out, { g: l === 0 ? 0 : 1 + Math.floor((l - 1) / 2), r: false, open: true, p: line.map(([x, y]) => frame.to(x * sx, y * sy, (level / total) * lift * 6)) });
      }
    });
    return {
      modes: modes.map((md) => [Math.min(md.n, md.m), Math.max(md.n, md.m), md.s]),
      levels: levelList.length,
      lines,
      closed: lines ? closed / lines : 0,
      where: frame.where,
    };
  },
};
