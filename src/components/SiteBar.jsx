// The slim bar at the top of every page: the site's wordmark, linking home,
// and room on the right for something of the page's own.
import { Link } from '@/lib/router';
import { cn } from '@/lib/utils';

// Three stacked lines, as in the drawings, in the accent colour.
function Mark() {
  return (
    <svg viewBox="0 0 16 16" aria-hidden="true" className="size-4 text-brand">
      <path d="M2 5l6 3 6-3M2 8l6 3 6-3M2 11l6 3 6-3" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
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
