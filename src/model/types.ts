import type { Point } from './path';
import type { PlayStep } from './steps';

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

/** Token id -> position. Used for arrangements and animation frames. */
export type PositionMap = Record<string, Point>;

export type Tool = 'arrow' | 'select' | 'addRunner' | 'addBall' | 'pen' | 'erase';

export interface DiagramState {
  /**
   * The board at the top of the play. Playback never writes here — it runs as
   * an overlay — so the field returns to this arrangement on its own.
   */
  tokens: Token[];
  strokes: Stroke[];
  /**
   * The play, beat by beat. Always at least one step, so there is somewhere to
   * draw the first arrow.
   */
  steps: PlayStep[];
  /** Which step new arrows land in, and which the board is shown entering. */
  activeStep: number;
  undoStack: UndoEntry[];
}

export type UndoEntry =
  | { kind: 'move'; id: string; x: number; y: number }
  | { kind: 'addToken'; token: Token; index: number; steps: PlayStep[] }
  | { kind: 'removeToken'; id: string }
  | { kind: 'addStroke'; stroke: Stroke; index: number }
  | { kind: 'removeStroke'; id: string }
  | {
      kind: 'restoreDestination';
      step: number;
      id: string;
      /** The previous arrow tip, or undefined when there was no arrow. */
      to: Point | undefined;
    }
  /** Coarse restore for anything that reshapes the step list itself. */
  | { kind: 'restoreSteps'; steps: PlayStep[]; activeStep: number };
