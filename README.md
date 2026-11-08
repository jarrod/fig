<picture>
  <source media="(prefers-color-scheme: dark)" srcset="media/banner-dark.svg">
  <img src="media/banner-light.svg" width="100%" alt="Fig: generative line drawings, exported as SVG">
</picture>

Fig is a collection of generative line drawings. Each design comes from one algorithm, such as Perlin noise, a Hilbert curve, a Lorenz attractor or reaction–diffusion. Pick a design, change its seed and style, and export it as an SVG for your own site.

Drawings are reproducible: the same design, seed and detail always give the same drawing and the same text. Each card is headed with the algorithm's name, and its description is written from values measured from that drawing.

## Getting started

```bash
npm install
npm run dev
```

Then open http://localhost:5174.

To build a static site, run `npm run build`. It writes to `dist/`, which you can put on any static host. The build expects to be served from the root of a domain; to host it under a sub-path, set `base` in `vite.config.js`.

The site is built with React, Tailwind CSS v4 and [shadcn/ui](https://ui.shadcn.com) on Base UI (style `base-nova`), using Vite. To add a shadcn component, run `npx shadcn@latest add <name>`; it lands in `src/components/ui/`.

`npm run banner` rebuilds the README banner (`media/banner-light.svg` and `media/banner-dark.svg`). To use a different design, seed or detail, edit the constants at the top of `scripts/readme-banner.mjs`.

## Using the site

- **Gallery** (`/`) shows every design as a card. Cards use fixed settings: detail 5, normal speed, the Fill frame for field designs, and a random seed each visit. Each card has a button to try a new seed. A card animates while it's hovered or has keyboard focus, and pauses where it is when you move away. Until a card's drawing is ready, a skeleton holds its place.
- **Design page** (for example `/?d=flows&seed=6470&detail=5`) shows a large preview with controls for seed, frame, detail, animation, speed, line colour, background, transparency and line width. Every setting is kept in the URL, so you can share a link to exactly what you see.
- **Export** lets you download an SVG, copy its code, or download an animated SVG that loops on its own using SMIL, with no script. When every frame of an animation has the same shapes, the file morphs each shape smoothly; otherwise it swaps whole frames.

### Frames

Ten designs sample a patch of ground rather than drawing one free shape: Perlin flow field, Wave interference, Gray–Scott reaction–diffusion, Slope hatching, Chladni figure, Domain-warped noise, Penrose tiling, Truchet tiles, Water caustics and Field lines. You can choose how that patch is framed:

- **Diamond**: an isometric view of a square of ground. This is the default on the design page.
- **Fill**: seen from above, running edge to edge across the whole card. The gallery uses this one.
- **Square**, **Circle** or **Hexagon**: seen from above. The field is sampled across the whole shape and every line is clipped to it, so the pattern fills the shape instead of being cut out of the diamond.

Every other design keeps its own outline.

Solid designs hide the lines behind them by filling each face with the background colour, so their faces stay filled even when the background is transparent.

## The `<gen-card>` element

The cards are a standalone custom element with no React or other dependencies, so you can use them on any page:

```html
<script type="module" src="/src/gen-card.js"></script>
<gen-card form="plates" seed="4821" detail="5" fig="0.3"></gen-card>
```

It loads as plain ES modules, so outside this project, copy `src/gen-card.js` together with `src/core/`, `src/designs/` and `src/workers/`, keeping the same folder structure.

| Attribute | What it does |
| --- | --- |
| `form` | The design's id, the file name in `src/designs/` (for example `plates` or `flows`). |
| `seed` | The seed to draw. Defaults to 1. |
| `detail` | The level of detail. Defaults to 5. |
| `fig` | The figure number shown in the corner, such as `0.3`. |
| `animate` | Loops the drawing while the card is on screen. Use `animate="hover"` to loop only while the card is hovered or focused. |
| `speed` | Speeds up or slows down the animation, for example `0.5` for half speed. Each design sets its own loop length at normal speed. |
| `frame` | `fill`, `square`, `circle` or `hexagon` for a field design. Other designs ignore it. |

Cards stay still for viewers who have reduced motion turned on. Each card shows its figure number, seed and the algorithm's name, on one line so every card is the same size; the full description is on the design page. When a card's drawing is ready, the card gets a `ready` attribute and fires a `gen-card-ready` event, which you can use to swap out a placeholder.

### How it renders

Each card draws to a canvas, using the same path data, fills and strokes as the downloadable SVG. The maths and drawing run on a small pool of Web Workers (`src/core/card-pool.js`, `src/core/card-renderer.js`, `src/workers/card-worker.js`): each card hands its canvas to a worker as an OffscreenCanvas, so the page never waits on it.

A card only starts building when it nears the viewport. One shared clock drives every animated card on screen, and a worker is only sent its next frame once it has drawn the last one, so a slow design drops frames instead of holding up the page. In browsers without OffscreenCanvas, the same renderer runs on the main thread, one card per task.

## Project layout

- `src/designs/` has one file per design, all listed in `src/designs/index.js`.
- `src/core/geometry.js` has the shared geometry: isometric projection, the seeded random generator, boxes, prisms, noise and more. `src/core/marching.js` traces contour lines, and `src/core/text.js` has small helpers for writing descriptions.
- `src/core/frame.js` defines the frames for field designs.
- `src/core/render.js` fits a drawing to its frame, turns faces into SVG paths and builds the exported files.
- `src/gen-card.js` defines the `<gen-card>` element.
- `src/App.jsx`, `src/pages/Gallery.jsx` and `src/pages/Designer.jsx` are the site, with a small query-string router in `src/lib/router.jsx`. `src/components/GenCard.jsx` wraps the element for React. It sets the element's attributes directly, because React would otherwise assign `animate` as a property and replace the element's built-in `animate()` method.
- `scripts/check-design.mjs` checks a design against the rules below.

## Adding a design

Add a file to `src/designs/` and list it in `src/designs/index.js`. Each design exports `{ id, kind, name, describe, draw }`, plus any of these optional fields:

- `loopSeconds`: how long one animation loop lasts at normal speed (10 by default).
- `framed`: `true` for a field design that can use the frames above.
- `resorts`: `true` for a solid whose faces are re-sorted by depth each frame, so its animated export swaps whole frames instead of morphing.
- `exportFrames`: fewer keyframes for the animated export, which keeps files small for simple motion over many faces.

A design that can draw several types (Lorenz, Aizawa or Thomas attractors, say) is split into one card per type with `split()` from `src/designs/pinned.js`, so a new seed only varies the drawing within its type.

### Drawing

`draw(out, R, detail, time, seed)` pushes faces into `out` and returns the facts its text needs. A few rules keep drawings reproducible and animations seamless:

- All randomness comes from `R`, and it must be called the same number of times at every `time`.
- `time` is in radians. 0 is the still drawing, and every motion must repeat exactly every 2π.
- Solid faces must be pushed back to front, because each one is painted over the last to hide the lines behind it. Open lines (`open: true`) have no fill and can go in any order.

A field design sets `framed: true` and gets a sixth argument, `frame`. It samples ground over `0..frame.w` by `0..frame.h`, turns ground points into drawing points with `frame.to(x, y, z)`, and adds lines with `frame.push(out, face)`, which clips them to the shape. `frame.scale` is the patch's area compared with the original 12 × 12 square, so you can keep the same density of lines in every frame.

### Checking a design

```bash
node scripts/check-design.mjs src/designs/<name>.js
```

This checks that the design draws the same thing every time, loops without a seam, moves smoothly, is fast enough to animate, varies its text from seed to seed, keeps its lines inside each frame and exports cleanly. You can also pass a registered design's id instead of a path. Add `--sheet sheet.png` to render a contact sheet of seeds with headless Chrome, or `--frame circle` to check a particular frame.
