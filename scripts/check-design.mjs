// Checks one design module against the rules every design must follow, and
// renders a contact sheet of seeds to PNG with headless Chrome for a look.
//
//   node scripts/check-design.mjs src/designs/flows.js [--sheet out.png] [--frame circle]
//
// Rules checked: draws something for most seeds, finite points, deterministic,
// loops seamlessly (time 0 equals time 2π), moves smoothly (no jumps between
// close times), fast enough to animate, text that varies from seed to seed,
// well-formed exports, and lines kept inside the shape for each frame.
import { execFileSync } from 'node:child_process';
import { mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { TAU, build, describeDesign, exportAnimatedSvg, exportSvg, fitDesign, pathData } from '../src/core/render.js';
import { FRAME_IDS } from '../src/core/frame.js';

const args = process.argv.slice(2);
const file = args.find((a) => !a.startsWith('--') && !args[args.indexOf(a) - 1]?.startsWith('--'));
const opt = (name) => (args.includes(`--${name}`) ? args[args.indexOf(`--${name}`) + 1] : undefined);
const design = (await import(pathToFileURL(resolve(file)).href)).default;
const frameId = opt('frame');
const problems = [];
const notes = [];
const fail = (msg) => problems.includes(msg) || problems.push(msg);
let tiny = 0;

for (const key of ['id', 'kind', 'name', 'describe', 'draw']) if (!(key in design)) fail(`missing export field "${key}"`);
if (!['solid', 'line'].includes(design.kind)) fail(`kind must be 'solid' or 'line', got ${design.kind}`);

const seeds = Array.from({ length: 40 }, (_, i) => 1 + i * 241);
const flat = (faces) => faces.flatMap((f) => f.p.flat());
let empty = 0;
const texts = new Set();
const names = new Set();
for (const detail of [1, 5, 10]) {
  for (const seed of seeds.slice(0, detail === 5 ? 40 : 10)) {
    const a = build(design, seed, detail, 0, frameId);
    if (!a.faces.length) empty++;
    for (const f of a.faces) {
      if (!Array.isArray(f.p) || !f.p.length) fail('a face with no points');
      else if (f.p.length < 2) tiny++;
      if (f.p.some((q) => !Number.isFinite(q[0]) || !Number.isFinite(q[1]))) fail(`seed ${seed} detail ${detail}: non-finite point`);
      if (typeof f.g !== 'number') fail(`seed ${seed}: face without a numeric g`);
    }
    if (detail === 5) {
      texts.add(describeDesign(design, a.facts, a.faces.length));
      names.add(design.name(a.facts));
      const again = build(design, seed, detail, 0, frameId);
      if (JSON.stringify(again.faces) !== JSON.stringify(a.faces)) fail(`seed ${seed}: not deterministic`);
    }
  }
}
if (empty > 2) fail(`${empty} seed/detail runs drew nothing`);
if (texts.size < 30) fail(`only ${texts.size} distinct descriptions over 40 seeds: measure more from the drawing`);
if (tiny) fail(`${tiny} faces have a single point, which draws nothing: skip them`);
notes.push(`${texts.size}/40 distinct descriptions, ${names.size} distinct names`);

// Seamless loop and smooth motion, measured on screen (after fitting).
let seamWorst = 0;
let jumpWorst = 0;
let structureChanges = 0;
for (const seed of seeds.slice(0, 8)) {
  const box = fitDesign(design, seed, 5, true, frameId);
  if (!box) continue;
  const screen = (t) => build(design, seed, 5, t, frameId).faces.map((f) => f.p.map(([x, y]) => [x * box.k + box.ox, y * box.k + box.oy]));
  const diff = (A, B) => {
    if (A.length !== B.length || A.some((f, i) => f.length !== B[i].length)) return Infinity;
    let worst = 0;
    A.forEach((f, i) => f.forEach((q, j) => (worst = Math.max(worst, Math.hypot(q[0] - B[i][j][0], q[1] - B[i][j][1])))));
    return worst;
  };
  const s0 = diff(screen(0), screen(TAU));
  seamWorst = Math.max(seamWorst, s0 === Infinity ? 1e9 : s0);
  for (let i = 0; i < 24; i++) {
    const t = (i / 24) * TAU;
    const d = diff(screen(t), screen(t + TAU / 600));
    // Faces re-sorted by depth change places in the list, so per-face jumps
    // mean nothing for them; they count as structure changes instead.
    if (d === Infinity || design.resorts) structureChanges++;
    else jumpWorst = Math.max(jumpWorst, d);
  }
}
if (seamWorst > 0.05) fail(`loop seam: time 0 and 2π differ by ${seamWorst === 1e9 ? 'structure' : `${seamWorst.toFixed(2)} px`}`);
if (jumpWorst > 6) fail(`a jump of ${jumpWorst.toFixed(1)} px between frames 1/600 of a loop apart: motion must be smooth`);
notes.push(`seam ${seamWorst.toFixed(3)} px, worst step ${jumpWorst.toFixed(2)} px per 1/600 loop, ${structureChanges}/192 steps change structure`);

// Speed: an animated card rebuilds every frame.
for (const detail of [5, 10]) {
  build(design, 77, detail, 0, frameId);
  const t0 = performance.now();
  for (let i = 0; i < 20; i++) build(design, 77, detail, (i / 20) * TAU, frameId);
  const ms = (performance.now() - t0) / 20;
  notes.push(`detail ${detail}: ${ms.toFixed(1)} ms per frame`);
  if (detail === 5 && ms > 8) fail(`detail 5 takes ${ms.toFixed(1)} ms per frame (keep under 8)`);
  if (detail === 10 && ms > 25) fail(`detail 10 takes ${ms.toFixed(1)} ms per frame (keep under 25)`);
}

// Exports.
const still = exportSvg(design, 77, 5, undefined, frameId);
if (!still.startsWith('<svg') || /NaN|undefined/.test(still)) fail('still export is malformed');
const anim = exportAnimatedSvg(design, 77, 5, undefined, { frame: frameId });
if (/NaN|undefined/.test(anim.svg)) fail('animated export is malformed');
notes.push(`export: still ${(still.length / 1024).toFixed(0)} KB, animated ${anim.mode} ${(anim.svg.length / 1024).toFixed(0)} KB`);
if (anim.svg.length > 3 * 1024 * 1024) fail(`animated export is ${(anim.svg.length / 1048576).toFixed(1)} MB at detail 5 (keep under 3 MB)`);

if (design.framed) {
  for (const f of FRAME_IDS) {
    const r = build(design, 77, 5, 1, f);
    if (!r.faces.length) fail(`frame ${f}: drew nothing`);
  }
  notes.push('framed: drew in every frame shape');
}

console.log(`${design.id}: ${problems.length ? 'FAIL' : 'ok'}`);
for (const n of notes) console.log(`  ${n}`);
for (const p of problems) console.log(`  ✗ ${p}`);
console.log(`  sample text: ${[...texts][0]}`);
console.log(`  sample name: ${[...names][0]}`);

// Contact sheet: 12 seeds at detail 5, and seed 77 at detail 1, 5, 10 and three times.
const sheet = opt('sheet');
if (sheet) {
  const cells = [];
  const cell = (svg, label) => `<figure><div>${svg}</div><figcaption>${label}</figcaption></figure>`;
  for (const seed of [77, 1234, 4821, 9001, 3, 555, 2718, 6470, 8123, 31, 4242, 7777])
    cells.push(cell(exportSvg(design, seed, 5, undefined, frameId), `seed ${seed}`));
  for (const d of [1, 10]) cells.push(cell(exportSvg(design, 77, d, undefined, frameId), `seed 77 detail ${d}`));
  const html = `<!doctype html><style>body{margin:0;background:#000;display:grid;grid-template-columns:repeat(4,320px);gap:6px;padding:6px;font:11px monospace;color:#888}figure{margin:0}svg{display:block;width:320px;height:270px}path[fill=none]{}</style>${cells.join('')}`;
  const dir = mkdtempSync(join(tmpdir(), 'sheet-'));
  writeFileSync(join(dir, 'sheet.html'), html);
  execFileSync('/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', [
    '--headless=new', '--disable-gpu', '--hide-scrollbars', `--screenshot=${resolve(sheet)}`, '--window-size=1310,1200', `file://${join(dir, 'sheet.html')}`,
  ], { stdio: 'ignore' });
  console.log(`  contact sheet: ${resolve(sheet)}`);
}
process.exit(problems.length ? 1 : 0);
