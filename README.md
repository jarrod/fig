<picture>
  <source media="(prefers-color-scheme: dark)" srcset="media/banner-dark.svg">
  <img src="media/banner-light.svg" width="100%" alt="Fig: generative line drawings, exported as SVG">
</picture>

**Mathematics, drawn in line.**

Fig is a collection of generative line drawings: minimal surfaces, strange attractors, fractals, flow fields, tilings and more. Each one is drawn by a single algorithm and grown from a seed. Find one you love, make it yours, and take it home as an SVG.

## Why Fig exists

A lot of beautiful mathematics never gets seen outside a textbook. A Lorenz attractor, a Penrose tiling or a reaction–diffusion pattern make great artwork, but turning one into something you can drop onto a website usually means writing the code yourself.

Fig does that part for you. Every drawing is clean vector line work that suits a hero image, a background or a header, and you can tune it until it fits your page.

## What you can do

- **Browse** the gallery and try new seeds until something catches your eye.
- **Shape it** on its own page: change the seed, detail, frame, line colour, background, line width and animation speed.
- **Share it** with a link. Every setting lives in the URL.
- **Take it home** as a still SVG, or as an animated SVG that loops forever on its own, with no JavaScript.

Every drawing can be reproduced: the same design and seed always give you the same picture. Each one also comes with a short description, written from what's actually in that drawing.

## Running it locally

Fig is a static React site built with Vite.

```bash
npm install
npm run dev
```

Then open http://localhost:5174. `npm run build` writes a static site to `dist/`.

## License

The code is available under the [MIT License](LICENSE).

The drawings are yours. Any SVG you export from Fig, still or animated, is free to use for any purpose, personal or commercial, with no attribution needed. They're dedicated to the public domain under [CC0 1.0](https://creativecommons.org/publicdomain/zero/1.0/).
