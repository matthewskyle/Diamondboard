import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import {
  clampToField,
  hitRadiusForScale,
  TOKEN_RADIUS,
  tokenScaleForScale,
  VIEW_BOX,
  viewBoxAttr,
  viewHeightFor,
} from '../model/fieldGeometry';
import { snapToBase, snapToTarget, strokeAt, tokenAt } from '../model/hitTest';
import type { Point } from '../model/path';
import { MIN_ARROW_LENGTH, type DiagramAction } from '../model/diagramState';
import { arrangementBefore } from '../model/steps';
import type { DiagramState, PositionMap, Token, Tool } from '../model/types';
import { FieldSurface } from './FieldSurface';
import { MoveArrowLayer } from './MoveArrowLayer';
import { StrokeLayer } from './StrokeLayer';
import { TokenLayer } from './TokenLayer';

interface Props {
  state: DiagramState;
  dispatch: (action: DiagramAction) => void;
  tool: Tool;
  /** Positions driven by the animation transport; suppresses interaction. */
  animating: PositionMap | null;
}

interface AimState {
  pointerId: number;
  tokenId: string;
  from: Point;
  to: Point;
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
  const [aim, setAim] = useState<AimState | null>(null);
  const [viewHeight, setViewHeight] = useState<number>(VIEW_BOX.height);
  // CSS pixels per viewBox unit, remembered from the last resize so the tokens
  // can be drawn at a size a finger can actually find.
  const [pxPerUnit, setPxPerUnit] = useState<number>(1);

  // Track the container's shape so a rotation crops the board rather than
  // shrinking the field. Changing the viewBox doesn't resize the element, so
  // this can't feed back on itself.
  useEffect(() => {
    const svg = svgRef.current;
    if (!svg) return;
    const observer = new ResizeObserver(([entry]) => {
      const { width, height } = entry.contentRect;
      if (width > 0 && height > 0) {
        setViewHeight(viewHeightFor(width / height));
        setPxPerUnit(width / VIEW_BOX.width);
      }
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

  /**
   * Where everybody stands entering the step being edited. A play is built one
   * beat at a time, so the board has to show the beat being worked on rather
   * than the top of the play.
   */
  const board = useMemo(
    () => arrangementBefore(state.tokens, state.steps, state.activeStep),
    [state.tokens, state.steps, state.activeStep],
  );

  /** The tokens as they stand in the step on screen, for hit testing. */
  const placed: Token[] = useMemo(
    () => state.tokens.map((t) => ({ ...t, ...(board[t.id] ?? { x: t.x, y: t.y }) })),
    [state.tokens, board],
  );

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

  /**
   * Capture keeps a drag alive when the finger outruns the token, but it is not
   * what makes the drag work: Safari has historically thrown here for touch
   * pointers on an SVG element, and a throw at this point would swallow the
   * whole gesture. Losing capture costs a drag that leaves the board; losing the
   * drag costs everything.
   */
  const capture = (event: React.PointerEvent<SVGSVGElement>) => {
    try {
      event.currentTarget.setPointerCapture(event.pointerId);
    } catch {
      // Ignored: the pointer handlers below work without it.
    }
  };

  const handlePointerDown = (event: React.PointerEvent<SVGSVGElement>) => {
    // A running animation owns the tokens; don't let a stray touch fight it.
    if (animating || event.button > 0) return;
    const p = toFieldPoint(event);

    switch (tool) {
      case 'arrow': {
        const token = tokenAt(placed, p, hitRadiusForScale(currentScale()));
        if (!token) return;
        capture(event);
        // Hold the player and pull: the line out of him is where he is going
        // this step, and it is drawn as it is dragged.
        setAim({
          pointerId: event.pointerId,
          tokenId: token.id,
          from: { x: token.x, y: token.y },
          to: { x: token.x, y: token.y },
        });
        return;
      }
      case 'select': {
        const token = tokenAt(placed, p, hitRadiusForScale(currentScale()));
        if (!token) return;
        capture(event);
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
      case 'erase': {
        const token = tokenAt(placed, p, hitRadiusForScale(currentScale()));
        if (token) {
          dispatch({ type: 'removeToken', id: token.id });
          return;
        }
        const stroke = strokeAt(state.strokes, p);
        if (stroke) dispatch({ type: 'removeStroke', id: stroke.id });
        return;
      }
      case 'pen':
        capture(event);
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
    if (aim?.pointerId === event.pointerId) {
      setAim({ ...aim, to: clampToField(toFieldPoint(event), viewHeight) });
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
    if (aim?.pointerId === event.pointerId) {
      const reach = Math.hypot(aim.to.x - aim.from.x, aim.to.y - aim.from.y);
      if (reach < MIN_ARROW_LENGTH) {
        // A tap rather than a drag: take this step's arrow back off.
        dispatch({ type: 'clearDestination', id: aim.tokenId });
      } else {
        dispatch({
          type: 'setDestination',
          id: aim.tokenId,
          // Aimed at a bag or a teammate, land on it exactly.
          to: snapToTarget(
            placed.filter((t) => t.id !== aim.tokenId),
            aim.to,
            hitRadiusForScale(currentScale()),
          ),
        });
      }
      setAim(null);
    }
    if (drag?.pointerId === event.pointerId) {
      // One dispatch per drag, so undo steps back a whole move, not a frame.
      // Dropped near a bag, settle onto it rather than a pixel beside it.
      dispatch({ type: 'placeToken', id: drag.tokenId, to: snapToBase(drag.at) });
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
    if (aim?.pointerId === event.pointerId) setAim(null);
    if (drag?.pointerId === event.pointerId) setDrag(null);
    if (draft?.pointerId === event.pointerId) setDraft(null);
  };

  const positions: PositionMap =
    animating ?? (drag ? { ...board, [drag.tokenId]: drag.at } : board);

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
      <MoveArrowLayer
        tokens={state.tokens}
        steps={state.steps}
        activeStep={state.activeStep}
        aiming={aim}
        playing={animating !== null}
      />
      <TokenLayer
        tokens={state.tokens}
        overrides={positions}
        scale={tokenScaleForScale(pxPerUnit)}
      />
    </svg>
  );
}
