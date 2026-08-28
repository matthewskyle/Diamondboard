# Diamondboard

Interactive baseball field for teaching and learning situational baseball.

Draw your own play on a stylized field: hold a player, pull an arrow to where he
goes, and press Play. A play is built in **steps** — everybody with an arrow in
a step breaks at the same time, and the next step does not start until they have
all arrived — so a rundown or a 6-4-3 reads the way it is coached. Built for an
iPad in portrait first, then phone, then desktop.

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

Hold any player and drag: the line out of him is where he goes, and letting go
near a bag or a teammate lands him on it exactly. Tap him without pulling to
take the arrow back off.

Everyone you point in the same step breaks together. When that beat is set,
press **+** in the step bar and draw the next one — the players are now standing
where the last step left them, so the arrows start from the right place. Tap any
step number to go back and rework it.

Press **Play** and the whole thing runs: step 1 together, a beat, step 2, and so
on. The board is back at the start when it finishes, ready to run again — there
is nothing to rewind and nothing to record.

| Tool | What it does |
| --- | --- |
| **Arrow** | Hold a player and drag to where he goes this step. |
| **Select** | Reposition somebody without giving him a move — setting the picture, not the play. |
| **Runner** | Tap the field to drop a runner. |
| **Ball** | Tap to place the ball. Tapping again moves it — there's only one. The ball takes arrows like anyone else, so a throw is a step and a relay is two. |
| **Draw** | Freehand over the field with a finger or an Apple Pencil. |
| **Erase** | Tap a runner, the ball, or a drawing to remove it, arrows and all. Fielders stay. |
| **Undo** | Step back the last change — an arrow, a move, an add, a delete, a stroke. |

The chips above the step bar set the situation: tap a base to put a runner on
it, tap it again to take him off.

**Clear play** drops the arrows and leaves the situation you set up standing.
**New** starts over: default fielders, nobody on, nothing drawn.

The **0.5× / 1× / 2×** button sets the pace. Each step takes 1.5 seconds at 1×.

## Layout

```
src/
  model/          # no React in here — pure logic, all of it unit tested
    fieldGeometry.ts   field dimensions, base and fielder positions, the SVG paths
    diagramState.ts    tokens, strokes, and the undo stack (a reducer)
    steps.ts           the play: steps, the arrangement entering each, playback
    tween.ts           interpolation between two arrangements
    hitTest.ts         what a tap landed on
    path.ts            stroke smoothing and point/segment math
    plays.ts           the 150-play library — built, parked, not mounted
  components/     # FieldSurface (static), FieldStage (pointer input), TokenLayer,
                  # MoveArrowLayer, StrokeLayer, StepBar, Toolbar, PlayControls
  hooks/          # useTween — the requestAnimationFrame transport
```

`fieldGeometry.ts` is the single source of truth for where anything on the field
sits; nothing else hardcodes a coordinate. Its proportions and colors are
measured from the reference diagram — see DECISIONS.md for the model.

The set-play library and the position-study mode are still in the tree with
their tests, but nothing mounts them, so none of it ships — see "The play
library, parked" in DECISIONS.md for why and how to bring it back.

See [SPEC.md](SPEC.md) for the Phase 1 scope and [DECISIONS.md](DECISIONS.md)
for the choices made where the spec left things open.
