import { project, normalise, turnAbout } from '../core/geometry.js';

export default {
  id: 'attractors',
  kind: 'line',
  // Seconds per loop at normal speed; this design moves fast, so it loops slowly.
  loopSeconds: 30,

  describe({ system, steps, param, swaps, turns }) {
    const about = [
      `a simple model of air rolling in a heated layer, with ρ = ${param.toFixed(1)}`,
      `equations that wind a path around a sphere-like shell, with a = ${param.toFixed(3)}`,
      `three equations that each feed the sine of the next, with damping b = ${param.toFixed(3)}`,
    ][system];
    const measured = [
      `It swaps between its two wings ${swaps} times.`,
      `It circles the axis ${turns} times, rising and falling through the middle.`,
      `It crosses the middle ${swaps} times as it wanders between its lobes.`,
    ][system];
    return `One unbroken path of ${steps} steps, traced by following ${about}, from a seeded start. ${measured}`;
  },

  name: ({ system }) => ['Lorenz attractor', 'Aizawa attractor', 'Thomas attractor'][system],

  draw(out, R, detail, time = 0) {
    const system = Math.floor(R() * 3);
    const steps = 1500 + detail * 500;
    const angle = R() * 6.283;
    let p = [0.1 + R() * 0.5, R() * 0.5, R() * 0.5];
    let dt;
    let step;
    let param;
    if (system === 0) {
      const rho = 28 + R() * 8;
      param = rho;
      dt = 0.005;
      step = ([x, y, z]) => [10 * (y - x), x * (rho - z) - y, x * y - (8 / 3) * z];
    } else if (system === 1) {
      const a = 0.9 + R() * 0.1;
      param = a;
      dt = 0.01;
      step = ([x, y, z]) => [(z - 0.7) * x - 3.5 * y, 3.5 * x + (z - 0.7) * y, 0.6 + a * z - z ** 3 / 3 - (x * x + y * y) * (1 + 0.25 * z) + 0.1 * z * x ** 3];
    } else {
      const b = 0.18 + R() * 0.025;
      param = b;
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
    // Measured from the path: how often it changes side (the sign of x),
    // and how many whole turns it makes around the vertical axis.
    let swaps = 0;
    let angle0 = Math.atan2(points[0][1], points[0][0]);
    let wound = 0;
    for (let i = 1; i < points.length; i++) {
      if (Math.sign(points[i][0]) !== Math.sign(points[i - 1][0])) swaps++;
      const a1 = Math.atan2(points[i][1], points[i][0]);
      let d = a1 - angle0;
      if (d > Math.PI) d -= 2 * Math.PI;
      if (d < -Math.PI) d += 2 * Math.PI;
      wound += d;
      angle0 = a1;
    }
    return { system, steps, param, swaps, turns: Math.round(Math.abs(wound) / (2 * Math.PI)) };
  },
};
