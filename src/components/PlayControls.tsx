import { PLAYBACK_SPEEDS, type PlaybackSpeed } from '../model/tween';

export type RecordState = 'idle' | 'recording' | 'recorded';

interface Props {
  onOpenLibrary: () => void;
  onReset: () => void;
  onRecord: () => void;
  onStop: () => void;
  onPlay: () => void;
  onToStart: () => void;
  recordState: RecordState;
  canPlay: boolean;
  canRewind: boolean;
  speed: PlaybackSpeed;
  onSpeedChange: (speed: PlaybackSpeed) => void;
  isPlaying: boolean;
  /**
   * True while a play from the library is on the board. A pre-determined play
   * is watched, not built, so the recording, rewind and speed controls stay out
   * of the way until the coach starts a play of their own.
   */
  libraryPlay: boolean;
  /** Set while studying one position: step through that position's plays. */
  study: { label: string; index: number; total: number } | null;
  onStep: (delta: number) => void;
}

const RECORD_LABEL: Record<RecordState, string> = {
  idle: 'Record',
  recording: 'Stop',
  // Named for what pressing it does now: throw the old play away and start over.
  recorded: 'Re-record',
};

const RECORD_HINT: Record<RecordState, string> = {
  idle: 'Record a play from where the players stand now',
  recording: 'Stop recording — save the play and return to the start',
  recorded: 'Discard this play and record a new one',
};

/** Floats over the bottom-left of the field, clear of the tool bar. */
export function PlayControls({
  onOpenLibrary,
  onReset,
  onRecord,
  onStop,
  onPlay,
  onToStart,
  recordState,
  canPlay,
  canRewind,
  speed,
  onSpeedChange,
  isPlaying,
  libraryPlay,
  study,
  onStep,
}: Props) {
  // One button that steps through the speeds, so the bar stays thumb-sized.
  const nextSpeed = PLAYBACK_SPEEDS[(PLAYBACK_SPEEDS.indexOf(speed) + 1) % PLAYBACK_SPEEDS.length];
  const recording = recordState === 'recording';
  return (
    <div className="play-controls">
      {study && (
        <div className="pill-group study-stepper">
          <button
            type="button"
            className="pill"
            onClick={() => onStep(-1)}
            disabled={isPlaying}
            aria-label="Previous play for this position"
          >
            ‹
          </button>
          <span className="study-count">
            {study.label} · {study.index + 1} of {study.total}
          </span>
          <button
            type="button"
            className="pill"
            onClick={() => onStep(1)}
            disabled={isPlaying}
            aria-label="Next play for this position"
          >
            ›
          </button>
        </div>
      )}
      <div className="pill-group">
        <button type="button" className="pill pill-light" onClick={onOpenLibrary}>
          Plays
        </button>
        <button type="button" className="pill pill-light" onClick={onReset}>
          New
        </button>
      </div>
      <div className="pill-group">
        {!libraryPlay && (
          <button
            type="button"
            className={recording ? 'pill pill-recording' : 'pill'}
            onClick={recording ? onStop : onRecord}
            disabled={isPlaying}
            aria-label={RECORD_HINT[recordState]}
          >
            {recording ? '■' : '●'} {RECORD_LABEL[recordState]}
          </button>
        )}
        <button
          type="button"
          className="pill pill-primary"
          onClick={onPlay}
          disabled={!canPlay || isPlaying}
        >
          ▶ Play
        </button>
        {!libraryPlay && (
          <>
            <button
              type="button"
              className="pill"
              onClick={onToStart}
              disabled={!canRewind || isPlaying}
              aria-label="Return to the start of the play"
            >
              ⏮
            </button>
            <button
              type="button"
              className="pill pill-speed"
              onClick={() => onSpeedChange(nextSpeed)}
              disabled={isPlaying}
              aria-label={`Playback speed ${speed}x — tap for ${nextSpeed}x`}
            >
              {speed}×
            </button>
          </>
        )}
      </div>
    </div>
  );
}
