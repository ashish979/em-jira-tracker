# AWS Architecture

## Recommended MVP

- Static frontend: S3 + CloudFront, or Amplify Hosting.
- Backend: Lambda function URLs or API Gateway HTTP API.
- Structured settings: DynamoDB.
- Larger cached Jira payloads: S3 objects.
- Secrets: SSM Parameter Store or Lambda environment variables.

## Cache Model

Every section has an independent cache key:

- `home`
- `attention`
- `team`
- `board:<boardId>`
- `filter:<filterId>`

Each cache object stores:

- `section`
- `refreshedAt`
- `source`
- `payload`

The UI should load cached data first. Refresh buttons call backend routes that
query Jira, write the new cache object, and return the fresh payload.

## Why Not SQLite In S3

SQLite expects filesystem semantics such as locking and small random writes.
S3 stores whole objects. It is a good fit for JSON cache blobs, not a live
SQLite database file.

## Suggested APIs

- `GET /settings`
- `PUT /settings`
- `GET /cache/:section`
- `POST /refresh/home`
- `POST /refresh/team`
- `POST /refresh/attention`
- `POST /refresh/board/:boardId`
- `POST /refresh/filter/:filterId`
