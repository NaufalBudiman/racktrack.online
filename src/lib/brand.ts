// RackTrack mark: a rack unit (green LED, amber activity bar) inside scan corners. 24×24 grid.
// Used as an SVG string for generated images (apple icon, OG image); <Logo> and app/icon.svg draw the same shapes.

export const BRAND = {
  bg: "#07090D",
  corner: "#FFC27A",
  unit: "#F1F4F8",
  led: "#4FD199",
  bar: "#F7A23A",
};

export const MARK_SHAPES = `
<path d="M3 8V5a2 2 0 0 1 2-2h3M16 3h3a2 2 0 0 1 2 2v3M21 16v3a2 2 0 0 1-2 2h-3M8 21H5a2 2 0 0 1-2-2v-3" fill="none" stroke="${BRAND.corner}" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
<rect x="6.5" y="9.25" width="11" height="5.5" rx="1.6" fill="none" stroke="${BRAND.unit}" stroke-width="1.7"/>
<circle cx="9.2" cy="12" r="1.15" fill="${BRAND.led}"/>
<rect x="11.4" y="11.35" width="4.2" height="1.3" rx="0.65" fill="${BRAND.bar}"/>`;

/**
 * The mark as a standalone SVG. `tile` adds the dark background: square for PNG app icons (iOS/Android round
 * them themselves, and maskable icons must be full-bleed), rounded only where we show it ourselves.
 */
export function markSvg({ size, tile = false, rounded = false }: { size: number; tile?: boolean; rounded?: boolean }): string {
  const inner = tile ? `<rect width="24" height="24" rx="${rounded ? 5.5 : 0}" fill="${BRAND.bg}"/><g transform="translate(3.6 3.6) scale(0.7)">${MARK_SHAPES}</g>` : MARK_SHAPES;
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 24 24">${inner}</svg>`;
}

export const markDataUri = (opts: { size: number; tile?: boolean; rounded?: boolean }) =>
  `data:image/svg+xml;base64,${Buffer.from(markSvg(opts)).toString("base64")}`;
