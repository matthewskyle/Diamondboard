import { useLayoutEffect, useRef, useState } from 'react';
import type { PlaySummary, PracticeQueue } from '../storage/library';

interface Props {
  queue: PracticeQueue | null;
  plays: readonly PlaySummary[];
  notice: string | null;
  onSave: (queue: PracticeQueue) => boolean;
  onStart: () => void;
  onClose: () => void;
}

export function PracticeQueueSheet({ queue, plays, notice, onSave, onStart, onClose }: Props) {
  const dialog = useRef<HTMLDialogElement>(null);
  const [name, setName] = useState(queue?.name ?? '');
  const [selected, setSelected] = useState('');
  const names = new Map(plays.map((play) => [play.id, play.name]));

  useLayoutEffect(() => {
    const sheet = dialog.current;
    if (!sheet) return;
    sheet.showModal();
    return () => sheet.close();
  }, []);

  const remove = (index: number) => {
    if (!queue) return;
    const { activeIndex } = queue;
    onSave({
      ...queue,
      playIds: queue.playIds.filter((_, entry) => entry !== index),
      activeIndex: activeIndex === null || activeIndex === index
        ? null
        : activeIndex - Number(index < activeIndex),
    });
  };

  const move = (from: number, to: number) => {
    if (!queue) return;
    const playIds = queue.playIds.slice();
    [playIds[from], playIds[to]] = [playIds[to], playIds[from]];
    const { activeIndex } = queue;
    onSave({
      ...queue,
      playIds,
      activeIndex: activeIndex === from ? to : activeIndex === to ? from : activeIndex,
    });
  };

  return (
    <dialog
      ref={dialog}
      className="my-plays practice-dialog"
      aria-label="Practice queue"
      onCancel={(event) => {
        event.preventDefault();
        onClose();
      }}
    >
      <header className="my-plays-head">
        <h2>Practice queue</h2>
        <button type="button" className="pill" onClick={onClose}>Close</button>
      </header>
      {notice && <p className="my-plays-notice" role="status">{notice}</p>}
      {queue && (
        <>
          <form className="my-plays-save" onSubmit={(event) => {
            event.preventDefault();
            if (onSave({ ...queue, name })) setName(name.trim());
          }}>
            <input
              className="my-plays-name"
              aria-label="Queue name"
              value={name}
              maxLength={80}
              autoComplete="off"
              onChange={(event) => setName(event.target.value)}
            />
            <button type="submit" className="pill" disabled={!name.trim() || name.trim() === queue.name}>
              Save name
            </button>
          </form>
          {plays.length > 0 ? (
            <form className="my-plays-save" onSubmit={(event) => {
              event.preventDefault();
              if (names.has(selected)) {
                onSave({ ...queue, playIds: [...queue.playIds, selected] });
              }
            }}>
              <select
                className="my-plays-name"
                aria-label="Saved play"
                value={selected}
                onChange={(event) => setSelected(event.target.value)}
              >
                <option value="" disabled>Choose from My plays</option>
                {plays.map((play) => <option key={play.id} value={play.id}>{play.name}</option>)}
              </select>
              <button type="submit" className="pill" disabled={!names.has(selected)}>Add to queue</button>
            </form>
          ) : (
            <p className="my-plays-empty">Save a board in My plays to add it here.</p>
          )}
          {queue.playIds.length > 0 && (
            <>
              <ol className="my-plays-list">
                {queue.playIds.map((id, index) => {
                  const title = names.get(id) ?? 'Saved play';
                  return (
                    <li key={`${id}-${index}`} aria-current={index === queue.activeIndex ? 'step' : undefined}>
                      <span className="my-plays-play-name">{index + 1}. {title}</span>
                      <div className="my-plays-actions">
                        <button type="button" className="pill" aria-label={`Move ${title} up`} disabled={index === 0} onClick={() => move(index, index - 1)}>
                          Up
                        </button>
                        <button type="button" className="pill" aria-label={`Move ${title} down`} disabled={index === queue.playIds.length - 1} onClick={() => move(index, index + 1)}>
                          Down
                        </button>
                        <button type="button" className="pill" aria-label={`Remove ${title}`} onClick={() => remove(index)}>
                          Remove
                        </button>
                      </div>
                    </li>
                  );
                })}
              </ol>
              <button type="button" className="pill pill-primary practice-start" onClick={onStart}>
                {queue.activeIndex === null ? 'Start practice' : 'Restart practice'}
              </button>
            </>
          )}
        </>
      )}
    </dialog>
  );
}

export function PracticeNavigation({
  queue,
  notice,
  onSelect,
}: {
  queue: PracticeQueue;
  notice: string | null;
  onSelect: (index: number) => void;
}) {
  const { activeIndex, playIds, name } = queue;
  if (activeIndex === null) return null;

  return (
    <div className="practice-session" role="group" aria-label={name}>
      <button type="button" className="pill" aria-label="Previous practice play" disabled={activeIndex === 0} onClick={() => onSelect(activeIndex - 1)}>
        Prev
      </button>
      <div className="practice-progress">
        <strong title={name}>{name}</strong>
        <span role="status" aria-label="Practice position">{activeIndex + 1} / {playIds.length}</span>
        {notice && <span role="alert">{notice}</span>}
      </div>
      <button type="button" className="pill" aria-label="Next practice play" disabled={activeIndex === playIds.length - 1} onClick={() => onSelect(activeIndex + 1)}>
        Next
      </button>
    </div>
  );
}
