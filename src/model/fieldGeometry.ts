import type { Point } from './path';

/**
 * FieldGeometry — the single source of truth for where everything lives.
 *
 * Coordinate space: a fixed SVG viewBox. Every token position, field feature
 * and pen stroke is expressed in these units; the SVG is CSS-scaled to fit the
 * container, so nothing is device-pixel dependent.
 *
 * Geometry model, matched to the reference diagram: positions are named in real
 * feet and real bearings, then projected into the reference's stylized space in
 * two steps.
 *
 *  1. Radial compression. Distance from home is real feet times INFIELD_SCALE
 *     out to INFIELD_LIMIT_FT, then compressed beyond it, so the infield keeps
 *     its real proportions (90 ft base paths, a 60 ft 6 in mound) while a
 *     400-plus-foot center field still fits on screen.
 *  2. Vertical squash. The whole field is flattened toward the viewer by
 *     VERTICAL_SQUASH, which is what gives the reference its slightly
 *     foreshortened look: the foul lines leave home at a 0.78 slope rather than
 *     a true 45 degrees, and the diamond reads wider than it is deep.
 *
 * The two arcs — the outfield fence and the top of the infield dirt — are drawn
 * as true circles centered on the mound, again matching the reference.
 */

export const VIEW_BOX = { width: 1000, height: 1130 } as const;

/**
 * The shortest board worth drawing: everything the field renders, including the
 * catcher's token, sits above this. Cropping to it trades the open green below
 * home plate — which is the portrait look — for a bigger field.
 */
export const MIN_VIEW_HEIGHT = 780;

/**
 * How tall the board should be for a container of the given aspect (width over
 * height). Portrait keeps the full height; as the container widens, the empty
 * green below home is cropped away rather than being allowed to squeeze the
 * field, down to the floor above. No breakpoints — it tracks the container.
 */
export function viewHeightFor(aspect: number): number {
  if (!Number.isFinite(aspect) || aspect <= 0) return VIEW_BOX.height;
  // Below this height the render is width-limited, which is what fills the frame.
  const widthLimited = VIEW_BOX.width / aspect;
  return Math.min(Math.max(widthLimited, MIN_VIEW_HEIGHT), VIEW_BOX.height);
}

export function viewBoxAttr(height: number = VIEW_BOX.height): string {
  return `0 0 ${VIEW_BOX.width} ${r(height)}`;
}

/** Home plate, in viewBox units. Everything else is measured from here. */
export const HOME: Point = { x: 500, y: 643 };

/** How far the field is flattened toward the viewer. 1 would be a plan view. */
export const VERTICAL_SQUASH = 0.78;

export const INFIELD_SCALE = 2.62; // units per foot, before the squash
export const INFIELD_LIMIT_FT = 130; // where the radial compression starts
const INFIELD_LIMIT_UNITS = INFIELD_LIMIT_FT * INFIELD_SCALE;
export const OUTFIELD_SCALE = 1.275; // units per foot beyond the infield

/** Real feet from home plate -> radial units, before the vertical squash. */
export function feetToUnits(feet: number): number {
  return feet <= INFIELD_LIMIT_FT
    ? feet * INFIELD_SCALE
    : INFIELD_LIMIT_UNITS + (feet - INFIELD_LIMIT_FT) * OUTFIELD_SCALE;
}

/**
 * Polar placement. `angleDeg` is measured from the home-to-second-base line:
 * 0 is straight to center field, negative is toward third base / left field,
 * positive is toward first base / right field. The foul lines are +/-45.
 */
export function pointAt(feet: number, angleDeg: number): Point {
  const r = feetToUnits(feet);
  const a = (angleDeg * Math.PI) / 180;
  return {
    x: HOME.x + r * Math.sin(a),
    y: HOME.y - VERTICAL_SQUASH * r * Math.cos(a),
  };
}

export const FOUL_ANGLE = 45;

// --- Field features -------------------------------------------------------

export const BASE_PATH_FT = 90;
export const MOUND_DISTANCE_FT = 60.5;

export const BASES = {
  first: pointAt(BASE_PATH_FT, FOUL_ANGLE),
  second: pointAt(BASE_PATH_FT * Math.SQRT2, 0),
  third: pointAt(BASE_PATH_FT, -FOUL_ANGLE),
  home: HOME,
} as const;

export const MOUND = pointAt(MOUND_DISTANCE_FT, 0);

/** Both arcs are circles about the mound, sized off the reference. */
export const FENCE_RADIUS = 460;
export const INFIELD_ARC_RADIUS = 232;

export const MOUND_RADIUS = { x: 24, y: 24 * VERTICAL_SQUASH };
export const HOME_CIRCLE_RADIUS = { x: 34, y: 34 * VERTICAL_SQUASH };
export const RUBBER = { width: 17, height: 5 };

/** Bases are drawn oversized — a true 15 inch bag would be four units across. */
export const BASE_SIZE = 13;
export const HOME_PLATE_SIZE = 20;

/** Unit direction of the first-base foul line, in the squashed space. */
const FOUL_DIR = (() => {
  const a = (FOUL_ANGLE * Math.PI) / 180;
  const x = Math.sin(a);
  const y = -VERTICAL_SQUASH * Math.cos(a);
  const len = Math.hypot(x, y);
  return { x: x / len, y: y / len };
})();

/**
 * How far along a foul line, from home, it crosses a circle centered on the
 * mound. Solved rather than eyeballed, so the lines always meet the arcs
 * cleanly whatever the radii are tuned to.
 */
