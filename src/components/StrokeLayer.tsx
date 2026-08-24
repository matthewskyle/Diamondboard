import { smoothPath, type Point } from '../model/path';
import type { Stroke } from '../model/types';

interface Props {
  strokes: readonly Stroke[];
  /** The stroke currently under the pen, not yet committed. */
  drafting: readonly Point[] | null;
}

/** Pen strokes sit above the field and below tokens, so tokens stay legible. */
export function StrokeLayer({ strokes, drafting }: Props) {
  return (
    <g className="strokes" pointerEvents="none">
      {strokes.map((stroke) => (
        <path key={stroke.id} d={smoothPath(stroke.points)} className="fx-stroke" />
      ))}
      {drafting && drafting.length > 0 && <path d={smoothPath(drafting)} className="fx-stroke" />}
    </g>
  );
}
