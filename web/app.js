const CACHE_PREFIX = "jira-command-center:";
const CACHE_VERSION = "2026-07-06-support-actions-v1";
const sections = ["team", "sprint", "overview", "attention", "support", "trackers"];
const pageSize = 12;
const paginationState = {};

const defaultSettings = {
  settingsVersion: CACHE_VERSION,
  jiraSiteUrl: "https://josysglobal.atlassian.net",
  jiraEmail: "ashish.agrawal@josys.com",
  emField: "customfield_10067",
  apiBaseUrl: "",
  teamMembers: [
    "amarnath.chowdary@josys.com",
    "ashish.agrawal@josys.com",
    "dipayan.sanyal@josys.com",
    "golakiya.n@josys.com",
    "kali.kumar@josys.com",
    "karthik.devaraj@josys.com",
    "kiran.babu@josys.com",
    "noushadali.ms@josys.com",
    "prashant.t@josys.com",
    "saksham.gupta@josys.com",
    "sanket.jagdishbhai@josys.com",
    "shaaz.jiwani@josys.com",
    "shaik.shahul@josys.com",
    "swathi.kolamala@josys.com",
    "vikas.sahu@josys.com",
  ].join("\n"),
  trackedItems: ["board:141 User Profiles/Identities", "filter:18377 Customer support attention"].join("\n"),
};

const seed = {
  issues: [
    issue("PLAT-2194", "Unblock profile sync rollout", "In Progress", "High", "Ashish", "Aisha", -1, 5, ["blocked", "customer"]),
    issue("PLAT-2208", "Billing event replay audit", "Code Review", "Medium", "Ashish", "Dev", 3, 2, ["sprint"]),
    issue("DX-881", "Reduce CI queue time for monorepo", "In Progress", "High", "Ashish", "Meera", 7, 11, ["stale"]),
    issue("DX-904", "Fix flaky deployment smoke test", "To Do", "Low", "Ashish", "Aisha", 14, 1, ["maintenance"]),
    issue("SEC-442", "Access review exceptions", "Waiting", "High", "Ashish", "Dev", -3, 9, ["risk"]),
    issue("PLAT-2220", "Sprint planning capacity update", "Done", "Medium", "Ashish", "Ashish", 2, 1, ["planning"]),
  ],
  boards: [
    { id: "141", name: "User Profiles/Identities", sprint: "SC-Sprint 8", active: 18, done: 0, backlog: 64, blocked: 2 },
    { id: "77", name: "Developer experience", sprint: "Sprint 18", active: 11, done: 0, backlog: 31, blocked: 1 },
    { id: "13", name: "Ops reliability", sprint: "Sprint 09", active: 7, done: 0, backlog: 18, blocked: 0 },
  ],
  trackers: [
    { type: "filter", id: "181", name: "Release blockers", count: 5, previous: 7, url: "#" },
    { type: "filter", id: "205", name: "Approaching due date", count: 9, previous: 6, url: "#" },
    { type: "dashboard", id: "team", name: "Team planning dashboard", count: 3, previous: 3, url: "#" },
  ],
};

function issue(key, summary, status, priority, em, assignee, dueInDays, ageDays, labels) {
  const due = new Date();
  due.setDate(due.getDate() + dueInDays);
  return { key, summary, status, priority, em, assignee, due: due.toISOString(), ageDays, labels, url: `https://josysglobal.atlassian.net/browse/${key}` };
}

function loadSettings() {
  const saved = localStorage.getItem(`${CACHE_PREFIX}settings`);
  if (!saved) return defaultSettings;
  const parsed = JSON.parse(saved);
  if (parsed.settingsVersion !== CACHE_VERSION) {
    return { ...defaultSettings, apiBaseUrl: parsed.apiBaseUrl || defaultSettings.apiBaseUrl };
  }
  return { ...defaultSettings, ...parsed };
}

function saveSettings(settings) {
  localStorage.setItem(`${CACHE_PREFIX}settings`, JSON.stringify(settings));
}

function loadCache(section) {
  const saved = localStorage.getItem(`${CACHE_PREFIX}cache:${section}`);
  if (!saved) return null;
  const parsed = JSON.parse(saved);
  return parsed.version === CACHE_VERSION ? parsed : null;
}

function saveCache(section, payload, source = "mock") {
  const item = { version: CACHE_VERSION, section, payload, source, refreshedAt: new Date().toISOString() };
  localStorage.setItem(`${CACHE_PREFIX}cache:${section}`, JSON.stringify(item));
  return item;
}

async function refreshSection(section) {
  setGlobalCacheState("refreshing");
  const settings = loadSettings();
  const apiBaseUrl = settings.apiBaseUrl.trim() || (window.location.port === "4174" ? window.location.origin : "");

  if (apiBaseUrl) {
    const response = await fetch(`${apiBaseUrl.replace(/\/$/, "")}/refresh/${section}`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ settings: publicSettings(settings) }),
    });
    if (!response.ok) throw new Error(`Refresh failed: ${response.status}`);
    const data = await response.json();
    return saveCache(section, data.payload, data.source || "jira");
  }

  await wait(250 + Math.random() * 300);
  return saveCache(section, buildMockPayload(section, settings));
}

function publicSettings(settings) {
  const { jiraSiteUrl, jiraEmail, emField, teamMembers, trackedItems } = settings;
  return { jiraSiteUrl, jiraEmail, emField, teamMembers, trackedItems };
}

function buildMockPayload(section, settings) {
  const members = parseLines(settings.teamMembers);
  const tracked = parseLines(settings.trackedItems);
  if (section === "overview") return buildOverview();
  if (section === "attention") return buildAttention();
  if (section === "team") return buildTeam(members);
  if (section === "sprint") return buildSprint(tracked, members);
  if (section === "support") return buildSupport();
  if (section === "trackers") return buildTrackers(tracked);
  return {};
}

