import { cell, cubes } from '../core/geometry.js';
import { plural } from '../core/text.js';

export default {
  id: 'fractals',
  kind: 'solid',

  describe({ rule, levels, ruleCubes, kept }) {
    const rate = [20, 7, 8][rule];
    const missing = ruleCubes - kept;
    return `Each of ${plural(levels, 'step')} keeps ${rate} of every 27 smaller cubes, leaving ${ruleCubes}. ${
      missing ? `${missing} more were removed at random.` : 'None were removed at random.'
    }`;
  },

  name: ({ rule }) => ['Menger sponge', 'Vicsek fractal', 'Cantor dust'][rule],

  draw(out, R, detail, time = 0) {
    const rule = Math.floor(R() * 3);
    const levels = detail < 4 ? 1 : rule === 0 ? 2 : 3;
    const n = 3 ** levels;
    const damage = R() * 0.2;
    // Split the cube into 27 and keep some, then repeat inside each kept cube.
    // Sponge keeps the 20 that are not face or body centres, cross keeps the
    // centre and the 6 face centres, and dust keeps only the 8 corners.
    const keep = (x, y, z) => {
      for (let s = 1; s < n; s *= 3) {
        const ones = (Math.floor(x / s) % 3 === 1) + (Math.floor(y / s) % 3 === 1) + (Math.floor(z / s) % 3 === 1);
        if (rule === 0 ? ones >= 2 : rule === 1 ? ones < 2 : ones > 0) return false;
      }
      return true;
    };
    // Each kept cube has a fixed roll, so cubes drop out and return as the damage level moves.
    const level = damage * (1 + 0.8 * Math.sin(time));
    const on = new Uint8Array(n * n * n);
    let ruleCubes = 0;
    let kept = 0;
    for (let x = 0; x < n; x++) {
      for (let y = 0; y < n; y++) {
        for (let z = 0; z < n; z++) {
          if (!keep(x, y, z)) continue;
          ruleCubes++;
          if (R() >= level) {
            on[cell(n, x, y, z)] = 1;
            kept++;
          }
        }
      }
    }
    cubes(out, on, n);
    return { rule, levels, ruleCubes, kept };
  },
};
