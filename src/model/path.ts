export interface Point {
  x: number;
  y: number;
}

/**
 * Catmull-Rom interpolation rendered as cubic beziers. Used for both the
 * outfield fence (sampled at coarse angles) and freehand pen strokes.
 */
export function smoothPath(points: readonly Point[]): string {
  if (points.length === 0) return '';
  if (points.length === 1) {
    // A single tap still deserves a visible dot: a zero-length line with a round cap.
    const { x, y } = points[0];
    return `M ${round(x)} ${round(y)} L ${round(x)} ${round(y)}`;
  }

  const d: string[] = [`M ${round(points[0].x)} ${round(points[0].y)}`];
  for (let i = 0; i < points.length - 1; i++) {
    const p0 = points[i - 1] ?? points[i];
    const p1 = points[i];
    const p2 = points[i + 1];
    const p3 = points[i + 2] ?? p2;
    const c1x = p1.x + (p2.x - p0.x) / 6;
    const c1y = p1.y + (p2.y - p0.y) / 6;
    const c2x = p2.x - (p3.x - p1.x) / 6;
    const c2y = p2.y - (p3.y - p1.y) / 6;
    d.push(
      `C ${round(c1x)} ${round(c1y)}, ${round(c2x)} ${round(c2y)}, ${round(p2.x)} ${round(p2.y)}`,
    );
  }
  return d.join(' ');
}

/** Squared distance from `p` to segment `ab`; avoids a sqrt in hit-test loops. */
export function distanceToSegmentSq(p: Point, a: Point, b: Point): number {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const lenSq = dx * dx + dy * dy;
  const t = lenSq === 0 ? 0 : clamp(((p.x - a.x) * dx + (p.y - a.y) * dy) / lenSq, 0, 1);
  const cx = a.x + t * dx - p.x;
  const cy = a.y + t * dy - p.y;
  return cx * cx + cy * cy;
}

export function clamp(value: number, min: number, max: number): number {
  return value < min ? min : value > max ? max : value;
}

function round(n: number): number {
  return Math.round(n * 100) / 100;
}
