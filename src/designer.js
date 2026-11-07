// One design's page: a large live preview, seed and style controls, and export.
// Every setting is kept in the URL, so a page can be shared as it looks.
import { DESIGNS } from './designs/index.js';
import {
  DEFAULT_STYLE,
  TAU,
  build,
  describeDesign,
  exportAnimatedSvg,
  exportSvg,
  fitDesign,
  loopMs,
  updatePaths,
} from './core/render.js';

const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)');
const isColour = (v) => /^#[0-9a-f]{6}$/i.test(v ?? '');
const clamp = (v, lo, hi, fallback) => (Number.isFinite(v) ? Math.min(hi, Math.max(lo, v)) : fallback);

function readSettings(params) {
  // A missing parameter must fall back to its default, not read as 0.
  const num = (key) => (params.has(key) && params.get(key) !== '' ? Number(params.get(key)) : NaN);
  return {
    seed: Math.round(clamp(num('seed'), 1, 99999, 1 + Math.floor(Math.random() * 9998))),
    detail: Math.round(clamp(num('detail'), 1, 10, 5)),
    animate: params.get('animate') === '1',
    speed: clamp(num('speed'), 0.25, 2, 1),
    style: {
      line: isColour(params.get('line')) ? params.get('line') : DEFAULT_STYLE.line,
      background: isColour(params.get('bg')) ? params.get('bg') : DEFAULT_STYLE.background,
      transparent: params.get('t') === '1',
      width: clamp(num('w'), 0.25, 3, DEFAULT_STYLE.width),
    },
  };
}

function writeUrl(design, s) {
  const params = new URLSearchParams({ d: design.id, seed: s.seed, detail: s.detail });
  if (s.animate) params.set('animate', '1');
  if (s.speed !== 1) params.set('speed', s.speed);
  if (s.style.line !== DEFAULT_STYLE.line) params.set('line', s.style.line);
  if (s.style.background !== DEFAULT_STYLE.background) params.set('bg', s.style.background);
  if (s.style.transparent) params.set('t', '1');
  if (s.style.width !== DEFAULT_STYLE.width) params.set('w', s.style.width);
  history.replaceState(null, '', `?${params}`);
}

