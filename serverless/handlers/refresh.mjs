import { createCacheStore, loadRuntimeConfig } from "../config.mjs";
import { createJiraClient, normalizeIssue } from "../jiraClient.mjs";

const baseFields = [
  "summary",
  "status",
  "priority",
  "assignee",
  "duedate",
  "updated",
  "statuscategorychangedate",
  "labels",
];

export async function refreshHandler(event = {}, env = process.env) {
  const config = loadRuntimeConfig(env);
  const section = extractSection(event);
  const body = parseBody(event.body);
  const cache = createCacheStore(config);
  const payload = await refreshPayload(section, body, config);
  const item = {
    section,
    payload,
    source: "jira",
    refreshedAt: new Date().toISOString(),
  };

  await cache.putJson(`cache:${section}`, item);

  return {
    statusCode: 200,
    headers: {
      "content-type": "application/json",
      "access-control-allow-origin": "*",
    },
    body: JSON.stringify(item),
  };
}

async function refreshPayload(section, body, config) {
  const jira = createJiraClient(config.jira);
  const emField = body?.settings?.emField || config.jira.emField;
  const fields = emField ? [...baseFields, emField] : baseFields;

  if (section === "overview") {
    const emJqlField = toJqlField(emField);
    const [assigned, emOwned] = await Promise.all([
      jira.searchIssues({ jql: "assignee = currentUser() AND resolution = EMPTY ORDER BY updated DESC", fields }),
      emField
        ? jira.searchIssues({ jql: `${emJqlField} = currentUser() AND resolution = EMPTY ORDER BY updated DESC`, fields })
        : Promise.resolve({ issues: [] }),
    ]);
    const myIssues = assigned.issues.map((item) => normalizeIssue(item, emField));
    const emIssues = emOwned.issues.map((item) => normalizeIssue(item, emField));
    return {
      metrics: [
        ["Assigned", myIssues.length, "from Jira"],
        ["EM-owned", emIssues.length, "from Jira"],
        ["Blocked", countWithLabel([...myIssues, ...emIssues], "blocked"), "label scan"],
        ["Due soon", countDueSoon([...myIssues, ...emIssues]), "next 3 days"],
      ],
      myIssues,
      emIssues,
    };
  }

  if (section === "attention") {
    const result = await jira.searchIssues({
      jql: "resolution = EMPTY AND (assignee = currentUser() OR updated >= -30d) ORDER BY duedate ASC, updated ASC",
      fields,
      maxResults: 100,
    });
    return result.issues.map((item) => normalizeIssue(item, emField)).map(addAttentionReasons).filter((item) => item.reasons.length);
  }

  if (section === "team") {
    const members = parseLines(body?.settings?.teamMembers || "");
    return Promise.all(members.map((member) => loadMemberSummary(jira, member, fields, emField)));
  }

  if (section === "boards") {
    const boards = parseTracked(body?.settings?.trackedItems || "", "board");
    return Promise.all(boards.map((board) => loadBoardSummary(jira, board)));
  }

  if (section === "trackers") {
    const filters = parseTracked(body?.settings?.trackedItems || "", "filter");
    return Promise.all(filters.map((filter) => loadFilterSummary(jira, filter, fields)));
  }

  return {};
}

async function loadMemberSummary(jira, member, fields, emField) {
  const jqlMember = member.includes("@") ? `"${member}"` : member;
  const result = await jira.searchIssues({
    jql: `assignee = ${jqlMember} AND resolution = EMPTY ORDER BY updated ASC`,
    fields,
    maxResults: 100,
  });
  const issues = result.issues.map((item) => normalizeIssue(item, emField));
  const oldest = issues.reduce((max, item) => Math.max(max, ageDays(item.statusCategoryChangedDate || item.updated)), 0);
  return {
    member,
    active: issues.length,
    inProgress: issues.filter((item) => item.status.toLowerCase().includes("progress")).length,
    oldest,
    attention: oldest > 8 ? "stale focus item" : issues.length > 5 ? "capacity check" : "healthy",
  };
}

async function loadBoardSummary(jira, board) {
  const [boardDetails, sprints, issues, backlog] = await Promise.all([
    jira.getBoard(board.id),
    jira.getActiveSprints(board.id),
    jira.getBoardIssues(board.id),
    jira.getBacklog(board.id),
  ]);
  const active = issues.issues || [];
  return {
    id: board.id,
    name: board.name || boardDetails.name,
    sprint: sprints.values?.[0]?.name || "No active sprint",
    active: active.length,
    done: active.filter((issue) => issue.fields?.status?.statusCategory?.key === "done").length,
    backlog: backlog.issues?.length || 0,
    blocked: active.filter((issue) => (issue.fields?.labels || []).includes("blocked")).length,
  };
}

async function loadFilterSummary(jira, filter, fields) {
  const result = await jira.searchIssues({
    jql: `filter = ${filter.id}`,
    fields,
    maxResults: 1,
  });
  return {
    type: "filter",
    id: filter.id,
    name: filter.name || `Filter ${filter.id}`,
    count: result.total || result.issues?.length || 0,
    previous: 0,
    url: "#",
  };
}

function extractSection(event) {
  return event.pathParameters?.section || event.section || "overview";
}

function parseBody(body) {
  if (!body) return {};
  return typeof body === "string" ? JSON.parse(body) : body;
}

function parseLines(value) {
  return value.split("\n").map((line) => line.trim()).filter(Boolean);
}

function parseTracked(value, type) {
  return parseLines(value)
    .filter((line) => line.startsWith(`${type}:`))
    .map((line) => {
      const [kindAndId, ...nameParts] = line.split(" ");
      return { id: kindAndId.split(":")[1], name: nameParts.join(" ") };
    });
}

function addAttentionReasons(item) {
  const dueIn = item.due ? daysUntil(item.due) : null;
  const staleAge = ageDays(item.statusCategoryChangedDate || item.updated);
  const reasons = [];
  if (dueIn !== null && dueIn < 0) reasons.push(`${Math.abs(dueIn)}d overdue`);
  if (dueIn !== null && dueIn >= 0 && dueIn <= 3) reasons.push(`due in ${dueIn}d`);
  if (staleAge > 7) reasons.push(`${staleAge}d in motion`);
  if (item.labels.includes("blocked")) reasons.push("blocked");
  return {
    ...item,
    dueIn,
    reasons,
    severity: reasons.includes("blocked") || (dueIn !== null && dueIn < 0) ? "critical" : reasons.length ? "warn" : "good",
  };
}

function daysUntil(isoDate) {
  return Math.ceil((new Date(isoDate).getTime() - Date.now()) / 86400000);
}

function ageDays(isoDate) {
  if (!isoDate) return 0;
  return Math.floor((Date.now() - new Date(isoDate).getTime()) / 86400000);
}

function countWithLabel(issues, label) {
  return new Set(issues.filter((issue) => issue.labels.includes(label)).map((issue) => issue.key)).size;
}

function countDueSoon(issues) {
  return new Set(issues.filter((issue) => issue.due && daysUntil(issue.due) <= 3).map((issue) => issue.key)).size;
}

function toJqlField(fieldId) {
  const match = /^customfield_(\d+)$/.exec(fieldId || "");
  return match ? `cf[${match[1]}]` : `"${fieldId}"`;
}
