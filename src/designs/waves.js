import { makeFrame } from '../core/frame.js';
import { contourLines, isClosed } from '../core/marching.js';
import { pct } from '../core/text.js';

const WORDS = ['', 'one', 'two', 'three', 'four'];

export default {
  id: 'waves',
  kind: 'line',
  // Seconds per loop at normal speed, set from how fast it moves on screen.
  loopSeconds: 20,
  // Samples a patch of ground, so it can be shown in any frame shape.
  framed: true,

  describe: ({ sources, wavelength, levels, lines, closed, where }) =>
    `${WORDS[sources][0].toUpperCase()}${WORDS[sources].slice(1)} point sources send out ripples ${wavelength.toFixed(1)} units apart, and their sum is traced at ${levels} heights ${where}. Of the ${lines} contour lines, ${pct(closed)}% close into loops.`,

  name: () => 'Wave interference',

  draw(out, R, detail, time = 0, seed, frame = makeFrame()) {
    const { w, h } = frame;
    const sources = 2 + Math.floor(R() * 3);
    const wavelength = 1.4 + R() * 2;
    const k = (Math.PI * 2) / wavelength;
    // Sources sit in or just outside the ground patch. Each has its own start phase
    // and turns a whole number of times per loop, so ripples travel outward
    // and the loop is seamless.
    const src = Array.from({ length: sources }, () => ({
      x: -2 + R() * (w + 4),
      y: -2 + R() * (h + 4),
      phase: R() * Math.PI * 2,
      speed: 1 + Math.floor(R() * 2),
    }));
    const levels = 3 + Math.floor(R() * 4);
    const lift = R() * 0.25;

    // Sum the waves on a grid. Each wave fades slowly with distance, so the
    // pattern is strongest near the sources.
    // Grid points per side of the original 12-unit square, kept per unit here.
    const n = 40 + detail * 8;
    const nx = Math.round((n * w) / 12);
    const ny = Math.round((n * h) / 12);
    const sx = w / (nx - 1);
    const sy = h / (ny - 1);
    const field = new Float32Array(nx * ny);
    for (const s of src) {
      const ph = s.phase + s.speed * time;
      for (let j = 0; j < ny; j++) {
        const dy = j * sy - s.y;
        for (let i = 0; i < nx; i++) {
          const dx = i * sx - s.x;
          const r = Math.sqrt(dx * dx + dy * dy);
          field[j * nx + i] += Math.sin(k * r - ph) / Math.sqrt(1 + r * 0.25);
        }
      }
    }

    // Levels spread evenly across the typical range of the sum.
    const spread = Math.sqrt(sources) * 0.6;
    let lines = 0;
    let closed = 0;
    for (let l = 0; l < levels; l++) {
      const level = -spread + ((l + 0.5) / levels) * spread * 2;
      for (const line of contourLines(field, nx, ny, level)) {
        if (line.length < 3) continue;
        lines++;
        if (isClosed(line)) closed++;
        frame.push(out, { g: l, r: false, open: true, p: line.map(([x, y]) => frame.to(x * sx, y * sy, level * lift)) });
      }
    }
    return { sources, wavelength, levels, lines, closed: lines ? closed / lines : 0, where: frame.where };
  },
};
