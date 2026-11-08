// The slim bar at the top of every page: the site's wordmark, linking home,
// and room on the right for something of the page's own.
import { DESIGN } from '@/designs/index.js';
import { drawingBounds, exportSvg } from '@/core/render.js';
import { Link } from '@/lib/router';
import { cn } from '@/lib/utils';

// The logo: a tiny Power curve, the collection's first design, cropped to
// its plates and drawn in the accent colour with hairline lines. Its plates
// are filled with the page's background, so they hide the lines behind them.
const LOGO = { form: 'plates', seed: 1, detail: 1 };
const logoView = drawingBounds(DESIGN[LOGO.form], LOGO.seed, LOGO.detail);
const logo = exportSvg(DESIGN[LOGO.form], LOGO.seed, LOGO.detail, {
  line: 'currentColor',
  background: 'transparent',
  transparent: true,
  width: 1,
})
  .replace(/viewBox="[^"]*"/, `viewBox="${logoView.join(' ')}"`)
  .replace(/ width="320" height="270"/, '')
  .replace(/ role="img" aria-label="[^"]*"/, ' aria-hidden="true"');

function Mark() {
  return (
    <span
      className="block h-6 text-brand [&_g]:fill-background [&_path]:[vector-effect:non-scaling-stroke] [&_svg]:h-full [&_svg]:w-auto"
      style={{ aspectRatio: `${logoView[2]} / ${logoView[3]}` }}
      dangerouslySetInnerHTML={{ __html: logo }}
    />
  );
}

export function SiteBar({ children, className }) {
  return (
    <div className={cn('flex h-12 items-center justify-between gap-4', className)}>
      <Link
        href="./"
        className="-ml-1 inline-flex items-center gap-2 rounded-md px-1 py-1 text-sm font-semibold tracking-tight outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
      >
        <Mark />
        Gen Cards
      </Link>
      {children}
    </div>
  );
}
