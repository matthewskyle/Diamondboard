import { smoothPath, type Point } from './path';

/**
 * FieldGeometry — the single source of truth for where everything lives.
 *
 * Coordinate space: a fixed SVG viewBox. Every token position, field feature
 * and pen stroke is expressed in these units; the SVG is CSS-scaled to fit the
 * container, so nothing is device-pixel dependent.
 *
 * Geometry model: "compressed real geometry". Angles are real (the foul lines
 * are a true 90-degree wedge), and radial distances from home plate are real
 * feet mapped through a piecewise-linear scale:
 *
 *   r <= INFIELD_LIMIT_FT   ->  r * INFIELD_SCALE          (true to scale)
 *   r >  INFIELD_LIMIT_FT   ->  compressed toward the fence
 *
 * So the infield keeps real proportions (90 ft base paths, a 60 ft 6 in mound)
 * while the outfield is squeezed to fit a portrait-ish frame, which is what
 * makes the whole field readable on an iPad without shrinking the infield to
 * an unusable dot.
 */

export const VIEW_BOX = { width: 1000, height: 1000 } as const;
export const VIEW_BOX_ATTR = `0 0 ${VIEW_BOX.width} ${VIEW_BOX.height}`;

/** Home plate, in viewBox units. Everything else is measured from here. */
export const HOME: Point = { x: 500, y: 880 };

export const INFIELD_SCALE = 3.0; // units per foot inside the infield
export const INFIELD_LIMIT_FT = 130; // where the compression kicks in
const INFIELD_LIMIT_UNITS = INFIELD_LIMIT_FT * INFIELD_SCALE;

/** Real distance down the foul line, and where we draw the foul pole. */
export const FOUL_LINE_FT = 330;
const FOUL_POLE_OFFSET = 470; // units, on each axis (the 45-degree line)
const FOUL_LINE_UNITS = FOUL_POLE_OFFSET * Math.SQRT2;

export const OUTFIELD_SCALE =
  (FOUL_LINE_UNITS - INFIELD_LIMIT_UNITS) / (FOUL_LINE_FT - INFIELD_LIMIT_FT);

/** Real feet from home plate -> viewBox units. */
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
  return { x: HOME.x + r * Math.sin(a), y: HOME.y - r * Math.cos(a) };
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
export const MOUND_RADIUS = 9 * INFIELD_SCALE; // 9 ft radius
export const RUBBER = { width: 20, height: 6 };

/** Bases are drawn oversized — a true 15 in bag would be ~4 units across. */
export const BASE_SIZE = 26;
export const HOME_PLATE_SIZE = 28;
export const HOME_CIRCLE_RADIUS = 13 * INFIELD_SCALE; // 26 ft diameter

export const FOUL_POLES = {
  left: pointAt(FOUL_LINE_FT, -FOUL_ANGLE),
  right: pointAt(FOUL_LINE_FT, FOUL_ANGLE),
} as const;

/** Real fence distances, sampled by angle and mirrored across center field. */
const FENCE_PROFILE_FT: ReadonlyArray<readonly [angle: number, feet: number]> = [
  [0, 400],
  [11.25, 395],
  [22.5, 378],
  [33.75, 353],
  [45, FOUL_LINE_FT],
];

export function fenceDistanceFt(angleDeg: number): number {
  const a = Math.min(Math.abs(angleDeg), FOUL_ANGLE);
  for (let i = 0; i < FENCE_PROFILE_FT.length - 1; i++) {
    const [a0, f0] = FENCE_PROFILE_FT[i];
    const [a1, f1] = FENCE_PROFILE_FT[i + 1];
    if (a <= a1) return f0 + ((f1 - f0) * (a - a0)) / (a1 - a0);
  }
  return FOUL_LINE_FT;
}

function fencePoints(stepDeg = 2.5): Point[] {
  const points: Point[] = [];
  for (let a = -FOUL_ANGLE; a <= FOUL_ANGLE + 1e-9; a += stepDeg) {
    points.push(pointAt(fenceDistanceFt(a), a));
  }
  return points;
}

/** Open arc, foul pole to foul pole. */
export const OUTFIELD_ARC_PATH = smoothPath(fencePoints());

/** The grass area: fence arc closed back through home plate. */
export const FAIR_TERRITORY_PATH = `${OUTFIELD_ARC_PATH} L ${HOME.x} ${HOME.y} Z`;

