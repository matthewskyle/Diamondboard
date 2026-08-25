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

Measured off the reference diagram, and reproduced in `fieldGeometry.ts` by a
model rather than by transcribing coordinates. Positions are still named in real
feet and real bearings; two projections carry them into the reference's space.

- **viewBox `0 0 1000 1130`.** The field occupies the top half; the green below
  home plate is deliberate, matching the reference's open area above the bar.
- **Radial compression.** Distance from home is real feet × 2.62 units out to
  130 ft, then compressed at 1.275 units/ft. The infield keeps real proportions
  — 90 ft base paths, a 60 ft 6 in mound — while a 450-ft-equivalent center
  field still fits on screen.
- **Vertical squash of 0.78.** The whole field is flattened toward the viewer,
  which is what gives the reference its foreshortened look: the foul lines leave
  home at a 0.78 slope rather than a true 45°, and the diamond reads wider than
  it is deep. Measured off the reference's foul line, which runs 345 px across
  for 267 px up.
- **Both arcs are circles centered on the mound** — the fence at radius 460, the
  top of the infield dirt at 232. The reference's fence arc fits a circle
  centered within five units of its mound, so it is drawn as one. In real terms
  that works out to roughly 325 ft down the lines and a deep center field.
- **Bases and the rubber are drawn oversized.** A true 15-inch bag would be four
  units across. Positions are exact; the marker isn't.
- **Fielders start at depths and bearings read off the reference** — the
  shortstop 169 ft at 15.5° toward third, corner outfielders at 298 ft.

Every constant lives in that one file, and nothing else hardcodes a coordinate,
so the whole field retunes from a single place.

**Colors are sampled from the reference**, not guessed: one green (`#2c483d`)
for the backdrop, the outfield and the infield alike — the dirt (`#a37946`) and
the white lines do all the shape work — plus the near-black button fill
(`#131826`) and the light tool bar (`#e9ebea`).

## Open items from SPEC.md §11

| Item | Decision |
| --- | --- |
| Add-token UX | Two separate tools, **Runner** and **Ball** — no picker, one tap to place. |
| Chrome | A light icon bar across the bottom (select, runner, ball, draw, erase, undo) as in the reference, with the animation controls and **New play** floating over the field above it. |
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
- **Captures aren't undoable.** Record and Stop take a snapshot; neither they
  nor the animation transport (Play, To start) push undo entries. Undo is for
  editing the diagram, not for scrubbing the animation.
- **Record, Stop, Play.** Record snapshots the start. While recording, the same
  button becomes Stop: it stores the current board as the end and rewinds
  everyone to the start, so Play is ready by default. Stopping with nothing
  moved cancels the recording. Play can still close an open recording the old
  way — whatever moved since Record *is* the play — and if nothing has moved
  (just stopped or rewound) the stored play replays rather than collapsing into
  a play where nothing happens. The record button carries the state: Record,
  then Stop, then Re-record.
- **The ball travels its route, not a straight line.** Everything else tweens
  from where it started to where it ended; a ball that did that could never show
  a relay. Instead the coach taps out where the ball goes — each tap snapping to
  the fielder or base under it — and the ball runs those legs at constant speed,
  so a long throw takes longer than a short one. The route is a self-contained
  polyline anchored where it was drawn, so it stays put when the ball moves and
  doesn't trail backwards during playback. It renders whether or not anyone
  presses Play, which is how a coach draws it on a whiteboard anyway.
- **Playback runs at half the old rate by default**, with 0.5×, 1× and 2× on a
  button that steps through them. Full speed reads as a blur when the point is
  to see who went where; the board's original pace is still there as 2×.
- **The ball waits at each stop.** A throw arriving and leaving in the same
  instant reads as the ball glancing off, not as somebody catching it, so the
  ball holds at every intermediate stop — 12% of the playback each, capped at
  45% in total so a long relay stays mostly movement. Fielders keep moving
  through the pause: the ball is what is being caught.
- **A library of 50 set plays**, each with a batter. SPEC.md §1 ruled template plays out of Phase 1;
  that is superseded. Each is written in real feet and bearings — who moves
  where, and where the ball goes — and compiled into the same arrangement and
  route the board already animates, so a library play is not a special case at
  playback. Loading one replaces the board and arrives already recorded, so Play
  is live immediately; it clears the undo stack, since undoing back into a
  previous play would leave a half-merged arrangement nobody asked for.
