import type { Point } from './path';

export type TokenType = 'fielder' | 'runner' | 'ball';

export interface Token {
  id: string;
  type: TokenType;
  /** Fielders show a position label; runners and the ball are unlabeled. */
  label?: string;
  x: number;
  y: number;
}

export interface Stroke {
  id: string;
  points: Point[];
}

/** Token id -> position. Used for animation start/end capture. */
export type PositionMap = Record<string, Point>;

export type Tool = 'select' | 'addRunner' | 'addBall' | 'pen' | 'erase';

export interface DiagramState {
  tokens: Token[];
  strokes: Stroke[];
  /** Captured animation states. Null until the coach captures them. */
  start: PositionMap | null;
  end: PositionMap | null;
  undoStack: UndoEntry[];
}

export type UndoEntry =
  | { kind: 'move'; id: string; x: number; y: number }
  | { kind: 'addToken'; token: Token; index: number }
  | { kind: 'removeToken'; id: string }
  | { kind: 'addStroke'; stroke: Stroke; index: number }
  | { kind: 'removeStroke'; id: string };
