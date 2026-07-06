import { loadRuntimeConfig } from "../serverless/config.mjs";
import { createJiraClient } from "../serverless/jiraClient.mjs";

const config = loadRuntimeConfig();
const client = createJiraClient({
  siteUrl: config.jira.siteUrl,
  email: config.jira.email,
  apiToken: config.jira.apiToken,
});

const fields = await client.getFields();
const candidates = fields
  .filter((field) => {
    const haystack = `${field.name || ""} ${field.id || ""}`.toLowerCase();
    return field.custom || haystack.includes("em") || haystack.includes("engineering") || haystack.includes("manager");
  })
  .map((field) => ({
    id: field.id,
    name: field.name,
    custom: Boolean(field.custom),
    type: field.schema?.type || field.schema?.custom || "unknown",
  }))
  .sort((a, b) => Number((b.name || "").toLowerCase().includes("em")) - Number((a.name || "").toLowerCase().includes("em")));

console.table(candidates);
