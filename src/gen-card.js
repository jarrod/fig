import { DESIGN, DESIGNS } from './designs/index.js';
import { HEIGHT, TAU, WIDTH, build, describeDesign, drawPaths, fitDesign, loopMs, updatePaths } from './core/render.js';

const STYLE = `
  :host { display: block; }
  .card { background: #0e1011; border: 1px solid #26292b; border-radius: 12px; padding: 14px 16px 16px; height: 100%; box-sizing: border-box; }
  .meta { display: flex; justify-content: space-between; gap: 8px; font: 11px/1.4 ui-monospace, Menlo, monospace; color: #5e6367; }
  svg { display: block; width: 100%; margin: 2px 0 6px; }
  path { fill: #0e1011; stroke: #55595d; stroke-width: 0.7; stroke-linejoin: round; }
  path.line { fill: none; stroke-width: 0.5; }
  h3 { margin: 0 0 4px; font: 500 14px system-ui, sans-serif; color: #d7dade; }
  p { margin: 0; font: 400 13px/1.5 system-ui, sans-serif; color: #858a8f; }
  @media (prefers-reduced-motion: no-preference) { .still path { animation: in 0.35s both; } }
  @keyframes in { from { opacity: 0; } }
`;

const escapeHtml = (s) => s.replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]);

const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)');

class GenCard extends HTMLElement {
  static observedAttributes = ['form', 'seed', 'detail', 'fig', 'animate', 'speed'];

  #frame = 0;
  #visible = true;
  #observer = null;

  connectedCallback() {
    if (!this.shadowRoot) this.attachShadow({ mode: 'open' });
    // Skip drawing frames while the card is off screen.
    this.#observer = new IntersectionObserver(([entry]) => {
      this.#visible = entry.isIntersecting;
    });
    this.#observer.observe(this);
    this.render();
  }

  disconnectedCallback() {
    cancelAnimationFrame(this.#frame);
    this.#observer?.disconnect();
  }

  attributeChangedCallback() {
    if (this.shadowRoot) this.render();
  }

  render() {
    cancelAnimationFrame(this.#frame);
    const design = DESIGN[this.getAttribute('form') ?? ''] ?? DESIGNS[0];
    const seed = Number(this.getAttribute('seed')) || 1;
    const detail = Number(this.getAttribute('detail')) || 5;
    const fig = escapeHtml(this.getAttribute('fig') ?? '0.1');
    const loop = this.hasAttribute('animate') && !reducedMotion.matches;
    const loopLength = loopMs(design, Number(this.getAttribute('speed')) || 1);

    const { faces, facts } = build(design, seed, detail, 0);
    // The heading is the algorithm's name; the description is measured from the drawing.
    const name = design.name(facts);
    const body = describeDesign(design, facts, faces.length);
    const box = faces.length ? fitDesign(design, seed, detail, loop) : null;
    const label = `${name} drawing, seed ${seed}${loop ? ', animated' : ''}`;

    this.shadowRoot.innerHTML = `
      <style>${STYLE}</style>
      <div class="card">
        <div class="meta"><span>Fig ${fig}</span><span>${seed}</span></div>
        <svg class="${loop ? 'live' : 'still'}" viewBox="0 0 ${WIDTH} ${HEIGHT}" role="img" aria-label="${label}">${
          box ? drawPaths(faces, box, !loop) : ''
        }</svg>
        <h3>${name}</h3>
        <p>${body}</p>
      </div>`;
    if (!loop || !box) return;

    // All cards share one clock, so they move in step and a re-render never jumps.
    const svg = this.shadowRoot.querySelector('svg');
    const tick = (now) => {
      if (this.#visible) updatePaths(svg, build(design, seed, detail, ((now % loopLength) / loopLength) * TAU).faces, box);
      this.#frame = requestAnimationFrame(tick);
    };
    this.#frame = requestAnimationFrame(tick);
  }
}

if (!customElements.get('gen-card')) customElements.define('gen-card', GenCard);
