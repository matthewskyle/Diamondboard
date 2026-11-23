import { useState } from 'react';
import type { PlaySummary } from '../storage/library';

interface Props {
  plays: readonly PlaySummary[];
  notice: string | null;
  /** False when this build must not write: a newer schema, or a store that throws. */
  canWrite: boolean;
  onSave: (name: string) => boolean;
  onOpen: (id: string) => void;
  onRename: (id: string, name: string) => boolean;
  onDuplicate: (id: string) => void;
  onDelete: (id: string) => void;
  onClose: () => void;
}

/**
 * The on-device shelf. Every action is a button with a 44px target, and the
 * sheet sits above the field so a thumb can reach it on a phone.
 */
export function MyPlays({
  plays,
  notice,
  canWrite,
  onSave,
  onOpen,
  onRename,
  onDuplicate,
  onDelete,
  onClose,
}: Props) {
  const [draft, setDraft] = useState('');
  const [renamingId, setRenamingId] = useState<string | null>(null);
  const [renameDraft, setRenameDraft] = useState('');
  const [armedId, setArmedId] = useState<string | null>(null);

  return (
    <div className="my-plays-backdrop" onPointerDown={onClose}>
      <aside
        className="my-plays"
        role="dialog"
        aria-label="My plays"
        onPointerDown={(event) => event.stopPropagation()}
        onKeyDown={(event) => {
          if (event.key === 'Escape') onClose();
        }}
      >
        <header className="my-plays-head">
          <h2>My plays</h2>
          <button type="button" className="pill" onClick={onClose}>
            Close
          </button>
        </header>

        {notice && (
          <p className="my-plays-notice" role="status">
            {notice}
          </p>
        )}

        {canWrite && (
          <form
            className="my-plays-save"
            onSubmit={(event) => {
              event.preventDefault();
              if (draft.trim().length === 0) return;
              if (onSave(draft)) setDraft('');
            }}
          >
            <input
              className="my-plays-name"
              aria-label="Play name"
              placeholder="Hit and run"
              value={draft}
              maxLength={80}
              autoComplete="off"
              onChange={(event) => setDraft(event.target.value)}
            />
            <button type="submit" className="pill pill-primary" aria-label="Save play" disabled={draft.trim().length === 0}>
              Save
            </button>
          </form>
        )}

        {plays.length === 0 ? (
          <p className="my-plays-empty">Nothing saved yet</p>
        ) : (
          <ul className="my-plays-list">
            {plays.map((play) => (
              <li key={play.id} aria-label={play.name}>
                {renamingId === play.id ? (
                  <form
                    className="my-plays-rename"
                    onSubmit={(event) => {
                      event.preventDefault();
                      if (renameDraft.trim().length === 0) return;
                      if (onRename(play.id, renameDraft)) setRenamingId(null);
                    }}
                  >
                    <input
                      className="my-plays-name"
                      aria-label={`New name for ${play.name}`}
                      value={renameDraft}
                      maxLength={80}
                      autoComplete="off"
                      onChange={(event) => setRenameDraft(event.target.value)}
                    />
                    <button type="submit" className="pill pill-primary" disabled={renameDraft.trim().length === 0}>
                      Save name
                    </button>
                    <button type="button" className="pill" onClick={() => setRenamingId(null)}>
                      Cancel
                    </button>
                  </form>
                ) : (
                  <>
                    <span className="my-plays-play-name">{play.name}</span>
                    <div className="my-plays-actions">
                      <button
                        type="button"
                        className="pill pill-primary"
                        aria-label={`Open ${play.name}`}
                        onClick={() => onOpen(play.id)}
                      >
                        Open
                      </button>
                      {canWrite && (
                        <>
                          <button
                            type="button"
                            className="pill"
                            aria-label={`Rename ${play.name}`}
                            onClick={() => {
                              setRenamingId(play.id);
                              setRenameDraft(play.name);
                              setArmedId(null);
                            }}
                          >
                            Rename
                          </button>
                          <button
                            type="button"
                            className="pill"
                            aria-label={`Duplicate ${play.name}`}
                            onClick={() => onDuplicate(play.id)}
                          >
                            Duplicate
                          </button>
                          {armedId === play.id ? (
                            <button
                              type="button"
                              className="pill"
                              aria-label={`Confirm delete ${play.name}`}
                              onClick={() => onDelete(play.id)}
                            >
                              Delete?
                            </button>
                          ) : (
                            <button
                              type="button"
                              className="pill"
                              aria-label={`Delete ${play.name}`}
                              onClick={() => {
                                setArmedId(play.id);
                                setRenamingId(null);
                              }}
                            >
                              Delete
                            </button>
                          )}
                        </>
                      )}
                    </div>
                  </>
                )}
              </li>
            ))}
          </ul>
        )}
      </aside>
    </div>
  );
}
