import { box, peakIndex } from '../core/geometry.js';
import { pct } from '../core/text.js';

export default {
  id: 'plates',
  kind: 'solid',

  describe({ type, slabs, tallest, front, crest, power, waves }) {
    if (type === 0) return `${slabs} slabs climb for the first ${pct(crest)}% of the way to the crest, then fall along a 1.6 power curve until the front slab is ${pct(front)}% of the tallest.`;
    if (type === 1) return `${slabs} slabs ripple through ${waves.toFixed(1)} waves, tallest ${pct(tallest)}% of the way forward, ending at ${pct(front)}% of that height.`;
    return `${slabs} slabs shrink as a power of ${power.toFixed(2)} until the front slab is ${pct(front)}% of the back slab.`;
  },

  name: ({ type }) => ['Power curve', 'Damped sine', 'Power-law decay'][type],

  draw(out, R, detail, time = 0) {
    const n = 6 + detail * 2;
    const peak = 0.1 + R() * 0.3;
    const type = Math.floor(R() * 3);
    const freq = 2 + R() * 3;
    const heights = [];
    for (let i = 0; i < n; i++) {
      const t = i / (n - 1);
      let v;
      if (type === 0) {
        // The crest slides back and forth.
        const p = peak + 0.08 * Math.sin(time);
        v = t < p ? 0.45 + (0.55 * t) / p : Math.pow(1 - (t - p) / (1 - p), 1.6);
      } else if (type === 1) {
        // The ripple travels toward the front.
        v = (0.55 + 0.45 * Math.sin(t * freq * 2 - time)) * (1 - t * 0.7);
      } else {
        // Reuses the values already drawn, so the other curves keep their shapes.
        // The fall steepens and relaxes.
        const floor = peak - 0.1;
        v = floor + (1 - floor) * Math.pow(1 - t, (freq - 1) * (1 + 0.35 * Math.sin(time)));
      }
      const h = 0.5 + v * 9;
      heights.push(h);
      box(out, 0, i * 1.05, 0, 12, 0.28, h, i);
    }
    const tallest = peakIndex(heights);
    return {
      type,
      slabs: heights.length,
      tallest: tallest / (heights.length - 1),
      front: heights[heights.length - 1] / heights[tallest],
      crest: peak,
      power: freq - 1,
      waves: (freq * 2) / (2 * Math.PI),
    };
  },
};
