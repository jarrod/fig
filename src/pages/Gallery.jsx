// The home page: every design as a card, at fixed settings. A card animates
// while it is hovered or focused. Each design's own page has the full controls.
import { useEffect, useState } from 'react';
import { DicesIcon } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { GenCard } from '@/components/GenCard';
import { Hero } from '@/components/Hero';
import { DESIGNS } from '@/designs/index.js';
import { Link } from '@/lib/router';

// The gallery's fixed settings. Field designs fill the card edge to edge;
// the others ignore the frame.
const DETAIL = 5;
const FRAME = 'fill';

const randomSeed = () => 1 + Math.floor(Math.random() * 9998);

// Lives outside the component so the seeds survive visits to design pages.
let saved = Object.fromEntries(DESIGNS.map((d) => [d.id, randomSeed()]));

// Links carry the seed, and the frame for field designs, over to the design page.
const hrefFor = (design, seed) => `?d=${design.id}&seed=${seed}&detail=${DETAIL}${design.framed ? `&frame=${FRAME}` : ''}`;

// Any design at any seed, for the hero's "Surprise me".
const surprise = () => hrefFor(DESIGNS[Math.floor(Math.random() * DESIGNS.length)], randomSeed());
const STAGE_INDEX = DESIGNS.findIndex((d) => d.id === 'minimal');

export default function Gallery() {
  const [seeds, setSeeds] = useState(saved);
  const [surpriseHref, setSurpriseHref] = useState(surprise);
  const reshuffle = (id) =>
    setSeeds((prev) => {
      let seed = randomSeed();
      while (seed === prev[id]) seed = randomSeed();
      return (saved = { ...prev, [id]: seed });
    });

  useEffect(() => {
    document.title = 'Gen Cards';
  }, []);

  return (
    <>
      <Hero
        count={DESIGNS.length}
        stageHref={hrefFor(DESIGNS[STAGE_INDEX], 77)}
        stageFig={`0.${STAGE_INDEX + 1}`}
        surpriseHref={surpriseHref}
        // A fresh pick for next time, once this one has been followed.
        onSurprise={() => setTimeout(() => setSurpriseHref(surprise()), 0)}
      />

      <header id="collection" className="mt-10 mb-6 flex scroll-mt-6 flex-wrap items-end justify-between gap-x-8 gap-y-2">
        <div>
          <h2 className="font-heading text-2xl font-semibold tracking-tight">The collection</h2>
          <p className="mt-1 max-w-[62ch] text-muted-foreground">
            Hover a card to see it move, or open it to change its seed and style, then export it as an SVG for your
            own site.
          </p>
        </div>
        <p className="font-mono text-xs text-muted-foreground">{DESIGNS.length} designs</p>
      </header>

      <div className="grid grid-cols-[repeat(auto-fill,minmax(260px,1fr))] gap-3">
        {DESIGNS.map((design, i) => {
          const seed = seeds[design.id];
          // The button sits beside the link rather than inside it, since a
          // link can't contain another control.
          return (
            <div key={design.id} className="group relative [--gen-card-title-gap:30px]">
              <Link
                href={hrefFor(design, seed)}
                aria-label={`Open ${design.id}, seed ${seed}`}
                className="block h-full rounded-xl outline-none transition hover:brightness-125 focus-visible:ring-3 focus-visible:ring-ring/50"
              >
                <GenCard form={design.id} seed={seed} detail={DETAIL} fig={`0.${i + 1}`} frame={FRAME} animate="hover" />
              </Link>
              <Button
                variant="outline"
                size="icon-xs"
                aria-label={`New seed for ${design.id}`}
                title="New seed"
                onClick={() => reshuffle(design.id)}
                className="absolute right-3.5 bottom-3.5 z-10 border-[#26292b] bg-[#0e1011]/85 text-[#858a8f] opacity-0 transition-opacity group-focus-within:opacity-100 group-hover:opacity-100 hover:bg-[#1a1d1f] hover:text-[#d7dade] focus-visible:opacity-100 [@media(hover:none)]:opacity-100"
              >
                <DicesIcon />
              </Button>
            </div>
          );
        })}
      </div>
    </>
  );
}
