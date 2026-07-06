import { createCacheStore, loadRuntimeConfig } from "../config.mjs";
import { createJiraClient, normalizeIssue } from "../jiraClient.mjs";

const baseFields = [
  "summary",
  "status",
  "issuetype",
  "project",
  "priority",
  "assignee",
  "duedate",
  "updated",
  "statuscategorychangedate",
  "created",
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
  const siteUrl = config.jira.siteUrl;

  if (section === "overview") {
    const emJqlField = toJqlField(emField);
    const [assigned, emOwned] = await Promise.all([
      jira.searchIssues({ jql: "assignee = currentUser() AND resolution = EMPTY ORDER BY updated DESC", fields }),
      emField
        ? jira.searchIssues({ jql: `${emJqlField} = currentUser() AND resolution = EMPTY ORDER BY updated DESC`, fields })
        : Promise.resolve({ issues: [] }),
    ]);
    const myIssues = assigned.issues.map((item) => normalizeIssue(item, emField, siteUrl)).filter(isNotDone);
    const emIssues = emOwned.issues.map((item) => normalizeIssue(item, emField, siteUrl)).filter(isNotDone);
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
    return result.issues.map((item) => normalizeIssue(item, emField, siteUrl)).filter(isNotDone).map(addAttentionReasons).filter((item) => item.reasons.length);
  }

  if (section === "team") {
    const members = parseLines(body?.settings?.teamMembers || "");
    const boards = parseTracked(body?.settings?.trackedItems || "", "board");
    return Promise.all(members.map((member) => loadMemberSummary(jira, member, fields, emField, boards, siteUrl)));
  }

  if (section === "sprint") {
    const members = parseLines(body?.settings?.teamMembers || "");
    const boards = parseTracked(body?.settings?.trackedItems || "", "board");
    return Promise.all(boards.map((board) => loadSprintSummary(jira, board, fields, emField, members, siteUrl)));
  }

  if (section === "boards") {
    const boards = parseTracked(body?.settings?.trackedItems || "", "board");
    return Promise.all(boards.map((board) => loadBoardSummary(jira, board, fields, emField, siteUrl)));
  }

  if (section === "support") {
    return loadSupportAttention(jira, fields, emField, siteUrl, "18377");
  }

  if (section === "trackers") {
    const filters = parseTracked(body?.settings?.trackedItems || "", "filter");
    return Promise.all(filters.map((filter) => loadFilterSummary(jira, filter, fields)));
  }

  return {};
}

async function loadMemberSummary(jira, member, fields, emField, boards, siteUrl) {
  const jqlMember = member.includes("@") ? `"${member}"` : member;
  const [activeResult, recentResult, boardWork] = await Promise.all([
    jira.searchIssues({
      jql: `assignee = ${jqlMember} AND resolution = EMPTY ORDER BY updated ASC`,
      fields,
      maxResults: 100,
      limit: 500,
    }),
    jira.searchIssues({
      jql: `assignee = ${jqlMember} AND updated >= -45d ORDER BY updated DESC`,
      fields,
      maxResults: 100,
      limit: 300,
    }),
    Promise.all(boards.map((board) => loadMemberBoardWork(jira, board, jqlMember, fields, emField, siteUrl))),
  ]);
  const activeIssues = activeResult.issues.map((item) => normalizeIssue(item, emField, siteUrl)).filter(isNotDone);
  const recentIssues = recentResult.issues.map((item) => normalizeIssue(item, emField, siteUrl)).filter(isNotDone);
  const oldest = activeIssues.reduce((max, item) => Math.max(max, item.ageDays || 0), 0);
  return {
    member,
    active: activeIssues.length,
    inProgress: activeIssues.filter((item) => item.status.toLowerCase().includes("progress")).length,
    oldest,
    attention: oldest > 8 ? "stale focus item" : activeIssues.length > 5 ? "capacity check" : "healthy",
    tickets: activeIssues.slice(0, 8),
    recentTickets: recentIssues.slice(0, 8),
    boards: boardWork.filter((board) => board.active || board.workedOn),
  };
}

async function loadMemberBoardWork(jira, board, jqlMember, fields, emField, siteUrl) {
  const result = await jira.getBoardIssues(board.id, {
    fields,
    jql: `assignee = ${jqlMember} AND updated >= -45d ORDER BY updated DESC`,
    limit: 300,
  });
  const tickets = (result.issues || []).map((item) => normalizeIssue(item, emField, siteUrl)).filter(isNotDone);
  return {
    id: board.id,
    name: board.name || `Board ${board.id}`,
    active: tickets.filter((item) => !item.status.toLowerCase().includes("done")).length,
    workedOn: tickets.length,
    tickets: tickets.slice(0, 8),
  };
}

async function loadBoardSummary(jira, board, fields, emField, siteUrl) {
  const [boardDetails, sprints, issues, backlog] = await Promise.all([
    jira.getBoard(board.id),
    jira.getActiveSprints(board.id),
    jira.getBoardIssues(board.id, { fields, limit: 1000 }),
    jira.getBacklog(board.id, { fields, limit: 1000 }),
  ]);
  const active = issues.issues || [];
  const normalized = active.map((issue) => normalizeIssue(issue, emField, siteUrl)).filter(isNotDone);
  return {
    id: board.id,
    name: board.name || boardDetails.name,
    sprint: sprints.values?.[0]?.name || "No active sprint",
    active: normalized.length,
    done: 0,
    backlog: backlog.issues?.length || 0,
    blocked: normalized.filter((issue) => issue.labels.includes("blocked")).length,
    tickets: normalized.slice(0, 12),
  };
}

