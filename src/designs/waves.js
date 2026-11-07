import { project } from '../core/geometry.js';
import { contourLines, isClosed } from '../core/marching.js';
import { pct } from '../core/text.js';

const WORDS = ['', 'one', 'two', 'three', 'four'];

export default {
  id: 'waves',
  kind: 'line',
  // Seconds per loop at normal speed, set from how fast it moves on screen.
  loopSeconds: 20,

  describe: ({ sources, wavelength, levels, lines, closed }) =>
    `${WORDS[sources][0].toUpperCase()}${WORDS[sources].slice(1)} point sources send out ripples ${wavelength.toFixed(1)} units apart, and their sum is traced at ${levels} heights on a square 12 units across. Of the ${lines} contour lines, ${pct(closed)}% close into loops.`,

  name: () => 'Wave interference',

  draw(out, R, detail, time = 0) {
    const sources = 2 + Math.floor(R() * 3);
    const wavelength = 1.4 + R() * 2;
    const k = (Math.PI * 2) / wavelength;
    // Sources sit in or just outside the square. Each has its own start phase
    // and turns a whole number of times per loop, so ripples travel outward
    // and the loop is seamless.
    const src = Array.from({ length: sources }, () => ({
      x: -2 + R() * 16,
      y: -2 + R() * 16,
      phase: R() * Math.PI * 2,
      speed: 1 + Math.floor(R() * 2),
    }));
    const levels = 3 + Math.floor(R() * 4);
    const lift = R() * 0.25;

    // Sum the waves on a grid. Each wave fades slowly with distance, so the
    // pattern is strongest near the sources.
    const n = 40 + detail * 8;
    const step = 12 / (n - 1);
    const field = new Float32Array(n * n);
    for (const s of src) {
      const ph = s.phase + s.speed * time;
      for (let j = 0; j < n; j++) {
        const dy = j * step - s.y;
        for (let i = 0; i < n; i++) {
          const dx = i * step - s.x;
          const r = Math.sqrt(dx * dx + dy * dy);
          field[j * n + i] += Math.sin(k * r - ph) / Math.sqrt(1 + r * 0.25);
        }
      }
    }

    // Levels spread evenly across the typical range of the sum.
    const spread = Math.sqrt(sources) * 0.6;
    let lines = 0;
    let closed = 0;
    for (let l = 0; l < levels; l++) {
      const level = -spread + ((l + 0.5) / levels) * spread * 2;
      for (const line of contourLines(field, n, n, level)) {
        if (line.length < 3) continue;
        lines++;
        if (isClosed(line)) closed++;
        out.push({ g: l, r: false, open: true, p: line.map(([x, y]) => project(x * step, y * step, level * lift)) });
      }
    }
    return { sources, wavelength, levels, lines, closed: lines ? closed / lines : 0 };
  },
};
