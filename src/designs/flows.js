import { project, makeNoise } from '../core/geometry.js';
import { pct } from '../core/text.js';

export default {
  id: 'flows',
  kind: 'line',
  // Seconds per loop at normal speed; this design moves fast, so it loops slowly.
  loopSeconds: 15,

  describe: ({ edge, hilly }) =>
    `Each line follows a seeded noise field from a random start${hilly ? ' over rolling ground' : ''}, on a square 12 units across. ${pct(edge)}% run off the edge before their 140 steps are up.`,

  name: () => 'Perlin flow field',

  draw(out, R, detail, time = 0) {
    const noise = makeNoise(R);
    const lines = 30 + detail * 8;
    const freq = 0.12 + R() * 0.22;
    const swirl = 1 + R() * 2.5;
    const hills = R() * 3;
    const ox = Math.cos(time) * 1.2;
    const oy = Math.sin(time) * 1.2;
    const lift = (x, y) => hills * (0.5 + 0.5 * noise(x * 0.12 + 50, y * 0.12 + 50));
    let edge = 0;
    for (let i = 0; i < lines; i++) {
      let x = R() * 12;
      let y = R() * 12;
      const p = [project(x, y, lift(x, y))];
      // Follow the direction field in small steps until the line leaves the square.
      for (let s = 0; s < 140; s++) {
        const a = noise(x * freq + ox, y * freq + oy) * Math.PI * swirl;
        x += Math.cos(a) * 0.12;
        y += Math.sin(a) * 0.12;
        if (x < 0 || x > 12 || y < 0 || y > 12) {
          edge++;
          break;
        }
        p.push(project(x, y, lift(x, y)));
      }
      out.push({ g: i, r: false, open: true, p });
    }
    return { edge: edge / lines, hilly: hills > 1.5 };
  },
};
