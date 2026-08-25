import { POSITION_NAMES, rolesForPlay } from '../model/roles';
import type { PlayDef } from '../model/plays';

interface Props {
  play: PlayDef;
  /** When studying one position, that row is emphasized. */
  highlight: string | null;
}

/** Full nine-player breakdown: what each position does on this play, and why. */
export function PlayRoleList({ play, highlight }: Props) {
  const roles = rolesForPlay(play);
  return (
    <div className="play-roles" aria-label="What each position does">
      {roles.map(({ label, role }) => (
        <div
          key={label}
          className={
            highlight === label
              ? 'play-role play-role-active'
              : role.involved
                ? 'play-role'
                : 'play-role play-role-support'
          }
        >
          <span className="play-role-label" title={POSITION_NAMES[label]}>
            {label}
          </span>
          <span className="play-role-text">{role.text}</span>
        </div>
      ))}
    </div>
  );
}