function buildOverview() {
  const myIssues = seed.issues.filter(isNotDone).filter((item) => item.assignee === "Ashish" || item.assignee === "Aisha");
  const emIssues = seed.issues.filter(isNotDone).filter((item) => item.em === "Ashish");
  return {
    metrics: [
      ["Assigned", myIssues.length, "+2 since cache"],
      ["EM-owned", emIssues.length, "all boards"],
      ["Blocked", seed.issues.filter((item) => item.labels.includes("blocked")).length, "needs push"],
      ["Due soon", seed.issues.filter((item) => daysUntil(item.due) <= 3).length, "next 3 days"],
    ],
    myIssues,
    emIssues,
  };
}

function buildAttention() {
  return seed.issues
    .filter(isNotDone)
    .map((item) => {
      const dueIn = daysUntil(item.due);
      const reasons = [];
      if (dueIn < 0) reasons.push(`${Math.abs(dueIn)}d overdue`);
      if (dueIn >= 0 && dueIn <= 3) reasons.push(`due in ${dueIn}d`);
      if (item.ageDays > 7) reasons.push(`${item.ageDays}d in motion`);
      if (item.labels.includes("blocked")) reasons.push("blocked");
      return { ...item, dueIn, reasons, severity: reasons.includes("blocked") || dueIn < 0 ? "critical" : reasons.length ? "warn" : "good" };
    })
    .filter((item) => item.reasons.length)
    .sort((a, b) => b.reasons.length - a.reasons.length);
}

function buildTeam(members) {
  const names = members.length ? members : ["aisha@example.com", "dev@example.com", "meera@example.com"];
  return names.map((member, index) => {
    const active = 3 + index * 2;
    const inProgress = Math.max(1, active - 2);
    const oldest = 4 + index * 3;
    const tickets = seed.issues.filter(isNotDone).slice(index % 3, index % 3 + 3);
    return {
      member,
      active,
      inProgress,
      oldest,
      attention: oldest > 8 ? "stale focus item" : active > 5 ? "capacity check" : "healthy",
      tickets,
      recentTickets: tickets,
      boards: [
        {
          id: "141",
          name: "User Profiles/Identities",
          active: Math.max(1, inProgress - 1),
          workedOn: tickets.length,
          tickets,
        },
      ],
    };
  });
}

function buildBoards(tracked) {
  const configuredBoards = tracked
    .filter((line) => line.startsWith("board:"))
    .map((line) => {
      const [rawId, ...nameParts] = line.replace("board:", "").split(" ");
      const existing = seed.boards.find((board) => board.id === rawId);
      return existing || { id: rawId, name: nameParts.join(" ") || `Board ${rawId}`, sprint: "Active sprint", active: 8, done: 0, backlog: 21, blocked: 0 };
    });
  return configuredBoards.length ? configuredBoards : seed.boards;
}

function buildSprint(tracked, members) {
  return buildBoards(tracked).map((board) => {
    const mockEpics = [
      { key: "SC-1000", summary: "Identity lifecycle controls", type: "Epic", status: "In Progress", url: `${loadSettings().jiraSiteUrl.replace(/\/$/, "")}/browse/SC-1000` },
      { key: "SC-1021", summary: "Profile reliability", type: "Epic", status: "To Do", url: `${loadSettings().jiraSiteUrl.replace(/\/$/, "")}/browse/SC-1021` },
    ];
    const tickets = seed.issues.filter(isNotDone).map((item, index) => ({
      ...item,
      assignee: members[index % Math.max(1, members.length)] || item.assignee,
      parent: mockEpics[index % mockEpics.length],
    }));
    return {
      ...board,
      sprint: {
        id: 11306,
        name: "SC-Sprint 8",
        state: "active",
        startDate: new Date(Date.now() - 7 * 86400000).toISOString(),
        endDate: new Date(Date.now() + 5 * 86400000).toISOString(),
        goal: "Keep identity/profile work moving without hidden blockers",
        daysRemaining: 5,
        isPastEndDate: false,
      },
      totals: {
        tickets: tickets.length,
        done: 0,
        inProgress: tickets.filter((ticket) => ticket.status.includes("Progress")).length,
        unassigned: tickets.filter((ticket) => ticket.assignee === "Unassigned").length,
        backlog: board.backlog,
      },
      groups: {
        byStatus: groupCount(tickets, (ticket) => ticket.status),
        byAssignee: groupCount(tickets, (ticket) => ticket.assignee),
        byPriority: groupCount(tickets, (ticket) => ticket.priority),
        byType: groupCount(tickets, () => "Task"),
      },
      epics: buildEpicGroups(tickets),
      coverage: {
        withTickets: members.slice(0, 4).map((member) => ({ member, display: member, count: 1, hasTicket: true })),
        withoutTickets: members.slice(4, 8).map((member) => ({ member, display: member, count: 0, hasTicket: false })),
        unassignedTickets: [],
      },
      tickets,
    };
  });
}

function buildSupport() {
  const tickets = seed.issues.filter(isNotDone).map(addMockReasons);
  return {
    filterId: "18377",
    url: "https://josysglobal.atlassian.net/issues/?filter=18377",
    totals: {
      tickets: tickets.length,
      critical: tickets.filter((ticket) => ticket.severity === "critical").length,
      stale: tickets.filter((ticket) => ticket.reasons.some((reason) => reason.includes("motion"))).length,
      unassigned: tickets.filter((ticket) => ticket.assignee === "Unassigned").length,
    },
    groups: {
      byStatus: groupCount(tickets, (ticket) => ticket.status),
      byAssignee: groupCount(tickets, (ticket) => ticket.assignee),
      byPriority: groupCount(tickets, (ticket) => ticket.priority),
    },
    tickets,
  };
}

