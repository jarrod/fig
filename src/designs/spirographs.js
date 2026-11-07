import { project } from '../core/geometry.js';
import { pct, plural } from '../core/text.js';

const gcd = (a, b) => (b ? gcd(b, a % b) : a);
const an = (n) => (n === 8 || n === 11 ? 'An' : 'A');

export default {
  id: 'spirographs',
  kind: 'line',
  // Seconds per loop at normal speed, set from how fast it moves on screen.
  loopSeconds: 20,

  describe({ ring, wheel, pen, laps, lobes, layers, wave }) {
    const loops = pen > 1 ? ', past its rim, so the lobes curl into loops' : '';
    return `${an(wheel)} ${wheel}-tooth wheel rolls inside ${an(ring).toLowerCase()} ${ring}-tooth ring, the pen on the bottom layer ${pct(pen)}% of the wheel's radius from its centre${loops}. Each line closes after ${plural(laps, 'trip')} round the ring with ${lobes} lobes, and ${layers} turned copies are stacked${wave ? `, each rising and falling ${wave === 1 ? 'once' : `${wave} times`} per trip` : ''}.`;
  },

  name: () => 'Hypotrochoid',

  draw(out, R, detail, time = 0) {
    // Whole-number tooth counts, so the pen returns to its start and the line closes.
    let ring;
    let wheel;
    let lobes;
    do {
      ring = 5 + Math.floor(R() * 9);
      wheel = 2 + Math.floor(R() * (ring - 3));
      lobes = ring / gcd(ring, wheel);
    } while (lobes < 3);
    const laps = wheel / gcd(ring, wheel);
    const pen = 0.35 + R() * 1.0;
    const layers = 2 + Math.floor(R() * 3);
    const shrink = R() * 0.15;
    const twist = (R() - 0.5) * (Math.PI / lobes);
    const gap = 1.8 + R() * 1.4;
    const wave = Math.floor(R() * 4);
    const waveHeight = wave ? 0.3 + R() * 0.7 : 0;
    const roll = (ring - wheel) / wheel;
    const scale = 5.5 / (ring - wheel + pen * wheel);
    const count = Math.min(Math.floor(7200 / layers), (24 + detail * 10) * (lobes + laps));
    const span = Math.PI * 2 * laps;
    for (let k = 0; k < layers; k++) {
      const d = pen * wheel * (1 - shrink * k);
      // The pen's phase turns once per loop, the other way on alternate layers,
      // which spins the curve while its rise and fall stay put.
      const phase = (k % 2 ? -1 : 1) * time;
      const turn = twist * k;
      const p = [];
      for (let i = 0; i <= count; i++) {
        const t = (i / count) * span;
        const x = (ring - wheel) * Math.cos(t) + d * Math.cos(roll * t + phase);
        const y = (ring - wheel) * Math.sin(t) - d * Math.sin(roll * t + phase);
        const c = Math.cos(turn);
        const s = Math.sin(turn);
        const z = k * gap + waveHeight * (1 + Math.sin(wave * t));
        p.push(project(6 + (x * c - y * s) * scale, 6 + (x * s + y * c) * scale, z));
      }
      out.push({ g: k, r: false, open: true, p });
    }
    return { ring, wheel, pen, laps, lobes, layers, wave };
  },
};
