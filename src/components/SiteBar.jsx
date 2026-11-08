// The slim bar at the top of every page: the site's wordmark, linking home,
// and room on the right for something of the page's own.
import { LayersIcon } from 'lucide-react';
import { Link } from '@/lib/router';
import { cn } from '@/lib/utils';

export function SiteBar({ children, className }) {
  return (
    <div className={cn('flex h-12 items-center justify-between gap-4', className)}>
      <Link
        href="./"
        className="-ml-1 inline-flex items-center gap-2 rounded-md px-1 py-1 text-sm font-semibold tracking-tight outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
      >
        <LayersIcon aria-hidden="true" className="size-4 text-brand" />
        Gen Cards
      </Link>
      {children}
    </div>
  );
}
