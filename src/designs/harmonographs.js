import { project, normalise } from '../core/geometry.js';
import { pct } from '../core/text.js';

export default {
  id: 'harmonographs',
  kind: 'line',
  // Seconds per loop at normal speed; this design moves fast, so it loops slowly.
  loopSeconds: 40,

  describe: ({ ratios, remain }) =>
    `Three fading swings, one per axis, at frequency ratios of ${ratios.join(':')} with a slight detune. Each ends with ${pct(remain)}% of its starting swing.`,

  name: () => 'Harmonograph',

  draw(out, R, detail, time = 0) {
    const ratios = [1 + Math.floor(R() * 4), 1 + Math.floor(R() * 4), 1 + Math.floor(R() * 4)];
    const detune = ratios.map(() => (R() - 0.5) * 0.02);
    const phases = ratios.map(() => R() * 6.283);
    const remain = 0.1 + R() * 0.3;
    const count = 1500 + detail * 450;
    const span = Math.PI * 2 * (12 + detail * 3);
    const decay = -Math.log(remain) / span;
    // One decaying swing per axis. Each phase moves a whole number of turns per
    // loop, so the loop is seamless.
    const points = [];
    for (let i = 0; i < count; i++) {
      const t = (i / (count - 1)) * span;
      const fade = Math.exp(-decay * t);
      points.push(ratios.map((f, k) => Math.sin((f + detune[k]) * t + phases[k] + (k + 1) * time) * fade));
    }
    out.push({ g: 0, r: false, open: true, p: normalise(points).map((q) => project(...q)) });
    return { ratios, remain };
  },
};
