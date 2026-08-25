# AGENTS.md

## Cursor Cloud specific instructions

Diamondboard is a **client-only** React 19 + TypeScript PWA built with Vite 8. There is
no backend, database, accounts, secrets, or external services — everything runs in the
browser and a page refresh resets to defaults.

Standard commands live in `package.json` (`dev`, `build`, `lint`, `test`, `test:watch`,
`preview`) and in `README.md`; use those rather than duplicating them here.

Non-obvious notes:

- Node 22 is expected (CI uses Node 22 with `npm ci`); the repo pins no version-manager file.
- Lint uses `oxlint` (not ESLint): `npm run lint`.
- Tests are Vitest over pure model logic in `src/model` (node environment, no browser/jsdom);
  `npm test` runs once, `npm run test:watch` watches.
- `npm run dev` serves the app at http://localhost:5173. Run it as a long-lived process
  (e.g. a tmux-backed terminal), not from `install`/`start`.
- `npm run build` runs `tsc -b` then `vite build` into `dist/`, and generates a PWA service
  worker. The service worker requires HTTPS in production (`localhost` is exempt), so prefer
  `npm run dev` for local iteration.
