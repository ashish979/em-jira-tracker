# Jira Command Center

Personal Jira dashboard for engineering managers: team workload, active
sprints, attention items, support queue and tracked boards/filters. Static
vanilla-JS frontend plus a small Node backend that queries Jira Cloud.

## Commands

- `npm run serve` — static UI in mock mode at http://localhost:4173 (no credentials).
- `npm run dev:jira` — Node dev server at http://localhost:4174; reads `.env` and serves live `POST /refresh/:section`.
- `npm run check` — `node --check` syntax pass over all source files. There is no test suite, linter or build step.
- `npm run discover:fields` — list Jira fields to find the EM custom field id.
- `npm run smoke:jira`, `npm run smoke:live` — live-Jira sanity scripts; need real credentials.

## Layout

- `web/` — `index.html`, `app.js` (all UI logic, mock data, settings, cache), `styles.css`.
- `serverless/handlers/refresh.mjs` — per-section Jira payload builders; Lambda-shaped handler.
- `serverless/jiraClient.mjs` — Jira REST client (paged JQL, Agile board/sprint APIs).
- `serverless/config.mjs` — env/.env loading and cache-store selection.
- `serverless/storage/` — `localStore` (JSON in `.cache/`), `s3Store` (stub).
- `scripts/` — dev server and Jira helper scripts.
- `docs/` — `ARCHITECTURE.md`, `jira-setup.md`, `aws-architecture.md`, `media/`.
- `.claude/skills/` — `run-locally`, `add-dashboard-page`, `deploy-aws`.

## Conventions

- ES modules, no dependencies. Do not add a framework or bundler without a strong reason.
- Sections are `team`, `sprint`, `overview`, `attention`, `support`, `trackers`. A section exists in four places: `sections` + `buildMockPayload` + `render*` in `web/app.js`, nav/section markup in `web/index.html`, and a branch in `refreshPayload` in `refresh.mjs`.
- Keep the mock payload shape identical to the live payload shape.
- Escape all dynamic HTML (`escapeHtml` / `escapeAttribute`).
- Done-category issues are hidden everywhere (`isNotDone`).

## Gotchas

- Never commit `.env`, tokens or real company data. Sample data must stay fictional (`@example.com`).
- Bump `CACHE_VERSION` in `web/app.js` when changing payload shapes or default settings, or users keep stale localStorage.
- `defaultSettings` and `loadSettings()` merge saved settings over defaults; new settings need a matching input in `web/index.html` (matched by `name`) and an entry in `publicSettings`.
- The UI picks live mode if "API base URL" is set, or automatically when served from port 4174.
- `s3Store` is a stub that throws; `CACHE_BACKEND=s3` does not work until `@aws-sdk/client-s3` is added.
- `customfield_10014` / `customfield_10063` in the Jira client are the standard Atlassian Cloud epic/parent-link fields.
- The server cache is written on refresh but the UI reads only localStorage.
