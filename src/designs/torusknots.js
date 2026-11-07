import { project, turnAbout } from '../core/geometry.js';
import { plural } from '../core/text.js';

const gcd = (a, b) => (b ? gcd(b, a % b) : a);

export default {
  id: 'torusknots',
  kind: 'line',
  // Seconds per loop at normal speed, set from how fast it moves on screen.
  loopSeconds: 40,

  describe({ p, q, strands, tilt }) {
    const ribbon = strands > 1 ? ` It is drawn as ${strands} strands side by side, like a flat ribbon.` : '';
    return `A line wound on an unseen ring: it goes ${plural(p, 'time')} around the ring and ${plural(q, 'time')} through its hole before closing.${ribbon} The ring is tipped ${tilt}° from flat.`;
  },

  name: ({ p, q }) => `${p},${q} torus knot`,

  draw(out, R, detail, time = 0) {
    // p and q share no factor, so one line visits every turn before it closes.
    let p;
    let q;
    do {
      p = 2 + Math.floor(R() * 6);
      q = 2 + Math.floor(R() * 8);
    } while (p === q || gcd(p, q) !== 1);
    const strands = 1 + Math.floor(R() * 3);
    const tube = 1.2 + R() * 1.3;
    const width = 0.12 + R() * 0.12;
    const tilt = 0.12 + R() * 0.45;
    const angle = R() * 6.283;
    const big = 5.5 - tube - width;
    const lift = 5.6;
    const count = Math.min(Math.floor(7500 / strands), (40 + detail * 14) * (p + q));
    const ct = Math.cos(tilt);
    const st = Math.sin(tilt);
    for (let k = 0; k < strands; k++) {
      // Strands sit at slightly different tube radii, so they stay parallel.
      const r = tube + (k - (strands - 1) / 2) * width;
      const pts = [];
      for (let i = 0; i <= count; i++) {
        const t = (i / count) * Math.PI * 2;
        const w = big + r * Math.cos(q * t);
        const x = w * Math.cos(p * t);
        const y = w * Math.sin(p * t);
        const z = r * Math.sin(q * t);
        // Tip the ring about x, then spin it once around the vertical per loop.
        const tipped = [6 + x, 6 + y * ct - z * st, lift + y * st + z * ct];
        pts.push(project(...turnAbout(tipped, angle + time)));
      }
      out.push({ g: k, r: false, open: true, p: pts });
    }
    return { p, q, strands, tilt: Math.round((tilt * 180) / Math.PI) };
  },
};
