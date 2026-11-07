import { box } from '../core/geometry.js';

export default {
  id: 'voxels',
  kind: 'solid',

  describe: ({ levels, top, fullest }) =>
    `Mirrored across the diagonal, reaching level ${top + 1} of ${levels}. The fullest level holds ${fullest}.`,

  name: () => 'Mirrored random fill',

  draw(out, R, detail, time = 0) {
    const n = Math.min(7, 2 + Math.ceil(detail / 2));
    // Each cell keeps its roll, so cubes come and go as the density rises and falls.
    const density = 0.42 + R() * 0.3 + 0.15 * Math.sin(time);
    const on = new Set();
    for (let z = 0; z < n; z++) {
      for (let x = 0; x < n; x++) {
        for (let y = 0; y <= x; y++) {
          if (R() < density * (1 - z / (n * 1.6))) {
            on.add(`${x},${y},${z}`);
            on.add(`${y},${x},${z}`);
          }
        }
      }
    }
    let g = 0;
    const perLevel = Array(n).fill(0);
    for (let x = 0; x < n; x++) {
      for (let y = 0; y < n; y++) {
        for (let z = 0; z < n; z++) {
          if (on.has(`${x},${y},${z}`)) {
            perLevel[z]++;
            box(out, x * 1.08, y * 1.08, z * 1.08, 1, 1, 1, g++);
          }
        }
      }
    }
    return {
      levels: n,
      top: perLevel.findLastIndex((count) => count > 0),
      fullest: Math.max(...perLevel),
    };
  },
};
