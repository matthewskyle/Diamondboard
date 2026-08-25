/**
 * Toolbar glyphs. Drawn rather than set in type so they stay crisp and
 * consistent across platforms — emoji render differently on every device.
 */
const STROKE = {
  fill: 'none',
  stroke: 'currentColor',
  strokeWidth: 1.8,
  strokeLinecap: 'round',
  strokeLinejoin: 'round',
} as const;

function Icon({ children }: { children: React.ReactNode }) {
  return (
    <svg viewBox="0 0 24 24" width="24" height="24" aria-hidden="true" focusable="false">
      {children}
    </svg>
  );
}

export function SelectIcon() {
  return (
    <Icon>
      <path d="M6 3 L18.5 11.2 L12.6 12.4 L15.4 19 L12.8 20 L10.1 13.6 L6 17.4 Z" {...STROKE} />
    </Icon>
  );
}

export function RunnerIcon() {
  return (
    <Icon>
      <circle cx="12" cy="12" r="5.5" fill="currentColor" />
    </Icon>
  );
}

export function BallIcon() {
  return (
    <Icon>
      <circle cx="12" cy="12" r="6.5" {...STROKE} />
      <path d="M8.2 7.4 Q10.4 12 8.2 16.6" {...STROKE} />
      <path d="M15.8 7.4 Q13.6 12 15.8 16.6" {...STROKE} />
    </Icon>
  );
}

export function PenIcon() {
  return (
    <Icon>
      <path d="M4 20 L5 16 L16.5 4.5 A2.1 2.1 0 0 1 19.5 7.5 L8 19 Z" {...STROKE} />
    </Icon>
  );
}

export function UndoIcon() {
  return (
    <Icon>
      <path d="M9 7 L4.5 11 L9 15" {...STROKE} />
      <path d="M4.5 11 H14 A5 5 0 0 1 14 21 H10" {...STROKE} />
    </Icon>
  );
}

export function EraseIcon() {
  return (
    <Icon>
      <path d="M8.5 19 L4 14.5 A1.8 1.8 0 0 1 4 12 L12 4 A1.8 1.8 0 0 1 14.5 4 L20 9.5 A1.8 1.8 0 0 1 20 12 L13 19 Z" {...STROKE} />
      <path d="M8.5 19 H20" {...STROKE} />
    </Icon>
  );
}

export function RouteIcon() {
  return (
    <Icon>
      <path d="M4 18 L11 18" {...STROKE} strokeDasharray="3 3" />
      <path d="M11 18 L18 7" {...STROKE} strokeDasharray="3 3" />
      <path d="M14.4 6.2 L18.6 6 L18.4 10.2" {...STROKE} />
      <circle cx="4" cy="18" r="2" fill="currentColor" />
    </Icon>
  );
}
