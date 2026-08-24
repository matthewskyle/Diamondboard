# Baseball Field Diagram — Phase 1 Spec

**Stack:** Blazor WebAssembly (.NET), SVG rendering, no backend.
**Target devices (priority order):** iPad (Safari) → phone → desktop. Portrait-first.
**Persistence:** None this phase. All state is in-memory client-side.

---

## 1. Product summary

A single-screen web app showing a stylized baseball field. Coaches drag player/runner/ball
tokens around the field to teach positioning and situations, can freehand-draw over the field
with a pen tool, and can trigger an on-demand animation that tweens tokens from a start
arrangement to an end arrangement.

This is a **client-only** app. Nothing is saved or loaded from a server. Refreshing the page
resets to the default arrangement.

### In scope (Phase 1)
- Stylized field rendering matching the reference look (see §3).
- Nine fielder tokens (P, C, 1B, 2B, SS, 3B, LF, CF, RF), draggable.
- Baserunner tokens (red) and a ball token, add/remove and draggable.
- Freehand pen/draw tool with undo and erase.
- On-demand animation: capture a start state and an end state, then play the tween.
- Toolbar: select, add-token, pen, undo, erase, reset, and animation controls.

### Out of scope (Phase 1 — do NOT build)
- Save/load, "My plays" library, accounts, sharing links, any backend or database.
- Pre-determined/template plays.
- Multi-keyframe timelines (Phase 1 animation is exactly two states: start → end).
- Realistic field geometry (Phase 1 uses the stylized proportions from the reference).

---

## 2. Coordinate system & field scale

**Decision (confirmed):** match the *stylized* proportions from the reference images, not
real-world feet. The reference compresses the outfield so the whole field fits a portrait screen.

- Use a fixed **SVG viewBox** as the logical coordinate space (e.g. `0 0 1000 1400`,
  portrait). All token positions, field geometry, and drawing paths are expressed in these
  viewBox units. The SVG scales to the container via `preserveAspectRatio="xMidYMid meet"`.
- This keeps every device pixel-independent: one coordinate space, CSS-scaled to fit.
- **Field geometry constants live in one shared file** (see §7, FieldGeometry) so the
  rendering agent and the interaction agent agree on where home plate, bases, mound, and
  the infield arc are.

> ⚠️ The exact viewBox dimensions and the field control points must be finalized against the
> reference image before rendering work locks. Do not hardcode magic numbers scattered across
> files — all of it goes in `FieldGeometry`.

---

## 3. Field visual spec (from reference)

Portrait field, occupying roughly the top 70–75% of the screen; toolbar below.

Layers, back to front:
1. **Background** — dark desaturated green (outfield grass). Fills the field area.
2. **Outfield arc** — white arc (foul-pole to foul-pole) bounding the outfield.
3. **Foul lines** — two white lines from home plate out through 1B and 3B to the arc.
4. **Infield dirt** — tan/brown filled region: the classic infield "shell" (arc across the
   top of the infield) plus the base-path cutouts and the home-plate circle.
5. **Infield grass diamond** — green diamond inside the dirt, inset from the base paths.
6. **Bases** — white squares at 1B/2B/3B (diamond-oriented), white home plate at bottom.
7. **Pitcher's mound** — small tan circle at center with the rubber.
8. **Tokens** (topmost) — see §4.

Colors (approximate, tune to reference):
- Grass green: dark muted green.
- Dirt: tan/khaki brown.
- Lines/bases: white.
- Fielder tokens: white fill, dark text, subtle border/shadow.
- Runner tokens: red fill.
- Ball: small white circle with seam detail (or simple white dot Phase 1).

Field is **static** (not interactive itself) — only tokens and pen strokes are interactive.

---

## 4. Tokens (entities)

A token is a draggable object on the field.

| Type      | Visual                    | Label        | Count (default)      |
|-----------|---------------------------|--------------|----------------------|
| Fielder   | White circle, dark label  | P,C,1B,2B,SS,3B,LF,CF,RF | 9, at standard spots |
| Runner    | Red circle                | none / R     | 0 default, add on demand |
| Ball      | White ball icon           | none         | 0 or 1               |

