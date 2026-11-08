// The home page's hero: the headline and a line of copy on a dark, softly
// lit stage, with a Damped sine drawing from the collection scaled up behind
// them, barely visible.
import { DESIGN } from '@/designs/index.js';
import { exportSvg } from '@/core/render.js';

const BACKDROP = { form: 'damped', seed: 3901, detail: 5 };

// Drawn once, as a still SVG. Its faces are filled with the stage colour so
// lines behind them stay hidden; the lines are kept hairline-thin however
// large the drawing is scaled.
const backdrop = exportSvg(DESIGN[BACKDROP.form], BACKDROP.seed, BACKDROP.detail, {
  line: '#9ca1a6',
  background: '#08090a',
  transparent: true,
  width: 1,
}).replace('<svg ', '<svg preserveAspectRatio="xMidYMid meet" ');

export function Hero() {
  return (
    <section
      aria-labelledby="hero-title"
      className="relative isolate left-1/2 -mt-6 w-screen -translate-x-1/2 overflow-hidden bg-[#08090a] text-white"
    >
      {/* The stage: a soft spotlight from above, and the drawing. */}
      <div aria-hidden="true" className="absolute inset-0 -z-10">
        <div
          className="absolute inset-0"
          style={{ background: 'radial-gradient(ellipse 70% 60% at 50% -5%, rgba(255,255,255,0.10), transparent 70%)' }}
        />
        {/* The drawing, much larger than the hero, fading out toward its
            edges. */}
        <div
          className="absolute top-1/2 left-1/2 aspect-[320/270] w-[max(760px,82vw)] -translate-x-1/2 -translate-y-[48%] opacity-[0.2] [&_path]:[vector-effect:non-scaling-stroke] [&_svg]:size-full"
          style={{
            maskImage: 'radial-gradient(ellipse 45% 42% at 50% 50%, black 30%, transparent 100%)',
            WebkitMaskImage: 'radial-gradient(ellipse 45% 42% at 50% 50%, black 30%, transparent 100%)',
          }}
          dangerouslySetInnerHTML={{ __html: backdrop }}
        />
      </div>

      <div className="relative mx-auto flex max-w-6xl flex-col items-center px-4 pt-20 text-center md:pt-28">
        <h1
          id="hero-title"
          className="hero-rise text-[clamp(2.75rem,7vw,5.25rem)] leading-[0.95] font-semibold tracking-[-0.045em] [--d:80ms]"
        >
          Mathematics,{' '}
          <span className="block bg-gradient-to-b from-white/70 to-white/25 bg-clip-text text-transparent">drawn in line.</span>
        </h1>

        <p className="hero-rise mt-5 mb-24 max-w-[46ch] text-base leading-relaxed text-pretty text-white/55 [--d:160ms] md:text-lg">
          Minimal surfaces, strange attractors, fractals and fields, each grown from a seed. Find one you love and take
          it home as a single SVG that moves on its own.
        </p>

      </div>

      {/* In the dark theme the stage fades into the page below. */}
      <div aria-hidden="true" className="pointer-events-none absolute inset-x-0 bottom-0 hidden h-24 bg-gradient-to-b from-transparent to-background dark:block" />
    </section>
  );
}
