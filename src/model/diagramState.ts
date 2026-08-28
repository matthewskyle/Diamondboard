import { defaultFielderPosition, FIELDER_SPOTS } from './fieldGeometry';
import type { Point } from './path';
import { arrangementBefore, hasMoves, lastStepMoving, type PlayStep } from './steps';
import type { DiagramState, PositionMap, Stroke, Token, UndoEntry } from './types';

/** Deep enough for the common flow, shallow enough to stay cheap. */
export const UNDO_DEPTH = 50;

/** Below this a drag is a tap, and an arrow drawn that short is a mistake. */
export const MIN_ARROW_LENGTH = 26;

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

export function emptyStep(): PlayStep {
  return { id: nextId('step'), moves: {} };
}

export function initialState(): DiagramState {
  return {
    tokens: defaultTokens(),
    strokes: [],
    steps: [emptyStep()],
    activeStep: 0,
    undoStack: [],
  };
}

export type DiagramAction =
  /** Move a token outright, in the play's starting arrangement. */
  | { type: 'moveToken'; id: string; x: number; y: number }
  /**
   * Put a token where the finger dropped it, in whichever arrangement is on
   * screen: the start, or the arrival an earlier step already gave it.
   */
  | { type: 'placeToken'; id: string; to: Point }
  /** Point a token somewhere in the active step. */
  | { type: 'setDestination'; id: string; to: Point }
  /** Take back the active step's arrow for a token. */
  | { type: 'clearDestination'; id: string }
  | { type: 'addStep' }
  | { type: 'removeStep'; index: number }
  | { type: 'setActiveStep'; index: number }
  /** Throw the play away, leaving the players where they stand. */
  | { type: 'clearSteps' }
  | { type: 'addRunner'; at: Point; label?: string }
  | { type: 'addBall'; at: Point }
  | { type: 'removeToken'; id: string }
  | { type: 'addStroke'; points: Point[] }
  | { type: 'removeStroke'; id: string }
  /** Bulk position write, used to rescue tokens a rotation cropped out. */
  | { type: 'setPositions'; positions: PositionMap }
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

    case 'placeToken': {
      // On screen the token is standing wherever the play has left it. If that
      // is an earlier step's arrival, dragging it adjusts that arrival — moving
      // the top of the play instead would slide him out from under his own
      // arrow.
      const prior = lastStepMoving(state.steps, action.id, state.activeStep - 1);
      if (prior === -1) {
        return diagramReducer(state, {
          type: 'moveToken',
          id: action.id,
          x: action.to.x,
          y: action.to.y,
        });
      }
      return writeDestination(state, prior, action.id, action.to);
    }

    case 'setDestination': {
      if (!state.tokens.some((t) => t.id === action.id)) return state;
      return writeDestination(state, state.activeStep, action.id, action.to);
    }

    case 'clearDestination': {
      const step = state.steps[state.activeStep];
      const current = step?.moves[action.id];
      if (!current) return state;
      const moves = { ...step.moves };
      delete moves[action.id];
      return push(withStep(state, state.activeStep, { ...step, moves }), {
        kind: 'restoreDestination',
        step: state.activeStep,
        id: action.id,
        to: current,
      });
    }

    case 'addStep': {
      // A step nobody has been given yet is already waiting; land on it rather
      // than stacking a second empty one behind it.
      const last = state.steps.length - 1;
      if (last >= 0 && !hasMoves(state.steps[last])) {
        return { ...state, activeStep: last };
      }
      return push(
        { ...state, steps: [...state.steps, emptyStep()], activeStep: state.steps.length },
        { kind: 'restoreSteps', steps: state.steps, activeStep: state.activeStep },
      );
    }

    case 'removeStep': {
      if (action.index < 0 || action.index >= state.steps.length) return state;
      // There is always a step to draw into, so removing the only one empties
      // it rather than leaving the board with nowhere to put an arrow.
      const steps =
        state.steps.length === 1
          ? [emptyStep()]
          : state.steps.filter((_, i) => i !== action.index);
      const activeStep = Math.min(state.activeStep, steps.length - 1);
      return push({ ...state, steps, activeStep }, {
        kind: 'restoreSteps',
        steps: state.steps,
        activeStep: state.activeStep,
      });
    }

    case 'setActiveStep': {
      if (action.index < 0 || action.index >= state.steps.length) return state;
      // Not undoable: looking at another step changes nothing about the play.
      return { ...state, activeStep: action.index };
    }

    case 'clearSteps': {
      if (state.steps.length === 1 && !hasMoves(state.steps[0])) return state;
      return push({ ...state, steps: [emptyStep()], activeStep: 0 }, {
        kind: 'restoreSteps',
        steps: state.steps,
        activeStep: state.activeStep,
      });
    }

    case 'addRunner': {
      const token: Token = {
        id: nextId('runner'),
        type: 'runner',
        label: action.label,
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
        {
          ...state,
          tokens: state.tokens.filter((t) => t.id !== action.id),
          steps: withoutToken(state.steps, action.id),
        },
        { kind: 'addToken', token: state.tokens[index], index, steps: state.steps },
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

    case 'undo':
      return applyUndo(state);

    case 'reset':
      return initialState();

    default:
      return state;
  }
}

/** Is there anything to play? */
export function hasPlay(state: DiagramState): boolean {
  return state.steps.some(hasMoves);
}

/**
 * Where a token stands on screen right now: the start arrangement with every
 * step before the active one laid over it.
 */
export function boardArrangement(state: DiagramState): PositionMap {
  return arrangementBefore(state.tokens, state.steps, state.activeStep);
}

export function capturePositions(tokens: readonly Token[]): PositionMap {
  const positions: PositionMap = {};
  for (const t of tokens) positions[t.id] = { x: t.x, y: t.y };
  return positions;
}

function writeDestination(
  state: DiagramState,
  index: number,
  id: string,
  to: Point,
): DiagramState {
  const step = state.steps[index];
  if (!step) return state;
  const previous = step.moves[id];
  if (previous && previous.x === to.x && previous.y === to.y) return state;
  return push(withStep(state, index, { ...step, moves: { ...step.moves, [id]: to } }), {
    kind: 'restoreDestination',
    step: index,
    id,
    to: previous,
  });
}

function withStep(state: DiagramState, index: number, step: PlayStep): DiagramState {
  return { ...state, steps: state.steps.map((s, i) => (i === index ? step : s)) };
}

/** Drop a token out of every step, so an erased runner leaves no arrows behind. */
function withoutToken(steps: readonly PlayStep[], id: string): PlayStep[] {
  return steps.map((step) => {
    if (!step.moves[id]) return step;
    const moves = { ...step.moves };
    delete moves[id];
    return { ...step, moves };
  });
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
      return {
        ...state,
        undoStack,
        tokens: state.tokens.filter((t) => t.id !== entry.id),
        steps: withoutToken(state.steps, entry.id),
      };
    case 'addToken': {
      const tokens = [...state.tokens];
      tokens.splice(entry.index, 0, entry.token);
      return { ...state, undoStack, tokens, steps: entry.steps };
    }
    case 'restoreDestination': {
      const step = state.steps[entry.step];
      if (!step) return { ...state, undoStack };
      const moves = { ...step.moves };
      if (entry.to) moves[entry.id] = entry.to;
      else delete moves[entry.id];
      return { ...withStep(state, entry.step, { ...step, moves }), undoStack };
    }
    case 'restoreSteps':
      return {
        ...state,
        undoStack,
        steps: entry.steps,
        activeStep: Math.min(entry.activeStep, entry.steps.length - 1),
      };
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