function addMockReasons(item) {
  const dueIn = daysUntil(item.due);
  const reasons = [];
  if (dueIn < 0) reasons.push(`${Math.abs(dueIn)}d overdue`);
  if (item.ageDays > 7) reasons.push(`${item.ageDays}d in motion`);
  if (item.labels.includes("blocked")) reasons.push("blocked");
  return { ...item, reasons, severity: reasons.includes("blocked") || dueIn < 0 ? "critical" : reasons.length ? "warn" : "good" };
}

function buildTrackers(tracked) {
  const configured = tracked
    .filter((line) => line.startsWith("filter:") || line.startsWith("dashboard:"))
    .map((line, index) => {
      const [kindAndId, ...nameParts] = line.split(" ");
      const [type, id] = kindAndId.split(":");
      return { type, id, name: nameParts.join(" ") || `${type} ${id}`, count: 4 + index * 3, previous: 5 + index, url: "#" };
    });
  return configured.length ? configured : seed.trackers;
}

function renderAll() {
  for (const section of sections) {
    if (!loadCache(section)) saveCache(section, buildMockPayload(section, loadSettings()), "seed");
  }
  renderTeam(loadCache("team"));
  renderSprint(loadCache("sprint"));
  renderOverview(loadCache("overview"));
  renderAttention(loadCache("attention"));
  renderSupport(loadCache("support"));
  renderTrackers(loadCache("trackers"));
  hydrateSettings();
  activatePage(location.hash?.replace("#", "") || "team");
  setGlobalCacheState("warm");
}

function renderOverview(cache) {
  setMeta("overview", cache);
  const payload = cache.payload;
  const myIssues = (payload.myIssues || []).filter(isNotDone);
  const emIssues = (payload.emIssues || []).filter(isNotDone);
  document.getElementById("overview-metrics").innerHTML = payload.metrics.map(([label, value, detail]) => `
    <article class="metric"><span>${escapeHtml(label)}</span><strong>${label === "Assigned" ? myIssues.length : label === "EM-owned" ? emIssues.length : value}</strong><small>${escapeHtml(detail)}</small></article>
  `).join("");
  document.getElementById("my-ticket-count").textContent = `${myIssues.length} issues`;
  document.getElementById("em-ticket-count").textContent = `${emIssues.length} issues`;
  renderPaginatedList("my-issues", myIssues, renderIssue);
  renderPaginatedList("em-issues", emIssues, renderIssue);
}

function renderAttention(cache) {
  setMeta("attention", cache);
  renderPaginatedList("attention-list", cache.payload.filter(isNotDone), (item) => `
    <article class="attention-row ${item.severity === "critical" ? "critical" : ""}">
      <div class="attention-top">
        <div>
          ${renderIssueLink(item, "key")}
          <p class="summary">${escapeHtml(item.summary)}</p>
        </div>
        <span class="tag ${item.severity === "critical" ? "hot" : "warn"}">${escapeHtml(item.severity)}</span>
      </div>
      <div class="tag-row">${item.reasons.map((reason) => `<span class="tag warn">${escapeHtml(reason)}</span>`).join("")}</div>
    </article>
  `);
}

function renderTeam(cache) {
  setMeta("team", cache);
  renderTeamCommand(cache.payload);
  document.getElementById("team-list").innerHTML = cache.payload.map(renderTeamMember).join("");
}

function renderTeamCommand(members) {
  const sorted = [...members].sort((a, b) => (b.active || 0) - (a.active || 0));
  const noSprintTickets = members.filter((member) => !(member.boards || []).some((board) => board.active > 0 || board.workedOn > 0));
  const stale = members.filter((member) => (member.oldest || 0) > 14);
  const memberNames = members.map((member) => member.member);
  document.getElementById("team-command").innerHTML = `
    <div class="team-radar-card">
      <h4>Workload shape</h4>
      <div class="load-bars">
        ${sorted.map((member) => {
          const width = Math.min(100, Math.round(((member.active || 0) / Math.max(1, sorted[0]?.active || 1)) * 100));
          return `
            <div class="load-row">
              <a href="#${escapeAttribute(memberAnchorId(member.member))}" data-member-target="${escapeAttribute(memberAnchorId(member.member))}">${escapeHtml(shortName(member.member))}</a>
              <div class="load-track"><div style="width: ${width}%"></div></div>
              <strong>${member.active || 0}</strong>
            </div>
          `;
        }).join("")}
      </div>
    </div>
    <div class="team-radar-card">
      <h4>EM signals</h4>
      <div class="signal-grid">
        ${renderSignal("No sprint activity", noSprintTickets.length, noSprintTickets.map((member) => shortName(member.member)).slice(0, 6).join(", ") || "clear", teamIssueSearchUrl(noSprintTickets.map((member) => member.member)))}
        ${renderSignal("Stale oldest item", stale.length, stale.map((member) => shortName(member.member)).slice(0, 6).join(", ") || "clear", teamIssueSearchUrl(stale.map((member) => member.member), "ORDER BY updated ASC"))}
        ${renderSignal("Total active", members.reduce((sum, member) => sum + (member.active || 0), 0), "assigned across team", teamIssueSearchUrl(memberNames, "ORDER BY updated ASC"))}
        ${renderSignal("In progress", members.reduce((sum, member) => sum + (member.inProgress || 0), 0), "currently moving", teamIssueSearchUrl(memberNames, "AND statusCategory = \"In Progress\" ORDER BY updated ASC"))}
      </div>
    </div>
  `;
}

function renderSignal(label, value, detail, url) {
  return `
    <a class="signal" href="${escapeAttribute(url)}" target="_blank" rel="noopener noreferrer">
      <span>${escapeHtml(label)}</span>
      <strong>${value}</strong>
      <small>${escapeHtml(detail)}</small>
    </a>
  `;
}

function renderSprint(cache) {
  setMeta("sprint", cache);
  document.getElementById("sprint-view").innerHTML = cache.payload.map(renderSprintBoard).join("");
}

