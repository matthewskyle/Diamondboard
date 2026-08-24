import {
  BASES,
  BASE_SIZE,
  FAIR_TERRITORY_PATH,
  FOUL_POLES,
  HOME,
  HOME_CIRCLE_RADIUS,
  HOME_PLATE_SIZE,
  INFIELD_ARC_PATH,
  INFIELD_DIRT_PATH,
  INFIELD_GRASS_PATH,
  MOUND,
  MOUND_RADIUS,
  OUTFIELD_ARC_PATH,
  RUBBER,
  VIEW_BOX,
} from '../model/fieldGeometry';

const HOME_PLATE_POINTS = (() => {
  const h = HOME_PLATE_SIZE / 2;
  return [
    [-h, -h],
    [h, -h],
    [h, h * 0.3],
    [0, h * 1.3],
    [-h, h * 0.3],
  ]
    .map(([x, y]) => `${HOME.x + x},${HOME.y + y}`)
    .join(' ');
})();

/**
 * The field itself: static, and deliberately inert — every pointer event
 * belongs to the stage above it.
 *
 * One green covers the backdrop, the outfield and the infield, as in the
 * reference; the dirt and the white lines do all the shape work.
 */
export function FieldSurface() {
  return (
    <g className="field" pointerEvents="none">
      <rect x={0} y={0} width={VIEW_BOX.width} height={VIEW_BOX.height} className="fx-grass" />
      <path d={FAIR_TERRITORY_PATH} className="fx-grass" />
      <path d={OUTFIELD_ARC_PATH} className="fx-line fx-fence" />
      <line
        x1={HOME.x}
        y1={HOME.y}
        x2={FOUL_POLES.left.x}
        y2={FOUL_POLES.left.y}
        className="fx-line"
      />
      <line
        x1={HOME.x}
        y1={HOME.y}
        x2={FOUL_POLES.right.x}
        y2={FOUL_POLES.right.y}
        className="fx-line"
      />

      <path d={INFIELD_DIRT_PATH} className="fx-dirt" />
      <path d={INFIELD_GRASS_PATH} className="fx-grass" />
      <path d={INFIELD_ARC_PATH} className="fx-line" />
      <ellipse
        cx={HOME.x}
        cy={HOME.y}
        rx={HOME_CIRCLE_RADIUS.x}
        ry={HOME_CIRCLE_RADIUS.y}
        className="fx-dirt"
      />

      <ellipse
        cx={MOUND.x}
        cy={MOUND.y}
        rx={MOUND_RADIUS.x}
        ry={MOUND_RADIUS.y}
        className="fx-mound"
      />
      <rect
        x={MOUND.x - RUBBER.width / 2}
        y={MOUND.y - RUBBER.height / 2}
        width={RUBBER.width}
        height={RUBBER.height}
        rx={1}
        className="fx-base"
      />

      {[BASES.first, BASES.second, BASES.third].map((base, i) => (
        <rect
          key={i}
          x={-BASE_SIZE / 2}
          y={-BASE_SIZE / 2}
          width={BASE_SIZE}
          height={BASE_SIZE}
          className="fx-base"
          transform={`translate(${base.x} ${base.y}) rotate(45)`}
        />
      ))}
      <polygon points={HOME_PLATE_POINTS} className="fx-base" />
    </g>
  );
}
