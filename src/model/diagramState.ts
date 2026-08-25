import { defaultFielderPosition, FIELDER_SPOTS } from './fieldGeometry';
import type { Point } from './path';
import type { DiagramState, PositionMap, Stroke, Token, UndoEntry } from './types';

/** Deep enough for the common flow, shallow enough to stay cheap. */
export const UNDO_DEPTH = 50;

let idCounter = 0;
export function nextId(prefix: string): string {
  idCounter += 1;
  return `${prefix}-${idCounter}`;
}

export function defaultTokens(): Token[] {
  return FIELDER_SPOTS.map((spot) => {
    const { x, y } = defaultFielderPosition(spot);
    return { id: `fielder-${spot.label}`, type: 'fielder' as const, label: spot.label, x, y };
  });
}

export function initialState(): DiagramState {
  return {
    tokens: defaultTokens(),
    strokes: [],
    ballRoute: [],
    runnerRoutes: {},
    start: null,
    end: null,
    undoStack: [],
  };
}

export type DiagramAction =
  | { type: 'moveToken'; id: string; x: number; y: number }
  | { type: 'addRunner'; at: Point }
  | { type: 'addBall'; at: Point }
  | { type: 'removeToken'; id: string }
  | { type: 'addStroke'; points: Point[] }
  | { type: 'removeStroke'; id: string }
  | { type: 'addRouteLeg'; at: Point }
  | { type: 'clearRoute' }
  /** Bulk position write used by the animation transport. Not undoable. */
  | { type: 'setPositions'; positions: PositionMap }
  | { type: 'captureStart' }
  | { type: 'captureEnd' }
  /** End a recording: store the current board as the end, then rewind to start. */
  | { type: 'stopRecording' }
  | { type: 'undo' }
  | { type: 'reset' }
  | {
      type: 'loadPlay';
      tokens: Token[];
      ballRoute: Point[];
      runnerRoutes: Record<string, Point[]>;
      start: PositionMap;
      end: PositionMap;
    };

export function diagramReducer(state: DiagramState, action: DiagramAction): DiagramState {
  switch (action.type) {
    case 'moveToken': {
      const token = state.tokens.find((t) => t.id === action.id);
      if (!token) return state;
      if (token.x === action.x && token.y === action.y) return state;
      return push(
        {
          ...state,
          tokens: state.tokens.map((t) =>
            t.id === action.id ? { ...t, x: action.x, y: action.y } : t,
          ),
        },
        { kind: 'move', id: token.id, x: token.x, y: token.y },
      );
    }

    case 'addRunner': {
      const token: Token = { id: nextId('runner'), type: 'runner', x: action.at.x, y: action.at.y };
      return push(
        { ...state, tokens: [...state.tokens, token] },
        { kind: 'removeToken', id: token.id },
      );
    }

    case 'addBall': {
      // Only ever one ball: a second "add ball" relocates the existing one.
      const existing = state.tokens.find((t) => t.type === 'ball');
      if (existing) {
        return diagramReducer(state, {
          type: 'moveToken',
          id: existing.id,
          x: action.at.x,
          y: action.at.y,
        });
      }
      const token: Token = { id: nextId('ball'), type: 'ball', x: action.at.x, y: action.at.y };
      return push(
        { ...state, tokens: [...state.tokens, token] },
        { kind: 'removeToken', id: token.id },
      );
    }

    case 'removeToken': {
      const index = state.tokens.findIndex((t) => t.id === action.id);
      // Fielders are permanent — there are always nine, and nothing re-adds them.
      if (index === -1 || state.tokens[index].type === 'fielder') return state;
      return push(
        { ...state, tokens: state.tokens.filter((t) => t.id !== action.id) },
        { kind: 'addToken', token: state.tokens[index], index },
      );
    }

    case 'addStroke': {
      if (action.points.length === 0) return state;
      const stroke: Stroke = { id: nextId('stroke'), points: action.points };
      return push(
        { ...state, strokes: [...state.strokes, stroke] },
        { kind: 'removeStroke', id: stroke.id },
      );
    }

    case 'removeStroke': {
      const index = state.strokes.findIndex((s) => s.id === action.id);
      if (index === -1) return state;
      return push(
        { ...state, strokes: state.strokes.filter((s) => s.id !== action.id) },
        { kind: 'addStroke', stroke: state.strokes[index], index },
      );
    }

    case 'addRouteLeg': {
      // The first leg also anchors the route, at wherever the ball is standing.
      const ball = state.tokens.find((t) => t.type === 'ball');
      if (state.ballRoute.length === 0 && !ball) return state;
      const route =
        state.ballRoute.length === 0
          ? [{ x: ball!.x, y: ball!.y }, action.at]
          : [...state.ballRoute, action.at];
      return push({ ...state, ballRoute: route }, {
        kind: 'restoreRoute',
        route: state.ballRoute,
      });
    }

    case 'clearRoute': {
      if (state.ballRoute.length === 0) return state;
      return push({ ...state, ballRoute: [] }, { kind: 'restoreRoute', route: state.ballRoute });
    }

    case 'setPositions':
      return {
        ...state,
        tokens: state.tokens.map((t) => {
          const p = action.positions[t.id];
          return p ? { ...t, x: p.x, y: p.y } : t;
        }),
      };

    case 'captureStart':
      // Re-record throws the old play away: new start, no end yet, and none of
      // the loaded play's base paths — from here the runners go where they are
      // dragged.
      return { ...state, start: capturePositions(state.tokens), end: null, runnerRoutes: {} };

    case 'captureEnd':
      return { ...state, end: capturePositions(state.tokens) };

    case 'stopRecording': {
      if (!state.start) return state;
      // Nothing moved — cancel the recording rather than storing an empty play.
      if (!hasMovedFrom(state.tokens, state.start)) {
        return { ...state, start: null, end: null };
      }
      const end = capturePositions(state.tokens);
      const start = state.start;
      return {
        ...state,
        end,
        tokens: state.tokens.map((t) => {
          const p = start[t.id];
          return p ? { ...t, x: p.x, y: p.y } : t;
        }),
      };
    }

    case 'undo':
      return applyUndo(state);

    case 'reset':
      return initialState();

    case 'loadPlay':
      // A library play arrives already recorded, so Play is live immediately.
      // It replaces the board outright: undoing back into a previous play would
      // leave a half-merged arrangement nobody asked for.
      return {
        tokens: action.tokens,
        strokes: [],
        ballRoute: action.ballRoute,
        runnerRoutes: action.runnerRoutes,
        start: action.start,
        end: action.end,
        undoStack: [],
      };

    default:
      return state;
  }
}

