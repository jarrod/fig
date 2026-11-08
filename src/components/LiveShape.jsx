// One design drawn live to a bare canvas that fills its box, with no card
// around it: for decorative uses such as the home page's hero. It runs on
// the same worker pool as the gallery cards (core/card-pool.js), so it draws
// the same paths as the downloadable SVG, off the main thread, and only
// animates while it is on screen. `style` restyles the lines (see
// core/card-renderer.js). It fades in once its first drawing is ready.
import { useEffect, useRef, useState } from 'react';
import * as pool from '@/core/card-pool.js';
import { cn } from '@/lib/utils';

const reducedMotion = () => matchMedia('(prefers-reduced-motion: reduce)').matches;

export function LiveShape({ form, seed, detail = 5, speed = 1, style, label, className }) {
  const host = useRef(null);
  const [ready, setReady] = useState(false);
  // The style is sent once per drawing; a new object each render shouldn't rebuild it.
  const styleKey = JSON.stringify(style ?? {});

  useEffect(() => {
    // A canvas can only be handed to a worker once, so each run of this
    // effect makes its own.
    const canvas = document.createElement('canvas');
    canvas.className = 'block size-full';
    canvas.setAttribute('role', 'img');
    if (label) canvas.setAttribute('aria-label', label);
    else canvas.setAttribute('aria-hidden', 'true');
    host.current.append(canvas);

    const animate = !reducedMotion();
    const id = pool.connect(canvas, () => setReady(true));
    pool.build(id, { form, seed, detail, speed, animate, style: JSON.parse(styleKey) });

    const sized = new ResizeObserver(([entry]) => {
      const dpr = Math.min(2, window.devicePixelRatio || 1);
      const { width, height } = entry.contentRect;
      if (width && height) pool.resize(id, Math.round(width * dpr), Math.round(height * dpr));
    });
    sized.observe(host.current);
    const seen = new IntersectionObserver(([entry]) => pool.animate(id, animate && entry.isIntersecting));
    seen.observe(host.current);

    return () => {
      sized.disconnect();
      seen.disconnect();
      pool.disconnect(id);
      canvas.remove();
      setReady(false);
    };
  }, [form, seed, detail, speed, styleKey, label]);

  return (
    <div
      ref={host}
      className={cn('transition-opacity duration-1000 ease-out motion-reduce:transition-none', ready ? 'opacity-100' : 'opacity-0', className)}
    />
  );
}
