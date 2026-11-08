// The home page: every design as a card, at fixed settings. A card animates
// while it is hovered or focused. Each design's own page has the full controls.
import { useEffect } from 'react';
import { GenCard } from '@/components/GenCard';
import { DESIGNS } from '@/designs/index.js';
import { Link } from '@/lib/router';

// The gallery's fixed settings.
const DETAIL = 5;

const newSeeds = () => Object.fromEntries(DESIGNS.map((d) => [d.id, 1 + Math.floor(Math.random() * 9998)]));

// Lives outside the component so the seeds survive visits to design pages.
const seeds = newSeeds();

// Links carry the seed over to the design page.
const hrefFor = (design, seed) => `?d=${design.id}&seed=${seed}&detail=${DETAIL}`;

export default function Gallery() {
  useEffect(() => {
    document.title = 'Gen Cards';
  }, []);

  return (
    <>
      <header className="mb-6">
        <h1 className="font-heading text-2xl font-semibold tracking-tight">Gen Cards</h1>
        <p className="mt-1 max-w-[62ch] text-muted-foreground">
          Generative line drawings, each made by one algorithm. Hover a card to see it move, or open it to change its
          seed and style, then export it as an SVG for your own site.
        </p>
      </header>

      <div className="grid grid-cols-[repeat(auto-fill,minmax(260px,1fr))] gap-3">
        {DESIGNS.map((design, i) => {
          const seed = seeds[design.id];
          return (
            <Link
              key={design.id}
              href={hrefFor(design, seed)}
              aria-label={`Open ${design.id}, seed ${seed}`}
              className="block rounded-xl outline-none transition hover:brightness-125 focus-visible:ring-3 focus-visible:ring-ring/50"
            >
              <GenCard form={design.id} seed={seed} detail={DETAIL} fig={`0.${i + 1}`} animate="hover" />
            </Link>
          );
        })}
      </div>
    </>
  );
}
