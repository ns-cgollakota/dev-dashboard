const BASE = '/api/github';

export function extractRepo(htmlUrl) {
  const m = (htmlUrl || '').match(/github\.com\/([^/]+\/[^/]+)/);
  return m ? m[1] : '';
}

export async function fetchMyPRs(username, org) {
  if (!username) throw new Error('VITE_GITHUB_USERNAME is not set in .env');

  const q = org
    ? `is:pr author:${username} org:${org}`
    : `is:pr author:${username}`;
  const url = `${BASE}/search/issues?q=${encodeURIComponent(q)}&sort=updated&per_page=100`;
  console.log("URL:", url);
  const res = await fetch(url);
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`GitHub API ${res.status}: ${text.slice(0, 300)}`);
  }
  const data = await res.json();
  const allItems = data.items || [];

  // Collect unique repos from raw results for debug display
  const repoSet = new Set(allItems.map((pr) => extractRepo(pr.html_url)));
  const sampleRepos = [...repoSet].slice(0, 10);
  const totalFetched = allItems.length;

  const items = allItems;

  return { items, totalFetched, sampleRepos };
}

export async function fetchPRReviews(apiUrl) {
  const path = apiUrl.replace('https://api.github.com', BASE);
  const res = await fetch(`${path}/reviews`);
  if (!res.ok) return [];
  return res.json();
}

export function summariseReviewState(reviews) {
  if (!reviews || reviews.length === 0) return 'none';
  const byUser = {};
  for (const r of reviews) {
    if (r.state !== 'DISMISSED') {
      byUser[r.user.login] = r.state;
    }
  }
  const states = Object.values(byUser);
  if (states.includes('CHANGES_REQUESTED')) return 'changes_requested';
  if (states.includes('APPROVED')) return 'approved';
  if (states.includes('COMMENTED')) return 'commented';
  return 'pending';
}
