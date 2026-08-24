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
  return { tokens: defaultTokens(), strokes: [], start: null, end: null, undoStack: [] };
}

export type DiagramAction =
  | { type: 'moveToken'; id: string; x: number; y: number }
  | { type: 'addRunner'; at: Point }
  | { type: 'addBall'; at: Point }
  | { type: 'removeToken'; id: string }
  | { type: 'addStroke'; points: Point[] }
  | { type: 'removeStroke'; id: string }
  /** Bulk position write used by the animation transport. Not undoable. */
  | { type: 'setPositions'; positions: PositionMap }
  | { type: 'captureStart' }
  | { type: 'captureEnd' }
  | { type: 'undo' }
  | { type: 'reset' };

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
      const token: Token = {
        id: nextId('runner'),
        type: 'runner',
        label: `R${nextRunnerNumber(state.tokens)}`,
        x: action.at.x,
        y: action.at.y,
      };
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

    case 'setPositions':
      return {
        ...state,
        tokens: state.tokens.map((t) => {
          const p = action.positions[t.id];
          return p ? { ...t, x: p.x, y: p.y } : t;
        }),
      };

    case 'captureStart':
      return { ...state, start: capturePositions(state.tokens) };

    case 'captureEnd':
      return { ...state, end: capturePositions(state.tokens) };

    case 'undo':
      return applyUndo(state);

    case 'reset':
      return initialState();

    default:
      return state;
  }
}

export function capturePositions(tokens: readonly Token[]): PositionMap {
  const positions: PositionMap = {};
  for (const t of tokens) positions[t.id] = { x: t.x, y: t.y };
  return positions;
}

function nextRunnerNumber(tokens: readonly Token[]): number {
  // Numbering never renumbers survivors on delete; it just fills the lowest gap.
  const taken = new Set(
    tokens
      .filter((t) => t.type === 'runner')
      .map((t) => Number(t.label?.slice(1)))
      .filter((n) => Number.isFinite(n)),
  );
  let n = 1;
  while (taken.has(n)) n += 1;
  return n;
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