// --- Infield dirt ---------------------------------------------------------

/** Real infield arc: 95 ft radius swung from the middle of the mound. */
export const INFIELD_ARC_RADIUS = 95 * INFIELD_SCALE;

/**
 * Distance from home, along a foul line, to where the infield arc crosses it.
 * Solved rather than eyeballed so the dirt shell always meets the lines cleanly.
 */
function foulLineArcIntersectionUnits(): number {
  // Along the foul line P(t) = HOME + t * dir, solve |P(t) - MOUND| = radius.
  const dy = HOME.y - MOUND.y; // MOUND sits straight up the center line
  const b = -dy * Math.cos((FOUL_ANGLE * Math.PI) / 180);
  const c = dy * dy - INFIELD_ARC_RADIUS * INFIELD_ARC_RADIUS;
  return -b + Math.sqrt(b * b - c);
}

const ARC_T = foulLineArcIntersectionUnits();
const ARC_RIGHT: Point = {
  x: HOME.x + ARC_T * Math.sin((FOUL_ANGLE * Math.PI) / 180),
  y: HOME.y - ARC_T * Math.cos((FOUL_ANGLE * Math.PI) / 180),
};
const ARC_LEFT: Point = { x: HOME.x - (ARC_RIGHT.x - HOME.x), y: ARC_RIGHT.y };

/** The classic infield "shell": foul line, arc across the top, foul line, home. */
export const INFIELD_DIRT_PATH = [
  `M ${HOME.x} ${HOME.y}`,
  `L ${r(ARC_RIGHT.x)} ${r(ARC_RIGHT.y)}`,
  `A ${r(INFIELD_ARC_RADIUS)} ${r(INFIELD_ARC_RADIUS)} 0 0 0 ${r(ARC_LEFT.x)} ${r(ARC_LEFT.y)}`,
  'Z',
].join(' ');

/** Infield grass diamond, inset 9 ft inside the base paths. */
export const INFIELD_GRASS_PATH = (() => {
  const center = pointAt((BASE_PATH_FT * Math.SQRT2) / 2, 0);
  const inset = 1 - 9 / (BASE_PATH_FT / 2); // apothem 45 ft -> 36 ft
  const corners = [BASES.home, BASES.first, BASES.second, BASES.third].map((p) => ({
    x: center.x + (p.x - center.x) * inset,
    y: center.y + (p.y - center.y) * inset,
  }));
  return `M ${corners.map((p) => `${r(p.x)} ${r(p.y)}`).join(' L ')} Z`;
})();

// --- Default arrangement --------------------------------------------------

export interface FielderSpot {
  label: string;
  feet: number;
  angle: number;
}

/** Standard-depth positioning, in real feet and real bearings. */
export const FIELDER_SPOTS: readonly FielderSpot[] = [
  { label: 'P', feet: 58, angle: 0 },
  { label: 'C', feet: 13, angle: 180 },
  { label: '1B', feet: 105, angle: 38 },
  { label: '2B', feet: 140, angle: 18 },
  { label: 'SS', feet: 140, angle: -18 },
  { label: '3B', feet: 100, angle: -38 },
  { label: 'LF', feet: 270, angle: -30 },
  { label: 'CF', feet: 300, angle: 0 },
  { label: 'RF', feet: 270, angle: 30 },
];

export function defaultFielderPosition(spot: FielderSpot): Point {
  return pointAt(spot.feet, spot.angle);
}

// --- Tokens ---------------------------------------------------------------

export const TOKEN_RADIUS = 24;
export const BALL_RADIUS = 11;
/**
 * Invisible hit area, in viewBox units. At iPad-portrait scale one unit is
 * roughly 0.75 CSS px, so 34 units clears the 44 px minimum touch target.
 */
export const TOKEN_HIT_RADIUS = 34;

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

/** Keep dragged tokens on the board. */
export function clampToField(p: Point): Point {
  const m = TOKEN_RADIUS;
  return {
    x: Math.min(Math.max(p.x, m), VIEW_BOX.width - m),
    y: Math.min(Math.max(p.y, m), VIEW_BOX.height - m),
  };
}

function r(n: number): number {
  return Math.round(n * 100) / 100;
}
