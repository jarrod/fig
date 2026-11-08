// React wrapper for the <gen-card> element. It sets attributes itself because
// React passes a prop as a property when the element already has one of that
// name, and every element has an animate() method (Web Animations API), so
// `animate` would replace that method instead of setting the attribute.
//
// Until the card's drawing is ready (it is built in a worker as it nears the
// viewport), a skeleton in the card's own shape sits over it.
import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { Skeleton } from '@/components/ui/skeleton';

// Matches the card's own layout and colours in gen-card.js.
function CardSkeleton() {
  const bar = 'rounded-sm bg-white/[0.06]';
  return (
    <div
      aria-hidden="true"
      className="pointer-events-none absolute inset-0 flex flex-col rounded-xl border border-[#26292b] bg-[#0e1011] px-4 pt-3.5 pb-4"
    >
      <div className="flex h-[15px] items-center justify-between">
        <Skeleton className={`h-2.5 w-12 ${bar}`} />
        <Skeleton className={`h-2.5 w-8 ${bar}`} />
      </div>
      <Skeleton className={`mt-0.5 mb-1.5 aspect-[320/270] w-full ${bar}`} />
      <Skeleton className={`mt-1 mb-2 h-3.5 w-2/5 ${bar}`} />
      <div className="flex flex-col gap-[7px] pt-1">
        <Skeleton className={`h-3 w-full ${bar}`} />
        <Skeleton className={`h-3 w-11/12 ${bar}`} />
        <Skeleton className={`h-3 w-full ${bar}`} />
        <Skeleton className={`h-3 w-3/5 ${bar}`} />
      </div>
    </div>
  );
}

export function GenCard({ form, seed, detail, fig, speed, animate, frame }) {
  const ref = useRef(null);
  const [ready, setReady] = useState(false);

  useLayoutEffect(() => {
    const card = ref.current;
    const attributes = { form, seed, detail, fig, speed, frame };
    for (const [name, value] of Object.entries(attributes)) {
      if (value === undefined) card.removeAttribute(name);
      else if (card.getAttribute(name) !== String(value)) card.setAttribute(name, value);
    }
    // `animate` is true for always, or a string such as 'hover'.
    if (typeof animate === 'string') card.setAttribute('animate', animate);
    else card.toggleAttribute('animate', Boolean(animate));
  }, [form, seed, detail, fig, speed, animate, frame]);

  useEffect(() => {
    const card = ref.current;
    if (card.hasAttribute('ready')) return setReady(true);
    const done = () => setReady(true);
    card.addEventListener('gen-card-ready', done);
    return () => card.removeEventListener('gen-card-ready', done);
  }, []);

  return (
    <div className="relative h-full">
      <gen-card ref={ref} />
      {!ready && <CardSkeleton />}
    </div>
  );
}
