import type { Point } from '../model/path';
import type { PositionMap, Token } from '../model/types';

interface Props {
  tokens: readonly Token[];
  start: PositionMap | null;
  end: PositionMap | null;
  /** The arrow being dragged out right now, before it is committed. */
  aiming: { tokenId: string; from: Point; to: Point } | null;
}

/** Anything shorter than this is a token sitting still, not a move. */
const MIN_VISIBLE = 8;

/** Stop short of the destination so the head lands beside it, not under it. */
const HEAD_CLEARANCE = 20;

/** Pull a line's end back along its own direction. */
function trimmed(from: Point, to: Point): Point {
  const dx = to.x - from.x;
  const dy = to.y - from.y;
  const length = Math.hypot(dx, dy);
  if (length <= HEAD_CLEARANCE) return to;
  const keep = (length - HEAD_CLEARANCE) / length;
  return { x: from.x + dx * keep, y: from.y + dy * keep };
}

/**
 * Where each player is going, drawn the way a coach draws it: a solid line with
 * an arrowhead, so a run reads differently from a throw. It is the same pair of
 * arrangements the animation uses, which means a recorded play and a library
 * play both show their movement without being asked.
 */
export function MoveArrowLayer({ tokens, start, end, aiming }: Props) {
  const arrows: { id: string; from: Point; to: Point; ball: boolean }[] = [];

  if (start && end) {
    for (const token of tokens) {
      if (aiming?.tokenId === token.id) continue; // shown live below
      const from = start[token.id];
      const to = end[token.id];
      if (!from || !to) continue;
      if (Math.hypot(to.x - from.x, to.y - from.y) < MIN_VISIBLE) continue;
      arrows.push({ id: token.id, from, to, ball: token.type === 'ball' });
    }
  }

  if (arrows.length === 0 && !aiming) return null;

  return (
    <g className="move-arrows" pointerEvents="none">
      <defs>
        <marker
          id="move-arrow-head"
          viewBox="0 0 10 10"
          refX="9"
          refY="5"
          markerWidth="4"
          markerHeight="4"
          markerUnits="strokeWidth"
          orient="auto"
        >
          <path d="M 0 0 L 10 5 L 0 10 Z" className="fx-move-head" />
        </marker>
        <marker
          id="move-arrow-head-aiming"
          viewBox="0 0 10 10"
          refX="9"
          refY="5"
          markerWidth="4"
          markerHeight="4"
          markerUnits="strokeWidth"
          orient="auto"
        >
          <path d="M 0 0 L 10 5 L 0 10 Z" className="fx-move-head-aiming" />
        </marker>
      </defs>
      {arrows.map((arrow) => (
        // The ball has its own dashed route; a straight hop is still its move.
        <path
          key={arrow.id}
          d={`M ${arrow.from.x} ${arrow.from.y} L ${trimmed(arrow.from, arrow.to).x} ${
            trimmed(arrow.from, arrow.to).y
          }`}
          className={arrow.ball ? 'fx-move fx-move-ball' : 'fx-move'}
          markerEnd="url(#move-arrow-head)"
        />
      ))}
      {aiming && (
        <path
          d={`M ${aiming.from.x} ${aiming.from.y} L ${aiming.to.x} ${aiming.to.y}`}
          className="fx-move fx-move-aiming"
          markerEnd="url(#move-arrow-head-aiming)"
        />
      )}
    </g>
  );
}
