import { project } from '../core/geometry.js';

// The simulation is slow enough to matter at 60 frames a second, so each
// (seed, detail) is run once and kept. Frames only cut and project the result.
const cache = new Map();
const CACHE_SIZE = 20;

// One double pendulum (arms l1, l2; bob masses m1, m2) as angles and spins.
// The standard equations of motion for two point masses on rigid, weightless arms.
function slope([t1, t2, w1, w2], l1, l2, m1, m2) {
  const g = 9.81;
  const d = t1 - t2;
  const den = 2 * m1 + m2 - m2 * Math.cos(2 * d);
  const a1 = (-g * (2 * m1 + m2) * Math.sin(t1) - m2 * g * Math.sin(t1 - 2 * t2) - 2 * Math.sin(d) * m2 * (w2 * w2 * l2 + w1 * w1 * l1 * Math.cos(d))) / (l1 * den);
  const a2 = (2 * Math.sin(d) * (w1 * w1 * l1 * (m1 + m2) + g * (m1 + m2) * Math.cos(t1) + w2 * w2 * l2 * m2 * Math.cos(d))) / (l2 * den);
  return [w1, w2, a1, a2];
}

function simulate({ count, l1, l2, m1, m2, a1, a2, nudge, steps }) {
  // The same 16 simulated seconds at every detail; detail only samples it more finely.
  const sub = Math.ceil(16 / (steps - 1) / 0.004); // Runge–Kutta steps per recorded point.
  const dt = 16 / (steps - 1) / sub;
  const reach = l1 + l2;
  const scale = 5 / reach;
  // The pendulum swings in the x–z plane with its pivot 10 units up, and each
  // recorded point slides a little further along y, so the trace becomes a
  // ribbon through time instead of a knot in one place.
  const place = (x, up, i) => project(6 + x * scale, (16 * i) / (steps - 1), 5 + up * scale);
  const traces = [];
  const tips = [];
  const arm = [];
  for (let k = 0; k < count; k++) {
    let s = [a1 + k * nudge, a2, 0, 0];
    const trace = [];
    const tip = [];
    for (let i = 0; i < steps; i++) {
      const ex = l1 * Math.sin(s[0]);
      const ey = -l1 * Math.cos(s[0]);
      const tx = ex + l2 * Math.sin(s[1]);
      const ty = ey - l2 * Math.cos(s[1]);
      trace.push(place(tx, ty, i));
      tip.push([tx, ty]);
      if (k === 0) arm.push([place(0, 0, i), place(ex, ey, i)]);
      for (let j = 0; j < sub; j++) {
        const add = (a, b, h) => a.map((v, n) => v + b[n] * h);
        const k1 = slope(s, l1, l2, m1, m2);
        const k2 = slope(add(s, k1, dt / 2), l1, l2, m1, m2);
        const k3 = slope(add(s, k2, dt / 2), l1, l2, m1, m2);
        const k4 = slope(add(s, k3, dt), l1, l2, m1, m2);
        s = s.map((v, n) => v + (dt / 6) * (k1[n] + 2 * k2[n] + 2 * k3[n] + k4[n]));
      }
    }
    traces.push(trace);
    tips.push(tip);
  }
  // Where the tips first move more than a fifth of the full reach apart.
  let split = null;
  for (let i = 0; i < steps && split === null; i++) {
    for (let k = 1; k < count; k++) {
      if (Math.hypot(tips[k][i][0] - tips[0][i][0], tips[k][i][1] - tips[0][i][1]) > reach * 0.2) split = i / (steps - 1);
    }
  }
  return { traces, arm, split };
}

const lerp = (a, b, t) => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t];

export default {
  id: 'pendulums',
  kind: 'line',
  // Seconds per loop at normal speed, set from how fast it moves on screen.
  loopSeconds: 40,

  describe({ count, nudge, steps, split }) {
    const start = `${count === 2 ? 'Two' : 'Three'} double pendulums let go with upper arms ${nudge} of a degree apart. Each tip is traced for ${steps} steps, shifted a little further sideways at every step so its path spreads out through time.`;
    if (split === null) return `${start} Their paths stay within a fifth of a full reach of each other the whole way.`;
    return `${start} Their paths stay together for the first ${Math.max(1, Math.round(split * 100))}% of the trace, then part.`;
  },

  name: () => 'Double pendulum',

  draw(out, R, detail, time = 0, seed) {
    const count = R() < 0.5 ? 2 : 3;
    const l1 = 1;
    const l2 = 0.6 + R() * 0.8;
    const m1 = 1;
    const m2 = 0.5 + R();
    // A high, near-flung start: low starts swing politely and never turn chaotic.
    const a1 = (0.6 + R() * 0.4) * Math.PI * (R() < 0.5 ? -1 : 1);
    const a2 = (R() * 2 - 1) * Math.PI;
    const pick = Math.floor(R() * 3);
    const nudge = ([0.1, 0.2, 0.5][pick] * Math.PI) / 180;
    const steps = 500 + detail * 150;
    const key = seed == null ? null : `${seed}/${detail}`;
    let sim = key !== null && cache.get(key);
    if (!sim) {
      sim = simulate({ count, l1, l2, m1, m2, a1, a2, nudge, steps });
      if (key !== null) {
        cache.set(key, sim);
        if (cache.size > CACHE_SIZE) cache.delete(cache.keys().next().value);
      }
    }
    // Replay: the visible share of the trace runs from all of it at time 0 to
    // none at time π and back. Hidden points sit on the moving tip, so every
    // frame has the same number of points.
    const at = (0.5 + 0.5 * Math.cos(time)) * (steps - 1);
    const last = Math.min(steps - 2, Math.floor(at));
    const frac = at - last;
    const cut = (line) => {
      const head = lerp(line[last], line[last + 1], frac);
      return line.map((q, i) => (i <= last ? q : head));
    };
    sim.traces.forEach((line, k) => out.push({ g: k, r: false, open: true, p: cut(line) }));
    // The first pendulum's arms where its tip has reached.
    const pivot = lerp(sim.arm[last][0], sim.arm[last + 1][0], frac);
    const elbow = lerp(sim.arm[last][1], sim.arm[last + 1][1], frac);
    out.push({ g: count, r: false, open: true, p: [pivot, elbow, lerp(sim.traces[0][last], sim.traces[0][last + 1], frac)] });
    return { count, nudge: ['a tenth', 'a fifth', 'half'][pick], steps, split: sim.split };
  },
};