async function loadSprintSummary(jira, board, fields, emField, members, siteUrl) {
  const [boardDetails, sprints, backlog] = await Promise.all([
    jira.getBoard(board.id),
    jira.getActiveSprints(board.id),
    jira.getBacklog(board.id, { fields, limit: 1000 }),
  ]);
  const sprint = sprints.values?.[0] || null;
  const sprintIssues = sprint
    ? await jira.getSprintIssues(sprint.id, { fields, limit: 1000 })
    : { issues: [] };
  const tickets = (sprintIssues.issues || []).map((issue) => normalizeIssue(issue, emField, siteUrl)).filter(isNotDone);
  const assigneeCounts = groupCount(tickets, (ticket) => ticket.assignee || "Unassigned");
  const memberCoverage = members.map((member) => {
    const display = memberDisplay(member);
    const count = tickets.filter((ticket) => sameAssignee(ticket.assignee, member, display)).length;
    return { member, display, count, hasTicket: count > 0 };
  });

  return {
    id: board.id,
    name: board.name || boardDetails.name,
    sprint: sprint
      ? {
          id: sprint.id,
          name: sprint.name,
          state: sprint.state,
          startDate: sprint.startDate || null,
          endDate: sprint.endDate || null,
          completeDate: sprint.completeDate || null,
          goal: sprint.goal || "",
          daysRemaining: daysUntil(sprint.endDate),
          isPastEndDate: sprint.endDate ? daysUntil(sprint.endDate) < 0 : false,
        }
      : null,
    totals: {
      tickets: tickets.length,
      done: 0,
      inProgress: tickets.filter((ticket) => ticket.status.toLowerCase().includes("progress")).length,
      unassigned: tickets.filter((ticket) => ticket.assignee === "Unassigned").length,
      backlog: backlog.issues?.length || 0,
    },
    groups: {
      byStatus: groupCount(tickets, (ticket) => ticket.status || "Unknown"),
      byAssignee: assigneeCounts,
      byPriority: groupCount(tickets, (ticket) => ticket.priority || "None"),
      byType: groupCount(tickets, (ticket) => ticket.type || "Issue"),
    },
    coverage: {
      withTickets: memberCoverage.filter((member) => member.hasTicket),
      withoutTickets: memberCoverage.filter((member) => !member.hasTicket),
      unassignedTickets: tickets.filter((ticket) => ticket.assignee === "Unassigned").slice(0, 20),
    },
    tickets,
  };
}

async function loadSupportAttention(jira, fields, emField, siteUrl, filterId) {
  const result = await jira.searchIssues({
    jql: `filter = ${filterId} ORDER BY priority DESC, updated ASC`,
    fields,
    maxResults: 100,
    limit: 1000,
  });
  const tickets = result.issues.map((issue) => normalizeIssue(issue, emField, siteUrl)).filter(isNotDone).map(addAttentionReasons);
  return {
    filterId,
    url: `${siteUrl.replace(/\/$/, "")}/issues/?filter=${filterId}`,
    totals: {
      tickets: tickets.length,
      critical: tickets.filter((ticket) => ticket.severity === "critical").length,
      stale: tickets.filter((ticket) => ticket.reasons.some((reason) => reason.includes("motion"))).length,
      unassigned: tickets.filter((ticket) => ticket.assignee === "Unassigned").length,
    },
    groups: {
      byStatus: groupCount(tickets, (ticket) => ticket.status || "Unknown"),
      byAssignee: groupCount(tickets, (ticket) => ticket.assignee || "Unassigned"),
      byPriority: groupCount(tickets, (ticket) => ticket.priority || "None"),
    },
    tickets,
  };
}

async function loadFilterSummary(jira, filter, fields) {
  const result = await jira.searchIssues({
    jql: `filter = ${filter.id}`,
    fields,
    maxResults: 100,
    limit: 1,
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

function groupCount(items, keyFn) {
  const counts = new Map();
  for (const item of items) {
    const key = keyFn(item) || "Unknown";
    counts.set(key, (counts.get(key) || 0) + 1);
  }
  return [...counts.entries()]
    .map(([name, count]) => ({ name, count }))
    .sort((a, b) => b.count - a.count || a.name.localeCompare(b.name));
}

function memberDisplay(member) {
  return member.split("@")[0].replace(/[._-]+/g, " ");
}

function sameAssignee(assignee, member, display) {
  const normalizedAssignee = normalizePerson(assignee);
  return normalizedAssignee === normalizePerson(member) || normalizedAssignee.includes(normalizePerson(display));
}

function normalizePerson(value) {
  return String(value || "").toLowerCase().replace(/[^a-z0-9]+/g, "");
}

function addAttentionReasons(item) {
  const dueIn = item.due ? daysUntil(item.due) : null;
  const staleAge = item.ageDays ?? ageDays(item.statusCategoryChangedDate || item.updated);
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
  if (!isoDate) return null;
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

function isNotDone(issue) {
  return issue.statusCategory !== "done" && issue.status.toLowerCase() !== "done" && issue.status.toLowerCase() !== "closed" && issue.status.toLowerCase() !== "archived";
}

function toJqlField(fieldId) {
  const match = /^customfield_(\d+)$/.exec(fieldId || "");
  return match ? `cf[${match[1]}]` : `"${fieldId}"`;
}
