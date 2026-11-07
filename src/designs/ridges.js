import { project, makeNoise } from '../core/geometry.js';

export default {
  id: 'ridges',
  kind: 'solid',

  describe: ({ rows, row }) =>
    `${rows} ridges traced from seeded noise, back to front. The highest point is on ridge ${row + 1}, counting from the back.`,

  name: () => 'Perlin noise',

  draw(out, R, detail, time = 0) {
    const noise = makeNoise(R);
    const rows = 6 + detail * 2;
    const freq = 0.15 + R() * 0.2;
    const drift = 0.08 + R() * 0.17;
    const centre = 3 + R() * 6;
    const spread = 2.2 + R() * 2.5;
    const height = 2.5 + R() * 3;
    // The noise is sampled around a circle as time passes, so the ridges shift and loop.
    const ox = Math.cos(time) * 1.5;
    const oy = Math.sin(time) * 1.5;
    const samples = 60;
    let best = { h: -1, row: 0 };
    for (let i = 0; i < rows; i++) {
      const y = (i / Math.max(1, rows - 1)) * 12;
      const mid = centre + 2 * noise(i * 0.15 + 40, oy);
      const p = [];
      for (let k = 0; k <= samples; k++) {
        const x = (k / samples) * 12;
        const envelope = Math.exp(-(((x - mid) / spread) ** 2));
        const n = 0.55 + 0.35 * noise(x * freq + ox, i * drift + oy) + 0.15 * noise(x * freq * 2.7 + oy, i * drift * 2 - ox);
        const h = Math.max(0, height * envelope * n);
        if (h > best.h) best = { h, row: i };
        p.push(project(x, y, h));
      }
      p.push(project(12, y, 0), project(0, y, 0));
      out.push({ g: i, r: false, p });
    }
    return { rows, row: best.row };
  },
};
