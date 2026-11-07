import { box, peakIndex, countCrests } from '../core/geometry.js';
import { pct, plural } from '../core/text.js';

export default {
  id: 'sheets',
  kind: 'solid',
  // Seconds per loop at normal speed; this design moves fast, so it loops slowly.
  loopSeconds: 15,

  describe: ({ bulges, narrowest }) =>
    `Counting from the bottom, the stack forms ${plural(bulges, 'bulge')}. The narrowest is ${pct(narrowest)}% as wide as the widest.`,

  name: () => 'Rectified sine',

  draw(out, R, detail, time = 0) {
    const n = 4 + detail * 2;
    const f = 1 + R() * 4;
    const a = R() * 6;
    const step = 10 / n + 0.5;
    const widths = [];
    for (let i = 0; i < n; i++) {
      const s = 0.4 + 0.6 * Math.abs(Math.sin((i / n) * f + a - time)); // The wave climbs the stack.
      const w = 12 * s;
      widths.push(w);
      const d = 12 * (s * 0.5 + 0.5 * (1 - i / n));
      box(out, (12 - w) / 2, (12 - d) / 2, i * step, w, d, 0.12, i);
    }
    const widest = peakIndex(widths);
    return {
      bulges: countCrests(widths),
      narrowest: Math.min(...widths) / widths[widest],
    };
  },
};
