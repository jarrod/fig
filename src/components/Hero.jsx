// The home page's hero: the headline, a line of copy and two calls to
// action on a dark, softly lit stage.
import { ArrowDownIcon, ArrowRightIcon } from 'lucide-react';
import { Link } from '@/lib/router';

const reducedMotion = () => matchMedia('(prefers-reduced-motion: reduce)').matches;

export function Hero({ surpriseHref, onSurprise }) {
  const browse = (event) => {
    event.preventDefault();
    document.getElementById('collection')?.scrollIntoView({ behavior: reducedMotion() ? 'auto' : 'smooth' });
  };

  return (
    <section
      aria-labelledby="hero-title"
      className="relative isolate left-1/2 -mt-6 w-screen -translate-x-1/2 overflow-hidden bg-[#08090a] text-white"
    >
      {/* The stage's lighting: a soft spotlight from above and a dot grid
          that fades out from the centre. */}
      <div aria-hidden="true" className="absolute inset-0 -z-10">
        <div
          className="absolute inset-0"
          style={{ background: 'radial-gradient(ellipse 70% 60% at 50% -5%, rgba(255,255,255,0.10), transparent 70%)' }}
        />
        <div
          className="absolute inset-0 opacity-70"
          style={{
            backgroundImage: 'radial-gradient(rgba(255,255,255,0.09) 1px, transparent 1px)',
            backgroundSize: '24px 24px',
            maskImage: 'radial-gradient(ellipse 55% 50% at 50% 55%, black, transparent 75%)',
            WebkitMaskImage: 'radial-gradient(ellipse 55% 50% at 50% 55%, black, transparent 75%)',
          }}
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

        <p className="hero-rise mt-5 max-w-[46ch] text-base leading-relaxed text-pretty text-white/55 [--d:160ms] md:text-lg">
          Minimal surfaces, strange attractors, fractals and fields, each grown from a seed. Find one you love and take
          it home as a single SVG that moves on its own.
        </p>

        <div className="hero-rise mt-8 mb-24 flex flex-wrap items-center justify-center gap-x-6 gap-y-3 [--d:240ms]">
          <a
            href="#collection"
            onClick={browse}
            className="inline-flex h-11 items-center gap-2 rounded-full bg-white px-6 text-sm font-medium text-black transition hover:bg-white/85 focus-visible:ring-4 focus-visible:ring-white/30 focus-visible:outline-none"
          >
            Browse the collection
            <ArrowDownIcon className="size-4" />
          </a>
          <Link
            href={surpriseHref}
            onClick={onSurprise}
            className="group inline-flex h-11 items-center gap-1.5 rounded-full px-2 text-sm font-medium text-white/75 transition hover:text-white focus-visible:ring-4 focus-visible:ring-white/30 focus-visible:outline-none"
          >
            Surprise me
            <ArrowRightIcon className="size-4 transition-transform group-hover:translate-x-0.5" />
          </Link>
        </div>

      </div>

      {/* In the dark theme the stage fades into the page below. */}
      <div aria-hidden="true" className="pointer-events-none absolute inset-x-0 bottom-0 hidden h-24 bg-gradient-to-b from-transparent to-background dark:block" />
    </section>
  );
}
