import { box, hilbertPoint } from '../core/geometry.js';
import { plural } from '../core/text.js';

export default {
  id: 'paths',
  kind: 'solid',

  describe: ({ points, waves, range }) =>
    `${points} points joined into one unbroken Hilbert curve, with ${plural(waves, 'height wave')} along it. The tallest wall is ${range.toFixed(1)}× the lowest.`,

  name: () => 'Hilbert curve',

  draw(out, R, detail, time = 0) {
    const order = detail <= 3 ? 2 : detail <= 7 ? 3 : 4;
    const n = 2 ** order;
    const points = n * n;
    const turn = Math.floor(R() * 8);
    const waves = 1 + Math.floor(R() * 4);
    const phase = R() * 6.283;
    const size = n * 2 - 1;
    const amp = 0.6 + R() * 1.6;
    // One of the 8 rotations and mirror images of the curve.
    const orient = ([x, y]) => {
      let [a, b] = turn & 4 ? [y, x] : [x, y];
      if (turn & 1) a = n - 1 - a;
      if (turn & 2) b = n - 1 - b;
      return [a, b];
    };
    // Heights travel along the path as a wave.
    const height = (s) => 0.4 + amp * (0.5 + 0.5 * Math.sin(Math.PI * 2 * waves * s + phase - time));
    const cells = new Map();
    let prev = null;
    for (let k = 0; k < points; k++) {
      const [x, y] = orient(hilbertPoint(n, k));
      cells.set(`${x * 2},${y * 2}`, height(k / (points - 1)));
      if (prev) cells.set(`${prev[0] + x},${prev[1] + y}`, height((k - 0.5) / (points - 1)));
      prev = [x, y];
    }
    let g = 0;
    for (let x = 0; x < size; x++) {
      for (let y = 0; y < size; y++) {
        const h = cells.get(`${x},${y}`);
        if (h !== undefined) box(out, x, y, 0, 1, 1, h, g++);
      }
    }
    const all = [...cells.values()];
    return { points, waves, range: Math.max(...all) / Math.min(...all) };
  },
};
