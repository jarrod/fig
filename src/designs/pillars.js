import { orderFootprints, cylinder } from '../core/geometry.js';

export default {
  id: 'pillars',
  kind: 'solid',

  describe: ({ slender }) =>
    `Each pillar is as wide as it can be at a seeded point without touching those placed before it. The most slender stands ${slender.toFixed(1)}× its own width.`,

  name: () => 'Greedy circle packing',

  draw(out, R, detail, time = 0) {
    const most = 20 + detail * 6;
    const biggest = 1.2 + R() * 1.4;
    const smallest = 0.3;
    const gap = 0.15;
    const tall = 2 + R() * 5;
    const discs = [];
    // Try seeded points and make each pillar as wide as it can be without
    // touching the edge or a pillar placed before it.
    for (let tries = 0; tries < 600; tries++) {
      const x = R() * 12;
      const y = R() * 12;
      if (discs.length >= most) continue;
      let r = Math.min(biggest, x, 12 - x, y, 12 - y);
      for (const d of discs) r = Math.min(r, Math.hypot(x - d.x, y - d.y) - d.r - gap);
      if (r >= smallest) discs.push({ x, y, r });
    }
    for (const d of discs) {
      d.h = 0.4 + tall * R() ** 1.5;
      d.phase = R() * 6.283;
    }
    // Each pillar rises and falls on its own phase; at time 0 each is at its own height.
    const heights = discs.map((d) => d.h * (1 + 0.3 * (Math.sin(time + d.phase) - Math.sin(d.phase))));
    const outlines = discs.map((d) => Array.from({ length: 24 }, (_, k) => [d.x + Math.cos((k / 24) * 6.283) * d.r, d.y + Math.sin((k / 24) * 6.283) * d.r]));
    orderFootprints(outlines).forEach((i, g) => cylinder(out, discs[i].x, discs[i].y, discs[i].r, 0, heights[i], g));
    return { slender: Math.max(...discs.map((d, i) => heights[i] / (d.r * 2))) };
  },
};
