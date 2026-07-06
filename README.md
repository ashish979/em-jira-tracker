# Jira Command Center

Personal Jira dashboard for engineering-manager workflows.

The first version is intentionally small and cheap:

- The browser app is static and dependency-free.
- Jira API tokens stay on the backend, never in browser storage.
- Each dashboard section has an explicit refresh button.
- Cached section payloads are read first and refreshed only on demand.
- Local development uses mock data or local JSON cache.
- AWS deployment can use Lambda + S3 + DynamoDB.

## Run Locally

```bash
npm run serve
```

Open `http://localhost:4173`.

This runs in mock mode. To use your local `.env` and call Jira with the Refresh
buttons:

```bash
npm run dev:jira
```

Open `http://localhost:4174`.

The main console is page-based rather than one long scroll:

- Team: workload radar, stale-item signals, and member ticket details.
- Sprint: active sprint timing, grouping, coverage, and paginated tickets.
- Support: customer support attention filter `18377`.
- Overview, Attention, Trackers, and Settings stay separate pages.

## Current State

The UI runs with representative mock Jira data. The backend modules in
`serverless/` define the refresh shape we will wire to Jira once credentials
are available.

## When Jira Credentials Are Needed

I will need these when we connect real refreshes:

- Jira site URL, for example `https://company.atlassian.net`
- Jira account email
- Jira API token
- The company EM custom field id, for example `customfield_12345`
- Team member emails or Atlassian account IDs
- Board IDs and saved filter IDs you care about

Your first configured board is `board:141 User Profiles/Identities`.

For token and EM field discovery steps, see `docs/jira-setup.md`.

## AWS Shape

See `docs/aws-architecture.md`.
