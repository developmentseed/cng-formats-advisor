import type { ReactNode } from 'react';
import type { Topology } from '../framework/types';

/** Small line icons for the four shapes. They use the current text colour. */
export function ShapeIcon({ topology }: { topology: Topology }) {
  return (
    <svg
      className="shape-icon"
      viewBox="0 0 40 40"
      width="40"
      height="40"
      aria-hidden="true"
      focusable="false"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.6"
      strokeLinejoin="round"
      strokeLinecap="round"
    >
      {ICONS[topology]}
    </svg>
  );
}

const ICONS: Record<Topology, ReactNode> = {
  // A grid of pixels: one scene.
  'raster-2d': (
    <>
      <rect x="6" y="6" width="28" height="28" rx="2" />
      <path d="M15.3 6v28M24.7 6v28M6 15.3h28M6 24.7h28" />
      <rect x="15.3" y="15.3" width="9.4" height="9.4" fill="currentColor" fillOpacity="0.35" stroke="none" />
      <rect x="24.7" y="6" width="9.3" height="9.3" fill="currentColor" fillOpacity="0.2" stroke="none" />
    </>
  ),
  // A stack of grids: a cube over time or bands.
  'nd-cube': (
    <>
      <path d="M14 8V4h20v20h-4" strokeOpacity="0.45" />
      <path d="M10 12V8h20v20h-4" strokeOpacity="0.7" />
      <path d="M6 12h20v20H6z" />
      <path d="M12.7 12v20M19.3 12v20M6 18.7h20M6 25.3h20" />
    </>
  ),
  // Scattered points at different heights.
  'point-cloud': (
    <g fill="currentColor" stroke="none">
      <circle cx="9" cy="28" r="2" />
      <circle cx="15" cy="22" r="2.2" />
      <circle cx="13" cy="31" r="1.6" />
      <circle cx="21" cy="27" r="2" />
      <circle cx="22" cy="16" r="1.8" />
      <circle cx="27" cy="22" r="2.2" />
      <circle cx="31" cy="12" r="1.8" />
      <circle cx="29" cy="30" r="1.6" />
      <circle cx="17" cy="11" r="1.4" />
      <circle cx="33" cy="25" r="1.4" />
      <circle cx="25" cy="8" r="1.4" />
    </g>
  ),
  // A polygon, a line, a point, and a small table.
  vector: (
    <>
      <path d="M5 14l8-8 9 4-2 9-11 1z" fill="currentColor" fillOpacity="0.2" />
      <path d="M5 33l7-6 6 3 6-7" />
      <circle cx="29" cy="9" r="2.2" fill="currentColor" stroke="none" />
      <rect x="22" y="22" width="14" height="12" rx="1" />
      <path d="M22 26h14M22 30h14M29 22v12" />
    </>
  ),
};
