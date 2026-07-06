import { readFileSync } from "node:fs";
import { createJiraClient } from "../serverless/jiraClient.mjs";

const env = { ...loadDotEnv(), ...process.env };
const client = createJiraClient({
  siteUrl: env.JIRA_SITE_URL,
  email: env.JIRA_EMAIL,
  apiToken: env.JIRA_API_TOKEN,
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

function loadDotEnv() {
  try {
    return Object.fromEntries(
      readFileSync(".env", "utf8")
        .split("\n")
        .map((line) => line.trim())
        .filter((line) => line && !line.startsWith("#"))
        .map((line) => {
          const index = line.indexOf("=");
          return [line.slice(0, index), line.slice(index + 1)];
        }),
    );
  } catch (error) {
    if (error.code === "ENOENT") return {};
    throw error;
  }
}
