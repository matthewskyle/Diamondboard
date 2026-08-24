import { BALL_RADIUS, TOKEN_RADIUS } from '../model/fieldGeometry';
import type { Point } from '../model/path';
import type { PositionMap, Token } from '../model/types';

interface Props {
  tokens: readonly Token[];
  /** Live positions from a drag or a running animation, keyed by token id. */
  overrides?: PositionMap | null;
}

export function TokenLayer({ tokens, overrides }: Props) {
  return (
    <g className="tokens" pointerEvents="none">
      {tokens.map((token) => {
        const p: Point = overrides?.[token.id] ?? { x: token.x, y: token.y };
        return <TokenShape key={token.id} token={token} at={p} />;
      })}
    </g>
  );
}

function TokenShape({ token, at }: { token: Token; at: Point }) {
  if (token.type === 'ball') {
    return (
      <g transform={`translate(${at.x} ${at.y})`} className="token token-ball">
        <circle r={BALL_RADIUS} className="tk-ball" />
        <path d={`M ${-BALL_RADIUS * 0.55} -7 Q 0 0 ${-BALL_RADIUS * 0.55} 7`} className="tk-seam" />
        <path d={`M ${BALL_RADIUS * 0.55} -7 Q 0 0 ${BALL_RADIUS * 0.55} 7`} className="tk-seam" />
      </g>
    );
  }

  const isRunner = token.type === 'runner';
  return (
    <g transform={`translate(${at.x} ${at.y})`} className={`token token-${token.type}`}>
      <circle r={TOKEN_RADIUS} className={isRunner ? 'tk-runner' : 'tk-fielder'} />
      {token.label && (
        <text
          className={isRunner ? 'tk-label tk-label-runner' : 'tk-label'}
          textAnchor="middle"
          dominantBaseline="central"
        >
          {token.label}
        </text>
      )}
    </g>
  );
}