function renderSprintBoard(board) {
  const sprint = board.sprint;
  if (!sprint) {
    return `<article class="panel"><h4>${escapeHtml(board.name)}</h4><p class="empty-state">No active sprint found.</p></article>`;
  }
  const tickets = (board.tickets || []).filter(isNotDone);
  const progress = 0;
  const endCopy = sprint.daysRemaining === null
    ? "No end date"
    : sprint.daysRemaining < 0
      ? `${Math.abs(sprint.daysRemaining)}d past end`
      : sprint.daysRemaining === 0
        ? "Ends today"
        : `${sprint.daysRemaining}d left`;
  const statusGroupId = `sprint-status-${board.id}`;
  const assigneeGroupId = `sprint-assignee-${board.id}`;
  const priorityGroupId = `sprint-priority-${board.id}`;
  const epics = board.epics?.length ? board.epics : buildEpicGroups(tickets);
  return `
    <article class="sprint-board">
      <div class="sprint-hero">
        <div>
          <a class="eyebrow" href="${escapeAttribute(boardHref(board.id))}" target="_blank" rel="noopener noreferrer">board ${escapeHtml(board.id)}</a>
          <h4>${escapeHtml(sprint.name)}</h4>
          <p>${escapeHtml(board.name)}${sprint.goal ? ` · ${escapeHtml(sprint.goal)}` : ""}</p>
        </div>
        <a class="sprint-date ${sprint.isPastEndDate ? "danger" : ""}" href="${escapeAttribute(boardHref(board.id))}" target="_blank" rel="noopener noreferrer">${escapeHtml(endCopy)}</a>
      </div>
      <div class="metric-grid compact">
        ${renderMetric("Sprint tickets", tickets.length, "open only", sprintSearchUrl(board))}
        ${renderMetric("In progress", board.totals?.inProgress || 0, "active motion", sprintSearchUrl(board, "AND statusCategory = \"In Progress\" ORDER BY updated DESC"))}
        ${renderMetric("Unassigned", tickets.filter((ticket) => ticket.assignee === "Unassigned").length, "ownership gap", sprintSearchUrl(board, "AND assignee is EMPTY ORDER BY updated DESC"))}
        ${renderMetric("Backlog", board.totals?.backlog || 0, "outside sprint", `${boardHref(board.id)}&view=planning`)}
      </div>
      <div class="progress-bar large"><div class="progress-fill" style="width: ${Math.min(100, progress)}%"></div></div>
      <div class="ops-grid">
        ${renderGroupPanel("By status", board.groups?.byStatus || [], statusGroupId, (item) => sprintSearchUrl(board, `AND status = ${jqlQuote(item.name)} ORDER BY updated DESC`))}
        ${renderGroupPanel("By assignee", board.groups?.byAssignee || [], assigneeGroupId, (item) => sprintAssigneeSearchUrl(board, item.name))}
        ${renderGroupPanel("By priority", board.groups?.byPriority || [], priorityGroupId, (item) => sprintPrioritySearchUrl(board, item.name))}
      </div>
      <div class="coverage-grid">
        <div class="panel">
          <div class="panel-heading"><h4>Has sprint tickets</h4>${renderCountLink(board.coverage?.withTickets?.length || 0, sprintSearchUrl(board))}</div>
          <div class="person-chip-list">${(board.coverage?.withTickets || []).map((person) => `<a class="person-chip" href="${escapeAttribute(sprintAssigneeSearchUrl(board, person.member))}" target="_blank" rel="noopener noreferrer">${escapeHtml(shortName(person.member))}<strong>${person.count}</strong></a>`).join("") || `<span class="empty-state">No one mapped yet</span>`}</div>
        </div>
        <div class="panel">
          <div class="panel-heading"><h4>No sprint tickets</h4>${renderCountLink(board.coverage?.withoutTickets?.length || 0, boardHref(board.id))}</div>
          <div class="person-chip-list">${(board.coverage?.withoutTickets || []).map((person) => `<span class="person-chip muted">${escapeHtml(shortName(person.member))}</span>`).join("") || `<span class="empty-state">Everyone has sprint work</span>`}</div>
        </div>
      </div>
      <div class="panel sprint-ticket-panel">
        <div class="panel-heading"><h4>Sprint tickets by epic</h4>${renderCountLink(tickets.length, sprintSearchUrl(board), "open issues")}</div>
        <div class="sprint-epic-list">${epics.map((epic) => renderSprintEpic(epic, board)).join("") || `<span class="empty-state">No sprint tickets found</span>`}</div>
      </div>
    </article>
  `;
}

function renderBoards(cache) {
  setMeta("boards", cache);
  document.getElementById("board-grid").innerHTML = cache.payload.map((board) => {
    const progress = 0;
    return `
      <article class="board-card">
        <div class="board-top">
          <div>
            <span class="key">board ${escapeHtml(board.id)}</span>
            <p class="summary">${escapeHtml(board.name)}</p>
          </div>
          <span class="tag ${board.blocked ? "hot" : ""}">${board.blocked} blocked</span>
        </div>
        <div class="tag-row">
          <span class="tag">${escapeHtml(board.sprint)}</span>
          <span class="tag">${board.active} active</span>
          <span class="tag">${board.backlog} backlog</span>
        </div>
        ${board.tickets?.length ? `<div class="mini-ticket-list">${board.tickets.slice(0, 6).map(renderMiniIssue).join("")}</div>` : ""}
        <div class="progress-bar"><div class="progress-fill" style="width: ${Math.min(100, progress)}%"></div></div>
      </article>
    `;
  }).join("");
}

