import { loadRuntimeConfig } from "../serverless/config.mjs";
import { createJiraClient } from "../serverless/jiraClient.mjs";

const config = loadRuntimeConfig();
const jira = createJiraClient(config.jira);
const boardId = "141";

const [board, sprints, assigned, emOwned] = await Promise.all([
  jira.getBoard(boardId),
  jira.getActiveSprints(boardId),
  jira.searchIssues({
    jql: "assignee = currentUser() AND resolution = EMPTY ORDER BY updated DESC",
    fields: ["summary", "status", "assignee", config.jira.emField],
    maxResults: 5,
  }),
  jira.searchIssues({
    jql: "cf[10067] = currentUser() AND resolution = EMPTY ORDER BY updated DESC",
    fields: ["summary", "status", "assignee", config.jira.emField],
    maxResults: 5,
  }),
]);

console.log(JSON.stringify({
  board: {
    id: board.id,
    name: board.name,
    type: board.type,
  },
  activeSprints: (sprints.values || []).map((sprint) => ({
    id: sprint.id,
    name: sprint.name,
    state: sprint.state,
  })),
  assignedSample: {
    count: assigned.issues?.length || 0,
    keys: (assigned.issues || []).map((issue) => issue.key),
  },
  engineeringManagerSample: {
    field: config.jira.emField,
    count: emOwned.issues?.length || 0,
    keys: (emOwned.issues || []).map((issue) => issue.key),
  },
}, null, 2));
