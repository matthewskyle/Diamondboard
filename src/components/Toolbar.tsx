import type { Tool } from '../model/types';
import {
  BallIcon,
  EraseIcon,
  PenIcon,
  RouteIcon,
  RunnerIcon,
  SelectIcon,
  UndoIcon,
} from './ToolIcons';

interface Props {
  tool: Tool;
  onToolChange: (tool: Tool) => void;
  onUndo: () => void;
  canUndo: boolean;
}

const TOOLS: ReadonlyArray<{ tool: Tool; label: string; Icon: () => React.ReactElement }> = [
  { tool: 'select', label: 'Select and move', Icon: SelectIcon },
  { tool: 'addRunner', label: 'Add runner', Icon: RunnerIcon },
  { tool: 'addBall', label: 'Place ball', Icon: BallIcon },
  { tool: 'ballRoute', label: 'Draw where the ball goes', Icon: RouteIcon },
  { tool: 'pen', label: 'Draw', Icon: PenIcon },
  { tool: 'erase', label: 'Erase', Icon: EraseIcon },
];

/** The bottom bar: one row of icon tools, thumb-reachable on an iPad. */
export function Toolbar({ tool, onToolChange, onUndo, canUndo }: Props) {
  return (
    <div className="toolbar" role="toolbar" aria-label="Tools">
      {TOOLS.map(({ tool: t, label, Icon }) => (
        <button
          key={t}
          type="button"
          className="tool-button"
          aria-label={label}
          aria-pressed={tool === t}
          onClick={() => onToolChange(t)}
        >
          <Icon />
        </button>
      ))}
      <button
        type="button"
        className="tool-button"
        aria-label="Undo"
        onClick={onUndo}
        disabled={!canUndo}
      >
        <UndoIcon />
      </button>
    </div>
  );
}
