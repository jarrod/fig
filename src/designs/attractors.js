import { project, normalise, turnAbout } from '../core/geometry.js';

export default {
  id: 'attractors',
  kind: 'line',
  // Seconds per loop at normal speed; this design moves fast, so it loops slowly.
  loopSeconds: 30,

  describe({ system, steps }) {
    const about = [
      'a simple model of air rolling in a heated layer',
      'equations that wind a path around a sphere-like shell',
      'three equations that each feed the sine of the next',
    ][system];
    return `One unbroken path of ${steps} steps, traced by following ${about} from a seeded start.`;
  },

  name: ({ system }) => ['Lorenz attractor', 'Aizawa attractor', 'Thomas attractor'][system],

  draw(out, R, detail, time = 0) {
    const system = Math.floor(R() * 3);
    const steps = 1500 + detail * 500;
    const angle = R() * 6.283;
    let p = [0.1 + R() * 0.5, R() * 0.5, R() * 0.5];
    let dt;
    let step;
    if (system === 0) {
      const rho = 28 + R() * 8;
      dt = 0.005;
      step = ([x, y, z]) => [10 * (y - x), x * (rho - z) - y, x * y - (8 / 3) * z];
    } else if (system === 1) {
      const a = 0.9 + R() * 0.1;
      dt = 0.01;
      step = ([x, y, z]) => [(z - 0.7) * x - 3.5 * y, 3.5 * x + (z - 0.7) * y, 0.6 + a * z - z ** 3 / 3 - (x * x + y * y) * (1 + 0.25 * z) + 0.1 * z * x ** 3];
    } else {
      const b = 0.18 + R() * 0.025;
      dt = 0.06;
      p = [0.1 + R(), R(), R()];
      step = ([x, y, z]) => [Math.sin(y) - b * x, Math.sin(z) - b * y, Math.sin(x) - b * z];
    }
    // Runge–Kutta steps along the equations. The first 400 are skipped so the
    // path has settled onto the attractor.
    const add = (a, b, s) => a.map((v, i) => v + b[i] * s);
    const points = [];
    for (let i = 0; i < steps + 400; i++) {
      const k1 = step(p);
      const k2 = step(add(p, k1, dt / 2));
      const k3 = step(add(p, k2, dt / 2));
      const k4 = step(add(p, k3, dt));
      p = p.map((v, j) => v + (dt / 6) * (k1[j] + 2 * k2[j] + 2 * k3[j] + k4[j]));
      if (i >= 400) points.push(p);
    }
    const shaped = normalise(points);
    // The attractor turns once around its vertical axis per loop.
    out.push({ g: 0, r: false, open: true, p: shaped.map((q) => project(...turnAbout(q, angle + time))) });
    return { system, steps };
  },
};
