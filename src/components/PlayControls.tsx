interface Props {
  onReset: () => void;
  onSetStart: () => void;
  onSetEnd: () => void;
  onPlay: () => void;
  onToStart: () => void;
  hasStart: boolean;
  hasEnd: boolean;
  isPlaying: boolean;
}

/** Floats over the bottom-left of the field, clear of the tool bar. */
export function PlayControls({
  onReset,
  onSetStart,
  onSetEnd,
  onPlay,
  onToStart,
  hasStart,
  hasEnd,
  isPlaying,
}: Props) {
  return (
    <div className="play-controls">
      <button type="button" className="pill pill-light" onClick={onReset}>
        New play
      </button>
      <div className="pill-group">
        <button
          type="button"
          className="pill"
          onClick={onSetStart}
          disabled={isPlaying}
          aria-label="Capture the start arrangement"
        >
          Start{hasStart ? ' ✓' : ''}
        </button>
        <button
          type="button"
          className="pill"
          onClick={onSetEnd}
          disabled={isPlaying}
          aria-label="Capture the end arrangement"
        >
          End{hasEnd ? ' ✓' : ''}
        </button>
        <button
          type="button"
          className="pill pill-primary"
          onClick={onPlay}
          disabled={!hasStart || !hasEnd || isPlaying}
        >
          ▶ Play
        </button>
        <button
          type="button"
          className="pill"
          onClick={onToStart}
          disabled={!hasStart || isPlaying}
          aria-label="Return to the start arrangement"
        >
          ⏮
        </button>
      </div>
    </div>
  );
}
