const BASE = '/api/confluence';

export async function fetchMyPages() {
  // Step 1: resolve the authenticated user's account ID
  const userRes = await fetch(`${BASE}/wiki/rest/api/user/current`);
  if (!userRes.ok) {
    const t = await userRes.text();
    throw new Error(`Confluence auth failed (${userRes.status}): ${t.slice(0, 120)}`);
  }
  const user = await userRes.json();
  const accountId = user.accountId;
  if (!accountId) throw new Error('Could not determine Confluence account ID from /user/current');

  // Step 2: CQL search scoped to pages created by this user.
  // NOTE: currentUser() is a Jira-only JQL function — it does NOT work in Confluence CQL.
  // Use creator.accountid with the resolved account ID instead.
  const cql = `type = page AND creator.accountid = "${accountId}" ORDER BY created DESC`;
  const url = `${BASE}/wiki/rest/api/search?cql=${encodeURIComponent(cql)}&limit=50&expand=content.space,content.version,content.history`;

  const res = await fetch(url);
  if (!res.ok) {
    const t = await res.text();
    throw new Error(`Confluence search ${res.status}: ${t.slice(0, 200)}`);
  }
  const data = await res.json();
  // /wiki/rest/api/search returns { results: [{ content: {...} }] }
  return (data.results || []).map((r) => r.content).filter(Boolean);
}
