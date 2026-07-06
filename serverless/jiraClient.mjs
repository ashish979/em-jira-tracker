export function createJiraClient({ siteUrl, email, apiToken }) {
  if (!siteUrl || !email || !apiToken) {
    throw new Error("Jira site URL, email, and API token are required.");
  }

  const baseUrl = siteUrl.replace(/\/$/, "");
  const auth = Buffer.from(`${email}:${apiToken}`).toString("base64");

  async function request(path, options = {}) {
    const response = await fetch(`${baseUrl}${path}`, {
      ...options,
      headers: {
        authorization: `Basic ${auth}`,
        accept: "application/json",
        "content-type": "application/json",
        ...options.headers,
      },
    });

    if (!response.ok) {
      const body = await response.text();
      throw new Error(`Jira API ${response.status}: ${body}`);
    }

    return response.json();
  }

  async function searchIssues({ jql, fields = [], maxResults = 100, limit = 1000 }) {
    const issues = [];
    let nextPageToken;
    let total;
    let lastResult = {};

    while (issues.length < limit) {
      const result = await request("/rest/api/3/search/jql", {
        method: "POST",
        body: JSON.stringify({
          jql,
          fields,
          maxResults: Math.min(maxResults, limit - issues.length),
          ...(nextPageToken ? { nextPageToken } : {}),
        }),
      });

      lastResult = result;
      issues.push(...(result.issues || []));
      total = typeof result.total === "number" ? result.total : total;
      nextPageToken = result.nextPageToken;

      if (nextPageToken) continue;
      break;
    }

    return {
      ...lastResult,
      issues,
      total: total ?? issues.length,
      returned: issues.length,
      truncated: issues.length >= limit && (typeof total !== "number" || issues.length < total),
    };
  }

  async function getFields() {
    return request("/rest/api/3/field");
  }

  async function getBoard(boardId) {
    return request(`/rest/agile/1.0/board/${encodeURIComponent(boardId)}`);
  }

  async function getActiveSprints(boardId) {
    return request(`/rest/agile/1.0/board/${encodeURIComponent(boardId)}/sprint?state=active`);
  }

  async function getBoardIssues(boardId, { fields = [], jql = "", limit = 1000 } = {}) {
    const params = new URLSearchParams({ maxResults: "100" });
    if (jql) params.set("jql", jql);
    for (const field of fields) params.append("fields", field);
    return pagedAgile(`/rest/agile/1.0/board/${encodeURIComponent(boardId)}/issue`, params, "issues", limit);
  }

  async function getBacklog(boardId, { fields = [], limit = 1000 } = {}) {
    const params = new URLSearchParams({ maxResults: "100" });
    for (const field of fields) params.append("fields", field);
    return pagedAgile(`/rest/agile/1.0/board/${encodeURIComponent(boardId)}/backlog`, params, "issues", limit);
  }

  async function pagedAgile(path, params, itemKey, limit) {
    const items = [];
    let nextPageToken;
    let startAt = 0;
    let total;
    let lastResult = {};

    while (items.length < limit) {
      const pageParams = new URLSearchParams(params);
      pageParams.set("maxResults", String(Math.min(Number(pageParams.get("maxResults") || 100), limit - items.length)));
      if (nextPageToken) pageParams.set("nextPageToken", nextPageToken);
      else pageParams.set("startAt", String(startAt));

      const result = await request(`${path}?${pageParams.toString()}`);
      const pageItems = result[itemKey] || result.values || [];
      lastResult = result;
      items.push(...pageItems);
      total = typeof result.total === "number" ? result.total : total;
      nextPageToken = result.nextPageToken;

      if (nextPageToken) continue;
      if (result.isLast === false && pageItems.length) {
        startAt += pageItems.length;
        continue;
      }
      if (typeof total === "number" && items.length < total && pageItems.length) {
        startAt += pageItems.length;
        continue;
      }
      break;
    }

    return {
      ...lastResult,
      [itemKey]: items,
      total: total ?? items.length,
      returned: items.length,
      truncated: items.length >= limit && (typeof total !== "number" || items.length < total),
    };
  }

  return {
    searchIssues,
    getFields,
    getBoard,
    getActiveSprints,
    getBoardIssues,
    getBacklog,
  };
}

export function normalizeIssue(issue, emField, siteUrl = "") {
  const fields = issue.fields || {};
  const assignee = fields.assignee || {};
  const status = fields.status || {};
  const priority = fields.priority || {};
  const em = emField ? fields[emField] : null;

  const statusChangedAt = fields.statuscategorychangedate || fields.statusCategoryChangedDate || null;

  return {
    key: issue.key,
    summary: fields.summary || "",
    status: status.name || "Unknown",
    priority: priority.name || "None",
    assignee: assignee.displayName || assignee.emailAddress || "Unassigned",
    em: em?.displayName || em?.emailAddress || em?.value || null,
    due: fields.duedate || null,
    updated: fields.updated || null,
    statusCategoryChangedDate: statusChangedAt,
    ageDays: ageDays(statusChangedAt || fields.updated || issue.created),
    labels: fields.labels || [],
    url: siteUrl ? `${siteUrl.replace(/\/$/, "")}/browse/${issue.key}` : issue.self || null,
  };
}

function ageDays(isoDate) {
  if (!isoDate) return null;
  return Math.max(0, Math.floor((Date.now() - new Date(isoDate).getTime()) / 86400000));
}
