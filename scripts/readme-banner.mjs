// Builds the README banner: one self-contained SVG per GitHub theme, with the
// title set in SVG text beside an animated drawing from the site's own export.
// Run with `npm run banner`. Change the design, seed or detail below.
import { writeFileSync, mkdirSync } from 'node:fs';
import { DESIGN, DESIGNS } from '../src/designs/index.js';
import { build, exportAnimatedSvg, DEFAULT_STYLE } from '../src/core/render.js';

const ID = 'contours';
const SEED = 6470;
const DETAIL = 4;

// Colours from GitHub's own light and dark themes, so the banner sits flush.
const THEMES = {
  dark: { bg: '#0d1117', text: '#f0f6fc', muted: '#9198a1', faint: '#3d444d', line: '#9198a1' },
  light: { bg: '#ffffff', text: '#1f2328', muted: '#59636e', faint: '#d1d9e0', line: '#59636e' },
};

const W = 1200;
const H = 400;
const design = DESIGN[ID];
const fig = `0.${DESIGNS.indexOf(design) + 1}`;
const name = design.name(build(design, SEED, DETAIL, 0).facts);
const SANS = `-apple-system, BlinkMacSystemFont, 'Segoe UI', 'Noto Sans', Helvetica, Arial, sans-serif`;
const MONO = `ui-monospace, SFMono-Regular, 'SF Mono', Menlo, Consolas, monospace`;
const esc = (s) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;');

// Registration marks at each corner, like a print proof.
function corners(inset, size) {
  const pts = [
    [inset, inset, 1, 1],
    [W - inset, inset, -1, 1],
    [inset, H - inset, 1, -1],
    [W - inset, H - inset, -1, -1],
  ];
  return pts.map(([x, y, sx, sy]) => `M${x + sx * size} ${y}H${x}V${y + sy * size}`).join('');
}

function banner(theme) {
  const t = THEMES[theme];
  const style = { ...DEFAULT_STYLE, line: t.line, background: t.bg, transparent: true, width: 0.8 };
  const { svg } = exportAnimatedSvg(design, SEED, DETAIL, style);
  const drawing = svg.replace(/^<svg[^>]*>/, '').replace(/<\/svg>\s*$/, '');

  // The drawing keeps the export's 320 × 270 frame, scaled up on the right.
  const dw = 440;
  const dh = Math.round((dw * 270) / 320);
  const dx = W - dw - 40;
  const dy = Math.round((H - dh) / 2) + 4;
  const cx = dx + dw / 2;
  const cy = dy + dh / 2;

  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${H}" width="${W}" height="${H}" role="img" aria-label="Gen Cards: generative line drawings, exported as SVG">
<style>
  .in { opacity: 0; animation: rise 1.1s cubic-bezier(.2,.7,.2,1) forwards; }
  .d1 { animation-delay: .05s } .d2 { animation-delay: .2s } .d3 { animation-delay: .35s } .d4 { animation-delay: .6s }
  .art { opacity: 0; animation: fade 1.6s ease-out .25s forwards; }
  @keyframes rise { from { opacity: 0; transform: translateY(10px) } to { opacity: 1; transform: none } }
  @keyframes fade { to { opacity: 1 } }
  @media (prefers-reduced-motion: reduce) { .in, .art { animation: none; opacity: 1 } }
</style>
<defs>
  <pattern id="dots" width="16" height="16" patternUnits="userSpaceOnUse"><circle cx="1" cy="1" r="1" fill="${t.faint}"/></pattern>
  <radialGradient id="fade" cx="${cx}" cy="${cy}" r="${dw * 0.62}" gradientUnits="userSpaceOnUse">
    <stop offset="0" stop-color="#fff"/><stop offset="1" stop-color="#fff" stop-opacity="0"/>
  </radialGradient>
  <mask id="glow"><rect width="${W}" height="${H}" fill="url(#fade)"/></mask>
</defs>
<rect x="0.5" y="0.5" width="${W - 1}" height="${H - 1}" rx="14" fill="${t.bg}" stroke="${t.faint}"/>
<path d="${corners(20, 10)}" fill="none" stroke="${t.muted}" stroke-width="1" opacity=".6"/>
<rect width="${W}" height="${H}" fill="url(#dots)" mask="url(#glow)"/>

<g font-family="${SANS}">
  <text class="in d1" x="72" y="118" font-family="${MONO}" font-size="17" letter-spacing="3" fill="${t.muted}">GENERATIVE LINE DRAWINGS</text>
  <text class="in d2" x="68" y="210" font-size="92" font-weight="600" letter-spacing="-3" fill="${t.text}">Gen Cards</text>
  <text class="in d3" font-size="25" fill="${t.muted}">
    <tspan x="72" y="262">${DESIGNS.length} algorithms, each drawing its own seeded figure.</tspan>
    <tspan x="72" y="296">Export any of them as plain, animated SVG.</tspan>
  </text>
  <g class="in d4" font-family="${MONO}" font-size="16" letter-spacing="1" fill="${t.muted}">
    <line x1="72" y1="337" x2="98" y2="337" stroke="${t.muted}"/>
    <text x="112" y="343">FIG ${fig}  ·  ${esc(name.toUpperCase())}  ·  SEED ${SEED}</text>
  </g>
</g>

<svg class="art" x="${dx}" y="${dy}" width="${dw}" height="${dh}" viewBox="0 0 320 270" overflow="visible">${drawing}</svg>
</svg>
`;
}

mkdirSync(new URL('../media/', import.meta.url), { recursive: true });
for (const theme of Object.keys(THEMES)) {
  const out = banner(theme);
  writeFileSync(new URL(`../media/banner-${theme}.svg`, import.meta.url), out);
  console.log(`media/banner-${theme}.svg  ${(out.length / 1024).toFixed(0)} KB`);
}
