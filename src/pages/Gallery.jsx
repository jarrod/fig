// The home page: every design as a card, at fixed settings, with one switch
// for animation. Each design's own page has the full controls.
import { useEffect, useState } from 'react';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { GenCard } from '@/components/GenCard';
import { DESIGNS } from '@/designs/index.js';
import { Link } from '@/lib/router';

// The gallery's fixed settings.
const DETAIL = 5;

const newSeeds = () => Object.fromEntries(DESIGNS.map((d) => [d.id, 1 + Math.floor(Math.random() * 9998)]));

// Lives outside the component so it survives visits to design pages.
let saved = { animate: false, seeds: newSeeds() };

// Links carry the seed and animation over to the design page.
const hrefFor = (design, seed, animate) => `?d=${design.id}&seed=${seed}&detail=${DETAIL}${animate ? '&animate=1' : ''}`;

export default function Gallery() {
  const [animate, setAnimate] = useState(saved.animate);

  useEffect(() => {
    saved = { ...saved, animate };
  }, [animate]);
  useEffect(() => {
    document.title = 'Gen Cards';
  }, []);

  return (
    <>
      <header className="mb-6 flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="font-heading text-2xl font-semibold tracking-tight">Gen Cards</h1>
          <p className="mt-1 max-w-[62ch] text-muted-foreground">
            Generative line drawings, each made by one algorithm. Open a design to change its seed and style, then
            export it as an SVG for your own site.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Switch id="animate" checked={animate} onCheckedChange={setAnimate} />
          <Label htmlFor="animate">Animate</Label>
        </div>
      </header>

      <div className="grid grid-cols-[repeat(auto-fill,minmax(260px,1fr))] gap-3">
        {DESIGNS.map((design, i) => {
          const seed = saved.seeds[design.id];
          return (
            <Link
              key={design.id}
              href={hrefFor(design, seed, animate)}
              aria-label={`Open ${design.id}, seed ${seed}`}
              className="block rounded-xl outline-none transition hover:brightness-125 focus-visible:ring-3 focus-visible:ring-ring/50"
            >
              <GenCard form={design.id} seed={seed} detail={DETAIL} fig={`0.${i + 1}`} animate={animate} />
            </Link>
          );
        })}
      </div>
    </>
  );
}
