import { project, makeNoise } from '../core/geometry.js';

export default {
  id: 'contours',
  kind: 'solid',

  describe({ lobing }) {
    const edge = lobing < 0.05 ? 'gently wavy' : lobing < 0.1 ? 'wavy' : 'deeply lobed';
    return `Each layer traces one contour of seeded noise around a peak, inside the one below. The base outline is ${edge}.`;
  },

  name: () => 'Perlin contours',

  draw(out, R, detail, time = 0) {
    const noise = makeNoise(R);
    const layers = 4 + detail * 2;
    const radius = 5.5;
    const height = 3 + R() * 5;
    const shape = 0.5 + R() * 1.2;
    const freq = 0.8 + R() * 1.4;
    const amp = 0.12 + R() * 0.28;
    const drift = 0.1 + R() * 0.25;
    const ox = Math.cos(time) * 1.2;
    const oy = Math.sin(time) * 1.2;
    const thick = height / layers;
    let prev = null;
    let baseLobing = 0;
    for (let k = 0; k < layers; k++) {
      const fall = Math.max(0.06, (1 - k / layers) ** shape);
      const r = [];
      for (let j = 0; j < 96; j++) {
        const q = (j / 96) * Math.PI * 2;
        let v = radius * fall * (1 + amp * noise(Math.cos(q) * freq + ox + 7, Math.sin(q) * freq + oy + k * drift));
        // Keep each layer inside the one below.
        if (prev) v = Math.min(v, prev[j] * 0.97);
        r.push(Math.max(0.2, v));
      }
      if (k === 0) {
        const mean = r.reduce((a, v) => a + v, 0) / r.length;
        baseLobing = r.reduce((a, v) => a + Math.abs(v - mean), 0) / r.length / mean;
      }
      const ring = (z) => r.map((v, j) => project(6 + Math.cos((j / 96) * Math.PI * 2) * v, 6 + Math.sin((j / 96) * Math.PI * 2) * v, z));
      out.push({ g: k, r: false, p: ring(k * thick) });
      out.push({ g: k, r: false, p: ring((k + 0.7) * thick) });
      prev = r;
    }
    return { lobing: baseLobing };
  },
};