Token requirements:
- **Touch target ≥ 44×44 CSS px** regardless of visual size (iPad/phone ergonomics).
- Draggable via pointer events (unified mouse/touch/pen — see §5).
- Fielders start at standard stylized positions (defined in `FieldGeometry`).
- Runners and ball are added via the add-token tool and removed via erase.
- Each token has a stable `Id`, a `Type`, an optional `Label`, and an `(X,Y)` position in
  viewBox units.

---

## 5. Interaction model

**All pointer input uses the Pointer Events API** (`pointerdown`/`pointermove`/`pointerup`,
with `setPointerCapture`). This unifies mouse, touch, and Apple Pencil and is the reliable
path on iPad Safari. Do **not** use mouse-only or touch-only event handlers.

iPad Safari specifics the interaction agent must handle:
- Call `preventDefault` / use `touch-action: none` on the field surface to stop the page
  from scrolling or pinch-zooming while dragging a token or drawing.
- Test that a two-finger gesture doesn't hijack a single-finger drag.
- Ensure tokens don't trigger text selection or the iOS callout menu on long-press.

### Tools (mutually exclusive active tool)
1. **Select/Move** (default) — drag tokens. Tapping empty space deselects.
2. **Add token** — tap to place a new runner (default) or ball. (UI to pick which; simplest:
   an add-runner and an add-ball affordance.)
3. **Pen/Draw** — freehand drawing (see §6).
4. **Erase** — tap a token or a drawn stroke to delete it.
5. **Undo** — reverts the last mutating action (move, add, delete, draw stroke).
6. **Reset** — returns fielders to default positions, clears runners/ball/drawings.

Animation controls (see §8) live in the toolbar as well.

---

## 6. Pen / draw tool

- While the pen tool is active, `pointerdown` starts a stroke; `pointermove` appends points;
  `pointerup` finalizes it. Render as an SVG `<path>` (smoothed polyline is fine Phase 1).
- Strokes are stored as a list of point arrays in viewBox coordinates, so they scale with
  the field.
- Single stroke color/width Phase 1 (e.g. yellow, medium). Multiple colors optional/later.
- Erase tool removes a whole stroke on tap. Undo removes the most recent stroke.
- Strokes render above the field but below tokens **or** above tokens — pick one and keep it
  consistent (recommend below tokens so tokens stay legible).

---

## 7. State & architecture

