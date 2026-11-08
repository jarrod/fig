// One design's page: a large live preview, seed and style controls, and export.
// Every setting is kept in the URL, so a page can be shared as it looks.
import { useEffect, useMemo, useRef, useState } from 'react';
import { ArrowLeftIcon, ArrowRightIcon, ChevronDownIcon, CopyIcon, DicesIcon, DownloadIcon, FilmIcon, LoaderIcon } from 'lucide-react';
import { toast } from 'sonner';
import { Button, buttonVariants } from '@/components/ui/button';
import { ButtonGroup } from '@/components/ui/button-group';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Separator } from '@/components/ui/separator';
import { Slider } from '@/components/ui/slider';
import { Switch } from '@/components/ui/switch';
import { FramePicker } from '@/components/FramePicker';
import { SiteBar } from '@/components/SiteBar';
import { DEFAULT_FRAME, isFrame } from '@/core/frame.js';
import { cn } from '@/lib/utils';
import { DESIGNS } from '@/designs/index.js';
import { Link } from '@/lib/router';
import {
  DEFAULT_STYLE,
  TAU,
  build,
  describeDesign,
  exportAnimatedSvg,
  exportSvg,
  fitDesign,
  loopMs,
  updatePaths,
} from '@/core/render.js';

const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)');
const isColour = (v) => /^#[0-9a-f]{6}$/i.test(v ?? '');
const clamp = (v, lo, hi, fallback) => (Number.isFinite(v) ? Math.min(hi, Math.max(lo, v)) : fallback);
const randomSeed = () => 1 + Math.floor(Math.random() * 9998);

function readSettings(params) {
  // A missing parameter must fall back to its default, not read as 0.
  const num = (key) => (params.has(key) && params.get(key) !== '' ? Number(params.get(key)) : NaN);
  return {
    seed: Math.round(clamp(num('seed'), 1, 99999, randomSeed())),
    detail: Math.round(clamp(num('detail'), 1, 10, 5)),
    animate: params.get('animate') === '1',
    frame: isFrame(params.get('frame')) ? params.get('frame') : DEFAULT_FRAME,
    speed: clamp(num('speed'), 0.25, 2, 1),
    style: {
      line: isColour(params.get('line')) ? params.get('line') : DEFAULT_STYLE.line,
      background: isColour(params.get('bg')) ? params.get('bg') : DEFAULT_STYLE.background,
      transparent: params.get('t') === '1',
      width: clamp(num('w'), 0.25, 3, DEFAULT_STYLE.width),
    },
  };
}

function writeUrl(design, s) {
  const params = new URLSearchParams({ d: design.id, seed: s.seed, detail: s.detail });
  if (s.animate) params.set('animate', '1');
  if (s.speed !== 1) params.set('speed', s.speed);
  if (design.framed && s.frame !== DEFAULT_FRAME) params.set('frame', s.frame);
  if (s.style.line !== DEFAULT_STYLE.line) params.set('line', s.style.line);
  if (s.style.background !== DEFAULT_STYLE.background) params.set('bg', s.style.background);
  if (s.style.transparent) params.set('t', '1');
  if (s.style.width !== DEFAULT_STYLE.width) params.set('w', s.style.width);
  history.replaceState(null, '', `?${params}`);
}

