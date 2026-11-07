// The home page: every design as a live card. Settings are kept while you move
// between the gallery and design pages.
import { DESIGNS } from './designs/index.js';

const state = {
  kind: 'all',
  detail: 5,
  animate: false,
  speed: 1,
  seeds: null,
};

const speedLabel = (v) => `${v}×`;

const newSeeds = () => Object.fromEntries(DESIGNS.map((d) => [d.id, 1 + Math.floor(Math.random() * 9998)]));

export function showGallery(app) {
  state.seeds ??= newSeeds();
  app.innerHTML = `
    <header class="intro">
      <h1>Gen Cards</h1>
      <p>Generative line drawings, each made by one algorithm. Open a design to change its seed and style, then export it as an SVG for your own site.</p>
    </header>
    <div class="controls">
      <div class="filter" role="group" aria-label="Show">
        <button type="button" data-kind="all">All</button>
        <button type="button" data-kind="solid">Solids</button>
        <button type="button" data-kind="line">Lines</button>
      </div>
      <label>Detail <input id="detail" type="range" min="1" max="10" step="1" /> <output id="detail-out"></output></label>
      <label><input id="animate" type="checkbox" /> Animate</label>
      <label>Speed <input id="speed" type="range" min="0.25" max="2" step="0.25" /> <output id="speed-out"></output></label>
      <button id="shuffle" type="button">Shuffle</button>
    </div>
    <div class="grid" id="grid"></div>`;

  const grid = app.querySelector('#grid');
  const detail = app.querySelector('#detail');
  const animate = app.querySelector('#animate');
  const speed = app.querySelector('#speed');
  detail.value = state.detail;
  animate.checked = state.animate;
  speed.value = state.speed;
  app.querySelector('#speed-out').textContent = speedLabel(state.speed);

  // Links carry the gallery's animation settings over to the design page.
  const hrefFor = (design, seed) =>
    `?d=${design.id}&seed=${seed}&detail=${state.detail}${state.animate ? '&animate=1' : ''}${state.speed !== 1 ? `&speed=${state.speed}` : ''}`;
  const updateCards = (attribute, value) => {
    for (const link of grid.querySelectorAll('a[data-id]')) {
      link.setAttribute('href', hrefFor({ id: link.dataset.id }, state.seeds[link.dataset.id]));
      const card = link.querySelector('gen-card');
      if (attribute === 'animate') card.toggleAttribute('animate', value);
      else card.setAttribute(attribute, value);
    }
  };

  const paint = () => {
    app.querySelector('#detail-out').textContent = state.detail;
    for (const b of app.querySelectorAll('.filter button')) b.setAttribute('aria-pressed', String(b.dataset.kind === state.kind));
    grid.replaceChildren(
      ...DESIGNS.flatMap((design, i) => {
        if (state.kind !== 'all' && design.kind !== state.kind) return [];
        const seed = state.seeds[design.id];
        const link = document.createElement('a');
        link.setAttribute('href', hrefFor(design, seed));
        link.dataset.route = '';
        link.dataset.id = design.id;
        link.setAttribute('aria-label', `Open ${design.id}, seed ${seed}`);
        const card = document.createElement('gen-card');
        card.setAttribute('form', design.id);
        card.setAttribute('seed', seed);
        card.setAttribute('detail', state.detail);
        card.setAttribute('fig', `0.${i + 1}`);
        card.toggleAttribute('animate', state.animate);
        card.setAttribute('speed', state.speed);
        link.append(card);
        return [link];
      }),
    );
  };

  app.querySelector('.filter').addEventListener('click', (event) => {
    const kind = event.target.closest('button')?.dataset.kind;
    if (!kind) return;
    state.kind = kind;
    paint();
  });
  detail.addEventListener('input', () => {
    state.detail = Number(detail.value);
    paint();
  });
  animate.addEventListener('change', () => {
    state.animate = animate.checked;
    updateCards('animate', state.animate);
  });
  speed.addEventListener('input', () => {
    state.speed = Number(speed.value);
    app.querySelector('#speed-out').textContent = speedLabel(state.speed);
    updateCards('speed', state.speed);
  });
  app.querySelector('#shuffle').addEventListener('click', () => {
    state.seeds = newSeeds();
    paint();
  });

  paint();
  document.title = 'Gen Cards';
  return () => {};
}
