import { box } from '../core/geometry.js';
import { pct, plural } from '../core/text.js';

export default {
  id: 'blocks',
  kind: 'solid',

  describe: ({ blocks, largest }) =>
    `The ground was split ${plural(blocks - 1, 'time')}, always across the longer side. The largest block covers ${pct(largest)}% of it.`,

  name: () => 'k-d tree subdivision',

  draw(out, R, detail, time = 0) {
    const maxDepth = 2 + Math.ceil(detail / 2);
    const gap = 0.12;
    const leaves = [];
    // Split the ground in two across its longer side, then split each half
    // again. Drawing the lower half first keeps the order back to front.
    const split = (x, y, w, d, depth) => {
      const stop = depth === maxDepth || (w < 2.4 && d < 2.4) || (depth > 1 && R() < 0.12);
      if (stop) {
        leaves.push({ x, y, w, d, base: 0.4 + R() ** 2 * 5, phase: R() * 6.283 });
        return;
      }
      const cut = 0.3 + R() * 0.4;
      if (w >= d) {
        split(x, y, w * cut, d, depth + 1);
        split(x + w * cut, y, w * (1 - cut), d, depth + 1);
      } else {
        split(x, y, w, d * cut, depth + 1);
        split(x, y + d * cut, w, d * (1 - cut), depth + 1);
      }
    };
    split(0, 0, 12, 12, 0);
    // Each block bobs on its own phase. At time 0 every block is at its base height.
    const heights = leaves.map((b) => b.base * (1 + 0.35 * (Math.sin(time + b.phase) - Math.sin(b.phase))));
    leaves.forEach((b, i) => box(out, b.x + gap, b.y + gap, 0, b.w - gap * 2, b.d - gap * 2, heights[i], i));
    return {
      blocks: leaves.length,
      largest: Math.max(...leaves.map((b) => b.w * b.d)) / 144,
    };
  },
};
