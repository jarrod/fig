// The home page's hero: a live catenoid bending into a helicoid on a dark
// stage. It is a real design from the collection, drawn by the same workers
// as the cards, and drifts a little with the pointer unless the visitor
// prefers reduced motion.
import { useRef } from 'react';
import { ArrowDownIcon, ArrowRightIcon } from 'lucide-react';
import { LiveShape } from '@/components/LiveShape';
import { Link } from '@/lib/router';

// The centre piece: design, seed and line style. `clear` lets the stage's
// lighting show through the shape's faces.
const STAGE = {
  form: 'minimal',
  seed: 77,
  detail: 6,
  style: { line: '#ffffff', lineEnd: 'rgba(255,255,255,0.1)', width: 0.7, clear: true },
};
const reducedMotion = () => matchMedia('(prefers-reduced-motion: reduce)').matches;

export function Hero({ count, stageHref, stageFig, surpriseHref, onSurprise }) {
  const section = useRef(null);

  // The pointer's place over the hero, from -1 to 1 each way, as CSS
  // variables, so moving it never re-renders anything.
  const track = (event) => {
    if (event.pointerType !== 'mouse' || reducedMotion()) return;
    const box = section.current.getBoundingClientRect();
    section.current.style.setProperty('--mx', (((event.clientX - box.left) / box.width) * 2 - 1).toFixed(3));
    section.current.style.setProperty('--my', (((event.clientY - box.top) / box.height) * 2 - 1).toFixed(3));
  };
  const settle = () => {
    section.current.style.setProperty('--mx', '0');
    section.current.style.setProperty('--my', '0');
  };

  const browse = (event) => {
    event.preventDefault();
    document.getElementById('collection')?.scrollIntoView({ behavior: reducedMotion() ? 'auto' : 'smooth' });
  };

  return (
    <section
      ref={section}
      onPointerMove={track}
      onPointerLeave={settle}
      aria-labelledby="hero-title"
      className="relative isolate left-1/2 -mt-6 w-screen -translate-x-1/2 overflow-hidden bg-[#08090a] text-white"
    >
      {/* The stage's lighting: a soft spotlight from above, a dot grid that
          fades out from the centre, and a pool of light under the shape. */}
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
        <div
          className="absolute bottom-[14%] left-1/2 h-40 w-[min(90vw,760px)] -translate-x-1/2 rounded-[50%] blur-3xl"
          style={{ background: 'radial-gradient(closest-side, rgba(255,255,255,0.08), transparent)' }}
        />
      </div>

      <div className="relative mx-auto flex max-w-6xl flex-col items-center px-4 pt-16 text-center md:pt-20">
        <p className="hero-rise inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/[0.04] px-3 py-1 text-xs text-white/60 backdrop-blur">
          <span className="size-1.5 rounded-full bg-white/70" />
          {count} generative designs
        </p>

        <h1
          id="hero-title"
          className="hero-rise mt-6 text-[clamp(2.75rem,7vw,5.25rem)] leading-[0.95] font-semibold tracking-[-0.045em] [--d:80ms]"
        >
          Mathematics,{' '}
          <span className="block bg-gradient-to-b from-white/70 to-white/25 bg-clip-text text-transparent">drawn in line.</span>
        </h1>

        <p className="hero-rise mt-5 max-w-[46ch] text-base leading-relaxed text-pretty text-white/55 [--d:160ms] md:text-lg">
          Minimal surfaces, strange attractors, fractals and fields, each grown from a seed. Find one you love and take
          it home as a single SVG that moves on its own.
        </p>

        <div className="hero-rise mt-8 flex flex-wrap items-center justify-center gap-x-6 gap-y-3 [--d:240ms]">
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

        {/* The centre piece opens on its own page, at the same seed. */}
        <Link
          href={stageHref}
          aria-label={`Open the catenoid to helicoid design, seed ${STAGE.seed}`}
          className="hero-rise group mt-4 block w-[min(92vw,600px)] rounded-3xl [--d:320ms] focus-visible:ring-4 focus-visible:ring-white/20 focus-visible:outline-none md:-mt-4"
        >
          <div
            style={{
              transform: 'translate3d(calc(var(--mx, 0) * 10px), calc(var(--my, 0) * 6px), 0)',
              transition: 'transform 900ms cubic-bezier(0.2, 0.7, 0.2, 1)',
            }}
          >
            <LiveShape {...STAGE} label={`Catenoid to helicoid, seed ${STAGE.seed}, animated`} className="aspect-[320/270] w-full" />
          </div>
          <p className="-mt-6 font-mono text-[11px] tracking-wide text-white/35 transition-colors group-hover:text-white/60">
            Fig {stageFig} · Catenoid to helicoid · seed {STAGE.seed}
          </p>
        </Link>

        {/* A spec strip, in the manner of a product page. */}
        <ul className="hero-rise mt-14 mb-16 grid w-full max-w-3xl grid-cols-3 divide-x divide-white/10 border-t border-white/10 pt-6 [--d:400ms] md:mb-20">
          {[
            [count, 'designs, one algorithm each'],
            ['1 file', 'per export, with no scripts'],
            ['∞', 'seeds, each a new drawing'],
          ].map(([value, text]) => (
            <li key={text} className="px-3">
              <p className="text-2xl font-semibold tracking-tight md:text-3xl">{value}</p>
              <p className="mt-1 text-xs leading-snug text-white/45 md:text-sm">{text}</p>
            </li>
          ))}
        </ul>
      </div>

      {/* In the dark theme the stage fades into the page below. */}
      <div aria-hidden="true" className="pointer-events-none absolute inset-x-0 bottom-0 hidden h-24 bg-gradient-to-b from-transparent to-background dark:block" />
    </section>
  );
}