function renderSupport(cache) {
  setMeta("support", cache);
  const payload = { ...cache.payload, tickets: (cache.payload.tickets || []).filter(isNotDone) };
  const filterUrl = payload.url || supportFilterUrl(payload.filterId || "18377");
  document.getElementById("support-view").innerHTML = `
    <div class="support-header">
      <div>
        <span class="eyebrow">filter ${escapeHtml(payload.filterId || "18377")}</span>
        <h4>Customer support attention queue</h4>
      </div>
      <a class="command-link" href="${escapeAttribute(filterUrl)}" target="_blank" rel="noopener noreferrer">Open in Jira</a>
    </div>
    <div class="metric-grid compact">
      ${renderMetric("Tickets", payload.tickets.length, "open in filter", supportSearchUrl(payload))}
      ${renderMetric("Critical", payload.tickets.filter((ticket) => ticket.severity === "critical").length, "needs attention", supportSearchUrl(payload, "AND (labels = blocked OR duedate <= now()) ORDER BY priority DESC, updated ASC"))}
      ${renderMetric("Stale", payload.tickets.filter((ticket) => ticket.reasons?.some((reason) => reason.includes("motion"))).length, "age signal", supportSearchUrl(payload, "AND updated <= -7d ORDER BY updated ASC"))}
      ${renderMetric("Unassigned", payload.tickets.filter((ticket) => ticket.assignee === "Unassigned").length, "ownership gap", supportSearchUrl(payload, "AND assignee is EMPTY ORDER BY priority DESC, updated ASC"))}
    </div>
    <div class="ops-grid">
      ${renderGroupPanel("Status", payload.groups?.byStatus || [], "", (item) => supportSearchUrl(payload, `AND status = ${jqlQuote(item.name)} ORDER BY priority DESC, updated ASC`))}
      ${renderGroupPanel("Assignee", payload.groups?.byAssignee || [], "", (item) => supportAssigneeSearchUrl(payload, item.name))}
      ${renderGroupPanel("Priority", payload.groups?.byPriority || [], "", (item) => supportPrioritySearchUrl(payload, item.name))}
    </div>
    <div class="panel support-ticket-panel">
      <div class="panel-heading"><h4>Support tickets</h4>${renderCountLink(payload.tickets?.length || 0, supportSearchUrl(payload), "issues")}</div>
      <div class="compact-ticket-list">${payload.tickets.length ? payload.tickets.map(renderSupportCompactIssue).join("") : `<span class="empty-state">No support tickets found</span>`}</div>
    </div>
  `;
}

function renderTrackers(cache) {
  setMeta("trackers", cache);
  document.getElementById("tracker-grid").innerHTML = cache.payload.map((tracker) => {
    const delta = tracker.count - tracker.previous;
    return `
      <article class="tracker-card">
        <div class="tracker-top">
          <div>
            <span class="key">${escapeHtml(tracker.type)} ${escapeHtml(tracker.id)}</span>
            <p class="summary">${escapeHtml(tracker.name)}</p>
          </div>
          <span class="tag ${delta > 0 ? "warn" : ""}">${delta >= 0 ? "+" : ""}${delta}</span>
        </div>
        <div class="metric"><span>current count</span><strong>${tracker.count}</strong><small>previous ${tracker.previous}</small></div>
      </article>
    `;
  }).join("");
}

function renderMetric(label, value, detail, url = "") {
  const body = `<span>${escapeHtml(label)}</span><strong>${value}</strong><small>${escapeHtml(detail)}</small>`;
  return url
    ? `<a class="metric metric-link" href="${escapeAttribute(url)}" target="_blank" rel="noopener noreferrer">${body}</a>`
    : `<article class="metric">${body}</article>`;
}

function renderGroupPanel(title, items, id = "", linkFactory = null) {
  return `
    <div class="group-panel"${id ? ` id="${escapeAttribute(id)}"` : ""}>
      <h4>${escapeHtml(title)}</h4>
      <div class="group-bars">
        ${items.slice(0, 10).map((item) => {
          const max = Math.max(1, items[0]?.count || 1);
          const count = linkFactory
            ? `<a href="${escapeAttribute(linkFactory(item))}" target="_blank" rel="noopener noreferrer">${item.count}</a>`
            : `<strong>${item.count}</strong>`;
          return `
            <div class="group-row">
              <span>${escapeHtml(item.name)}</span>
              <div class="load-track"><div style="width: ${Math.round((item.count / max) * 100)}%"></div></div>
              ${count}
            </div>
          `;
        }).join("") || `<span class="empty-state">No data</span>`}
      </div>
    </div>
  `;
}

