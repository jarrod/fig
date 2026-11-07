import { project, rng, turnAbout } from '../core/geometry.js';
import { pct } from '../core/text.js';

// Growing the tree takes too long to repeat every frame, so each (seed, detail)
// is grown once and kept. Frames only turn and project it.
const cache = new Map();
const CACHE_SIZE = 20;
const CROWNS = ['round', 'tall', 'wide', 'cone'];

// Space colonisation. Seeded attractor points fill the crown. Each round, every
// attractor finds the nearest branch node within reach and pulls it; each node
// that is pulled grows one short step toward the average direction of its
// pulls. Attractors that a branch comes close to are used up. Growth stops when
// none are left within reach.
function colonise({ crown, attractors, reach, kill, stepLength, top, radius, simSeed }) {
  const R = rng(simSeed);
  const h = top * 0.35;
  // Attractors scattered evenly through the crown's volume.
  const spots = [];
  while (spots.length < attractors) {
    const u = R() * 2 - 1;
    const v = R() * 2 - 1;
    const w = R() * 2 - 1;
    let inside;
    if (crown === 'cone') inside = w > -1 && Math.hypot(u, v) < (1 - w) / 2;
    else inside = u * u + v * v + w * w < 1;
    if (!inside) continue;
    const sx = crown === 'wide' ? 1.35 : crown === 'tall' ? 0.75 : 1;
    const sz = crown === 'wide' ? 0.7 : crown === 'tall' ? 1.25 : 1;
    spots.push([6 + u * radius * sx, 6 + v * radius * sx, top + (w - 1) * h * sz]);
  }
  const alive = spots.map(() => true);
  const nodes = [[6, 6, 0]];
  const parent = [-1];
  // Nodes go into a grid of reach-sized cells, so each attractor only checks
  // the 27 cells around it.
  const grid = new Map();
  const key = (x, y, z) => (Math.floor(x / reach) * 1000 + Math.floor(y / reach)) * 1000 + Math.floor(z / reach);
  const add = (p, from) => {
    nodes.push(p);
    parent.push(from);
    const k = key(...p);
    const list = grid.get(k);
    if (list) list.push(nodes.length - 1);
    else grid.set(k, [nodes.length - 1]);
  };
  grid.set(key(...nodes[0]), [0]);
  // The trunk climbs straight up until the crown is within reach.
  const near = () => spots.some((s, i) => alive[i] && Math.hypot(s[0] - nodes.at(-1)[0], s[1] - nodes.at(-1)[1], s[2] - nodes.at(-1)[2]) < reach);
  while (!near() && nodes.at(-1)[2] < top) add([6, 6, nodes.at(-1)[2] + stepLength], nodes.length - 1);
  for (let round = 0; round < 400 && nodes.length < 6000; round++) {
    const pull = new Map();
    spots.forEach((s, i) => {
      if (!alive[i]) return;
      let best = -1;
      let bestD = reach;
      const cx = Math.floor(s[0] / reach);
      const cy = Math.floor(s[1] / reach);
      const cz = Math.floor(s[2] / reach);
      for (let a = -1; a <= 1; a++) {
        for (let b = -1; b <= 1; b++) {
          for (let c = -1; c <= 1; c++) {
            const list = grid.get(((cx + a) * 1000 + cy + b) * 1000 + cz + c);
            if (!list) continue;
            for (const j of list) {
              const n = nodes[j];
              const d = Math.hypot(s[0] - n[0], s[1] - n[1], s[2] - n[2]);
              if (d < bestD) {
                bestD = d;
                best = j;
              }
            }
          }
        }
      }
      if (best < 0) return;
      if (bestD < kill) {
        alive[i] = false;
        return;
      }
      const n = nodes[best];
      const dir = pull.get(best) ?? [0, 0, 0];
      dir[0] += (s[0] - n[0]) / bestD;
      dir[1] += (s[1] - n[1]) / bestD;
      dir[2] += (s[2] - n[2]) / bestD;
      pull.set(best, dir);
    });
    if (!pull.size) break;
    for (const [j, dir] of pull) {
      // A little seeded jitter stops a node caught between two equal pulls
      // from stepping on the spot forever.
      const d = [dir[0] + (R() - 0.5) * 0.1, dir[1] + (R() - 0.5) * 0.1, dir[2] + (R() - 0.5) * 0.1];
      const len = Math.hypot(...d) || 1;
      const n = nodes[j];
      add([n[0] + (d[0] / len) * stepLength, n[1] + (d[1] / len) * stepLength, n[2] + (d[2] / len) * stepLength], j);
    }
  }
  // Break the tree into chains for drawing: each chain follows a node's first
  // child, and every other child starts a new chain from its parent.
  const children = nodes.map(() => []);
  parent.forEach((p, i) => p >= 0 && children[p].push(i));
  const chains = [];
  const starts = [0];
  while (starts.length) {
    let i = starts.pop();
    const chain = parent[i] >= 0 ? [nodes[parent[i]], nodes[i]] : [nodes[i]];
    while (children[i].length) {
      starts.push(...children[i].slice(1));
      i = children[i][0];
      chain.push(nodes[i]);
    }
    if (chain.length > 1) chains.push(chain);
  }
  const used = alive.filter((v) => !v).length;
  const tips = children.filter((c) => !c.length).length;
  return { chains, used: used / attractors, tips, nodes: nodes.length };
}

export default {
  id: 'branches',
  kind: 'line',
  // Seconds per loop at normal speed, set from how fast it moves on screen.
  loopSeconds: 30,

  describe({ crown, attractors, used, segments, tips }) {
    const shape = { round: 'a round', tall: 'a tall, narrow', wide: 'a wide, flattened', cone: 'a cone-shaped' }[crown];
    const reached = used > 0.995 ? 'Every point was reached' : `The branches reached ${pct(used)}% of the points`;
    return `A tree grown from one root toward ${attractors} seeded points scattered through ${shape} crown, one short step at a time; each point is used up once a branch comes near it. ${reached}, with ${segments} segments ending in ${tips} tips.`;
  },

  name: () => 'Space colonisation',

  draw(out, R, detail, time = 0, seed) {
    const crown = CROWNS[Math.floor(R() * CROWNS.length)];
    const attractors = 200 + detail * 80;
    const reach = 1.6 + R() * 1.4;
    const kill = 0.35 + R() * 0.25;
    const stepLength = 0.18 + R() * 0.07;
    const top = 9 + R() * 3;
    const radius = 3.2 + R() * 1.6;
    const angle = R() * 6.283;
    const simSeed = Math.floor(R() * 2 ** 32);
    const key = seed == null ? null : `${seed}/${detail}`;
    let sim = key !== null && cache.get(key);
    if (!sim) {
      sim = colonise({ crown, attractors, reach, kill, stepLength, top, radius, simSeed });
      if (key !== null) {
        cache.set(key, sim);
        if (cache.size > CACHE_SIZE) cache.delete(cache.keys().next().value);
      }
    }
    // The tree turns once around its trunk per loop.
    sim.chains.forEach((chain, i) => out.push({ g: i, r: false, open: true, p: chain.map((q) => project(...turnAbout(q, angle + time))) }));
    return { crown, attractors, used: sim.used, segments: sim.nodes - 1, tips: sim.tips };
  },
};