- **Play always runs the captured start → end.** It snaps to the start on the
  first frame, so it replays identically no matter where the tokens sit when
  it's pressed.
- **Tokens added after a capture stay put** during playback, per the spec.
- **Runners are unlabeled red dots**, smaller than the fielder tokens, as in the
  reference. Nothing to read means they never compete with the position labels
  for attention.
- **Undo depth is 50**, oldest dropped first.
- **New play** (the spec's Reset) restores the nine default fielders and clears
  runners, the ball, strokes, both captures, and the undo stack.

## Learning one position

A player asking "what do I do?" wants a different cut of the same data than a
coach picking a play. Choosing a position filters the library to the plays that
position has a job in, rings their token so they can follow themselves, and puts
prev/next in the dock to walk through them. The shortstop has a job in 28 of the
50; the right fielder in 5.

**Most of the wording is derived, not written.** If the ball comes to you, the
play already knows where it goes next, so "field it and throw to first base"
falls out of the data — and stays correct if the play is ever edited. Covering a
base is the same. What cannot be derived is the rest of the job: charging,
backing up, giving way. Those are written into the play itself, because
inventing them would put words in a coach's mouth. A test asserts no play and
position combination is left on the generic fallback.

The list is grouped by category and the stepper follows that same order, so
"4 of 28" is the fourth play a coach can actually see.

## Rotation

The board's height follows the container's shape instead of being fixed. In
portrait it keeps its full 1130 units, including the open green below home plate
that gives the reference its look. As the container widens, that green — which
is empty, and in landscape would otherwise squeeze the field itself — is cropped
away, down to a floor of 780 units that always clears the catcher's token. No
breakpoints: the height tracks the aspect continuously, so split view and Stage
Manager get the same treatment as a rotation.

On an iPad Air in landscape that takes the field from 57% of the width to 83%,
about 45% larger. Landscape is not a bespoke layout and doesn't fill the screen
— the field's natural shape leaves margins at the sides — but it is usable at a
glance rather than a shrunken portrait board.

Cropping can strand a token that was parked in the open green, so on a crop
anything below the new bottom edge is lifted back into view. It moves through
the same non-undoable bulk write the animation uses: rotating the iPad is not an
edit, and shouldn't cost an undo step.

## Touch targets

The spec's 44 CSS px minimum is enforced at whatever scale the field is drawn:
the hit radius is computed from the SVG's current transform, so it grows on a
phone where a unit is ~0.39 px. Because generous radii overlap, the **nearest**
token wins a tap, with exact ties going to the one drawn on top.

## Shipping as an app

Phase 1 ships as an installable PWA rather than a native build: nothing in the
app needs a native API, and this route costs no developer account, no review,
and no Mac.

- **`display: standalone`** — launches full screen, no browser chrome.
- **Precache everything** (`vite-plugin-pwa`, `generateSW`). The whole app is
  ~257 KB of static assets with no backend, so it can be cached in full and run
  with no network at all. Verified by loading it, cutting the network, reloading
  from the service worker, and dragging a fielder.
- **`autoUpdate`** — a new version installs on the next online launch. There is
  no unsaved work to interrupt, so a prompt would be noise.
- **`black-translucent` status bar**, with `.app` padding for
  `env(safe-area-inset-top)` — the field runs edge to edge under the clock.
- **Icons are rendered from one SVG** at build time, each variant with the safe
  zone its mask wants: maskable icons keep the art inside the middle 80% for the
  circular crop, iOS gets a little margin for its rounded-rect mask.

One consequence worth knowing: installing raises the expectation that work
persists, and nothing does yet. An installed board still opens on the default
arrangement every time. That makes Phase 2 persistence the next thing worth
building, and it is also what a native App Store build would need first.

## Deliberately absent

No save/load, no play library, no accounts, no templates, no multi-keyframe
timeline, no landscape-specific layout — all Phase 1 non-goals. State is
in memory only; a refresh resets the board.

The two-state animation is stored separately from the interpolation:
`interpolatePositions()` takes two arbitrary arrangements and knows nothing
about where they came from, so a Phase 2 keyframe list can pick a bracketing
pair and call it unchanged.
