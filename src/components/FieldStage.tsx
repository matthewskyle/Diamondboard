import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import {
  clampToField,
  hitRadiusForScale,
  TOKEN_RADIUS,
  VIEW_BOX,
  viewBoxAttr,
  viewHeightFor,
} from '../model/fieldGeometry';
import { routeAt, snapToTarget, strokeAt, tokenAt } from '../model/hitTest';
import type { Point } from '../model/path';
import type { DiagramAction } from '../model/diagramState';
import type { DiagramState, PositionMap, Tool } from '../model/types';
import { FieldSurface } from './FieldSurface';
import { BallRouteLayer } from './BallRouteLayer';
import { StrokeLayer } from './StrokeLayer';
import { TokenLayer } from './TokenLayer';

interface Props {
  state: DiagramState;
  dispatch: (action: DiagramAction) => void;
  tool: Tool;
  /** Positions driven by the animation transport; suppresses interaction. */
  animating: PositionMap | null;
  /** The position being studied, if any. */
  highlight?: string | null;
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

export function FieldStage({ state, dispatch, tool, animating, highlight }: Props) {
  const svgRef = useRef<SVGSVGElement | null>(null);
  const [drag, setDrag] = useState<DragState | null>(null);
  const [draft, setDraft] = useState<{ pointerId: number; points: Point[] } | null>(null);
  const [viewHeight, setViewHeight] = useState<number>(VIEW_BOX.height);

  // Track the container's shape so a rotation crops the board rather than
  // shrinking the field. Changing the viewBox doesn't resize the element, so
  // this can't feed back on itself.
  useEffect(() => {
    const svg = svgRef.current;
    if (!svg) return;
    const observer = new ResizeObserver(([entry]) => {
      const { width, height } = entry.contentRect;
      if (width > 0 && height > 0) setViewHeight(viewHeightFor(width / height));
    });
    observer.observe(svg);
    return () => observer.disconnect();
  }, []);

  const latestTokens = useRef(state.tokens);
  useLayoutEffect(() => {
    latestTokens.current = state.tokens;
  });

  // A crop can strand tokens below the new bottom edge — lift them back into
  // view rather than let them vanish on rotation.
  useEffect(() => {
    const bottom = viewHeight - TOKEN_RADIUS;
    const stranded = latestTokens.current.filter((t) => t.y > bottom);
    if (stranded.length === 0) return;
    const positions: PositionMap = {};
    for (const token of stranded) positions[token.id] = { x: token.x, y: bottom };
    dispatch({ type: 'setPositions', positions });
  }, [viewHeight, dispatch]);

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
        dispatch({ type: 'addRunner', at: clampToField(p, viewHeight) });
        return;
      case 'addBall':
        dispatch({ type: 'addBall', at: clampToField(p, viewHeight) });
        return;
      case 'ballRoute': {
        const ball = state.tokens.find((t) => t.type === 'ball');
        // Bootstrap: with no ball on the field, the first tap places it.
        if (!ball) {
          dispatch({ type: 'addBall', at: clampToField(p, viewHeight) });
          return;
        }
        dispatch({
          type: 'addRouteLeg',
          at: snapToTarget(state.tokens, clampToField(p, viewHeight), hitRadiusForScale(currentScale())),
        });
        return;
      }
      case 'erase': {
        const token = tokenAt(state.tokens, p, hitRadiusForScale(currentScale()));
        if (token) {
          dispatch({ type: 'removeToken', id: token.id });
          return;
        }
        if (routeAt(state.ballRoute, p)) {
          dispatch({ type: 'clearRoute' });
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
      setDrag({ ...drag, at: clampToField({ x: p.x + drag.dx, y: p.y + drag.dy }, viewHeight) });
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
      viewBox={viewBoxAttr(viewHeight)}
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
      <BallRouteLayer route={state.ballRoute} />
      <TokenLayer tokens={state.tokens} overrides={overrides} highlight={highlight} />
    </svg>
  );
}
