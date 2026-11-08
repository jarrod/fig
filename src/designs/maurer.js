import { pct } from '../core/text.js';

const gcd = (a, b) => (b ? gcd(b, a % b) : a);
const RAD = Math.PI / 180;

export default {
  id: 'maurer',
  kind: 'line',
  loopSeconds: 24,

  name: () => 'Maurer rose',

  describe({ n, d, d2, petals, middle, drift }) {
    const second = d2 ? ` A second line steps every ${d2} degrees over it.` : '';
    return `The rose r = sin(${n}θ) has ${petals} petals. A line joins 361 points on it taken every ${d} degrees, and ${pct(middle)}% of its chords pass close to the centre. The step sways by up to ${drift.toFixed(2)} degrees as it moves.${second}`;
  },

  draw(out, R, detail, time = 0) {
    // n sets the petals; d, sharing no factor with 360, makes the line visit
    // 360 different angles before it returns home.
    const n = 2 + Math.floor(R() * 7);
    const pickStep = () => {
      let v;
      do v = 7 + Math.floor(R() * 173);
      while (gcd(v, 360) !== 1);
      return v;
    };
    const d = pickStep();
    // At high detail a second web with its own step is laid over the first.
    let d2;
    do d2 = pickStep();
    while (d2 === d);
    const tilt = R() * 360;
    // Points far along the line move the most, so the sway is centred on the
    // middle step and kept smaller for roses with more petals.
    const drift = 0.5 / Math.hypot(1, n);
    const step = drift * Math.sin(time);
    const at = (deg) => {
      const r = Math.sin(n * deg * RAD);
      const a = (deg + tilt) * RAD;
      return [r * Math.cos(a), r * Math.sin(a)];
    };


    if (detail > 5) {
      // It sways the other way, so the two webs slide across each other.
      const q = [];
      for (let k = 0; k <= 360; k++) q.push(at(k * d2 - (k - 180) * step));
      out.push({ g: 0, r: false, open: true, p: q });
    }

    const p = [];
    let middle = 0;
    for (let k = 0; k <= 360; k++) {
      p.push(at(k * d + (k - 180) * step));
      if (k) {
        // A chord passes close to the centre when the nearest point on it is.
        const [x1, y1] = at((k - 1) * d);
        const [x2, y2] = at(k * d);
        const dx = x2 - x1;
        const dy = y2 - y1;
        const t = Math.max(0, Math.min(1, -(x1 * dx + y1 * dy) / (dx * dx + dy * dy || 1)));
        if (Math.hypot(x1 + t * dx, y1 + t * dy) < 0.15) middle++;
      }
    }
    out.push({ g: 1, r: false, open: true, p });

    return { n, d, d2: detail > 5 ? d2 : 0, petals: n % 2 ? n : 2 * n, middle: middle / 360, drift };
  },
};