function foulLineHit(radius: number): number {
  const oy = HOME.y - MOUND.y; // home relative to the mound; both share an x
  const b = FOUL_DIR.y * oy;
  return -b + Math.sqrt(b * b - (oy * oy - radius * radius));
}

function alongFoulLine(distance: number, side: 1 | -1): Point {
  return {
    x: HOME.x + side * distance * FOUL_DIR.x,
    y: HOME.y + distance * FOUL_DIR.y,
  };
}

export const FOUL_POLES = {
  left: alongFoulLine(foulLineHit(FENCE_RADIUS), -1),
  right: alongFoulLine(foulLineHit(FENCE_RADIUS), 1),
} as const;

const INFIELD_CORNERS = {
  left: alongFoulLine(foulLineHit(INFIELD_ARC_RADIUS), -1),
  right: alongFoulLine(foulLineHit(INFIELD_ARC_RADIUS), 1),
} as const;

/** Fence arc, foul pole to foul pole, drawn over the top. */
export const OUTFIELD_ARC_PATH = `${moveTo(FOUL_POLES.left)} ${arcTo(FOUL_POLES.right, FENCE_RADIUS)}`;

/** Everything inside the fence: the arc closed back through home plate. */
export const FAIR_TERRITORY_PATH = `${OUTFIELD_ARC_PATH} L ${r(HOME.x)} ${r(HOME.y)} Z`;

/** The classic infield shell: up one foul line, across the arc, back to home. */
export const INFIELD_DIRT_PATH = [
  moveTo(HOME),
  `L ${r(INFIELD_CORNERS.right.x)} ${r(INFIELD_CORNERS.right.y)}`,
  arcTo(INFIELD_CORNERS.left, INFIELD_ARC_RADIUS, 0),
  'Z',
].join(' ');

/** The white line along the top of the dirt. */
export const INFIELD_ARC_PATH = `${moveTo(INFIELD_CORNERS.left)} ${arcTo(
  INFIELD_CORNERS.right,
  INFIELD_ARC_RADIUS,
)}`;

/** Infield grass, inset from the base paths so the paths read as dirt. */
export const BASE_PATH_INSET_FT = 9;
export const INFIELD_GRASS_PATH = (() => {
  const center = pointAt((BASE_PATH_FT * Math.SQRT2) / 2, 0);
  const scale = 1 - BASE_PATH_INSET_FT / (BASE_PATH_FT / 2); // apothem 45 ft
  const corners = [BASES.home, BASES.first, BASES.second, BASES.third].map((p) => ({
    x: center.x + (p.x - center.x) * scale,
    y: center.y + (p.y - center.y) * scale,
  }));
  return `M ${corners.map((p) => `${r(p.x)} ${r(p.y)}`).join(' L ')} Z`;
})();

// --- Default arrangement --------------------------------------------------

export interface FielderSpot {
  label: string;
  feet: number;
  angle: number;
}

/** Depths and bearings read off the reference diagram. */
export const FIELDER_SPOTS: readonly FielderSpot[] = [
  { label: 'P', feet: MOUND_DISTANCE_FT, angle: 0 },
  { label: 'C', feet: 25, angle: 180 },
  { label: '1B', feet: 114, angle: 39 },
  { label: '2B', feet: 168, angle: 14 },
  { label: 'SS', feet: 169, angle: -15.5 },
  { label: '3B', feet: 104, angle: -37 },
  { label: 'LF', feet: 298, angle: -24.6 },
  { label: 'CF', feet: 363, angle: 0 },
  { label: 'RF', feet: 298, angle: 24.6 },
];

export function defaultFielderPosition(spot: FielderSpot): Point {
  return pointAt(spot.feet, spot.angle);
}

// --- Tokens ---------------------------------------------------------------

export const TOKEN_RADIUS = 30;
export const RUNNER_RADIUS = 12;
export const BALL_RADIUS = 12;

/**
 * Invisible hit area, in viewBox units. At iPad-portrait scale one unit is
 * roughly 0.8 CSS px, so 38 units clears the 44 px minimum touch target.
 */
export const TOKEN_HIT_RADIUS = 38;

/** The touch target we owe every token, in CSS pixels. */
export const MIN_TOUCH_TARGET_PX = 44;

/**
 * On a phone the field renders at roughly half the iPad's scale, so a fixed
 * radius would shrink below a fingertip. Grow the hit area to hold the 44 px
 * floor at whatever scale the SVG is currently drawn.
 */
export function hitRadiusForScale(pxPerUnit: number): number {
  if (!Number.isFinite(pxPerUnit) || pxPerUnit <= 0) return TOKEN_HIT_RADIUS;
  return Math.max(TOKEN_HIT_RADIUS, MIN_TOUCH_TARGET_PX / 2 / pxPerUnit);
}

/** Keep dragged tokens on the board, whatever height it is currently drawn at. */
export function clampToField(p: Point, viewHeight: number = VIEW_BOX.height): Point {
  const m = TOKEN_RADIUS;
  return {
    x: Math.min(Math.max(p.x, m), VIEW_BOX.width - m),
    y: Math.min(Math.max(p.y, m), viewHeight - m),
  };
}

function moveTo(p: Point): string {
  return `M ${r(p.x)} ${r(p.y)}`;
}

/**
 * An SVG arc to a point on a circle of the given radius. `sweep` 1 goes
 * clockwise on screen — over the top, for a point on each side of the mound.
 */
function arcTo(to: Point, radius: number, sweep: 0 | 1 = 1): string {
  return `A ${radius} ${radius} 0 0 ${sweep} ${r(to.x)} ${r(to.y)}`;
}

function r(n: number): number {
  return Math.round(n * 100) / 100;
}

