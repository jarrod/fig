import { project } from '../core/geometry.js';

const gcd = (a, b) => (b ? gcd(b, a % b) : a);

// Every ordered triple of different rates from 2 to 9 that share no factor,
// which is what makes the closed line a true knot.
const TRIPLES = [];
for (let a = 2; a <= 9; a++) {
  for (let b = 2; b <= 9; b++) {
    for (let c = 2; c <= 9; c++) {
      if (gcd(a, b) === 1 && gcd(b, c) === 1 && gcd(a, c) === 1) TRIPLES.push([a, b, c]);
    }
  }
}

export default {
  id: 'knots',
  kind: 'line',
  // Seconds per loop at normal speed, set from how fast it moves on screen.
  loopSeconds: 40,

  describe: ({ rates, length, height }) =>
    `One closed line whose two ground directions and height each swing back and forth ${rates[0]}, ${rates[1]} and ${rates[2]} times per circuit. It is about ${length} units long and stands ${height} units tall on an 11-unit square.`,

  name: () => 'Lissajous knot',

  draw(out, R, detail, time = 0) {
    const rates = TRIPLES[Math.floor(R() * TRIPLES.length)];
    const phases = rates.map(() => R() * 6.283);
    const tall = 3 + R() * 3;
    // Each phase drifts a whole number of turns per loop: x forwards, y back,
    // and height either way, so the knot reshapes and returns.
    const drift = [1, -1, R() < 0.5 ? 1 : -1];
    const count = 600 + detail * 480;
    const p = [];
    let length = 0;
    let last;
    for (let i = 0; i <= count; i++) {
      const t = (i / count) * Math.PI * 2;
      const [x, y, z] = rates.map((f, k) => Math.cos(f * t + phases[k] + drift[k] * time));
      const q = [6 + x * 5.5, 6 + y * 5.5, (1 + z) * tall * 0.5];
      if (last) length += Math.hypot(q[0] - last[0], q[1] - last[1], q[2] - last[2]);
      last = q;
      p.push(project(...q));
    }
    out.push({ g: 0, r: false, open: true, p });
    return { rates, length: Math.round(length), height: Math.round(tall) };
  },
};
