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

## Installing it on an iPad

Diamondboard is a progressive web app, so it installs from the browser with no
App Store involved:

1. Open the deployed URL in Safari.
2. Share → **Add to Home Screen**.

It then launches full screen with no browser chrome, and **runs entirely
offline** — every asset is precached on first visit, so it works on a field with
no signal. Updates install themselves the next time it is opened online.

Hosting needs to be HTTPS (service workers require it; `localhost` is exempt).
`.github/workflows/deploy.yml` publishes `dist/` to GitHub Pages on every push
to `main` — enable it once under Settings → Pages → Source: GitHub Actions.

## Using it

| Tool | What it does |
| --- | --- |
| **Move** | Drag any player, runner, or the ball. |
| **Runner** | Tap the field to drop a runner. |
| **Ball** | Tap to place the ball. Tapping again moves it — there's only one. |
| **Draw** | Freehand over the field with a finger or an Apple Pencil. |
| **Erase** | Tap a runner, the ball, or a drawing to remove it. Fielders stay. |
| **Route** | Tap where the ball goes, stop by stop. |
| **Undo** | Step back the last change — a move, an add, a delete, a stroke. |
| **New play** | Clear runners, the ball and drawings, and send the fielders home. |

To animate: press **Record**, move the players where they should end up, then
press **Play** — whatever moved is the play. The rewind button puts everyone
back at the start.

To show the ball travelling, pick the route tool and tap each place it goes —
the fielder, the bag, the plate. Taps snap to whatever is under them, and the
ball runs the legs in order when the play runs, pausing at each stop the way a
fielder actually handles it.

The **0.5× / 1× / 2×** button sets the pace. 1× is the default; 2× is the rate
the board originally ran at.

**Plays** opens a library of 50 situations a 10-11U team should know, from a 6-3
to playing a ball off the wall. Pick one and press Play.

## Layout

```
src/
  model/          # no React in here — pure logic, all of it unit tested
    fieldGeometry.ts   field dimensions, base and fielder positions, the SVG paths
    diagramState.ts    tokens, strokes, and the undo stack (a reducer)
    tween.ts           interpolation between two arrangements, and along a route
    plays.ts           the 25-play library, and the compiler that loads one
    hitTest.ts         what a tap landed on
    path.ts            stroke smoothing and point/segment math
  components/     # FieldSurface (static), FieldStage (pointer input), TokenLayer,
                  # StrokeLayer, Toolbar, PlayControls, ToolIcons
  hooks/          # useTween — the requestAnimationFrame transport
```

`fieldGeometry.ts` is the single source of truth for where anything on the field
sits; nothing else hardcodes a coordinate. Its proportions and colors are
measured from the reference diagram — see DECISIONS.md for the model.

See [SPEC.md](SPEC.md) for the Phase 1 scope and [DECISIONS.md](DECISIONS.md)
for the choices made where the spec left things open.
