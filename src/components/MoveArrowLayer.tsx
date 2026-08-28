import type { Point } from '../model/path';
import { arrangementBefore, type PlayStep } from '../model/steps';
import type { Token } from '../model/types';

interface Props {
  tokens: readonly Token[];
  steps: readonly PlayStep[];
  /** The step being drawn into; its arrows are the live ones. */
  activeStep: number;
  /** The arrow being dragged out right now, before it is committed. */
  aiming: { tokenId: string; from: Point; to: Point } | null;
  /** Hide the steps that have not happened yet while a play is running. */
  playing?: boolean;
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

interface Arrow {
  key: string;
  step: number;
  from: Point;
  to: Point;
  active: boolean;
}

/**
 * Every step's arrows at once, the way a coach draws a play on a whiteboard:
 * the whole thing is on the board, and the beat being worked on is the one in
 * chalk. Each arrow carries its step number, so which players break together
 * is readable without pressing Play.
 */
export function MoveArrowLayer({ tokens, steps, activeStep, aiming, playing }: Props) {
  const arrows: Arrow[] = [];

  for (let i = 0; i < steps.length; i++) {
    const before = arrangementBefore(tokens, steps, i);
    for (const [id, to] of Object.entries(steps[i].moves)) {
      if (aiming?.tokenId === id && i === activeStep) continue; // shown live below
      const from = before[id];
      if (!from) continue;
      if (Math.hypot(to.x - from.x, to.y - from.y) < MIN_VISIBLE) continue;
      arrows.push({ key: `${steps[i].id}:${id}`, step: i, from, to, active: i === activeStep });
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
      {arrows.map((arrow) => {
        const tip = trimmed(arrow.from, arrow.to);
        // While the play runs the tokens carry the story; keeping every step
        // lit would leave the field a thicket of arrows to read through.
        const className = playing
          ? 'fx-move fx-move-past'
          : arrow.active
            ? 'fx-move'
            : 'fx-move-past';
        return (
          <g key={arrow.key}>
            <path
              d={`M ${arrow.from.x} ${arrow.from.y} L ${tip.x} ${tip.y}`}
              className={className}
              markerEnd="url(#move-arrow-head)"
            />
            {!playing && <StepBadge from={arrow.from} to={tip} step={arrow.step} />}
          </g>
        );
      })}
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

/** The step number, sat on the arrow so a glance says when this move happens. */
function StepBadge({ from, to, step }: { from: Point; to: Point; step: number }) {
  const x = (from.x + to.x) / 2;
  const y = (from.y + to.y) / 2;
  return (
    <g className="fx-step-badge">
      <circle cx={x} cy={y} r={13} className="fx-step-badge-disc" />
      <text x={x} y={y} textAnchor="middle" dominantBaseline="central" className="fx-step-badge-text">
        {step + 1}
      </text>
    </g>
  );
}
