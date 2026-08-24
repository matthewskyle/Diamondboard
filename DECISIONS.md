# Phase 1 decisions

Every choice the spec left open, plus the behavioral gaps found while building.
Each one is a default, not a verdict — say the word and it changes.

## Stack

**React + TypeScript + Vite, no backend.** The spec proposed Blazor
WebAssembly. Nothing in Phase 1 touches a server, and everything it does need —
pointer events, `requestAnimationFrame`, SVG — is native to the browser. Blazor
would have added a multi-megabyte runtime download and a JS interop hop for the
two most timing-sensitive paths in the app (dragging and the tween), in exchange
for nothing this phase uses. The C# model shapes in SPEC.md §7 are implemented
as their TypeScript equivalents in `src/model/`.

## Field geometry

The spec deferred the field's proportions to a reference image that isn't in
the repo, so the geometry is derived instead: **real angles, real infield,
compressed outfield** (`src/model/fieldGeometry.ts`).

- **viewBox `0 0 1000 1000`.** Roughly square, because a real field is about as
  wide across the foul poles as it is deep. On an iPad in portrait that fills
  the width and lands near the 70–75% of screen height the spec asks for, with
  the toolbar below it.
- **Angles are real.** The foul lines are a true 90° wedge and the diamond is a
  true square, so anything a coach draws about angles stays honest.
- **Distance from home is piecewise:** real feet × 3.0 units out to 130 ft
  (the infield), then linearly compressed to the fence. So the base paths
  (90 ft), the mound (60 ft 6 in), and the 95-ft infield arc are all to scale,
  while a 400-ft center field still fits on screen. Fence distances come from a
  real profile — 400 ft to center, 330 down the lines.
- **Bases and the rubber are drawn oversized.** A true 15-inch bag would be
  about four units across — invisible. Positions are exact; the marker isn't.
- **Fielders start at real depths and bearings** (`FIELDER_SPOTS`), e.g. the
  shortstop 140 ft out at 18° toward third.

If a reference image turns up, retuning is a one-file job: every constant lives
in `fieldGeometry.ts`, and nothing else hardcodes a coordinate.

## Open items from SPEC.md §11

| Item | Decision |
| --- | --- |
| Add-token UX | Two separate tools, **Runner** and **Ball** — no picker, one tap to place. |
| Pen color and width | One fixed amber stroke, 7 units wide, round caps. |
| Animation duration | **1800 ms**, ease-in-out cubic. Easing is swappable per call; the tween takes it as an argument. |
| Stroke z-order | **Below tokens**, as recommended — tokens stay legible. |
| viewBox and control points | See above. |

## Behavior the spec didn't pin down

- **Fielders can't be erased.** There are always nine, and nothing re-adds a
  specific one. Erase ignores them; it only removes runners, the ball, and
  strokes.
- **There is only ever one ball.** Placing it again relocates the existing one,
  and that relocation undoes like any other move.
- **A drag is one undo step.** Positions update live during the drag but commit
  once on release, so undo steps back a whole move rather than a frame of one.
- **Captures aren't undoable.** "Set start" / "Set end" record a snapshot;
  neither they nor the animation transport (Play, To start) push undo entries.
  Undo is for editing the diagram, not for scrubbing the animation.
- **Play always runs the captured start → end.** It snaps to the start on the
  first frame, so it replays identically no matter where the tokens sit when
  it's pressed.
- **Tokens added after a capture stay put** during playback, per the spec.
- **Runner labels fill the lowest free number.** Delete R1 of R1–R3 and the
  next runner added is R1 again; survivors are never renumbered mid-diagram.
- **Undo depth is 50**, oldest dropped first.
- **Reset** restores the nine default fielders and clears runners, the ball,
  strokes, both captures, and the undo stack.

## Touch targets

The spec's 44 CSS px minimum is enforced at whatever scale the field is drawn:
the hit radius is computed from the SVG's current transform, so it grows on a
phone where a unit is ~0.36 px. Because generous radii overlap, the **nearest**
token wins a tap, with exact ties going to the one drawn on top.

## Deliberately absent

No save/load, no play library, no accounts, no templates, no multi-keyframe
timeline, no landscape-specific layout — all Phase 1 non-goals. State is
in memory only; a refresh resets the board.

The two-state animation is stored separately from the interpolation:
`interpolatePositions()` takes two arbitrary arrangements and knows nothing
about where they came from, so a Phase 2 keyframe list can pick a bracketing
pair and call it unchanged.
