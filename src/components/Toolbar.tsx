import type { Tool } from '../model/types';

interface Props {
  tool: Tool;
  onToolChange: (tool: Tool) => void;
  onUndo: () => void;
  onReset: () => void;
  canUndo: boolean;
  onSetStart: () => void;
  onSetEnd: () => void;
  onPlay: () => void;
  onToStart: () => void;
  hasStart: boolean;
  hasEnd: boolean;
  isPlaying: boolean;
}

const TOOLS: ReadonlyArray<{ tool: Tool; label: string; text: string }> = [
  { tool: 'select', label: 'Select and move', text: 'Move' },
  { tool: 'addRunner', label: 'Add runner', text: 'Runner' },
  { tool: 'addBall', label: 'Place ball', text: 'Ball' },
  { tool: 'pen', label: 'Draw', text: 'Draw' },
  { tool: 'erase', label: 'Erase', text: 'Erase' },
];

export function Toolbar({
  tool,
  onToolChange,
  onUndo,
  onReset,
  canUndo,
  onSetStart,
  onSetEnd,
  onPlay,
  onToStart,
  hasStart,
  hasEnd,
  isPlaying,
}: Props) {
  return (
    <div className="toolbar">
      <div className="tool-group" role="group" aria-label="Tools">
        {TOOLS.map(({ tool: t, label, text }) => (
          <button
            key={t}
            type="button"
            className="tool-button"
            aria-label={label}
            aria-pressed={tool === t}
            onClick={() => onToolChange(t)}
          >
            {text}
          </button>
        ))}
      </div>

      <div className="tool-group" role="group" aria-label="Edit">
        <button type="button" className="tool-button" onClick={onUndo} disabled={!canUndo}>
          Undo
        </button>
        <button type="button" className="tool-button" onClick={onReset}>
          Reset
        </button>
      </div>

      <div className="tool-group" role="group" aria-label="Animation">
        <button type="button" className="tool-button" onClick={onSetStart} disabled={isPlaying}>
          Set start{hasStart ? ' ✓' : ''}
        </button>
        <button type="button" className="tool-button" onClick={onSetEnd} disabled={isPlaying}>
          Set end{hasEnd ? ' ✓' : ''}
        </button>
        <button
          type="button"
          className="tool-button tool-button-primary"
          onClick={onPlay}
          disabled={!hasStart || !hasEnd || isPlaying}
        >
          ▶ Play
        </button>
        <button
          type="button"
          className="tool-button"
          onClick={onToStart}
          disabled={!hasStart || isPlaying}
        >
          ⏮ To start
        </button>
      </div>
    </div>
  );
}
