---
name: add-dashboard-page
description: Add a new page/section to the Jira Command Center dashboard, covering mock data, live Jira loader, rendering and navigation.
---

# Add a dashboard page

Pick a section id, e.g. `risks`. Touch these places:

1. `web/index.html`
   - Add a nav button: `<button data-page-target="risks" data-short="Ri">Risks</button>`.
   - Add `<section id="risks" class="section-band page-section" data-page="risks">` modelled on the Support section: heading, `<button class="command-button" data-refresh="risks">Refresh</button>`, `<div class="meta-line" id="risks-meta">`, and a `<div id="risks-view">`.
2. `web/app.js`
   - Append the id to `sections`.
   - Add a `buildRisks()` mock builder and a branch in `buildMockPayload`.
   - Add `renderRisks(cache)` (call `setMeta("risks", cache)`, escape all dynamic text) and call it from `renderAll` and from the refresh handler path used by the other sections.
   - Bump `CACHE_VERSION`.
3. `serverless/handlers/refresh.mjs`
   - Add `if (section === "risks") { ... }` in `refreshPayload`, using `jira.searchIssues`, `normalizeIssue` and `isNotDone`. Return the same shape as the mock builder.
4. `scripts/liveConsistency.mjs`: add the id to `sections` if it should be checked.
5. Run `npm run check`, open mock mode and click through the new page.

Keep mock and live payload shapes identical, hide done-category issues, and use fictional data only.
