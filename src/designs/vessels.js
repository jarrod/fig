import { project, peakIndex } from '../core/geometry.js';
import { pct } from '../core/text.js';

export default {
  id: 'vessels',
  kind: 'solid',

  describe({ rings, widest, fullBottom, fullTop }) {
    const change = fullTop > fullBottom * 1.1 ? 'rounder' : fullTop < fullBottom / 1.1 ? 'spikier' : 'about as sharp';
    const where =
      widest === 0 ? 'The widest ring is at the base.' : widest === 1 ? 'The widest ring is at the top.' : `The widest ring is ${pct(widest)}% of the way up.`;
    return `${rings} rings shaped by the superformula, ${change} toward the top. ${where}`;
  },

  name: () => 'Gielis superformula',

  draw(out, R, detail, time = 0) {
    const rings = 8 + detail * 4;
    const lobes = 3 + Math.floor(R() * 6);
    // A multiple of lobes, so turning by one lobe lands on the same points.
    const samples = lobes * Math.ceil(72 / lobes);
    const sharpBottom = 0.3 + R() * 1.4;
    const sharpTop = 0.3 + R() * 1.4;
    const n2 = 1 + R() * 3;
    const base = 2.6 + R() * 1.4;
    const bulge = 0.6 + R() * 1.4;
    const phase = R() * 6;
    const twist = (R() - 0.5) * 1.6;
    const radii = [];
    const fullness = [];
    for (let i = 0; i < rings; i++) {
      const t = i / (rings - 1);
      const size = base + Math.sin(t * 3 + phase) * bulge + (1 - t) * 0.8;
      // The superformula: lobes sets the symmetry, n1 how sharp the lobes are.
      // The whole shape turns one lobe per loop, so the loop is seamless.
      const n1 = (sharpBottom + (sharpTop - sharpBottom) * t) * (1 + 0.3 * Math.sin(time));
      const turn = twist * t + time / lobes;
      const shape = [];
      for (let k = 0; k < samples; k++) {
        const q = (k / samples) * Math.PI * 2;
        const a = Math.abs(Math.cos((lobes * q) / 4)) ** n2 + Math.abs(Math.sin((lobes * q) / 4)) ** n2;
        shape.push(a ** (-1 / n1));
      }
      const max = Math.max(...shape);
      fullness.push(Math.min(...shape) / max);
      radii.push(size);
      out.push({
        g: i,
        r: false,
        p: shape.map((v, k) => {
          const q = (k / samples) * Math.PI * 2 + turn;
          const r = (v / max) * size;
          return project(Math.cos(q) * r, Math.sin(q) * r, t * 12);
        }),
      });
    }
    return {
      rings,
      widest: peakIndex(radii) / (rings - 1),
      fullBottom: fullness[0],
      fullTop: fullness[fullness.length - 1],
    };
  },
};
