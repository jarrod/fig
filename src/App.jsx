import { Toaster } from '@/components/ui/sonner';
import { TooltipProvider } from '@/components/ui/tooltip';
import { DESIGN } from '@/designs/index.js';
import { useSearch } from '@/lib/router';
import Designer from '@/pages/Designer';
import Gallery from '@/pages/Gallery';

export default function App() {
  const params = new URLSearchParams(useSearch());
  const design = DESIGN[params.get('d') ?? ''];
  return (
    <TooltipProvider>
      <main className="mx-auto max-w-6xl px-4 pt-6 pb-12">
        {/* Keyed by design, so moving to another design starts from its URL. */}
        {design ? <Designer key={design.id} design={design} params={params} /> : <Gallery />}
      </main>
      <Toaster position="bottom-center" />
    </TooltipProvider>
  );
}
