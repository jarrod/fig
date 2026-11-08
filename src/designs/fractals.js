import { box } from '../core/geometry.js';
import { plural } from '../core/text.js';

export default {
  id: 'fractals',
  kind: 'solid',
  // Every face moves in one even swell, so 10 keyframes describe it, and the
  // animated file stays small despite the many faces.
  exportFrames: 10,

  describe({ rule, levels, ruleCubes, kept, apart }) {
    const rate = [20, 7, 8][rule];
    const missing = ruleCubes - kept;
    return `Each of ${plural(levels, 'step')} keeps ${rate} of every 27 smaller cubes, leaving ${ruleCubes}. ${
      missing ? `${missing} more were removed at random.` : 'None were removed at random.'
    } The cubes draw apart until each fills ${apart}% of its cell, and close up again.`;
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
    // Each kept cube has a fixed roll against the damage, so the same cubes
    // are missing all through the loop.
    const kept = [];
    let ruleCubes = 0;
    for (let x = 0; x < n; x++) {
      for (let y = 0; y < n; y++) {
        for (let z = 0; z < n; z++) {
          if (!keep(x, y, z)) continue;
          ruleCubes++;
          if (R() >= damage) kept.push([x, y, z]);
        }
      }
    }
    // The motion: every cube shrinks about its own centre, opening gaps that
    // show the structure inside, then grows back. The cells stay put, so the
    // outline holds its size. Every cube always draws all three visible
    // faces, so the drawing never changes shape abruptly. Cubes are drawn back to front in grid order. At rest they
    // touch, as a solid; the sponge, with far more cubes inside, opens less so
    // its holes stay readable.
    const least = 1;
    const most = rule === 0 ? 0.74 + R() * 0.1 : 0.45 + R() * 0.25;
    const size = least - (least - most) * (0.5 - 0.5 * Math.cos(time));
    const inset = (1 - size) / 2;
    kept.forEach(([x, y, z], g) => box(out, x + inset, y + inset, z + inset, size, size, size, g));
    return { rule, levels, ruleCubes, kept: kept.length, apart: Math.round(most * 100) };
  },
};
