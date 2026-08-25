import type { Point } from '../model/path';

interface Props {
  /** The whole route, origin first. Anchored where it was drawn. */
  route: readonly Point[];
}

/**
 * The ball's route, drawn the way a coach draws it on a whiteboard: a dashed
 * line with an arrowhead at each stop. It reads as part of the diagram whether
 * or not anyone presses Play.
 */
export function BallRouteLayer({ route }: Props) {
  if (route.length < 2) return null;
  const points = route;

  return (
    <g className="ball-route" pointerEvents="none">
      <defs>
        <marker
          id="route-arrow"
          viewBox="0 0 10 10"
          refX="9"
          refY="5"
          markerWidth="4"
          markerHeight="4"
          markerUnits="strokeWidth"
          orient="auto"
        >
          <path d="M 0 0 L 10 5 L 0 10 Z" className="fx-route-head" />
        </marker>
      </defs>
      {/* One path per leg, so every stop gets its own arrowhead. */}
      {points.slice(0, -1).map((p, i) => (
        <path
          key={i}
          d={`M ${p.x} ${p.y} L ${points[i + 1].x} ${points[i + 1].y}`}
          className="fx-route"
          markerEnd="url(#route-arrow)"
        />
      ))}
    </g>
  );
}
