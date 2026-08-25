import { PLAYBACK_SPEEDS, type PlaybackSpeed } from '../model/tween';

export type RecordState = 'idle' | 'recording' | 'recorded';

interface Props {
  onOpenLibrary: () => void;
  onReset: () => void;
  onRecord: () => void;
  onPlay: () => void;
  onToStart: () => void;
  recordState: RecordState;
  canPlay: boolean;
  canRewind: boolean;
  speed: PlaybackSpeed;
  onSpeedChange: (speed: PlaybackSpeed) => void;
  isPlaying: boolean;
}

const RECORD_LABEL: Record<RecordState, string> = {
  idle: 'Record',
  recording: 'Recording…',
  // Named for what pressing it does now: throw the old play away and start over.
  recorded: 'Re-record',
};

const RECORD_HINT: Record<RecordState, string> = {
  idle: 'Record a play from where the players stand now',
  recording: 'Recording — move the players, then press Play',
  recorded: 'Discard this play and record a new one',
};

/** Floats over the bottom-left of the field, clear of the tool bar. */
export function PlayControls({
  onOpenLibrary,
  onReset,
  onRecord,
  onPlay,
  onToStart,
  recordState,
  canPlay,
  canRewind,
  speed,
  onSpeedChange,
  isPlaying,
}: Props) {
  // One button that steps through the speeds, so the bar stays thumb-sized.
  const nextSpeed = PLAYBACK_SPEEDS[(PLAYBACK_SPEEDS.indexOf(speed) + 1) % PLAYBACK_SPEEDS.length];
  return (
    <div className="play-controls">
      <div className="pill-group">
        <button type="button" className="pill pill-light" onClick={onOpenLibrary}>
          Plays
        </button>
        <button type="button" className="pill pill-light" onClick={onReset}>
          New
        </button>
      </div>
      <div className="pill-group">
        <button
          type="button"
          className={recordState === 'recording' ? 'pill pill-recording' : 'pill'}
          onClick={onRecord}
          disabled={isPlaying}
          aria-label={RECORD_HINT[recordState]}
        >
          ● {RECORD_LABEL[recordState]}
        </button>
        <button
          type="button"
          className="pill pill-primary"
          onClick={onPlay}
          disabled={!canPlay || isPlaying}
        >
          ▶ Play
        </button>
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
      </div>
    </div>
  );
}
