---
name: run-locally
description: Run Jira Command Center locally in mock mode (no credentials) or against live Jira, and verify a UI change in the browser.
---

# Run locally

## Mock mode (default, no credentials)

1. `npm run serve`
2. Open http://localhost:4173. Data is generated client-side from `seed` in `web/app.js`.
3. To reset cached data, use the sidebar "C" (clear cache) button or bump `CACHE_VERSION`.

## Live Jira mode

1. `cp .env.example .env` and fill in `JIRA_SITE_URL`, `JIRA_EMAIL`, `JIRA_API_TOKEN`.
2. Find the EM field: `npm run discover:fields`, then set `JIRA_EM_FIELD`.
3. Set `JIRA_SUPPORT_FILTER_ID` for the Support page.
4. `npm run dev:jira` and open http://localhost:4174 (live mode is automatic on this port).
5. In Settings, enter team member emails and tracked items (`board:<id> Name`, `filter:<id> Name`), save, then press Refresh on a page.
6. Optional checks: `npm run smoke:jira`, `npm run smoke:live`.

## Verifying changes

- Always run `npm run check` (syntax only; there are no tests).
- For UI work, load the page and click through every nav item; check the browser console for errors.
- Never commit `.env` or `.cache/`.