function renderSprintEpic(epic, board) {
  const tickets = (epic.tickets || []).filter(isNotDone);
  const epicUrl = epic.key === "NO_EPIC" ? sprintSearchUrl(board, "AND parent is EMPTY AND \"Epic Link\" is EMPTY ORDER BY updated DESC") : sprintEpicSearchUrl(board, epic.key);
  const inProgress = epic.totals?.inProgress ?? tickets.filter((ticket) => ticket.status.toLowerCase().includes("progress")).length;
  const blocked = epic.totals?.blocked ?? tickets.filter((ticket) => ticket.labels?.includes("blocked") || ticket.status.toLowerCase().includes("blocked")).length;
  return `
    <article class="sprint-epic">
      <div class="sprint-epic-head">
        <div>
          ${epic.key === "NO_EPIC" ? `<span class="key">no epic</span>` : `<a class="key" href="${escapeAttribute(epic.url || epicUrl)}" target="_blank" rel="noopener noreferrer">${escapeHtml(epic.key)}</a>`}
          <h5>${escapeHtml(epic.summary || epic.key)}</h5>
        </div>
        <div class="epic-stats">
          ${renderCountLink(tickets.length, epicUrl, "open")}
          ${renderCountLink(inProgress, sprintSearchUrl(board, `${epicJqlClause(epic.key)} AND statusCategory = \"In Progress\" ORDER BY updated DESC`), "moving")}
          ${renderCountLink(blocked, sprintSearchUrl(board, `${epicJqlClause(epic.key)} AND (labels = blocked OR status = ${jqlQuote("Blocked")}) ORDER BY updated DESC`), "blocked")}
        </div>
      </div>
      <div class="compact-ticket-list">
        ${tickets.map(renderCompactIssue).join("")}
      </div>
    </article>
  `;
}

function renderCompactIssue(item) {
  return `
    <a class="compact-ticket" href="${escapeAttribute(issueHref(item))}" target="_blank" rel="noopener noreferrer">
      <span>${escapeHtml(item.key)}</span>
      <strong>${escapeHtml(item.summary || "Untitled issue")}</strong>
      <em>${escapeHtml(item.assignee || "Unassigned")}</em>
      <small>${escapeHtml(item.status || "Unknown")}</small>
    </a>
  `;
}

function renderSupportCompactIssue(item) {
  return `
    <a class="compact-ticket support-compact-ticket" href="${escapeAttribute(issueHref(item))}" target="_blank" rel="noopener noreferrer">
      <span>${escapeHtml(item.key)}</span>
      <strong>${escapeHtml(item.summary || "Untitled issue")}</strong>
      <em>${escapeHtml(item.assignee || "Unassigned")}</em>
      <small>${escapeHtml(item.priority || "None")} · ${escapeHtml(item.status || "Unknown")}</small>
    </a>
  `;
}

function renderCountLink(value, url, label = "") {
  return `<a class="count-link" href="${escapeAttribute(url)}" target="_blank" rel="noopener noreferrer">${value}${label ? ` <span>${escapeHtml(label)}</span>` : ""}</a>`;
}

function renderIssue(item) {
  return `
    <article class="issue-row">
      <div class="issue-top">
        <div>
          ${renderIssueLink(item, "key")}
          <p class="summary">${renderIssueLink(item, "summary")}</p>
        </div>
        <span class="tag ${item.priority === "High" ? "hot" : ""}">${escapeHtml(item.priority || "None")}</span>
      </div>
      <div class="tag-row">
        <span class="tag">${escapeHtml(item.status || "Unknown")}</span>
        <span class="tag">${escapeHtml(item.assignee || "Unassigned")}</span>
        <span class="tag">${formatAge(item)}</span>
        <span class="tag">${formatDue(item.due)}</span>
      </div>
    </article>
  `;
}

function renderTeamMember(member) {
  const tickets = (member.tickets?.length ? member.tickets : member.recentTickets || []).filter(isNotDone);
  const boards = member.boards || [];
  const memberIssueUrl = teamIssueSearchUrl([member.member], "ORDER BY updated ASC");
  return `
    <article class="team-card" id="${escapeAttribute(memberAnchorId(member.member))}">
      <div class="team-card-head">
        <div>
          <h4>${escapeHtml(member.member)}</h4>
          <p>${escapeHtml(member.attention || "healthy")}</p>
        </div>
        <a class="tag team-action-tag ${member.attention === "healthy" ? "" : "warn"}" href="${escapeAttribute(memberIssueUrl)}" target="_blank" rel="noopener noreferrer">${member.active || 0} active</a>
      </div>
      <div class="team-metrics">
        <a href="${escapeAttribute(teamIssueSearchUrl([member.member], "AND statusCategory = \"In Progress\" ORDER BY updated ASC"))}" target="_blank" rel="noopener noreferrer"><strong>${member.inProgress || 0}</strong> in progress</a>
        <a href="${escapeAttribute(memberIssueUrl)}" target="_blank" rel="noopener noreferrer"><strong>${Number.isFinite(member.oldest) ? member.oldest : 0}d</strong> oldest</a>
        <span><strong>${boards.length}</strong> boards</span>
      </div>
      ${boards.length ? `
        <div class="team-subsection">
          <h5>Boards</h5>
          ${boards.map((board) => `
            <div class="board-work">
              <div>
                <a class="key" href="${escapeAttribute(boardHref(board.id))}" target="_blank" rel="noopener noreferrer">board ${escapeHtml(board.id)}</a>
                <a class="board-name-link" href="${escapeAttribute(boardHref(board.id))}" target="_blank" rel="noopener noreferrer">${escapeHtml(board.name)}</a>
              </div>
              <a class="board-work-count" href="${escapeAttribute(teamIssueSearchUrl([member.member], "ORDER BY updated DESC"))}" target="_blank" rel="noopener noreferrer">${board.active || 0} active / ${board.workedOn || 0} worked</a>
            </div>
          `).join("")}
        </div>
      ` : ""}
      <div class="team-subsection">
        <h5>Tickets</h5>
        <div class="mini-ticket-list">${tickets.length ? tickets.slice(0, 8).map(renderMiniIssue).join("") : `<span class="empty-state">No matching tickets in cache</span>`}</div>
      </div>
    </article>
  `;
}

function renderMiniIssue(item) {
  return `
    <a class="mini-ticket" href="${escapeAttribute(issueHref(item))}" target="_blank" rel="noopener noreferrer">
      <span>${escapeHtml(item.key)}</span>
      <strong>${escapeHtml(item.summary || "Untitled issue")}</strong>
      <em>${escapeHtml(item.status || "Unknown")} · ${formatAge(item)}</em>
    </a>
  `;
}

function isNotDone(issue) {
  const status = String(issue.status || "").toLowerCase();
  return issue.statusCategory !== "done" && status !== "done" && status !== "closed" && status !== "archived";
}

function renderIssueLink(item, className) {
  const text = className === "summary" ? item.summary || "Untitled issue" : item.key;
  return `<a class="${className}" href="${escapeAttribute(issueHref(item))}" target="_blank" rel="noopener noreferrer">${escapeHtml(text)}</a>`;
}

function setMeta(section, cache) {
  const ageMinutes = Math.max(0, Math.round((Date.now() - new Date(cache.refreshedAt).getTime()) / 60000));
  document.getElementById(`${section}-meta`).textContent = `${cache.source} cache refreshed ${ageMinutes}m ago`;
}

function renderPaginatedList(containerId, items, renderer, size = pageSize) {
  const container = document.getElementById(containerId);
  if (!container) return;
  const totalPages = Math.max(1, Math.ceil(items.length / size));
  const state = paginationState[containerId] || { page: 1 };
  state.page = Math.min(Math.max(1, state.page), totalPages);
  paginationState[containerId] = state;
  const start = (state.page - 1) * size;
  const pageItems = items.slice(start, start + size);

  container.innerHTML = `
    <div class="paginated-list">
      ${pageItems.map(renderer).join("") || `<span class="empty-state">No issues found</span>`}
    </div>
    ${items.length > size ? `
      <div class="pagination">
        <button data-page-list="${escapeAttribute(containerId)}" data-page-delta="-1" ${state.page === 1 ? "disabled" : ""}>Prev</button>
        <span>${state.page} / ${totalPages} · ${items.length} items</span>
        <button data-page-list="${escapeAttribute(containerId)}" data-page-delta="1" ${state.page === totalPages ? "disabled" : ""}>Next</button>
      </div>
    ` : ""}
  `;
}

function rerenderPaginatedList(containerId) {
  if (containerId === "my-issues") return renderOverview(loadCache("overview"));
  if (containerId === "em-issues") return renderOverview(loadCache("overview"));
  if (containerId === "attention-list") return renderAttention(loadCache("attention"));
  if (containerId.startsWith("sprint-tickets-")) return renderSprint(loadCache("sprint"));
}

function activatePage(page) {
  const target = sections.includes(page) || page === "settings" ? page : "team";
  document.querySelectorAll(".page-section").forEach((section) => {
    section.hidden = section.dataset.page !== target;
  });
  document.querySelectorAll("[data-page-target]").forEach((button) => {
    button.classList.toggle("active", button.dataset.pageTarget === target);
  });
  if (location.hash !== `#${target}`) {
    history.replaceState(null, "", `#${target}`);
  }
}

