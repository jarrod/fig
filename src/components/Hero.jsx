// The home page's hero: the headline and a line of copy on the left of a
// dark, softly lit stage, and a Damped sine drawing from the collection
// slowly moving on the right.
import { useEffect, useRef } from 'react';
import { SiteBar } from '@/components/SiteBar';
import { DESIGN, DESIGNS } from '@/designs/index.js';
import { drawingBounds, exportAnimatedSvg, exportSvg } from '@/core/render.js';

const DRAWING = { form: 'damped', seed: 3901, detail: 5, speed: 0.5 };
const STYLE = { line: '#d317b1', background: '#08090a', transparent: true, width: 1 };

// Built once. It is the design's own animated SVG export, which moves by
// itself (SMIL), at half speed; visitors who ask for less motion get the
// still drawing instead. Its faces are filled with the stage colour so lines
// behind them stay hidden, and the lines stay hairline-thin however large
// the drawing is scaled.
const still = typeof matchMedia !== 'undefined' && matchMedia('(prefers-reduced-motion: reduce)').matches;
const design = DESIGN[DRAWING.form];
// Its figure number in the collection, as on its card.
const fig = `0.${DESIGNS.indexOf(design) + 1}`;
// Cropped to the area the drawing covers over its loop, so its label sits
// close by.
const view = drawingBounds(design, DRAWING.seed, DRAWING.detail, true);

const drawing = (
  still
    ? exportSvg(design, DRAWING.seed, DRAWING.detail, STYLE)
    : exportAnimatedSvg(design, DRAWING.seed, DRAWING.detail, STYLE, { speed: DRAWING.speed }).svg
)
  .replace(/viewBox="[^"]*"/, `viewBox="${view.join(' ')}"`)
  .replace('<svg ', '<svg preserveAspectRatio="xMidYMid meet" ');

export function Hero() {
  // The drawing's animation pauses while it is off screen, so it costs nothing
  // while the visitor browses the cards.
  const art = useRef(null);
  useEffect(() => {
    const svg = art.current?.querySelector('svg');
    if (!svg?.pauseAnimations) return;
    const seen = new IntersectionObserver(([entry]) => (entry.isIntersecting ? svg.unpauseAnimations() : svg.pauseAnimations()));
    seen.observe(art.current);
    return () => seen.disconnect();
  }, []);

  return (
    <section
      aria-labelledby="hero-title"
      className="relative isolate left-1/2 -mt-6 w-screen -translate-x-1/2 overflow-hidden bg-[#08090a] text-white"
    >
      {/* The stage's lighting: a soft spotlight from above. */}
      <div
        aria-hidden="true"
        className="absolute inset-0 -z-10"
        style={{ background: 'radial-gradient(ellipse 70% 60% at 50% -5%, rgba(255,255,255,0.10), transparent 70%)' }}
      />

      {/* Text on the left, the drawing on the right; stacked on phones. */}
      <SiteBar className="relative mx-auto max-w-6xl px-4 pt-2" />

      <div className="relative mx-auto grid max-w-6xl items-center gap-x-12 gap-y-4 px-4 pt-4 pb-12 md:grid-cols-[minmax(0,1fr)_minmax(0,1fr)] md:pt-0 md:pb-16">
        <div>
          <h1
            id="hero-title"
            className="hero-rise text-[clamp(2.75rem,6vw,5rem)] leading-[0.95] font-semibold tracking-[-0.045em] [--d:80ms]"
          >
            Mathematics,{' '}
            <span className="block bg-gradient-to-b from-white/70 to-white/25 bg-clip-text text-transparent">drawn in line.</span>
          </h1>
          <p className="hero-rise mt-5 max-w-[42ch] text-base leading-relaxed text-pretty text-white/55 [--d:160ms] md:text-lg">
            Minimal surfaces, strange attractors, fractals and fields, each grown from a seed. Find one you love and take
            it home as a single SVG that moves on its own.
          </p>
        </div>

        {/* The drawing, labelled like its card in the collection. */}
        <figure className="hero-rise w-full max-w-[300px] justify-self-center [--d:240ms] md:justify-self-end">
          <div
            ref={art}
            aria-hidden="true"
            className="w-full [&_path]:[vector-effect:non-scaling-stroke] [&_svg]:size-full"
            style={{ aspectRatio: `${view[2]} / ${view[3]}` }}
            dangerouslySetInnerHTML={{ __html: drawing }}
          />
          <figcaption className="mt-4 flex justify-end gap-4 font-mono text-[11px] text-white/40">
            <span className="text-brand/80">Fig {fig}</span>
            <span>Seed {DRAWING.seed}</span>
          </figcaption>
        </figure>
      </div>

      {/* In the dark theme the stage fades into the page below. */}
      <div aria-hidden="true" className="pointer-events-none absolute inset-x-0 bottom-0 hidden h-24 bg-gradient-to-b from-transparent to-background dark:block" />
    </section>
  );
}
