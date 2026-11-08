<picture>
  <source media="(prefers-color-scheme: dark)" srcset="media/banner-dark.svg">
  <img src="media/banner-light.svg" width="100%" alt="Gen Cards: generative line drawings, exported as SVG">
</picture>

A collection of generative line drawings. Each design is made by one algorithm (Perlin noise, a Hilbert curve, a Lorenz attractor, reaction–diffusion and so on). Pick a design, change its seed and style, and export it as an SVG to use on your own site.

The same design, seed and detail always give the same drawing and the same text. Each card's heading names the algorithm, and its description is written from values measured from that drawing.

## Run it

```bash
npm install
npm run dev
```

The site runs at http://localhost:5174. It's built with React, Tailwind CSS v4 and [shadcn/ui](https://ui.shadcn.com) on Base UI (style `base-nova`), on Vite. Add more shadcn components with `npx shadcn@latest add <name>`; they land in `src/components/ui/`. `npm run build` writes a static site to `dist/` that works on any static host. It assumes it's served from the root of a domain; to host it under a sub-path, set `base` in a Vite config.

`npm run banner` rebuilds the README banner (`media/banner-light.svg` and `media/banner-dark.svg`). It's set in `scripts/readme-banner.mjs`, where you can change the design, seed and detail.

## The site

- **Gallery** (`/`): every design as a card, with a button on each to try a new seed, at fixed settings (detail 5, normal speed, the Fill frame for field designs, a random seed per visit), and a card animates while it is hovered or has keyboard focus, then pauses where it is. A skeleton shows in each card's place until its drawing is ready.
- **Design page** (`/?d=flows&seed=6470&detail=5`): a large preview with seed, frame, detail, animation, speed, line colour, background, transparency and line width. Every setting is kept in the URL, so links can be shared.
- **Export**: download an SVG, copy its code, or download an animated SVG that loops on its own with SMIL (no script). Animated files morph each shape smoothly when every frame has the same shapes, and otherwise swap whole frames.

**Frames.** Ten designs sample a patch of ground rather than drawing one free shape: Perlin flow field, Wave interference, Gray–Scott reaction–diffusion, Slope hatching, Chladni figure, Domain-warped noise, Penrose tiling, Truchet tiles, Water caustics and Field lines. Their frame can be:
- **Diamond**: the isometric view of a square of ground, the default.
- **Fill**: seen from above, edge to edge across the whole card.
- **Square**, **Circle** or **Hexagon**: seen from above. The field is sampled over the whole shape and every line is clipped to it, so the field fills the shape rather than being cut from the diamond.

The other designs keep their own outline.

Solid designs hide lines by filling each face with the background colour, so their faces stay filled even when the background is transparent.

## The card element

```html
<script type="module" src="/src/gen-card.js"></script>
<gen-card form="plates" seed="4821" detail="5" fig="0.3"></gen-card>
```

Each card draws to a canvas, from the same path data as the downloadable SVG and with the same fills and strokes. The maths and the drawing run on a small pool of Web Workers (`src/core/card-pool.js`, `src/core/card-renderer.js`, `src/workers/card-worker.js`): each card hands its canvas to a worker as an OffscreenCanvas, so the page itself never waits. A card only starts building as it nears the viewport. One shared clock drives every animated card that is on screen, and a worker is only sent the next frame once it has drawn the last, so a slow design drops frames rather than holding up the page. Where OffscreenCanvas isn't supported, the same renderer runs on the main thread, one card per task. When its drawing is ready a card gets a `ready` attribute and fires a `gen-card-ready` event.

Add `animate` to loop the drawing while the card is on screen, or `animate="hover"` to loop it only while it is hovered or focused. With plain `animate`, it loops by moving its own seeded values, and `speed` (for example `0.5`) to slow it down or speed it up. Each design sets its own loop length for normal speed. Add `frame` (`fill`, `square`, `circle` or `hexagon`) to change the frame of a field design; other designs ignore it. Cards stay still for viewers who have reduced motion turned on. Each card shows its figure number, seed and the algorithm's name, kept to one line so every card is the same size; the description is on the design page.

## Layout

- `src/designs/` holds one file per design. Each exports `{ id, kind, name, describe, draw }`, and optionally `loopSeconds`, `framed`, `resorts` (for a solid whose faces are re-sorted by depth each frame, so its animated export swaps frames instead of morphing), and `exportFrames` (fewer keyframes for the animated export, for simple motion over many faces). To add a design, add a file and list it in `src/designs/index.js`. A design that draws several types (Lorenz, Aizawa or Thomas, say) is split into one card per type in the list with `split()` from `src/designs/pinned.js`, so a new seed only varies the drawing within its type.
- `scripts/check-design.mjs` checks a design against the rules below: it draws the same thing every time, loops without a seam, moves smoothly, is fast enough to animate, varies its text from seed to seed, and exports cleanly. `node scripts/check-design.mjs src/designs/<name>.js --sheet sheet.png` also renders a contact sheet of seeds with headless Chrome, and `--frame circle` checks a frame shape.
- `src/core/geometry.js` has the shared geometry: isometric projection, the seeded random generator, boxes, prisms, noise and more. `src/core/marching.js` traces contour lines. `src/core/text.js` has small helpers for descriptions.
- `src/core/render.js` fits a drawing to the frame, turns faces into SVG paths, and builds the exported files.
- `src/gen-card.js` defines the `<gen-card>` element. It has no React or other dependencies, so it works on any page.
- `src/App.jsx`, `src/pages/Gallery.jsx` and `src/pages/Designer.jsx` are the site, with a small query-string router in `src/lib/router.jsx`. `src/components/GenCard.jsx` wraps the element for React, setting its attributes directly, because React would otherwise assign `animate` as a property and replace the element's built-in `animate()` method.

A field design sets `framed: true` and gets a sixth argument, `frame` (from `src/core/frame.js`). It samples ground over `0..frame.w` by `0..frame.h`, turns ground points into drawing points with `frame.to(x, y, z)`, and adds lines with `frame.push(out, face)`, which clips them to the shape. `frame.scale` is the patch's area against the original 12 × 12 square, for keeping the same density of lines.

A design's `draw(out, R, detail, time, seed)` pushes faces into `out` and returns the facts its text needs. All randomness comes from `R`, called the same number of times at every `time`. `time` is in radians: 0 is the still drawing, and every motion repeats exactly every 2π. Solid faces must be pushed back to front, because each one is painted over the last to hide the lines behind it. Open lines (`open: true`) have no fill and can go in any order.
