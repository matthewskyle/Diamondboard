interface Props {
  onReset: () => void;
  onRecord: () => void;
  onStop: () => void;
  onPlay: () => void;
  onToStart: () => void;
  hasStart: boolean;
  hasEnd: boolean;
  /** False once the board has moved on from the captured start. */
  canRecord: boolean;
  canStop: boolean;
  isPlaying: boolean;
}

/** Floats over the bottom-left of the field, clear of the tool bar. */
export function PlayControls({
  onReset,
  onRecord,
  onStop,
  onPlay,
  onToStart,
  hasStart,
  hasEnd,
  canRecord,
  canStop,
  isPlaying,
}: Props) {
  // The record button doubles as the status of the recording.
  const recordLabel = !hasStart ? 'Record play' : hasEnd ? 'Recorded ✓' : 'Recording…';
  return (
    <div className="play-controls">
      <button type="button" className="pill pill-light" onClick={onReset}>
        New play
      </button>
      <div className="pill-group">
        <button
          type="button"
          className={hasStart && !hasEnd ? 'pill pill-recording' : 'pill'}
          onClick={onRecord}
          disabled={!canRecord}
          aria-label="Record a play from where the players stand now"
        >
          {recordLabel}
        </button>
        <button
          type="button"
          className="pill"
          onClick={onStop}
          disabled={!canStop}
          aria-label="Stop recording and keep this as the end of the play"
        >
          Stop
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
