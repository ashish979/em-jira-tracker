const CACHE_PREFIX = "jira-command-center:";
const CACHE_VERSION = "2026-07-06-team-links-v2";
const sections = ["overview", "attention", "team", "boards", "trackers"];

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
  trackedItems: ["board:141 User Profiles/Identities"].join("\n"),
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
    { id: "141", name: "User Profiles/Identities", sprint: "SC-Sprint 8", active: 18, done: 9, backlog: 64, blocked: 2 },
    { id: "77", name: "Developer experience", sprint: "Sprint 18", active: 11, done: 4, backlog: 31, blocked: 1 },
    { id: "13", name: "Ops reliability", sprint: "Sprint 09", active: 7, done: 6, backlog: 18, blocked: 0 },
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
  if (section === "boards") return buildBoards(tracked);
  if (section === "trackers") return buildTrackers(tracked);
  return {};
}

function buildOverview() {
  const myIssues = seed.issues.filter((item) => item.assignee === "Ashish" || item.assignee === "Aisha");
  const emIssues = seed.issues.filter((item) => item.em === "Ashish");
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
    const tickets = seed.issues.slice(index % 3, index % 3 + 3);
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
      return existing || { id: rawId, name: nameParts.join(" ") || `Board ${rawId}`, sprint: "Active sprint", active: 8, done: 3, backlog: 21, blocked: 0 };
    });
  return configuredBoards.length ? configuredBoards : seed.boards;
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
  renderOverview(loadCache("overview"));
  renderAttention(loadCache("attention"));
  renderTeam(loadCache("team"));
  renderBoards(loadCache("boards"));
  renderTrackers(loadCache("trackers"));
  hydrateSettings();
  setGlobalCacheState("warm");
}

function renderOverview(cache) {
  setMeta("overview", cache);
  const payload = cache.payload;
  document.getElementById("overview-metrics").innerHTML = payload.metrics.map(([label, value, detail]) => `
    <article class="metric"><span>${escapeHtml(label)}</span><strong>${value}</strong><small>${escapeHtml(detail)}</small></article>
  `).join("");
  document.getElementById("my-ticket-count").textContent = `${payload.myIssues.length} issues`;
  document.getElementById("em-ticket-count").textContent = `${payload.emIssues.length} issues`;
  document.getElementById("my-issues").innerHTML = payload.myIssues.map(renderIssue).join("");
  document.getElementById("em-issues").innerHTML = payload.emIssues.map(renderIssue).join("");
}

function renderAttention(cache) {
  setMeta("attention", cache);
  document.getElementById("attention-list").innerHTML = cache.payload.map((item) => `
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
  `).join("");
}

function renderTeam(cache) {
  setMeta("team", cache);
  document.getElementById("team-list").innerHTML = cache.payload.map(renderTeamMember).join("");
}

function renderBoards(cache) {
  setMeta("boards", cache);
  document.getElementById("board-grid").innerHTML = cache.payload.map((board) => {
    const progress = Math.round((board.done / Math.max(1, board.active)) * 100);
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
  const tickets = member.tickets?.length ? member.tickets : member.recentTickets || [];
  const boards = member.boards || [];
  return `
    <article class="team-card">
      <div class="team-card-head">
        <div>
          <h4>${escapeHtml(member.member)}</h4>
          <p>${escapeHtml(member.attention || "healthy")}</p>
        </div>
        <span class="tag ${member.attention === "healthy" ? "" : "warn"}">${member.active || 0} active</span>
      </div>
      <div class="team-metrics">
        <span><strong>${member.inProgress || 0}</strong> in progress</span>
        <span><strong>${Number.isFinite(member.oldest) ? member.oldest : 0}d</strong> oldest</span>
        <span><strong>${boards.length}</strong> boards</span>
      </div>
      ${boards.length ? `
        <div class="team-subsection">
          <h5>Boards</h5>
          ${boards.map((board) => `
            <div class="board-work">
              <div>
                <span class="key">board ${escapeHtml(board.id)}</span>
                <strong>${escapeHtml(board.name)}</strong>
              </div>
              <span>${board.active || 0} active / ${board.workedOn || 0} worked</span>
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

function renderIssueLink(item, className) {
  const text = className === "summary" ? item.summary || "Untitled issue" : item.key;
  return `<a class="${className}" href="${escapeAttribute(issueHref(item))}" target="_blank" rel="noopener noreferrer">${escapeHtml(text)}</a>`;
}

function setMeta(section, cache) {
  const ageMinutes = Math.max(0, Math.round((Date.now() - new Date(cache.refreshedAt).getTime()) / 60000));
  document.getElementById(`${section}-meta`).textContent = `${cache.source} cache refreshed ${ageMinutes}m ago`;
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
  const refreshButton = event.target.closest("[data-refresh]");
  if (refreshButton) {
    const section = refreshButton.dataset.refresh;
    refreshButton.textContent = "Refreshing";
    try {
      const cache = await refreshSection(section);
      if (section === "overview") renderOverview(cache);
      if (section === "attention") renderAttention(cache);
      if (section === "team") renderTeam(cache);
      if (section === "boards") renderBoards(cache);
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
    if (section === "boards") renderBoards(cache);
    if (section === "trackers") renderTrackers(cache);
  }
  setGlobalCacheState("warm");
});

document.getElementById("clear-cache").addEventListener("click", () => {
  for (const section of sections) localStorage.removeItem(`${CACHE_PREFIX}cache:${section}`);
  renderAll();
});

document.getElementById("save-settings").addEventListener("click", () => {
  saveSettings(readSettingsForm());
  for (const section of ["team", "boards", "trackers"]) {
    saveCache(section, buildMockPayload(section, loadSettings()), "settings");
  }
  renderAll();
});

renderAll();