function download(text, filename) {
  const url = URL.createObjectURL(new Blob([text], { type: 'image/svg+xml' }));
  const link = Object.assign(document.createElement('a'), { href: url, download: filename });
  link.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

const size = (text) => {
  const bytes = new Blob([text]).size;
  return bytes > 1024 * 1024 ? `${(bytes / 1024 / 1024).toFixed(1)} MB` : `${Math.ceil(bytes / 1024)} KB`;
};

const seconds = (ms) => `${+(ms / 1000).toFixed(1)} s`;

function Row({ label, htmlFor, id, children }) {
  return (
    <div className="flex min-h-8 items-center justify-between gap-3">
      <Label htmlFor={htmlFor} id={id} className="font-normal text-muted-foreground">
        {label}
      </Label>
      {children}
    </div>
  );
}

function SliderRow({ label, value, min, max, step, format = (v) => v, onChange }) {
  const id = `${label.toLowerCase().replace(/\s+/g, '-')}-label`;
  return (
    <Row label={label} id={id}>
      <div className="flex w-44 items-center gap-3">
        <div className="min-w-0 flex-1">
          <Slider aria-labelledby={id} min={min} max={max} step={step} value={[value]} onValueChange={([v]) => onChange(v)} />
        </div>
        <span className="w-10 shrink-0 text-right text-sm tabular-nums">{format(value)}</span>
      </div>
    </Row>
  );
}

function ColourRow({ label, id, value, onChange }) {
  return (
    <Row label={label} htmlFor={id}>
      <input
        id={id}
        type="color"
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="h-8 w-11 cursor-pointer rounded-md border border-input bg-transparent p-1"
      />
    </Row>
  );
}

function Section({ title, children }) {
  return (
    <section className="grid gap-2">
      <h2 className="text-xs font-medium tracking-wide text-muted-foreground uppercase">{title}</h2>
      {children}
    </section>
  );
}

export default function Designer({ design, params }) {
  const [s, setS] = useState(() => readSettings(params));
  const [building, setBuilding] = useState(false);
  const preview = useRef(null);
  // On wide screens the drawing's panel is as tall as the control panel
  // beside it; the drawing is centred in it at its own proportions.
  const panel = useRef(null);
  const [panelHeight, setPanelHeight] = useState(0);
  useEffect(() => {
    const wide = matchMedia('(min-width: 1024px)');
    const measure = () => setPanelHeight(wide.matches ? panel.current.offsetHeight : 0);
    const sized = new ResizeObserver(measure);
    sized.observe(panel.current);
    wide.addEventListener('change', measure);
    return () => {
      sized.disconnect();
      wide.removeEventListener('change', measure);
    };
  }, []);
  const set = (patch) => setS((prev) => ({ ...prev, ...patch }));
  const setStyle = (patch) => setS((prev) => ({ ...prev, style: { ...prev.style, ...patch } }));

  const index = DESIGNS.indexOf(design);
  const prev = DESIGNS[(index - 1 + DESIGNS.length) % DESIGNS.length];
  const next = DESIGNS[(index + 1) % DESIGNS.length];

  const { name, description, faceCount } = useMemo(() => {
    const { faces, facts } = build(design, s.seed, s.detail, 0, s.frame);
    return { name: design.name(facts), description: describeDesign(design, facts, faces.length), faceCount: faces.length };
  }, [design, s.seed, s.detail, s.frame]);
  const svg = useMemo(
    () => exportSvg(design, s.seed, s.detail, s.style, s.frame),
    [design, s.seed, s.detail, s.style, s.frame],
  );
  const loopLength = loopMs(design, s.speed);

  useEffect(() => writeUrl(design, s), [design, s]);
  useEffect(() => {
    document.title = `${name} · Gen Cards`;
  }, [name]);

  // Animate the preview by moving the existing paths each frame.
  useEffect(() => {
    const group = preview.current?.querySelector('svg > g');
    if (!s.animate || reducedMotion.matches || !group || !faceCount) return;
    const box = fitDesign(design, s.seed, s.detail, true, s.frame);
    const lineWidth = (s.style.width * 0.72).toFixed(2);
    let frame = 0;
    const tick = (now) => {
      updatePaths(group, build(design, s.seed, s.detail, ((now % loopLength) / loopLength) * TAU, s.frame).faces, box);
      for (const path of group.querySelectorAll('path.line')) path.setAttribute('stroke-width', lineWidth);
      frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [design, s.seed, s.detail, s.frame, s.animate, s.style.width, svg, faceCount, loopLength]);

  const frameTag = design.framed && s.frame !== DEFAULT_FRAME ? `-${s.frame}` : '';
  const filename = (suffix = '') => `${design.id}-${s.seed}${frameTag}${suffix}.svg`;

  const downloadStill = () => {
    download(svg, filename());
    toast.success(`Downloaded ${filename()}`, { description: size(svg) });
  };

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(svg);
      toast.success('Copied SVG code', { description: size(svg) });
    } catch {
      toast.error('Copying was blocked by the browser', { description: 'Use Download SVG instead.' });
    }
  };

  const downloadAnimated = () => {
    setBuilding(true);
    // Let the button repaint before the (sometimes slow) build.
    setTimeout(() => {
      const { svg: animated, mode } = exportAnimatedSvg(design, s.seed, s.detail, s.style, { speed: s.speed, frame: s.frame });
      download(animated, filename('-animated'));
      toast.success(`Downloaded ${filename('-animated')}`, {
        description: `${size(animated)}, loops every ${seconds(loopLength)}. ${
          mode === 'morph' ? 'Shapes morph smoothly.' : 'Frames swap in steps, because parts appear and disappear.'
        }`,
      });
      setBuilding(false);
    }, 30);
  };

  return (
    <>
      {/* The stage's soft spotlight, as on the home page, in the dark theme. */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-x-0 top-0 -z-10 hidden h-[480px] dark:block"
        style={{ background: 'radial-gradient(ellipse 70% 60% at 50% -10%, rgba(255,255,255,0.08), transparent 70%)' }}
      />

      <SiteBar className="-mt-4 mb-6" />

      {/* The design's own header: its label, name and description, with a
          pager through the collection. Links styled as buttons stay real
          links: shadcn's Base UI Button would give them role="button". */}
      <header className="mb-6 flex flex-wrap items-end justify-between gap-x-8 gap-y-4">
        <div className="min-w-0">
          <p className="font-mono text-xs text-muted-foreground">
            <span className="text-brand">Fig 0.{index + 1}</span> · Seed {s.seed}
          </p>
          <h1 className="mt-2 font-heading text-4xl leading-tight font-semibold tracking-[-0.03em] md:text-5xl">{name}</h1>
          <p className="mt-2 max-w-[65ch] text-pretty text-muted-foreground">{description}</p>
        </div>
        <nav className="flex shrink-0 items-center gap-1" aria-label="Other designs">
          <Link
            href={`?d=${prev.id}`}
            aria-label={`Previous design: ${prev.id}`}
            title={prev.id}
            className={buttonVariants({ variant: 'outline', size: 'icon-sm' })}
          >
            <ArrowLeftIcon />
          </Link>
          <span className="min-w-16 text-center font-mono text-xs text-muted-foreground tabular-nums">
            {index + 1} / {DESIGNS.length}
          </span>
          <Link
            href={`?d=${next.id}`}
            aria-label={`Next design: ${next.id}`}
            title={next.id}
            className={buttonVariants({ variant: 'outline', size: 'icon-sm' })}
          >
            <ArrowRightIcon />
          </Link>
        </nav>
      </header>

      <div className="grid items-start gap-6 lg:grid-cols-[minmax(0,1fr)_320px]">
        <div>
          <div
            ref={preview}
            className={cn(
              'overflow-hidden rounded-xl border [&_svg]:block [&_svg]:w-full [&_path.line]:fill-none',
              panelHeight ? '[&_svg]:h-full' : '[&_svg]:h-auto',
              s.style.transparent &&
                'bg-white bg-[length:16px_16px] bg-[position:0_0,8px_8px] [background-image:linear-gradient(45deg,#e4e4e0_25%,transparent_25%,transparent_75%,#e4e4e0_75%),linear-gradient(45deg,#e4e4e0_25%,transparent_25%,transparent_75%,#e4e4e0_75%)]',
            )}
            // The panel's own colour matches the drawing's, so the space
            // either side of a drawing narrower than the panel blends in.
            style={panelHeight ? { height: panelHeight, ...(s.style.transparent ? {} : { backgroundColor: s.style.background }) } : undefined}
            dangerouslySetInnerHTML={{ __html: svg }}
          />
        </div>

        <Card ref={panel}>
          <CardContent className="grid gap-5">
            <Section title="Drawing">
              <Row label="Seed" htmlFor="seed">
                <div className="flex gap-2">
                  <Input
                    id="seed"
                    type="number"
                    min={1}
                    max={99999}
                    className="w-24"
                    key={s.seed}
                    defaultValue={s.seed}
                    onBlur={(event) => set({ seed: Math.round(clamp(Number(event.target.value), 1, 99999, s.seed)) })}
                    onKeyDown={(event) => event.key === 'Enter' && event.currentTarget.blur()}
                  />
                  <Button variant="outline" size="icon" aria-label="Random seed" onClick={() => set({ seed: randomSeed() })}>
                    <DicesIcon />
                  </Button>
                </div>
              </Row>
              <Row label="Frame" id="frame-label">
                <FramePicker
                  aria-labelledby="frame-label"
                  value={design.framed ? s.frame : DEFAULT_FRAME}
                  onChange={(frame) => set({ frame })}
                  disabled={!design.framed}
                />
              </Row>
              {!design.framed && (
                <p className="text-xs text-muted-foreground">
                  This design draws one free shape, so it keeps its own outline. Frames apply to designs that sample a
                  patch of ground.
                </p>
              )}
              <SliderRow label="Detail" value={s.detail} min={1} max={10} step={1} onChange={(detail) => set({ detail })} />
              <Row label="Animate" htmlFor="animate">
                <Switch id="animate" checked={s.animate} onCheckedChange={(animate) => set({ animate })} />
              </Row>
              <SliderRow
                label="Speed"
                value={s.speed}
                min={0.25}
                max={2}
                step={0.25}
                format={(v) => `${v}×`}
                onChange={(speed) => set({ speed })}
              />
              <p className="text-xs text-muted-foreground">
                One loop takes {seconds(loopLength)}, in the preview and in animated exports.
              </p>
            </Section>

            <Separator />

            <Section title="Style">
              <ColourRow label="Line colour" id="line" value={s.style.line} onChange={(line) => setStyle({ line })} />
              <ColourRow
                label="Background"
                id="background"
                value={s.style.background}
                onChange={(background) => setStyle({ background })}
              />
              <Row label="Transparent background" htmlFor="transparent">
                <Switch
                  id="transparent"
                  checked={s.style.transparent}
                  onCheckedChange={(transparent) => setStyle({ transparent })}
                />
              </Row>
              {s.style.transparent && design.kind === 'solid' && (
                <p className="text-xs text-muted-foreground">
                  Solid shapes stay filled with the background colour, because the fill is what hides the lines behind
                  them.
                </p>
              )}
              <SliderRow
                label="Line width"
                value={s.style.width}
                min={0.25}
                max={3}
                step={0.05}
                format={(v) => v.toFixed(2)}
                onChange={(width) => setStyle({ width })}
              />
              <Button variant="outline" onClick={() => set({ style: { ...DEFAULT_STYLE } })}>
                Reset style
              </Button>
            </Section>

            <Separator />

            <Section title="Export">
              {/* The usual export is one click; the others are in the menu. */}
              <ButtonGroup className="w-full">
                <Button onClick={downloadStill} className="flex-1">
                  <DownloadIcon data-icon="inline-start" />
                  Download SVG
                </Button>
                <DropdownMenu>
                  <DropdownMenuTrigger
                    render={<Button size="icon" aria-label="More export options" className="border-l border-l-primary-foreground/15" />}
                  >
                    {building ? <LoaderIcon className="animate-spin" /> : <ChevronDownIcon />}
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end" className="w-60">
                    <DropdownMenuItem onClick={downloadAnimated} disabled={building}>
                      <FilmIcon />
                      {building ? 'Building animated SVG…' : 'Download animated SVG'}
                    </DropdownMenuItem>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem onClick={copy}>
                      <CopyIcon />
                      Copy SVG code
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </ButtonGroup>
            </Section>
          </CardContent>
        </Card>
      </div>
    </>
  );
}
