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

export type Tool = 'select' | 'addRunner' | 'addBall' | 'ballRoute' | 'pen' | 'erase';

export interface DiagramState {
  tokens: Token[];
  strokes: Stroke[];
  /**
   * Where the ball goes: a self-contained polyline whose first point is where
   * the route starts (seeded from the ball) and whose every later point is one
   * throw or carry. Empty until the coach draws one.
   */
  ballRoute: Point[];
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
  | { kind: 'removeStroke'; id: string }
  | { kind: 'restoreRoute'; route: Point[] };
