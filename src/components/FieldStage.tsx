import { useCallback, useRef, useState } from 'react';
import { clampToField, hitRadiusForScale, VIEW_BOX_ATTR } from '../model/fieldGeometry';
import { tokenAt, strokeAt } from '../model/hitTest';
import type { Point } from '../model/path';
import type { DiagramAction } from '../model/diagramState';
import type { DiagramState, PositionMap, Tool } from '../model/types';
import { FieldSurface } from './FieldSurface';
import { StrokeLayer } from './StrokeLayer';
import { TokenLayer } from './TokenLayer';

interface Props {
  state: DiagramState;
  dispatch: (action: DiagramAction) => void;
  tool: Tool;
  /** Positions driven by the animation transport; suppresses interaction. */
  animating: PositionMap | null;
}

interface DragState {
  pointerId: number;
  tokenId: string;
  /** Grab offset, so the token doesn't jump to the fingertip. */
  dx: number;
  dy: number;
  at: Point;
}

/** Ignore sub-pixel pointermove noise when recording a pen stroke. */
const MIN_STROKE_STEP = 3;

export function FieldStage({ state, dispatch, tool, animating }: Props) {
  const svgRef = useRef<SVGSVGElement | null>(null);
  const [drag, setDrag] = useState<DragState | null>(null);
  const [draft, setDraft] = useState<{ pointerId: number; points: Point[] } | null>(null);

  const toFieldPoint = useCallback((event: React.PointerEvent): Point => {
    const svg = svgRef.current;
    if (!svg) return { x: 0, y: 0 };
    const ctm = svg.getScreenCTM();
    if (!ctm) return { x: 0, y: 0 };
    const p = new DOMPoint(event.clientX, event.clientY).matrixTransform(ctm.inverse());
    return { x: p.x, y: p.y };
  }, []);

  /** CSS pixels per viewBox unit, for sizing touch targets at the current scale. */
  const currentScale = useCallback((): number => {
    const ctm = svgRef.current?.getScreenCTM();
    return ctm ? ctm.a : 1;
  }, []);

  const handlePointerDown = (event: React.PointerEvent<SVGSVGElement>) => {
    // A running animation owns the tokens; don't let a stray touch fight it.
    if (animating || event.button > 0) return;
    const p = toFieldPoint(event);

    switch (tool) {
      case 'select': {
        const token = tokenAt(state.tokens, p, hitRadiusForScale(currentScale()));
        if (!token) return;
        event.currentTarget.setPointerCapture(event.pointerId);
        setDrag({
          pointerId: event.pointerId,
          tokenId: token.id,
          dx: token.x - p.x,
          dy: token.y - p.y,
          at: { x: token.x, y: token.y },
        });
        return;
      }
      case 'addRunner':
        dispatch({ type: 'addRunner', at: clampToField(p) });
        return;
      case 'addBall':
        dispatch({ type: 'addBall', at: clampToField(p) });
        return;
      case 'erase': {
        const token = tokenAt(state.tokens, p, hitRadiusForScale(currentScale()));
        if (token) {
          dispatch({ type: 'removeToken', id: token.id });
          return;
        }
        const stroke = strokeAt(state.strokes, p);
        if (stroke) dispatch({ type: 'removeStroke', id: stroke.id });
        return;
      }
      case 'pen':
        event.currentTarget.setPointerCapture(event.pointerId);
        setDraft({ pointerId: event.pointerId, points: [p] });
        return;
    }
  };

  const handlePointerMove = (event: React.PointerEvent<SVGSVGElement>) => {
    if (drag?.pointerId === event.pointerId) {
      const p = toFieldPoint(event);
      setDrag({ ...drag, at: clampToField({ x: p.x + drag.dx, y: p.y + drag.dy }) });
      return;
    }
    if (draft?.pointerId === event.pointerId) {
      const p = toFieldPoint(event);
      const last = draft.points[draft.points.length - 1];
      if (Math.hypot(p.x - last.x, p.y - last.y) < MIN_STROKE_STEP) return;
      setDraft({ ...draft, points: [...draft.points, p] });
    }
  };

  const handlePointerUp = (event: React.PointerEvent<SVGSVGElement>) => {
    if (drag?.pointerId === event.pointerId) {
      // One dispatch per drag, so undo steps back a whole move, not a frame.
      dispatch({ type: 'moveToken', id: drag.tokenId, x: drag.at.x, y: drag.at.y });
      setDrag(null);
    }
    if (draft?.pointerId === event.pointerId) {
      dispatch({ type: 'addStroke', points: draft.points });
      setDraft(null);
    }
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }
  };

  const handlePointerCancel = (event: React.PointerEvent<SVGSVGElement>) => {
    if (drag?.pointerId === event.pointerId) setDrag(null);
    if (draft?.pointerId === event.pointerId) setDraft(null);
  };

  const overrides: PositionMap | null =
    animating ?? (drag ? { [drag.tokenId]: drag.at } : null);

  return (
    <svg
      ref={svgRef}
      className="field-svg"
      viewBox={VIEW_BOX_ATTR}
      preserveAspectRatio="xMidYMid meet"
      role="application"
      aria-label="Baseball field diagram"
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
      onPointerCancel={handlePointerCancel}
      onContextMenu={(e) => e.preventDefault()}
    >
      <FieldSurface />
      <StrokeLayer strokes={state.strokes} drafting={draft?.points ?? null} />
      <TokenLayer tokens={state.tokens} overrides={overrides} />
    </svg>
  );
}
