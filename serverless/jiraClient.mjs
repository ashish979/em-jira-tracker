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

  async function searchIssues({ jql, fields = [], maxResults = 50 }) {
    return request("/rest/api/3/search/jql", {
      method: "POST",
      body: JSON.stringify({
        jql,
        maxResults,
        fields,
      }),
    });
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

  async function getBoardIssues(boardId) {
    return request(`/rest/agile/1.0/board/${encodeURIComponent(boardId)}/issue?maxResults=100`);
  }

  async function getBacklog(boardId) {
    return request(`/rest/agile/1.0/board/${encodeURIComponent(boardId)}/backlog?maxResults=100`);
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

export function normalizeIssue(issue, emField) {
  const fields = issue.fields || {};
  const assignee = fields.assignee || {};
  const status = fields.status || {};
  const priority = fields.priority || {};
  const em = emField ? fields[emField] : null;

  return {
    key: issue.key,
    summary: fields.summary || "",
    status: status.name || "Unknown",
    priority: priority.name || "None",
    assignee: assignee.displayName || assignee.emailAddress || "Unassigned",
    em: em?.displayName || em?.emailAddress || em?.value || null,
    due: fields.duedate || null,
    updated: fields.updated || null,
    statusCategoryChangedDate: fields.statuscategorychangedate || null,
    labels: fields.labels || [],
    url: issue.self || null,
  };
}
