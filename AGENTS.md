# AGENTS.md

## Cursor Cloud specific instructions

Diamondboard is a single, fully client-side Vite + React + TypeScript PWA — there is no backend, database, accounts, or environment variables. Running the one dev server exercises the product end to end.

Dependencies are refreshed automatically on startup (`npm ci`), so you do not need to install them manually. Standard commands live in `package.json` and `README.md`; use those rather than duplicating them here:

- Dev server: `npm run dev` (Vite, http://localhost:5173) — run it as a long-lived process (e.g. a tmux-backed terminal), not in `install`.
- Lint: `npm run lint` (oxlint)
- Tests: `npm test` (Vitest, `src/**/*.test.ts`; the model layer under `src/model/` is fully unit-tested)
- Build: `npm run build` (`tsc -b && vite build`); preview a built `dist/` with `npm run preview` (http://localhost:4173).

Non-obvious notes:

- CI (`.github/workflows/deploy.yml`) runs `npm ci` → `npm run lint` → `npm test` → `npm run build` on Node 22, then deploys `dist/` to GitHub Pages. Make sure all four pass before considering a change complete.
- Fielder position tokens are fixed/non-draggable; runners, the ball, and freehand strokes are the draggable/editable elements (use the selection/pointer tool).
- The service worker (`vite-plugin-pwa`) only activates in a built/previewed app over HTTPS (localhost is exempt); it is not active under `npm run dev`.
