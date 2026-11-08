// The <gen-card> element: one design drawn to a canvas, with its figure
// number, seed and the algorithm's name. The description lives on the
// design's own page. The drawing is built and painted by a
// Web Worker (see core/card-pool.js), and only once the card comes near the
// viewport, so a page full of cards opens without waiting on the maths. It
// draws the same paths as the downloadable SVG.
//
// When its drawing is ready the element gets a `ready` attribute and fires a
// `gen-card-ready` event, so a page can show a placeholder until then.
//
// `animate` loops the drawing while the card is on screen; `animate="hover"`
// loops it only while the pointer is over the card or it has keyboard focus,
// and pauses it where it is otherwise.
import * as pool from './core/card-pool.js';
import { HEIGHT, WIDTH } from './core/frame.js';

const STYLE = `
  :host { display: block; height: 100%; }
  .card { background: #0e1011; border: 1px solid #26292b; border-radius: 12px; padding: 14px 16px 16px; height: 100%; box-sizing: border-box; }
  .meta { display: flex; justify-content: space-between; gap: 8px; font: 11px/1.4 ui-monospace, Menlo, monospace; color: #5e6367; }
  /* Rounded, so drawings that run edge to edge (the Fill frame) get soft corners. */
  .art { aspect-ratio: ${WIDTH} / ${HEIGHT}; margin: 2px 0 6px; border-radius: 8px; overflow: hidden; }
  canvas { display: block; width: 100%; height: 100%; opacity: 0; }
  :host([ready]) canvas { opacity: 1; }
  @media (prefers-reduced-motion: no-preference) { canvas { transition: opacity 0.35s; } }
  /* One line, so every card is the same size. A page can keep room at its end
     for a control of its own with --gen-card-title-gap. */
  h3 { margin: 0; padding-right: var(--gen-card-title-gap, 0); font: 500 14px/1.4 system-ui, sans-serif; color: #d7dade; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
`;

const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)');
// Cards start building this far before they scroll into view.
const NEAR = '600px 0px';

class GenCard extends HTMLElement {
  static observedAttributes = ['form', 'seed', 'detail', 'fig', 'animate', 'speed', 'frame'];

  #id = 0;
  #near = false;
  #visible = false;
  #hovered = false;
  #built = '';
  #observers = [];

  connectedCallback() {
    if (!this.shadowRoot) {
      this.attachShadow({ mode: 'open' }).innerHTML = `
        <style>${STYLE}</style>
        <div class="card">
          <div class="meta"><span class="fig"></span><span class="seed"></span></div>
          <div class="art"><canvas role="img"></canvas></div>
          <h3>&nbsp;</h3>
        </div>`;
    }
    // A canvas can only be handed to a worker once, so a card that is put
    // back on the page gets a fresh one.
    let canvas = this.shadowRoot.querySelector('canvas');
    if (canvas.dataset.taken) {
      const fresh = document.createElement('canvas');
      fresh.setAttribute('role', 'img');
      canvas.replaceWith(fresh);
      canvas = fresh;
    }
    canvas.dataset.taken = '1';
    this.#id = pool.connect(canvas, (msg) => this.#ready(msg));
    this.#built = '';
    this.#meta();

    const art = this.shadowRoot.querySelector('.art');
    const sized = new ResizeObserver(([entry]) => {
      const dpr = Math.min(2, window.devicePixelRatio || 1);
      const width = Math.round(entry.contentRect.width * dpr);
      if (width) pool.resize(this.#id, width, Math.round((width * HEIGHT) / WIDTH));
    });
    sized.observe(art);
    const near = new IntersectionObserver(
      ([entry]) => {
        this.#near = entry.isIntersecting;
        this.#update();
      },
      { rootMargin: NEAR },
    );
    near.observe(this);
    const seen = new IntersectionObserver(([entry]) => {
      this.#visible = entry.isIntersecting;
      this.#sync();
    });
    seen.observe(this);
    this.#observers = [sized, near, seen];

    // Hover and keyboard focus, for animate="hover". A card inside a link
    // gets focus through the link, so focus is watched there.
    const focusable = this.closest('a, button, [tabindex]') ?? this;
    const on = () => {
      this.#hovered = true;
      this.#sync();
    };
    const off = () => {
      this.#hovered = false;
      this.#sync();
    };
    const listen = [
      [this, 'pointerenter', on],
      [this, 'pointerleave', off],
      [focusable, 'focusin', on],
      [focusable, 'focusout', off],
    ];
    for (const [target, type, fn] of listen) target.addEventListener(type, fn);
    this.#unlisten = () => {
      for (const [target, type, fn] of listen) target.removeEventListener(type, fn);
    };
  }

  #unlisten = () => {};

  disconnectedCallback() {
    for (const o of this.#observers) o.disconnect();
    this.#unlisten();
    pool.disconnect(this.#id);
    this.#id = 0;
  }

  attributeChangedCallback() {
    if (!this.#id) return;
    this.#meta();
    this.#update();
  }

  #settings() {
    return {
      form: this.getAttribute('form') ?? '',
      seed: Number(this.getAttribute('seed')) || 1,
      detail: Number(this.getAttribute('detail')) || 5,
      // Only field designs use the frame; the rest ignore it.
      frame: this.getAttribute('frame') ?? undefined,
      speed: Number(this.getAttribute('speed')) || 1,
      animate: this.hasAttribute('animate') && !reducedMotion.matches,
    };
  }

  // Builds the drawing once the card is near the viewport, and again only
  // when a setting changes. Until a rebuild is ready the old drawing stays.
  #update() {
    if (!this.#near) return;
    const settings = this.#settings();
    const key = JSON.stringify(settings);
    if (key !== this.#built) {
      this.#built = key;
      pool.build(this.#id, settings);
    }
    this.#sync();
  }

  #sync() {
    const hoverOnly = this.getAttribute('animate') === 'hover';
    pool.animate(this.#id, Boolean(this.#built) && this.#visible && this.#settings().animate && (!hoverOnly || this.#hovered));
  }

  #meta() {
    this.shadowRoot.querySelector('.fig').textContent = `Fig ${this.getAttribute('fig') ?? '0.1'}`;
    this.shadowRoot.querySelector('.seed').textContent = this.getAttribute('seed') ?? '';
  }

  // The heading is the algorithm's name.
  #ready({ name }) {
    const root = this.shadowRoot;
    const h3 = root.querySelector('h3');
    h3.textContent = name;
    h3.title = name;
    const { seed, animate } = this.#settings();
    root.querySelector('canvas').setAttribute('aria-label', `${name} drawing, seed ${seed}${animate ? ', animated' : ''}`);
    if (!this.hasAttribute('ready')) {
      this.setAttribute('ready', '');
      this.dispatchEvent(new Event('gen-card-ready', { bubbles: true }));
    }
  }
}

if (!customElements.get('gen-card')) customElements.define('gen-card', GenCard);
