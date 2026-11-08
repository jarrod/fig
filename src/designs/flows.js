import { makeNoise } from '../core/geometry.js';
import { makeFrame } from '../core/frame.js';
import { pct } from '../core/text.js';

export default {
  id: 'flows',
  kind: 'line',
  // Seconds per loop at normal speed; this design moves fast, so it loops slowly.
  loopSeconds: 15,
  // Samples a patch of ground, so it can be shown in any frame shape.
  framed: true,

  describe: ({ edge, hilly, where }) =>
    `Each line follows a seeded noise field from a random start${hilly ? ' over rolling ground' : ''}, ${where}. ${pct(edge)}% run off the edge before their 140 steps are up.`,

  name: () => 'Perlin flow field',

  draw(out, R, detail, time = 0, seed, frame = makeFrame()) {
    const { w, h } = frame;
    const noise = makeNoise(R);
    // As many lines per unit of ground as on the original 12 × 12 square.
    const lines = Math.round((30 + detail * 8) * frame.scale);
    const freq = 0.12 + R() * 0.22;
    const swirl = 1 + R() * 2.5;
    const hills = R() * 3;
    const ox = Math.cos(time) * 1.2;
    const oy = Math.sin(time) * 1.2;
    const lift = (x, y) => hills * (0.5 + 0.5 * noise(x * 0.12 + 50, y * 0.12 + 50));
    let edge = 0;
    for (let i = 0; i < lines; i++) {
      let x = R() * w;
      let y = R() * h;
      const p = [frame.to(x, y, lift(x, y))];
      // Follow the direction field in small steps until the line leaves the ground patch.
      for (let s = 0; s < 140; s++) {
        const a = noise(x * freq + ox, y * freq + oy) * Math.PI * swirl;
        x += Math.cos(a) * 0.12;
        y += Math.sin(a) * 0.12;
        if (x < 0 || x > w || y < 0 || y > h) {
          edge++;
          break;
        }
        p.push(frame.to(x, y, lift(x, y)));
      }
      frame.push(out, { g: i, r: false, open: true, p });
    }
    return { edge: edge / lines, hilly: frame.iso && hills > 1.5, where: frame.where };
  },
};
