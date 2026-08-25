import { PLAYS, PLAY_CATEGORIES, type PlayDef } from '../model/plays';

interface Props {
  open: boolean;
  currentId: string | null;
  onSelect: (play: PlayDef) => void;
  onClose: () => void;
}

/** The library of set plays, grouped the way a practice plan is. */
export function PlayLibrary({ open, currentId, onSelect, onClose }: Props) {
  if (!open) return null;

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

        <div className="library-list">
          {PLAY_CATEGORIES.map((category) => (
            <section key={category}>
              <h3>{category}</h3>
              {PLAYS.filter((p) => p.category === category).map((play) => (
                <button
                  key={play.id}
                  type="button"
                  className="library-item"
                  aria-current={play.id === currentId}
                  onClick={() => onSelect(play)}
                >
                  <span className="library-item-name">{play.name}</span>
                  <span className="library-item-situation">{play.situation}</span>
                </button>
              ))}
            </section>
          ))}
        </div>
      </aside>
    </div>
  );
}
