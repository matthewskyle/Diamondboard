import { BALL_RADIUS, RUNNER_RADIUS, TOKEN_RADIUS } from '../model/fieldGeometry';
import type { Point } from '../model/path';
import type { PositionMap, Token } from '../model/types';

interface Props {
  tokens: readonly Token[];
  /** Live positions from a drag or a running animation, keyed by token id. */
  overrides?: PositionMap | null;
  /** The position being studied, ringed so a player can follow themselves. */
  highlight?: string | null;
}

export function TokenLayer({ tokens, overrides, highlight }: Props) {
  return (
    <g className="tokens" pointerEvents="none">
      {tokens.map((token) => {
        const p: Point = overrides?.[token.id] ?? { x: token.x, y: token.y };
        return (
          <TokenShape
            key={token.id}
            token={token}
            at={p}
            highlighted={highlight != null && token.label === highlight}
          />
        );
      })}
    </g>
  );
}

function TokenShape({
  token,
  at,
  highlighted,
}: {
  token: Token;
  at: Point;
  highlighted: boolean;
}) {
  const transform = `translate(${at.x} ${at.y})`;

  if (token.type === 'ball') {
    return (
      <g transform={transform} className="token token-ball">
        <circle r={BALL_RADIUS} className="tk-ball" />
        <path d={`M ${-BALL_RADIUS * 0.5} -8 Q 0 0 ${-BALL_RADIUS * 0.5} 8`} className="tk-seam" />
        <path d={`M ${BALL_RADIUS * 0.5} -8 Q 0 0 ${BALL_RADIUS * 0.5} 8`} className="tk-seam" />
      </g>
    );
  }

  // Runners are small red dots, as in the reference — no label to read at a
  // glance, so they never compete with the fielders for attention.
  if (token.type === 'runner') {
    return (
      <g transform={transform} className="token token-runner">
        <circle r={RUNNER_RADIUS} className="tk-runner" />
      </g>
    );
  }

  return (
    <g transform={transform} className="token token-fielder">
      {highlighted && <circle r={TOKEN_RADIUS + 7} className="tk-highlight" />}
      <circle r={TOKEN_RADIUS} className="tk-fielder" />
      <text className="tk-label" textAnchor="middle" dominantBaseline="central">
        {token.label}
      </text>
    </g>
  );
}
