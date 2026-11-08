// A Web Worker that builds and draws gallery cards on OffscreenCanvas, so
// the page itself never waits on the maths.
import { createRenderer } from '../core/card-renderer.js';

const renderer = createRenderer((msg) => self.postMessage(msg));
self.onmessage = (event) => renderer.handle(event.data);