function download(text, filename) {
  const url = URL.createObjectURL(new Blob([text], { type: 'image/svg+xml' }));
  const link = Object.assign(document.createElement('a'), { href: url, download: filename });
  link.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

const size = (text) => {
  const bytes = new Blob([text]).size;
  return bytes > 1024 * 1024 ? `${(bytes / 1024 / 1024).toFixed(1)} MB` : `${Math.ceil(bytes / 1024)} KB`;
};

export function showDesigner(app, design, params) {
  const s = readSettings(params);
  const index = DESIGNS.indexOf(design);
  const prev = DESIGNS[(index - 1 + DESIGNS.length) % DESIGNS.length];
  const next = DESIGNS[(index + 1) % DESIGNS.length];
  let frame = 0;

  app.innerHTML = `
    <a class="back" href="./" data-route>← All designs</a>
    <div class="designer">
      <div>
        <div class="preview" id="preview"></div>
        <div class="about">
          <div class="fig" id="fig"></div>
          <h1 id="name"></h1>
          <p id="description"></p>
        </div>
        <nav class="steps" aria-label="Other designs">
          <a href="?d=${prev.id}" data-route>← ${prev.id}</a>
          <a href="?d=${next.id}" data-route>${next.id} →</a>
        </nav>
      </div>
      <aside class="panel">
        <section>
          <h2>Drawing</h2>
          <div class="row"><span>Seed</span><input id="seed" type="number" min="1" max="99999" /><button id="random" type="button">Random</button></div>
          <div class="row"><span>Detail</span><input id="detail" type="range" min="1" max="10" step="1" /><output id="detail-out"></output></div>
          <div class="row"><span>Animate</span><input id="animate" type="checkbox" /></div>
          <div class="row"><span>Speed</span><input id="speed" type="range" min="0.25" max="2" step="0.25" /><output id="speed-out"></output></div>
          <p class="hint" id="loop-hint"></p>
        </section>
        <section>
          <h2>Style</h2>
          <div class="row"><span>Line colour</span><input id="line" type="color" /></div>
          <div class="row"><span>Background</span><input id="background" type="color" /></div>
          <div class="row"><span>Transparent background</span><input id="transparent" type="checkbox" /></div>
          <p class="hint" id="fill-hint" hidden>Solid shapes stay filled with the background colour, because the fill is what hides the lines behind them.</p>
          <div class="row"><span>Line width</span><input id="width" type="range" min="0.25" max="3" step="0.05" /><output id="width-out"></output></div>
          <button id="reset" type="button">Reset style</button>
        </section>
        <section>
          <h2>Export</h2>
          <div class="actions">
            <button id="download" type="button" class="primary">Download SVG</button>
            <button id="copy" type="button">Copy SVG code</button>
            <button id="download-animated" type="button">Download animated SVG</button>
          </div>
          <p class="status" id="status" role="status"></p>
        </section>
      </aside>
    </div>`;

  const $ = (id) => app.querySelector(`#${id}`);
  const preview = $('preview');
  const status = (text) => {
    $('status').textContent = text;
  };

  const syncInputs = () => {
    $('seed').value = s.seed;
    $('detail').value = s.detail;
    $('detail-out').textContent = s.detail;
    $('animate').checked = s.animate;
    $('speed').value = s.speed;
    $('speed-out').textContent = `${s.speed}×`;
    $('loop-hint').textContent = `One loop takes ${+(loopMs(design, s.speed) / 1000).toFixed(1)} s, in the preview and in animated exports.`;
    $('line').value = s.style.line;
    $('background').value = s.style.background;
    $('transparent').checked = s.style.transparent;
    $('width').value = s.style.width;
    $('width-out').textContent = s.style.width.toFixed(2);
  };

  const render = () => {
    cancelAnimationFrame(frame);
    writeUrl(design, s);
    const { faces, facts } = build(design, s.seed, s.detail, 0);
    const name = design.name(facts);
    $('fig').textContent = `Fig 0.${index + 1} · ${design.id} · seed ${s.seed}`;
    $('name').textContent = name;
    $('description').textContent = describeDesign(design, facts, faces.length);
    document.title = `${name} · Gen Cards`;
    $('fill-hint').hidden = !(s.style.transparent && design.kind === 'solid');
    preview.classList.toggle('transparent', s.style.transparent);
    preview.innerHTML = exportSvg(design, s.seed, s.detail, s.style);

    const loop = s.animate && !reducedMotion.matches;
    const group = preview.querySelector('svg > g');
    if (!loop || !group || !faces.length) return;
    const box = fitDesign(design, s.seed, s.detail, true);
    const lineWidth = (s.style.width * 0.72).toFixed(2);
    const loopLength = loopMs(design, s.speed);
    const tick = (now) => {
      updatePaths(group, build(design, s.seed, s.detail, ((now % loopLength) / loopLength) * TAU).faces, box);
      for (const path of group.querySelectorAll('path.line')) path.setAttribute('stroke-width', lineWidth);
      frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
  };

  const change = (update) => {
    update();
    syncInputs();
    status('');
    render();
  };

  $('seed').addEventListener('change', () => change(() => (s.seed = Math.round(clamp(Number($('seed').value), 1, 99999, s.seed)))));
  $('random').addEventListener('click', () => change(() => (s.seed = 1 + Math.floor(Math.random() * 9998))));
  $('detail').addEventListener('input', () => change(() => (s.detail = Number($('detail').value))));
  $('animate').addEventListener('change', () => change(() => (s.animate = $('animate').checked)));
  $('speed').addEventListener('input', () => change(() => (s.speed = Number($('speed').value))));
  $('line').addEventListener('input', () => change(() => (s.style.line = $('line').value)));
  $('background').addEventListener('input', () => change(() => (s.style.background = $('background').value)));
  $('transparent').addEventListener('change', () => change(() => (s.style.transparent = $('transparent').checked)));
  $('width').addEventListener('input', () => change(() => (s.style.width = Number($('width').value))));
  $('reset').addEventListener('click', () => change(() => (s.style = { ...DEFAULT_STYLE })));

  const filename = (suffix = '') => `${design.id}-${s.seed}${suffix}.svg`;
  $('download').addEventListener('click', () => {
    const svg = exportSvg(design, s.seed, s.detail, s.style);
    download(svg, filename());
    status(`Downloaded ${filename()} (${size(svg)}).`);
  });
  $('copy').addEventListener('click', async () => {
    const svg = exportSvg(design, s.seed, s.detail, s.style);
    try {
      await navigator.clipboard.writeText(svg);
      status(`Copied SVG code (${size(svg)}).`);
    } catch {
      status('Copying was blocked by the browser. Use Download SVG instead.');
    }
  });
  $('download-animated').addEventListener('click', () => {
    const button = $('download-animated');
    button.disabled = true;
    status('Building animated SVG…');
    // Let the status paint before the (sometimes slow) build.
    setTimeout(() => {
      const { svg, mode } = exportAnimatedSvg(design, s.seed, s.detail, s.style, { speed: s.speed });
      download(svg, filename('-animated'));
      const how = mode === 'morph' ? 'shapes morph smoothly' : 'frames swap in steps, because parts appear and disappear';
      status(`Downloaded ${filename('-animated')} (${size(svg)}). It loops every ${+(loopMs(design, s.speed) / 1000).toFixed(1)} s; ${how}.`);
      button.disabled = false;
    }, 30);
  });

  syncInputs();
  render();
  return () => cancelAnimationFrame(frame);
}
