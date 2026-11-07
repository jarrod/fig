import { makeNoise, orderFootprints, prism, clipHalf } from '../core/geometry.js';

export default {
  id: 'columns',
  kind: 'solid',

  describe: ({ common }) =>
    `Each column stands on the ground nearest one seeded point, like basalt, and most have ${common} sides. Heights follow seeded noise.`,

  name: () => 'Voronoi diagram',

  draw(out, R, detail, time = 0) {
    const noise = makeNoise(R);
    const k = 3 + Math.ceil(detail / 2);
    const jitter = 0.35 + R() * 0.6;
    const freq = 0.12 + R() * 0.2;
    const base = 0.6 + R() * 1.5;
    const amp = 2 + R() * 4;
    // Seeds on a jittered grid, so cells are similar in size.
    const sites = [];
    for (let i = 0; i < k; i++) {
      for (let j = 0; j < k; j++) {
        sites.push([((i + 0.5 + (R() - 0.5) * jitter) * 12) / k, ((j + 0.5 + (R() - 0.5) * jitter) * 12) / k]);
      }
    }
    // Each cell is the ground nearer its seed than any other: the square,
    // clipped by the halfway line to every other seed.
    const cells = sites.map(([x, y], i) => {
      let poly = [[0, 0], [12, 0], [12, 12], [0, 12]];
      sites.forEach(([sx, sy], j) => {
        if (j !== i) poly = clipHalf(poly, (x + sx) / 2, (y + sy) / 2, sx - x, sy - y);
      });
      const cx = poly.reduce((a, p) => a + p[0], 0) / poly.length;
      const cy = poly.reduce((a, p) => a + p[1], 0) / poly.length;
      return { sides: poly.length, poly: poly.map(([px, py]) => [cx + (px - cx) * 0.9, cy + (py - cy) * 0.9]), cx, cy };
    });
    // Heights come from noise sampled around a circle as time passes.
    const ox = Math.cos(time) * 1.2;
    const oy = Math.sin(time) * 1.2;
    const heights = cells.map((c) => base + amp * (0.5 + 0.5 * noise(c.cx * freq + ox, c.cy * freq + oy)));
    orderFootprints(cells.map((c) => c.poly)).forEach((i, g) => prism(out, cells[i].poly, 0, heights[i], g));
    const counts = {};
    for (const c of cells) counts[c.sides] = (counts[c.sides] || 0) + 1;
    const common = Object.keys(counts).reduce((a, b) => (counts[b] > counts[a] ? b : a));
    return { common: Number(common) };
  },
};
