// The home page: every design as a live card. Settings are kept while you move
// between the gallery and design pages.
import { useEffect, useState } from 'react';
import { ShuffleIcon } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Slider } from '@/components/ui/slider';
import { Switch } from '@/components/ui/switch';
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group';
import { FramePicker } from '@/components/FramePicker';
import { GenCard } from '@/components/GenCard';
import { DEFAULT_FRAME } from '@/core/frame.js';
import { DESIGNS } from '@/designs/index.js';
import { Link } from '@/lib/router';

const newSeeds = () => Object.fromEntries(DESIGNS.map((d) => [d.id, 1 + Math.floor(Math.random() * 9998)]));

// Lives outside the component so it survives visits to design pages.
let saved = { kind: 'all', detail: 5, animate: false, speed: 1, frame: DEFAULT_FRAME, seeds: newSeeds() };

// Links carry the gallery's settings over to the design page.
const hrefFor = (design, seed, s) =>
  `?d=${design.id}&seed=${seed}&detail=${s.detail}${s.animate ? '&animate=1' : ''}${s.speed !== 1 ? `&speed=${s.speed}` : ''}${
    design.framed && s.frame !== DEFAULT_FRAME ? `&frame=${s.frame}` : ''
  }`;

export default function Gallery() {
  const [s, setS] = useState(saved);
  const set = (patch) => setS((prev) => ({ ...prev, ...patch }));

  useEffect(() => {
    saved = s;
  }, [s]);
  useEffect(() => {
    document.title = 'Gen Cards';
  }, []);

  return (
    <>
      <header className="mb-6">
        <h1 className="font-heading text-2xl font-semibold tracking-tight">Gen Cards</h1>
        <p className="mt-1 max-w-[62ch] text-muted-foreground">
          Generative line drawings, each made by one algorithm. Open a design to change its seed and style, then export
          it as an SVG for your own site.
        </p>
      </header>

      <div className="mb-4 flex flex-wrap items-center gap-x-6 gap-y-3">
        <ToggleGroup
          variant="outline"
          spacing={0}
          value={[s.kind]}
          onValueChange={(value) => value[0] && set({ kind: value[0] })}
          aria-label="Show"
        >
          <ToggleGroupItem value="all">All</ToggleGroupItem>
          <ToggleGroupItem value="solid">Solids</ToggleGroupItem>
          <ToggleGroupItem value="line">Lines</ToggleGroupItem>
        </ToggleGroup>

        <div className="flex items-center gap-3">
          <Label id="detail-label">Detail</Label>
          <div className="w-32">
            <Slider
              aria-labelledby="detail-label"
              min={1}
              max={10}
              step={1}
              value={[s.detail]}
              onValueChange={([detail]) => set({ detail })}
            />
          </div>
          <span className="w-5 text-sm tabular-nums">{s.detail}</span>
        </div>

        <div className="flex items-center gap-2">
          <Switch id="animate" checked={s.animate} onCheckedChange={(animate) => set({ animate })} />
          <Label htmlFor="animate">Animate</Label>
        </div>

        <div className="flex items-center gap-3">
          <Label id="speed-label">Speed</Label>
          <div className="w-28">
            <Slider
              aria-labelledby="speed-label"
              min={0.25}
              max={2}
              step={0.25}
              value={[s.speed]}
              onValueChange={([speed]) => set({ speed })}
            />
          </div>
          <span className="w-10 text-sm tabular-nums">{s.speed}×</span>
        </div>

        <div className="flex items-center gap-3">
          <Label id="frame-label">Frame</Label>
          <FramePicker aria-labelledby="frame-label" value={s.frame} onChange={(frame) => set({ frame })} />
        </div>

        <Button variant="outline" onClick={() => set({ seeds: newSeeds() })}>
          <ShuffleIcon data-icon="inline-start" />
          Shuffle
        </Button>
      </div>

      <div className="grid grid-cols-[repeat(auto-fill,minmax(260px,1fr))] gap-3">
        {DESIGNS.map((design, i) => {
          if (s.kind !== 'all' && design.kind !== s.kind) return null;
          const seed = s.seeds[design.id];
          return (
            <Link
              key={design.id}
              href={hrefFor(design, seed, s)}
              aria-label={`Open ${design.id}, seed ${seed}`}
              className="block rounded-xl outline-none transition hover:brightness-125 focus-visible:ring-3 focus-visible:ring-ring/50"
            >
              <GenCard form={design.id} seed={seed} detail={s.detail} fig={`0.${i + 1}`} speed={s.speed} animate={s.animate} frame={s.frame} />
            </Link>
          );
        })}
      </div>
    </>
  );
}
