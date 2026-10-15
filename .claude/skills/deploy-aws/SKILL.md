---
name: deploy-aws
description: Plan or perform an AWS deployment of Jira Command Center (static frontend, Lambda refresh handler, S3/DynamoDB cache) and list what is still unimplemented.
---

# Deploy to AWS

Reference: `docs/aws-architecture.md` and `docs/ARCHITECTURE.md`.

## Target shape

- Frontend: upload `web/` to S3 behind CloudFront (or Amplify Hosting).
- Backend: Lambda (function URL or API Gateway HTTP API) running `refreshHandler` from `serverless/handlers/refresh.mjs`. Route `POST /refresh/{section}` to it.
- Cache: S3 bucket (`CACHE_BACKEND=s3`, `JIRA_CACHE_BUCKET`).
- Settings: DynamoDB table (`JIRA_SETTINGS_TABLE`) if settings should be shared.
- Secrets: store `JIRA_API_TOKEN` in SSM Parameter Store / Secrets Manager and inject it as an environment variable.

## Gaps to close first

1. `serverless/storage/s3Store.mjs` is a stub. Add `@aws-sdk/client-s3` and implement `getJson`/`putJson` (key `cache:<section>` to object key).
2. The handler's `event` shape: the dev server passes `{section, body}`. Add a thin Lambda wrapper that extracts the section from the path and parses the body.
3. There is no authentication on the API. Put it behind an authorizer, IP allow-list or Cognito before exposing it, because it holds a Jira token.
4. CORS: the handler returns `access-control-allow-origin: *`; restrict it to the CloudFront origin.

## Steps

1. Fix the gaps above and run `npm run check`.
2. Package `serverless/` as the Lambda bundle with Node 20+ and set the env vars from `.env.example`.
3. Deploy the API, then set "API base URL" in the app's Settings to its URL.
4. Upload `web/` and invalidate CloudFront.
5. Smoke test with one Refresh per page. Do not commit credentials or account ids.
