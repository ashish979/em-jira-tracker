import { loadRuntimeConfig } from "../serverless/config.mjs";
import { createJiraClient } from "../serverless/jiraClient.mjs";

const runtime = loadRuntimeConfig();
const settings = {
  trackedItems: process.env.JIRA_TRACKED_ITEMS || "board:101 Platform Core\nfilter:10001 Customer support attention",
  teamMembers: process.env.JIRA_TEAM_MEMBERS || "morgan.lee@example.com\naisha.khan@example.com\ndev.patel@example.com",
  emField: runtime.jira.emField,
  supportFilterId: runtime.jira.supportFilterId,
};

const sections = ["overview", "attention", "team", "sprint", "support", "trackers"];
const jira = createJiraClient(runtime.jira);

const payloads = Object.fromEntries(await Promise.all(sections.map(async (section) => [section, await refresh(section)])));
const doneShown = collectTickets(payloads).filter(isDone).map((ticket) => ticket.key);
const teamChecks = [];

for (const member of payloads.team) {
  const memberJql = jqlQuote(member.member);
  const inProgress = await countJql(`assignee = ${memberJql} AND statusCategory = "In Progress"`);
  const sprintIds = (member.currentSprint?.sprintIds || []).map(Number).filter(Number.isFinite);
  const currentSprint = sprintIds.length
    ? await countJql(`assignee = ${memberJql} AND sprint in (${sprintIds.join(", ")}) AND statusCategory != "Done"`)
    : 0;

  teamChecks.push({
    member: member.member,
    dashboardInProgress: member.inProgress,
    jiraInProgress: inProgress,
    dashboardSprint: member.currentSprint?.tickets || 0,
    jiraSprint: currentSprint,
  });
}

const teamMismatches = teamChecks.filter((check) => (
  check.dashboardInProgress !== check.jiraInProgress
  || check.dashboardSprint !== check.jiraSprint
));

const result = {
  doneShown,
  teamMembers: payloads.team.length,
  teamMismatches,
  teamSample: teamChecks.slice(0, 5),
  sprintTickets: payloads.sprint[0]?.tickets?.length || 0,
  sprintEpics: payloads.sprint[0]?.epics?.length || 0,
  supportTickets: payloads.support.tickets?.length || 0,
  attentionItems: payloads.attention.length,
  trackers: payloads.trackers.length,
};

console.log(JSON.stringify(result, null, 2));

if (doneShown.length || teamMismatches.length) {
  process.exitCode = 1;
}

async function refresh(section) {
  const response = await fetch(`http://localhost:4174/refresh/${section}`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ settings }),
  });
  if (!response.ok) throw new Error(`${section} refresh failed: ${response.status}`);
  return (await response.json()).payload;
}

async function countJql(jql) {
  const result = await jira.searchIssues({
    jql,
    fields: ["status"],
    maxResults: 100,
    limit: 1000,
  });
  return result.issues.length;
}

function collectTickets(payloadsToCheck) {
  return [
    payloadsToCheck.overview.myIssues || [],
    payloadsToCheck.overview.emIssues || [],
    payloadsToCheck.attention || [],
    ...payloadsToCheck.team.flatMap((member) => [
      member.tickets || [],
      member.recentTickets || [],
      member.currentSprint?.ticketSample || [],
      ...(member.boards || []).map((board) => board.tickets || []),
    ]),
    ...payloadsToCheck.sprint.flatMap((board) => [
      board.tickets || [],
      ...(board.epics || []).map((epic) => epic.tickets || []),
    ]),
    payloadsToCheck.support.tickets || [],
  ].flat();
}

function isDone(ticket) {
  const status = String(ticket.status || "").toLowerCase();
  return ["done", "closed", "archived"].includes(status) || ticket.statusCategory === "done";
}

function jqlQuote(value) {
  return `"${String(value || "").replace(/\\/g, "\\\\").replace(/"/g, "\\\"")}"`;
}
