import { project, peakIndex, countCrests } from '../core/geometry.js';
import { pct, plural } from '../core/text.js';

export default {
  id: 'lathe',
  kind: 'solid',

  describe: ({ rings, bulges, narrowest }) =>
    `${rings} rings form ${plural(bulges, 'bulge')}. The narrowest is ${pct(narrowest)}% as wide as the widest.`,

  name: () => 'Surface of revolution',

  draw(out, R, detail, time = 0) {
    const n = 8 + detail * 4;
    const a = R() * 6;
    const f = 1.5 + R() * 4;
    const base = 2 + R() * 2;
    const radii = [];
    for (let i = 0; i < n; i++) {
      const t = i / (n - 1);
      const r = base + Math.sin(t * f + a - time) * 1.6 + Math.sin(t * f * 2.3 + a - time) * 0.6 + (1 - t) * 1.5; // The profile ripples upward.
      radii.push(Math.abs(r)); // A negative radius draws the same circle.
      const p = [];
      for (let k = 0; k < 72; k++) {
        const q = (k / 72) * Math.PI * 2;
        p.push(project(Math.cos(q) * r, Math.sin(q) * r, t * 12));
      }
      out.push({ g: i, r: false, p });
    }
    const widest = peakIndex(radii);
    return {
      rings: radii.length,
      bulges: countCrests(radii),
      narrowest: Math.min(...radii) / radii[widest],
    };
  },
};
