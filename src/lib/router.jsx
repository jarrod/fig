// A tiny router. The gallery is at /, and each design has its own shareable
// page at /?d=<id>&seed=…, so the built site works on any static host.
import { useSyncExternalStore } from 'react';

const listeners = new Set();
const notify = () => listeners.forEach((listener) => listener());

function subscribe(listener) {
  listeners.add(listener);
  window.addEventListener('popstate', listener);
  return () => {
    listeners.delete(listener);
    window.removeEventListener('popstate', listener);
  };
}

export const useSearch = () => useSyncExternalStore(subscribe, () => location.search);

export function navigate(url) {
  history.pushState(null, '', url);
  window.scrollTo(0, 0);
  notify();
}

// A normal link that changes page without a reload. Modified clicks still open new tabs.
export function Link({ href, onClick, ...props }) {
  const handleClick = (event) => {
    onClick?.(event);
    if (event.defaultPrevented || event.metaKey || event.ctrlKey || event.shiftKey || event.button !== 0) return;
    event.preventDefault();
    navigate(href);
  };
  return <a href={href} onClick={handleClick} {...props} />;
}
