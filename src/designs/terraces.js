import { box, shareOut } from '../core/geometry.js';
import { pct, plural, trend } from '../core/text.js';

export default {
  id: 'terraces',
  kind: 'solid',

  describe: ({ levels, ledgeTrend, thicknessTrend, stature }) =>
    `${plural(levels, 'level')}, with ledges ${trend(ledgeTrend, 'widening', 'narrowing')} and thickness ${trend(thicknessTrend, 'growing', 'shrinking')}. Height is ${pct(stature)}% of the base width.`,

  name: () => 'Linear ramp',

  draw(out, R, detail, time = 0) {
    const n = Math.floor(3 + detail);
    // The top breathes in and out while the ledge and thickness trends swing.
    const topSize = 12 * (0.12 + R() * 0.38) * (1 + 0.25 * Math.sin(time));
    const height = 12 * (0.35 + R() * 0.4);
    const ledges = shareOut((12 - topSize) / 2, n - 1, 0.25, (R() * 1.6 - 0.8) * Math.cos(time));
    const thicknesses = shareOut(height, n, 0.3, (R() * 1.2 - 0.6) * Math.cos(2 * time));
    let inset = 0;
    let z = 0;
    thicknesses.forEach((h, i) => {
      const size = 12 - inset * 2;
      box(out, inset, inset, z, size, size, h, i);
      z += h;
      inset += ledges[i] ?? 0;
    });
    return {
      levels: thicknesses.length,
      ledgeTrend: ledges[ledges.length - 1] / ledges[0] || 1,
      thicknessTrend: thicknesses[thicknesses.length - 1] / thicknesses[0] || 1,
      stature: z / 12,
    };
  },
};
