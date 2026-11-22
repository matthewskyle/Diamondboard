# AGENTS.md

## Cursor Cloud specific instructions

Diamondboard is a home-screen PWA for coaches and players. It must work on iPad and iPhone in Safari and Brave. Launch target: Monday, February 1, 2027. It is a single, fully client-side Vite + React + TypeScript app — there is no backend, database, accounts, or environment variables. Running the one dev server exercises the product end to end.

Dependencies are refreshed automatically on startup (`npm ci`), so you do not need to install them manually. Standard commands live in `package.json` and `README.md`; use those rather than duplicating them here:

- Dev server: `npm run dev` (Vite, http://localhost:5173) — run it as a long-lived process (e.g. a tmux-backed terminal), not in `install`.
- Lint: `npm run lint` (oxlint)
- Typecheck: `npm run typecheck` (`tsc -b`)
- Unit: `npm run unit` (Vitest, `src/**/*.test.ts`; `npm test` is the same command; the model layer under `src/model/` is fully unit-tested)
- Build: `npm run build` (`tsc -b && vite build`); preview a built `dist/` with `npm run preview` (http://localhost:4173).
- E2E: `npm run e2e` (production build, then Playwright WebKit on iPad and iPhone). CI runs this as the `e2e-webkit` check (`.github/workflows/e2e.yml`).

Non-obvious notes:

- CI (`.github/workflows/ci.yml`) runs `lint`, `typecheck`, `unit`, and `build` as separate jobs on pull requests and on pushes to `main` (Ubuntu, Node 22). `.github/workflows/e2e.yml` runs `e2e-webkit`. `.github/workflows/deploy.yml` publishes `dist/` to GitHub Pages only after the CI run has succeeded on `main`. Make sure `lint`, `typecheck`, `unit`, `build`, and `e2e` pass before considering a change complete.
- Intended auto-merge for `main`: required checks must be green, and a failing check must not merge. The main-branch ruleset is not live yet — it still needs Kyle's admin action — so this is the planned rule, not something already enforced.
- Fielders, runners, the ball, and freehand strokes are draggable and editable with the selection/pointer tool. Hold a player and drag to give him a move.
- The service worker (`vite-plugin-pwa`) only activates in a built/previewed app over HTTPS (localhost is exempt); it is not active under `npm run dev`.

## Test-driven development

Every code change follows test-driven development:

- Write the failing test first (Vitest unit or Playwright e2e, whichever fits), run it, and confirm it fails for the right reason.
- Commit that test on its own before the implementation, so the PR history shows the test first, then the fix.
- Write the smallest code that makes it pass, then refactor with the tests green.
- In the PR body, add a short TDD section that names the new or changed tests, shows the failing output before the fix, and shows them passing after.

Docs-only changes are exempt from writing tests first. They should still document this rule.