function hydrateSettings() {
  const settings = loadSettings();
  const form = document.getElementById("settings-form");
  for (const [key, value] of Object.entries(settings)) {
    if (form.elements[key]) form.elements[key].value = value;
  }
}

function readSettingsForm() {
  const form = document.getElementById("settings-form");
  return Object.fromEntries(new FormData(form).entries());
}

function parseLines(value) {
  return value.split("\n").map((line) => line.trim()).filter(Boolean);
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

function buildEpicGroups(tickets) {
  const groups = new Map();
  for (const ticket of tickets) {
    const parent = ticket.parent || { key: "NO_EPIC", summary: "No epic / parent", type: "Unmapped", status: null, url: null };
    if (!groups.has(parent.key)) {
      groups.set(parent.key, {
        key: parent.key,
        summary: parent.summary || parent.key,
        type: parent.type || "Epic",
        status: parent.status || null,
        url: parent.url || null,
        tickets: [],
      });
    }
    groups.get(parent.key).tickets.push(ticket);
  }
  return [...groups.values()]
    .map((group) => ({
      ...group,
      totals: {
        tickets: group.tickets.length,
        inProgress: group.tickets.filter((ticket) => ticket.status.toLowerCase().includes("progress")).length,
        blocked: group.tickets.filter((ticket) => ticket.labels?.includes("blocked") || ticket.status.toLowerCase().includes("blocked")).length,
        unassigned: group.tickets.filter((ticket) => ticket.assignee === "Unassigned").length,
      },
    }))
    .sort((a, b) => b.totals.tickets - a.totals.tickets || a.summary.localeCompare(b.summary));
}

function shortName(value) {
  return String(value || "Unknown")
    .split("@")[0]
    .replace(/[._-]+/g, " ")
    .replace(/\b\w/g, (char) => char.toUpperCase());
}

function daysUntil(isoDate) {
  if (!isoDate) return null;
  return Math.ceil((new Date(isoDate).getTime() - Date.now()) / 86400000);
}

function formatAge(item) {
  const age = Number.isFinite(item.ageDays)
    ? item.ageDays
    : item.statusCategoryChangedDate || item.updated
      ? Math.max(0, Math.floor((Date.now() - new Date(item.statusCategoryChangedDate || item.updated).getTime()) / 86400000))
      : null;
  return age === null ? "age unknown" : `age ${age}d`;
}

function formatDue(isoDate) {
  const dueIn = daysUntil(isoDate);
  if (dueIn === null) return "no due date";
  if (dueIn === 0) return "due today";
  return dueIn > 0 ? `due in ${dueIn}d` : `${Math.abs(dueIn)}d overdue`;
}

function issueHref(item) {
  if (item.url) return item.url;
  return `${loadSettings().jiraSiteUrl.replace(/\/$/, "")}/browse/${item.key}`;
}

function boardHref(boardId) {
  return `${loadSettings().jiraSiteUrl.replace(/\/$/, "")}/secure/RapidBoard.jspa?rapidView=${encodeURIComponent(boardId)}`;
}

function jiraSearchUrl(jql) {
  return `${loadSettings().jiraSiteUrl.replace(/\/$/, "")}/issues/?jql=${encodeURIComponent(jql)}`;
}

function sprintSearchUrl(board, suffix = "ORDER BY updated DESC") {
  const sprintId = board.sprint?.id;
  const base = sprintId ? `sprint = ${sprintId}` : `project is not EMPTY`;
  return jiraSearchUrl(`${base} AND resolution = EMPTY ${suffix}`.trim());
}

function sprintAssigneeSearchUrl(board, assignee) {
  const clause = assignee === "Unassigned"
    ? "AND assignee is EMPTY"
    : `AND assignee = ${jqlQuote(assignee)}`;
  return sprintSearchUrl(board, `${clause} ORDER BY updated DESC`);
}

function sprintPrioritySearchUrl(board, priority) {
  const clause = priority === "None"
    ? "AND priority is EMPTY"
    : `AND priority = ${jqlQuote(priority)}`;
  return sprintSearchUrl(board, `${clause} ORDER BY updated DESC`);
}

function sprintEpicSearchUrl(board, epicKey) {
  return sprintSearchUrl(board, `${epicJqlClause(epicKey)} ORDER BY updated DESC`);
}

function supportFilterUrl(filterId = "18377") {
  return `${loadSettings().jiraSiteUrl.replace(/\/$/, "")}/issues/?filter=${encodeURIComponent(filterId)}`;
}

function supportSearchUrl(payload, suffix = "ORDER BY priority DESC, updated ASC") {
  const filterId = payload.filterId || "18377";
  return jiraSearchUrl(`filter = ${filterId} ${suffix}`.trim());
}

function supportAssigneeSearchUrl(payload, assignee) {
  const clause = assignee === "Unassigned"
    ? "AND assignee is EMPTY"
    : `AND assignee = ${jqlQuote(assignee)}`;
  return supportSearchUrl(payload, `${clause} ORDER BY priority DESC, updated ASC`);
}

function supportPrioritySearchUrl(payload, priority) {
  const clause = priority === "None"
    ? "AND priority is EMPTY"
    : `AND priority = ${jqlQuote(priority)}`;
  return supportSearchUrl(payload, `${clause} ORDER BY priority DESC, updated ASC`);
}

function epicJqlClause(epicKey) {
  if (epicKey === "NO_EPIC") return `AND parent is EMPTY AND "Epic Link" is EMPTY`;
  return `AND (parent = ${jqlQuote(epicKey)} OR "Epic Link" = ${jqlQuote(epicKey)})`;
}

function jqlQuote(value) {
  return `"${String(value || "").replace(/\\/g, "\\\\").replace(/"/g, "\\\"")}"`;
}

function teamIssueSearchUrl(members, suffix = "ORDER BY updated DESC") {
  const assignees = members.filter(Boolean);
  const assigneeClause = assignees.length
    ? `assignee in (${assignees.map((member) => `"${member.replace(/"/g, "\\\"")}"`).join(", ")})`
    : "assignee is not EMPTY";
  const jql = `${assigneeClause} AND resolution = EMPTY ${suffix}`.trim();
  return `${loadSettings().jiraSiteUrl.replace(/\/$/, "")}/issues/?jql=${encodeURIComponent(jql)}`;
}

