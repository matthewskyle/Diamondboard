import { PLAYS, PLAY_CATEGORIES, type PlayDef } from '../model/plays';
import {
  POSITIONS,
  POSITION_NAMES,
  POSITION_PLAY_LIMIT,
  playsForPosition,
  roleFor,
} from '../model/roles';

interface Props {
  open: boolean;
  currentId: string | null;
  /** When set, the list narrows to the plays this position has a job in. */
  position: string | null;
  onPositionChange: (position: string | null) => void;
  onSelect: (play: PlayDef) => void;
  onClose: () => void;
}

/**
 * The library of set plays, grouped the way a practice plan is.
 *
 * Parked: nothing renders this. The board is built around drawing your own
 * play in steps, and a shelf of 150 finished ones was answering a different
 * question. It is kept whole — with plays.ts, roles.ts and defense.ts and all
 * their tests — because the situations in it are the valuable part and putting
 * it back is a matter of mounting this component again. Nothing imports it, so
 * none of it ships.
 */
export function PlayLibrary({
  open,
  currentId,
  position,
  onPositionChange,
  onSelect,
  onClose,
}: Props) {
  if (!open) return null;

  const shown = position ? playsForPosition(PLAYS, position) : PLAYS;
  const categories = PLAY_CATEGORIES.filter((c) => shown.some((p) => p.category === c));

  return (
    <div className="library-backdrop" onPointerDown={onClose}>
      <aside
        className="library"
        role="dialog"
        aria-label="Play library"
        onPointerDown={(e) => e.stopPropagation()}
      >
        <header className="library-head">
          <h2>Plays</h2>
          <button type="button" className="pill pill-light" onClick={onClose}>
            Close
          </button>
        </header>

        <div className="position-picker" role="group" aria-label="Filter by position">
          <button
            type="button"
            className="position-chip"
            aria-pressed={position === null}
            onClick={() => onPositionChange(null)}
          >
            All
          </button>
          {POSITIONS.map((label) => (
            <button
              key={label}
              type="button"
              className="position-chip"
              aria-pressed={position === label}
              aria-label={POSITION_NAMES[label]}
              onClick={() => onPositionChange(label)}
            >
              {label}
            </button>
          ))}
        </div>

        {position && (
          <p className="position-summary">
            {POSITION_NAMES[position]} studies the top {Math.min(POSITION_PLAY_LIMIT, shown.length)} plays
            from a library of {PLAYS.length}.
          </p>
        )}

        <div className="library-list">
          {categories.map((category) => (
            <section key={category}>
              <h3>{category}</h3>
              {shown
                .filter((p) => p.category === category)
                .map((play) => (
                  <button
                    key={play.id}
                    type="button"
                    className="library-item"
                    aria-current={play.id === currentId}
                    onClick={() => onSelect(play)}
                  >
                    <span className="library-item-name">{play.name}</span>
                    <span className="library-item-situation">
                      {position ? roleFor(play, position).text : play.situation}
                    </span>
                  </button>
                ))}
            </section>
          ))}
        </div>
      </aside>
    </div>
  );
}
