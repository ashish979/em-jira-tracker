# Jira Setup

## Create An API Token

1. Open https://id.atlassian.com/manage-profile/security/api-tokens.
2. Choose `Create API token`.
3. Name it `em-jira-tracker`.
4. Pick an expiration date.
5. Copy it once and save it in a password manager.

Atlassian says new tokens expire by default in one year and can be set from one
day up to one year.

Do not commit the token. Put it only in `.env` locally or an AWS secret later.

## Local `.env`

```bash
cp .env.example .env
```

Then edit `.env`:

```bash
JIRA_SITE_URL=https://josysglobal.atlassian.net
JIRA_EMAIL=ashish.agrawal@josys.com
JIRA_API_TOKEN=your-token-here
JIRA_EM_FIELD=
```

## Find The EM Custom Field

After adding the token:

```bash
npm run discover:fields
```

Look for a row named `EM`, `Engineering Manager`, or your company's exact field
label. The id will look like `customfield_12345`. Put that value in
`JIRA_EM_FIELD`.

If the list is too broad, we can also inspect one known issue from board 141 and
match the rendered Jira field label to the REST field id.
