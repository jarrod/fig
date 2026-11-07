import { project, normalise, turnAbout } from '../core/geometry.js';

const sub = (a, b) => a.map((v, i) => v - b[i]);
const dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
const unit = (a) => {
  const l = Math.hypot(...a) || 1;
  return a.map((v) => v / l);
};

export default {
  id: 'ribbons',
  kind: 'line',
  // Seconds per loop at normal speed, set from how fast it moves on screen.
  loopSeconds: 30,

  describe({ system, strands, steps, width, length }) {
    const about = system ? 'three equations that each feed the sine of the next' : 'a simple model of air rolling in a heated layer';
    return `${strands} parallel strands, ${width} units apart, follow one path of ${steps} points traced from ${about}. The path is about ${length} units long, and the strands' sideways direction is carried along it so the ribbon does not twist about itself.`;
  },

  name: ({ system }) => (system ? 'Thomas ribbon' : 'Lorenz ribbon'),

  draw(out, R, detail, time = 0) {
    const system = R() < 0.5 ? 0 : 1;
    const strands = 3 + Math.floor(R() * 3);
    const width = 0.08 + R() * 0.1;
    const angle = R() * 6.283;
    const steps = Math.min(Math.floor(7500 / strands), 400 + detail * 110);
    let p;
    let dt;
    let every;
    let step;
    if (system === 0) {
      const rho = 28 + R() * 8;
      dt = 0.006;
      every = 2;
      p = [0.1 + R() * 0.5, R() * 0.5, R() * 0.5];
      step = ([x, y, z]) => [10 * (y - x), x * (rho - z) - y, x * y - (8 / 3) * z];
    } else {
      const b = 0.18 + R() * 0.025;
      dt = 0.05;
      every = 3;
      p = [0.1 + R(), R(), R()];
      step = ([x, y, z]) => [Math.sin(y) - b * x, Math.sin(z) - b * y, Math.sin(x) - b * z];
    }
    // Runge–Kutta steps, keeping every few, and skipping the first 400 kept
    // points so the path has settled onto the attractor.
    const add = (a, b, s) => a.map((v, i) => v + b[i] * s);
    const points = [];
    for (let i = 0; i < (steps + 400) * every; i++) {
      const k1 = step(p);
      const k2 = step(add(p, k1, dt / 2));
      const k3 = step(add(p, k2, dt / 2));
      const k4 = step(add(p, k3, dt));
      p = p.map((v, j) => v + (dt / 6) * (k1[j] + 2 * k2[j] + 2 * k3[j] + k4[j]));
      if (i >= 400 * every && i % every === 0) points.push(p);
    }
    const path = normalise(points);
    // The sideways direction starts level and is carried along the path: at
    // each step, the part along the new heading is removed, so it never spins.
    const n = path.length;
    const heading = path.map((q, i) => unit(sub(path[Math.min(i + 1, n - 1)], path[Math.max(i - 1, 0)])));
    let side = unit([-heading[0][1], heading[0][0], 0]);
    const sides = [];
    let length = 0;
    for (let i = 0; i < n; i++) {
      const h = heading[i];
      side = unit(sub(side, h.map((v) => v * dot(side, h))));
      sides.push(side);
      if (i) length += Math.hypot(...sub(path[i], path[i - 1]));
    }
    // The ribbon turns once around its vertical axis per loop.
    for (let k = 0; k < strands; k++) {
      const off = (k - (strands - 1) / 2) * width;
      const pts = path.map((q, i) => project(...turnAbout(q.map((v, j) => v + sides[i][j] * off), angle + time)));
      out.push({ g: k, r: false, open: true, p: pts });
    }
    return { system, strands, steps, width: Math.round(width * 100) / 100, length: Math.round(length) };
  },
};
