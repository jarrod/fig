// A small client-side router. The gallery is at /, and each design has its own
// shareable page at /?d=<id>&seed=…, so the site works on any static host.
import './gen-card.js';
import { DESIGN } from './designs/index.js';
import { showGallery } from './gallery.js';
import { showDesigner } from './designer.js';

const app = document.getElementById('app');
let leave = () => {};

function route() {
  leave();
  const params = new URLSearchParams(location.search);
  const design = DESIGN[params.get('d') ?? ''];
  leave = design ? showDesigner(app, design, params) : showGallery(app);
  window.scrollTo(0, 0);
}

export function navigate(url) {
  history.pushState(null, '', url);
  route();
}

// Follow in-site links without a full reload; let modified clicks open new tabs.
document.addEventListener('click', (event) => {
  const link = event.target.closest('a[data-route]');
  if (!link || event.metaKey || event.ctrlKey || event.shiftKey || event.button !== 0) return;
  event.preventDefault();
  navigate(link.getAttribute('href'));
});

window.addEventListener('popstate', route);
route();
