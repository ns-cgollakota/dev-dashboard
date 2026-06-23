const BASE = '/api/jira';

export async function fetchAssignedIssues() {
  const jql = 'assignee = currentUser() ORDER BY updated DESC';
  const fields = [
    'key', 'summary', 'status', 'priority', 'issuetype',
    'updated', 'assignee', 'fixVersions',
    'customfield_10016', // story points (classic projects)
    'customfield_10028', // story points (next-gen projects)
    'customfield_10020', // sprint
  ].join(',');

  const PAGE = 100; // Jira API max per request
  let nextPageToken = null;
  let all = [];

  while (true) {
    let url = `${BASE}/rest/api/3/search/jql?jql=${encodeURIComponent(jql)}&fields=${fields}&maxResults=${PAGE}`;
    if (nextPageToken) url += `&nextPageToken=${encodeURIComponent(nextPageToken)}`;
    const res = await fetch(url);
    if (!res.ok) {
      const text = await res.text();
      throw new Error(`Jira API ${res.status}: ${text}`);
    }
    const data = await res.json();
    const issues = data.issues || [];
    all = all.concat(issues);

    if (data.isLast || !data.nextPageToken || issues.length < PAGE) break;
    nextPageToken = data.nextPageToken;
  }

  return all;
}

// Resolve Jira base URL from the meta endpoint so we can build deep links
export async function fetchJiraBaseUrl() {
  try {
    const res = await fetch(`${BASE}/rest/api/3/serverInfo`);
    if (!res.ok) return null;
    const data = await res.json();
    return data.baseUrl || null;
  } catch {
    return null;
  }
}
