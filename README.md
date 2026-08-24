# Diamondboard

Interactive baseball field for teaching and learning situational baseball.

Drag the nine fielders, runners, and the ball around a stylized field, draw over
it with a pen, and play a two-state animation to show how a situation develops.
Built for an iPad in portrait first, then phone, then desktop.

## Running it

```sh
npm install
npm run dev      # http://localhost:5173
npm test         # unit tests
npm run build    # production build into dist/
```

No backend, no accounts, nothing saved: the app is entirely client-side and a
refresh returns the board to its default arrangement.

## Using it

| Tool | What it does |
| --- | --- |
| **Move** | Drag any player, runner, or the ball. |
| **Runner** | Tap the field to drop a runner (R1, R2, …). |
| **Ball** | Tap to place the ball. Tapping again moves it — there's only one. |
| **Draw** | Freehand over the field with a finger or an Apple Pencil. |
| **Erase** | Tap a runner, the ball, or a drawing to remove it. Fielders stay. |
| **Undo** / **Reset** | Step back the last change, or start over. |

To animate: arrange the players and press **Set start**, move them where they
should end up and press **Set end**, then **Play**. **To start** puts everyone
back on the start arrangement.

## Layout

```
src/
  model/          # no React in here — pure logic, all of it unit tested
    fieldGeometry.ts   field dimensions, base and fielder positions, the SVG paths
    diagramState.ts    tokens, strokes, and the undo stack (a reducer)
    tween.ts           interpolation between two arrangements
    hitTest.ts         what a tap landed on
    path.ts            stroke smoothing and point/segment math
  components/     # FieldSurface (static), FieldStage (pointer input), TokenLayer,
                  # StrokeLayer, Toolbar
  hooks/          # useTween — the requestAnimationFrame transport
```

`fieldGeometry.ts` is the single source of truth for where anything on the field
sits; nothing else hardcodes a coordinate.

See [SPEC.md](SPEC.md) for the Phase 1 scope and [DECISIONS.md](DECISIONS.md)
for the choices made where the spec left things open.
