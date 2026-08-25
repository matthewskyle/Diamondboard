import { BASE_SLOTS, SLOT_NAMES, type BaseSlot } from '../model/setup';

interface Props {
  occupied: readonly BaseSlot[];
  onToggle: (slot: BaseSlot) => void;
  onLoadBases: () => void;
  disabled: boolean;
}

/**
 * Setting the situation: tap a base to put a runner on it, tap again to take
 * him off. What used to be pick-the-tool, tap-the-field, switch-back, drag.
 */
export function SetupChips({ occupied, onToggle, onLoadBases, disabled }: Props) {
  const loaded = (['first', 'second', 'third'] as const).every((s) => occupied.includes(s));

  return (
    <div className="setup-chips" role="group" aria-label="Runners on base">
      {BASE_SLOTS.map((slot) => (
        <button
          key={slot}
          type="button"
          className="setup-chip"
          aria-pressed={occupied.includes(slot)}
          aria-label={
            slot === 'batter'
              ? 'Batter at the plate'
              : `Runner on ${SLOT_NAMES[slot]} base`
          }
          disabled={disabled}
          onClick={() => onToggle(slot)}
        >
          {SLOT_NAMES[slot]}
        </button>
      ))}
      <button
        type="button"
        className="setup-chip"
        aria-pressed={loaded}
        aria-label="Load the bases"
        disabled={disabled}
        onClick={onLoadBases}
      >
        Loaded
      </button>
    </div>
  );
}