Client-only, so state is a plain in-memory model held by a singleton service and rendered by
components. Suggested shape (C#):

```csharp
public enum TokenType { Fielder, Runner, Ball }

public record Token
{
    public string Id { get; init; }
    public TokenType Type { get; init; }
    public string? Label { get; init; }
    public double X { get; set; }   // viewBox units
    public double Y { get; set; }
}

public record Stroke
{
    public string Id { get; init; }
    public List<(double X, double Y)> Points { get; init; } = new();
}

public class DiagramState
{
    public List<Token> Tokens { get; } = new();
    public List<Stroke> Strokes { get; } = new();
    // Undo stack of reversible actions (move/add/delete/draw).
}
```

- **FieldGeometry** (static/shared): viewBox size, field path control points, default fielder
  positions, base/mound coordinates. Single source of truth consumed by rendering AND
  interaction. This is the contract that lets the two agents work in parallel.
- **DiagramStateService**: holds `DiagramState`, exposes mutating methods
  (`MoveToken`, `AddToken`, `RemoveToken`, `AddStroke`, `RemoveStroke`, `Undo`, `Reset`)
  and raises change notifications so components re-render.
- **Undo**: each mutating method pushes an inverse action onto an undo stack. Phase 1 undo
  depth can be modest but should cover the common flow.

---

## 8. Animation (on-demand, two-state)

Phase 1 animation is deliberately simple: **a start arrangement and an end arrangement**, and
a play button that tweens between them.

Flow:
1. Coach arranges tokens → **"Set Start"** captures every token's position as the start state.
2. Coach re-arranges tokens → **"Set End"** captures the end state.
3. **Play** interpolates each token from its start `(X,Y)` to its end `(X,Y)` over a fixed
   duration (e.g. 1.5–2.5s), then leaves tokens at the end state.
4. **Reset-to-start** returns tokens to the captured start.

Implementation:
- Drive the tween with `requestAnimationFrame` via a small JS interop helper (a
  monotonic timer C# can poll works too; rAF is smoother). On each frame compute
  `t = elapsed / duration` clamped to `[0,1]`, lerp each token, notify render.
- Linear interpolation is acceptable Phase 1; ease-in/out is a nice-to-have.
- Tokens without a captured start/end (e.g. added after capture) just stay put.
- Pen strokes are static during animation (they don't move).

> This two-state model is intentionally forward-compatible with the Phase-2 keyframe/timeline
> model (a two-state tween is just two keyframes). Keep the interpolation logic separate from
> the "two states" storage so Phase 2 can swap in an N-keyframe list without rewriting the
> tweener.

---

## 9. Layout & responsive behavior

- **Portrait-first.** Field fills the top region; toolbar pinned at the bottom (thumb-reachable
  on iPad/phone). Matches the reference.
- Field SVG scales to available width, preserving aspect ratio; letterbox vertically if needed.
- Toolbar is a horizontal row of icon buttons; targets ≥ 44px. Secondary buttons
  ("New Play"/"Reset", animation set/play) grouped clearly.
- Landscape and desktop: acceptable to simply center the portrait field with side margins
  Phase 1. Don't over-invest in landscape layout.

---

## 10. Parallel workstreams (for independent agents)

These are designed to minimize collision. The **shared contract is `FieldGeometry` + the
`DiagramStateService` interface** — agree on those signatures first, then agents work
independently against them.

### Workstream A — Field rendering (SVG)
Owns: the static field SVG component; all field geometry constants in `FieldGeometry`;
colors/styling to match the reference. Deliverable: a `<FieldSurface>` component that renders
the field from `FieldGeometry` with correct stylized proportions. No interactivity.
**Depends on:** nothing. Can start immediately. Publishes `FieldGeometry`.

### Workstream B — State service & undo
Owns: `DiagramState`, `Token`, `Stroke`, `DiagramStateService` with all mutating methods +
undo/reset + change notification. Deliverable: the service with unit tests, no UI.
**Depends on:** the model shapes in §7. Can start immediately.

### Workstream C — Token drag & interaction
Owns: rendering tokens on top of the field; pointer-event drag with capture; select/move tool;
add/remove tokens; iPad Safari touch handling (§5). Consumes `FieldGeometry` (A) for default
positions and `DiagramStateService` (B) for mutations.
**Depends on:** A's `FieldGeometry` contract, B's service interface. Can stub both to start.

### Workstream D — Pen/draw + erase
Owns: pen tool stroke capture, SVG path rendering, erase-stroke, undo-stroke wiring.
Consumes `DiagramStateService` (B) for stroke storage/undo.
**Depends on:** B's `Stroke` API. Can stub to start.

### Workstream E — Animation engine
Owns: start/end capture, rAF tween loop + JS interop helper, play/reset-to-start, keeping
interpolation decoupled from state storage (§8). Consumes `DiagramStateService` (B) for token
positions.
**Depends on:** B's token access. Can stub to start.

### Workstream F — Toolbar & app shell / layout
Owns: the responsive portrait layout, toolbar with tool selection (active-tool state), wiring
buttons to the active tool and to services, animation controls placement. Integrates A–E.
**Depends on:** everything's public surface; this is the integration seam. Define the
active-tool enum early so C/D/E know how they're activated.

### Suggested integration order
1. Lock `FieldGeometry` (A) and `DiagramStateService` interface (B) signatures — this is the
   contract meeting.
2. A, B, C, D, E build against those in parallel.
3. F integrates as pieces land.

---

## 11. Open items to confirm before/while building
- Exact viewBox dimensions and field control points (finalize against the reference image).
- Add-token UX: how the coach chooses runner vs. ball (two buttons vs. a picker).
- Pen color/width Phase 1 (single fixed, or a small palette?).
- Animation duration and whether ease-in/out is wanted Phase 1.
- Stroke z-order relative to tokens (recommended: below tokens).

None of these block starting Workstreams A and B.