function memberAnchorId(member) {
  return `team-member-${String(member || "unknown").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "")}`;
}

function wait(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function escapeHtml(value) {
  return String(value).replace(/[&<>"']/g, (char) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#039;",
  })[char]);
}

function escapeAttribute(value) {
  return escapeHtml(value).replace(/`/g, "&#096;");
}

function setGlobalCacheState(state) {
  document.getElementById("global-cache-state").textContent = state;
}

document.addEventListener("click", async (event) => {
  const memberLink = event.target.closest("[data-member-target]");
  if (memberLink) {
    event.preventDefault();
    activatePage("team");
    document.getElementById(memberLink.dataset.memberTarget)?.scrollIntoView({ behavior: "smooth", block: "start" });
    return;
  }

  const navButton = event.target.closest("[data-page-target]");
  if (navButton) {
    activatePage(navButton.dataset.pageTarget);
    return;
  }

  const pageButton = event.target.closest("[data-page-list]");
  if (pageButton) {
    const containerId = pageButton.dataset.pageList;
    const delta = Number(pageButton.dataset.pageDelta || 0);
    paginationState[containerId] = paginationState[containerId] || { page: 1 };
    paginationState[containerId].page += delta;
    rerenderPaginatedList(containerId);
    return;
  }

  const refreshButton = event.target.closest("[data-refresh]");
  if (refreshButton) {
    const section = refreshButton.dataset.refresh;
    refreshButton.textContent = "Refreshing";
    try {
      const cache = await refreshSection(section);
      if (section === "overview") renderOverview(cache);
      if (section === "attention") renderAttention(cache);
      if (section === "team") renderTeam(cache);
      if (section === "sprint") renderSprint(cache);
      if (section === "support") renderSupport(cache);
      if (section === "trackers") renderTrackers(cache);
    } finally {
      refreshButton.textContent = "Refresh";
      setGlobalCacheState("warm");
    }
  }
});

document.getElementById("refresh-all").addEventListener("click", async () => {
  for (const section of sections) {
    const cache = await refreshSection(section);
    if (section === "overview") renderOverview(cache);
    if (section === "attention") renderAttention(cache);
    if (section === "team") renderTeam(cache);
    if (section === "sprint") renderSprint(cache);
    if (section === "support") renderSupport(cache);
    if (section === "trackers") renderTrackers(cache);
  }
  setGlobalCacheState("warm");
});

document.getElementById("clear-cache").addEventListener("click", () => {
  for (const section of sections) localStorage.removeItem(`${CACHE_PREFIX}cache:${section}`);
  renderAll();
});

document.getElementById("sidebar-toggle").addEventListener("click", () => {
  const shell = document.querySelector(".app-shell");
  const collapsed = shell.classList.toggle("nav-collapsed");
  document.getElementById("sidebar-toggle").setAttribute("aria-expanded", String(!collapsed));
});

document.getElementById("save-settings").addEventListener("click", () => {
  saveSettings(readSettingsForm());
  for (const section of ["team", "sprint", "support", "trackers"]) {
    saveCache(section, buildMockPayload(section, loadSettings()), "settings");
  }
  renderAll();
});

window.addEventListener("hashchange", () => activatePage(location.hash.replace("#", "")));

renderAll();