/**
 * Has the board changed since an arrangement was captured? Drives the recording
 * controls: once something has moved, re-capturing the start would overwrite the
 * recording with the arrangement it was supposed to end at.
 */
export function hasMovedFrom(
  tokens: readonly Token[],
  positions: PositionMap | null,
): boolean {
  if (!positions) return false;
  if (Object.keys(positions).length !== tokens.length) return true; // added or removed
  return tokens.some((t) => {
    const p = positions[t.id];
    return !p || Math.abs(p.x - t.x) > 0.01 || Math.abs(p.y - t.y) > 0.01;
  });
}

/**
 * What pressing Play should show, given where the board stands.
 *
 * Prefer Stop to finish a recording (it stores the end and rewinds). Play can
 * still close an open recording: if anything has moved since Record, that
 * movement is the play and the current arrangement becomes its end. If nothing
 * has moved — the coach just stopped or rewound — the stored play is replayed
 * instead of collapsing to a play in which nothing happens.
 */
export function resolvePlayback(
  tokens: readonly Token[],
  start: PositionMap | null,
  storedEnd: PositionMap | null,
): { from: PositionMap; to: PositionMap; captureEnd: boolean } | null {
  if (!start) return null;
  if (hasMovedFrom(tokens, start)) {
    return { from: start, to: capturePositions(tokens), captureEnd: true };
  }
  if (storedEnd) return { from: start, to: storedEnd, captureEnd: false };
  return null;
}

export function capturePositions(tokens: readonly Token[]): PositionMap {
  const positions: PositionMap = {};
  for (const t of tokens) positions[t.id] = { x: t.x, y: t.y };
  return positions;
}

function push(state: DiagramState, entry: UndoEntry): DiagramState {
  const undoStack = [...state.undoStack, entry];
  if (undoStack.length > UNDO_DEPTH) undoStack.shift();
  return { ...state, undoStack };
}

function applyUndo(state: DiagramState): DiagramState {
  const entry = state.undoStack.at(-1);
  if (!entry) return state;
  const undoStack = state.undoStack.slice(0, -1);

  switch (entry.kind) {
    case 'move':
      return {
        ...state,
        undoStack,
        tokens: state.tokens.map((t) =>
          t.id === entry.id ? { ...t, x: entry.x, y: entry.y } : t,
        ),
      };
    case 'removeToken':
      return { ...state, undoStack, tokens: state.tokens.filter((t) => t.id !== entry.id) };
    case 'addToken': {
      const tokens = [...state.tokens];
      tokens.splice(entry.index, 0, entry.token);
      return { ...state, undoStack, tokens };
    }
    case 'restoreRoute':
      return { ...state, undoStack, ballRoute: entry.route };
    case 'removeStroke':
      return { ...state, undoStack, strokes: state.strokes.filter((s) => s.id !== entry.id) };
    case 'addStroke': {
      const strokes = [...state.strokes];
      strokes.splice(entry.index, 0, entry.stroke);
      return { ...state, undoStack, strokes };
    }
    default:
      return { ...state, undoStack };
  }
}
