# Developer Productivity Dashboard — Build Specification

> Paste this entire document as your prompt to recreate the dashboard from scratch.

---

## What to Build

A local single-page React developer productivity dashboard that aggregates:
- **Jira** — issues assigned to me, with status/priority/sprint/fix-version
- **GitHub** — open pull requests I authored, with review state
- **Confluence** — pages I created
- **Notes** — personal scratchpad (localStorage, no backend)
- **Home overview** — welcome banner, stat cards, Jira pie chart, action items panel

Runs locally via `npm run dev`. All API credentials stay server-side in the Vite dev proxy — the browser never sees tokens.

---

## Tech Stack

| Concern | Choice |
|---|---|
| Framework | React 18 + Vite |
| Styling | Tailwind CSS v4 (`@tailwindcss/vite` plugin) |
| Icons | `lucide-react` |
| Charts | `recharts` |
| Routing | Simple `useState` (no react-router) |
| Persistence | `localStorage` (Notes only) |

### Install commands
```bash
npm create vite@latest dev-dashboard -- --template react
cd dev-dashboard
npm install
npm install -D tailwindcss @tailwindcss/vite
npm install lucide-react recharts
```

---

## Project Structure

```
dev-dashboard/
├── .env                          # secrets — never commit
├── vite.config.js                # proxy config (injects auth headers)
├── src/
│   ├── index.css                 # Tailwind import + global styles
│   ├── main.jsx
│   ├── App.jsx                   # top-level router + header
│   ├── api/
│   │   ├── jira.js
│   │   ├── github.js
│   │   └── confluence.js
│   ├── config/
│   │   └── sections.js           # section registry
│   ├── context/
│   │   └── DataContext.jsx       # shared data provider
│   ├── hooks/
│   │   └── usePagination.js
│   ├── pages/
│   │   └── HomePage.jsx          # home overview page
│   └── components/
│       ├── Section.jsx           # reusable collapsible card
│       ├── StatusBadge.jsx       # color-coded pill
│       ├── Pagination.jsx        # numbered page controls
│       ├── ActionItems.jsx       # rules-engine action panel
│       ├── JiraIssues.jsx
│       ├── GitHubPRs.jsx
│       ├── ConfluencePages.jsx
│       └── Notes.jsx
```

---

## Environment Variables (`.env`)

```env
# ── Server-side only (never exposed to browser) ──────────────────────────────
JIRA_BASE_URL=https://yourcompany.atlassian.net
JIRA_EMAIL=you@yourcompany.com
JIRA_API_TOKEN=your_jira_api_token

CONFLUENCE_BASE_URL=https://yourcompany.atlassian.net
CONFLUENCE_EMAIL=you@yourcompany.com
CONFLUENCE_API_TOKEN=your_confluence_api_token
CONFLUENCE_ACCOUNT_ID=your_atlassian_account_id

GITHUB_TOKEN=ghp_your_github_pat
GITHUB_USERNAME=your-github-username

# ── Client-side VITE_ vars (safe non-secret identifiers only) ─────────────────
VITE_JIRA_BASE_URL=https://yourcompany.atlassian.net
VITE_CONFLUENCE_BASE_URL=https://yourcompany.atlassian.net
VITE_CONFLUENCE_ACCOUNT_ID=your_atlassian_account_id
VITE_GITHUB_USERNAME=your-github-username
VITE_GITHUB_ORG=YourGitHubOrg
VITE_DISPLAY_NAME=Your Full Name
VITE_DESIGNATION=Your Job Title
```

**How to get these values:**
- Jira/Confluence API token: `id.atlassian.com` → Security → API tokens
- Atlassian Account ID: `yourcompany.atlassian.net/rest/api/3/myself`
- GitHub PAT: GitHub Settings → Developer settings → Personal access tokens → Classic. Scopes needed: `repo`, `read:org`. **Must be SSO-authorized for your org** (GitHub Settings → PAT → Configure SSO → Authorize).

---

## `vite.config.js` — Proxy Setup

This is the most critical file. The proxy injects auth headers so secrets never reach the browser.

```js
import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '');  // '' = load ALL vars, not just VITE_

  const jiraAuth = env.JIRA_EMAIL && env.JIRA_API_TOKEN
    ? Buffer.from(`${env.JIRA_EMAIL}:${env.JIRA_API_TOKEN}`).toString('base64')
    : null;

  const confluenceAuth = env.CONFLUENCE_EMAIL && env.CONFLUENCE_API_TOKEN
    ? Buffer.from(`${env.CONFLUENCE_EMAIL}:${env.CONFLUENCE_API_TOKEN}`).toString('base64')
    : null;

  // CRITICAL: strip trailing /wiki to avoid double /wiki/wiki/ paths
  const confluenceTarget = (env.CONFLUENCE_BASE_URL || 'https://placeholder.atlassian.net')
    .replace(/\/wiki\/?$/, '');

  return {
    plugins: [react(), tailwindcss()],
    server: {
      proxy: {
        '/api/jira': {
          target: env.JIRA_BASE_URL || 'https://placeholder.atlassian.net',
          changeOrigin: true,
          rewrite: (p) => p.replace(/^\/api\/jira/, ''),
          configure: (proxy) => {
            proxy.on('proxyReq', (req) => {
              if (jiraAuth) req.setHeader('Authorization', `Basic ${jiraAuth}`);
              req.setHeader('Accept', 'application/json');
            });
          },
        },
        '/api/confluence': {
          target: confluenceTarget,
          changeOrigin: true,
          rewrite: (p) => p.replace(/^\/api\/confluence/, ''),
          configure: (proxy) => {
            proxy.on('proxyReq', (req) => {
              if (confluenceAuth) req.setHeader('Authorization', `Basic ${confluenceAuth}`);
              req.setHeader('Accept', 'application/json');
            });
          },
        },
        '/api/atlassian-people': {
          target: 'https://api.atlassian.com',
          changeOrigin: true,
          rewrite: (p) => p.replace(/^\/api\/atlassian-people/, ''),
          configure: (proxy) => {
            proxy.on('proxyReq', (req) => {
              if (jiraAuth) req.setHeader('Authorization', `Basic ${jiraAuth}`);
              req.setHeader('Accept', 'application/json');
            });
          },
        },
        '/api/github': {
          target: 'https://api.github.com',
          changeOrigin: true,
          rewrite: (p) => p.replace(/^\/api\/github/, ''),
          configure: (proxy) => {
            proxy.on('proxyReq', (req) => {
              if (env.GITHUB_TOKEN) req.setHeader('Authorization', `Bearer ${env.GITHUB_TOKEN}`);
              req.setHeader('Accept', 'application/vnd.github+json');
              req.setHeader('X-GitHub-Api-Version', '2022-11-28');
            });
          },
        },
      },
    },
  };
});
```

---

## `src/index.css`

```css
@import "tailwindcss";

* {
  box-sizing: border-box;
  scrollbar-width: thin;
  scrollbar-color: rgba(71, 85, 105, 0.4) transparent;
}

body {
  margin: 0;
  background: #080d1a;
  color: #e2e8f0;
  font-family: system-ui, -apple-system, sans-serif;
  font-size: 14px;
}

/* Subtle dot-grid background overlay */
.grid-bg::before {
  content: '';
  position: fixed;
  inset: 0;
  pointer-events: none;
  z-index: 0;
  background-image:
    linear-gradient(rgba(148, 163, 184, 0.028) 1px, transparent 1px),
    linear-gradient(90deg, rgba(148, 163, 184, 0.028) 1px, transparent 1px);
  background-size: 48px 48px;
}

@keyframes gradient-shift {
  0%   { background-position: 0% 50%; }
  50%  { background-position: 100% 50%; }
  100% { background-position: 0% 50%; }
}

.animated-gradient {
  background-size: 200% 200%;
  animation: gradient-shift 6s ease infinite;
}
```

---

## API Modules

### `src/api/jira.js`
```js
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

  const url = `${BASE}/rest/api/3/search/jql?jql=${encodeURIComponent(jql)}&fields=${fields}&maxResults=50`;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Jira API ${res.status}: ${await res.text()}`);
  return (await res.json()).issues || [];
}
```

**Gotcha:** Use `/rest/api/3/search/jql` — the old `/rest/api/3/search` endpoint returns HTTP 410.

### `src/api/confluence.js`
```js
const BASE = '/api/confluence';

export async function fetchMyPages() {
  // Step 1: get account ID from current user
  const meRes = await fetch(`${BASE}/wiki/rest/api/user/current`);
  if (!meRes.ok) throw new Error(`Confluence user API ${meRes.status}`);
  const me = await meRes.json();
  const accountId = me.accountId;

  // Step 2: CQL search — use creator.accountid, NOT currentUser() (that's Jira JQL only)
  const cql = `type=page AND creator.accountid="${accountId}" ORDER BY created DESC`;
  const url = `${BASE}/wiki/rest/api/search?cql=${encodeURIComponent(cql)}&limit=50`;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Confluence search API ${res.status}`);
  const data = await res.json();
  return data.results || [];
}
```

**Gotcha:** `currentUser()` is Jira JQL only — it does NOT work in Confluence CQL. Always fetch accountId first then use `creator.accountid`.

### `src/api/github.js`
```js
export function extractRepo(htmlUrl) {
  try {
    const parts = new URL(htmlUrl).pathname.split('/').filter(Boolean);
    return parts.length >= 2 ? `${parts[0]}/${parts[1]}` : htmlUrl;
  } catch { return htmlUrl; }
}

export async function fetchMyPRs(username, org) {
  const q = `is:pr author:${username} is:open`;
  const url = `/api/github/search/issues?q=${encodeURIComponent(q)}&per_page=50&sort=updated`;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`GitHub API ${res.status}: ${await res.text()}`);
  const data = await res.json();

  // Filter by org client-side — the API `org:` qualifier is unreliable
  const items = (data.items || []).filter((pr) =>
    !org || pr.html_url?.includes(`github.com/${org}/`)
  );

  // Attach review state
  const enriched = await Promise.all(items.map(async (pr) => {
    try {
      const repo = extractRepo(pr.html_url);
      const rRes = await fetch(`/api/github/repos/${repo}/pulls/${pr.number}/reviews`);
      const reviews = rRes.ok ? await rRes.json() : [];
      const latest = reviews.at(-1);
      return { ...pr, reviewState: latest?.state?.toLowerCase() || 'none' };
    } catch { return { ...pr, reviewState: 'unknown' }; }
  }));

  return enriched;
}
```

**Gotcha:** GitHub `org:` search qualifier is unreliable for private orgs — always filter client-side on `html_url`. PAT must be SSO-authorized for private orgs via GitHub Settings → PAT → Configure SSO.

---

## `src/context/DataContext.jsx`

Fetches all data on mount. Section components must NOT fetch independently.

```jsx
import { createContext, useContext, useState, useCallback, useEffect } from 'react';
import { fetchAssignedIssues } from '../api/jira';
import { fetchMyPRs } from '../api/github';
import { fetchMyPages } from '../api/confluence';

const DataContext = createContext(null);
export const useData = () => useContext(DataContext);

function useResource(fetcher) {
  const [data, setData]               = useState([]);
  const [loading, setLoading]         = useState(false);
  const [error, setError]             = useState(null);
  const [lastRefreshed, setRefreshed] = useState(null);

  const refresh = useCallback(async () => {
    setLoading(true); setError(null);
    try {
      setData(await fetcher());
      setRefreshed(new Date());
    } catch (e) { setError(e.message); }
    finally { setLoading(false); }
  }, [fetcher]);

  return { data, loading, error, lastRefreshed, refresh };
}

export function DataProvider({ children, githubUsername, githubOrg }) {
  const jiraR       = useResource(fetchAssignedIssues);
  const githubR     = useResource(() => fetchMyPRs(githubUsername, githubOrg));
  const confluenceR = useResource(fetchMyPages);

  // Fetch everything on mount
  useEffect(() => {
    jiraR.refresh(); githubR.refresh(); confluenceR.refresh();
  }, []); // eslint-disable-line

  return (
    <DataContext.Provider value={{
      jira:       { issues: jiraR.data,         ...jiraR,       refresh: jiraR.refresh },
      github:     { prs:    githubR.data,        ...githubR,     refresh: githubR.refresh },
      confluence: { pages:  confluenceR.data,    ...confluenceR, refresh: confluenceR.refresh },
    }}>
      {children}
    </DataContext.Provider>
  );
}
```

---

## `src/App.jsx` — Router + Header

- State-based routing: `const [view, setView] = useState('home')`
- Views: `home | jira | github-prs | confluence | notes`
- Header: glassmorphic, sticky, animated gradient accent line (blue→purple→cyan), gradient logo with glow
- Active nav item: gradient pill with indigo glow
- Background: `#080d1a` with `.grid-bg` overlay class + radial blue glow fixed at top
- Pass to HomePage: `onNavigate`, `jiraBaseUrl`, `githubUsername`, `displayName`, `fallbackDesignation`

---

## Design System

### Colors / tokens
```
Background:       #080d1a
Cards/sections:   rgba(13,20,36,0.8) with border rgba(148,163,184,0.08)
Glassmorphic:     backdrop-filter: blur(16px)

Stat card accents:
  Jira:           gradient #3b82f6 → #6366f1  (blue/indigo)
  GitHub PRs:     gradient #22c55e → #10b981  (green/emerald)
  Confluence:     gradient #0ea5e9 → #06b6d4  (sky/cyan)
  Notes:          gradient #f59e0b → #eab308  (amber/yellow)

Text:
  Primary:        #f1f5f9
  Secondary:      rgba(148,163,184,0.7)
  Muted:          rgba(148,163,184,0.35)
```

### Component patterns
- **Cards**: `background: rgba(13,20,36,0.8)`, `border: 1px solid rgba(148,163,184,0.08)`, `backdropFilter: blur(8px)`, `borderRadius: 12px`
- **Badges/chips**: `px-2.5 py-0.5 rounded-full text-xs font-medium` with color-matched bg/border/text
- **Hover lift**: `transform: translateY(-3px)` + matching `boxShadow` glow
- **Section headers**: icon in a rounded-lg pill, count badge with indigo tint

---

## `src/pages/HomePage.jsx`

### WelcomeBanner component
Fetches from three sources (in increasing priority):
1. `VITE_DESIGNATION` env var — instant fallback
2. `GET /api/jira/rest/api/3/myself?expand=groups` — `jobTitle` field, group names for team
3. `GET /api/atlassian-people/people/1.0/person/{accountId}` — authoritative `jobTitle` + `department`
4. `GET /api/github/users/{username}` — avatar photo

Visual layout:
- Full-width card with a **scenic nature photo background** (`https://picsum.photos/seed/{randomSeed}/1600/420`)
- Dark gradient overlay left→right so text on left is readable, photo shows on right
- Left side: avatar (circle, ring glow), gradient name heading, chips (designation / department / team), date
- Right side: frosted glass quote panel — **random quote on every page load** from curated array of 10 dev quotes
- 20 curated picsum seeds for reliable landscapes

### Stat cards (4-up grid)
Each card: gradient icon bg + hover lift + color-matched glow + `ArrowUpRight` icon. Click navigates to that section.

| Card | Count shown | Sub-text |
|---|---|---|
| Jira Issues | total assigned | "N in progress" |
| Open Pull Requests | open PRs | "N need attention" / "N awaiting review" |
| Confluence Pages | total pages | "authored by you" |
| Notes | localStorage count | "saved locally" |

### Bottom layout: two columns
- **Left (flex-1)**: Jira breakdown card — donut chart (recharts PieChart) + legend with mini progress bars + critical/high priority issues list
- **Right (w-72 shrink-0)**: ActionItems panel

### `statusColor(name)` helper
```js
export function statusColor(name) {
  const n = (name || '').toLowerCase();
  if (n.includes('progress'))                                    return '#3b82f6';
  if (n.includes('review') || n.includes('code'))               return '#8b5cf6';
  if (n === 'done' || n === 'closed' || n.includes('complete')) return '#22c55e';
  if (n === 'blocked')                                           return '#ef4444';
  return '#475569';
}
```

---

## `src/components/ActionItems.jsx` — Rules Engine

Scans Jira issues + GitHub PRs and surfaces action items. Sort: high urgency first, then by age.

| Rule | Urgency | Condition |
|---|---|---|
| Address review feedback | high | PR with `reviewState === 'changes_requested'` |
| Get PR reviewed | medium/high | Open PR, no review, age > 2d (high if > 5d) |
| Follow up on bug | high | Jira bug, priority high/highest, not done, not updated in 3d |
| Stale in-progress | medium | Jira in-progress, not updated in 5d |
| Follow up on review | medium | Jira in-review/code-review, not updated in 2d |

Each item: urgency color bar on left, icon, title, detail, external link icon. Max 20 items shown.

---

## `src/components/JiraIssues.jsx`

- Dynamic status filter chips built from actual issue data (not hardcoded)
- Table columns: Key (with type emoji + link), Summary, Status, Priority, Sprint, Fix Version, SP, Updated
- Fix version: green pill chip, `–` if empty
- Story points: `customfield_10016` or `customfield_10028`
- Sprint: active sprint preferred, else latest from `customfield_10020` array
- Pagination: 10/page, resets on filter change

---

## `src/components/GitHubPRs.jsx`

- Table columns: PR title + link, Repository, Review state, Age, Labels
- Review state color-coded via StatusBadge
- If 0 results: debug panel showing total fetched from API, sample repo names (helps diagnose org filter issues)

---

## `src/components/ConfluencePages.jsx`

- Table columns: Title (link to page), Space, Last modified date
- Pagination: 10/page

---

## `src/components/Notes.jsx`

- Stored in `localStorage` key `dev-dashboard-notes` as JSON array
- Each note: `{ id, content, createdAt, updatedAt? }`
- **Add**: textarea, Ctrl+Enter or Save button to submit, Escape to cancel
- **Edit**: pencil icon (visible on row hover), opens inline textarea pre-filled, Ctrl+Enter or Save, Escape to cancel. Shows "· edited {timestamp}" on the note
- **Delete**: trash icon (hover), two-click confirm (turns red), auto-cancels after 3s
- Yellow accent bar on left of each note in read view
- Empty state: 📝 emoji + prompt text

---

## `src/components/Section.jsx`

Reusable collapsible card used by Jira/GitHub/Confluence/Notes section pages.

Props: `id, title, icon, count, loading, error, lastRefreshed, onRefresh, children, defaultOpen`

- Header: icon in rounded pill, title, count badge (indigo tint), last-refreshed time (sm+), refresh button (spinner when loading), chevron
- Body: error state with retry button, loading skeleton, or children
- Auto-opens when `count > 0` after initial load

---

## `src/components/StatusBadge.jsx`

```js
const PALETTE = {
  'to do':             'bg-slate-700 text-slate-200',
  'in progress':       'bg-blue-900 text-blue-200',
  'in review':         'bg-violet-900 text-violet-200',
  'done':              'bg-green-900 text-green-200',
  'closed':            'bg-green-900 text-green-200',
  'blocked':           'bg-red-900 text-red-200',
  'highest':           'bg-red-800 text-red-100',
  'high':              'bg-orange-800 text-orange-100',
  'medium':            'bg-yellow-800 text-yellow-100',
  'low':               'bg-slate-700 text-slate-200',
  'open':              'bg-green-900 text-green-200',
  'merged':            'bg-purple-900 text-purple-200',
  'approved':          'bg-green-900 text-green-200',
  'changes_requested': 'bg-red-900 text-red-200',
  'commented':         'bg-yellow-900 text-yellow-200',
  'pending':           'bg-slate-700 text-slate-200',
  'none':              'bg-slate-800 text-slate-400',
};
```

---

## `src/hooks/usePagination.js`

```js
import { useState, useEffect } from 'react';

export function usePagination(items, pageSize = 10) {
  const [page, setPage] = useState(1);

  // Reset to page 1 whenever the items array reference changes (filter/tab switch)
  useEffect(() => { setPage(1); }, [items]);

  const totalPages = Math.max(1, Math.ceil(items.length / pageSize));
  const paginated  = items.slice((page - 1) * pageSize, page * pageSize);

  return { page, totalPages, paginated, setPage };
}
```

---

## `src/components/Pagination.jsx`

Shows "1–10 of 47", numbered page buttons with ellipsis for large ranges, Prev/Next. Hides when only 1 page.

---

## `src/config/sections.js`

```js
import { JiraIssues }      from '../components/JiraIssues';
import { GitHubPRs }       from '../components/GitHubPRs';
import { ConfluencePages } from '../components/ConfluencePages';
import { Notes }           from '../components/Notes';

export const SECTIONS = [
  { id: 'jira',       title: 'Jira Issues',     component: JiraIssues,      enabled: true },
  { id: 'github-prs', title: 'GitHub PRs',       component: GitHubPRs,       enabled: true },
  { id: 'confluence', title: 'Confluence Pages', component: ConfluencePages, enabled: true },
  { id: 'notes',      title: 'Notes',            component: Notes,           enabled: true },
];
```

---

## Known Bugs Already Fixed (Do Not Repeat)

| Symptom | Root cause | Fix |
|---|---|---|
| Jira API HTTP 410 | Deprecated `/rest/api/3/search` | Use `/rest/api/3/search/jql` |
| Confluence 404 on all endpoints | CONFLUENCE_BASE_URL had trailing `/wiki` causing `/wiki/wiki/` double path | Strip `/wiki/?$` from target in proxy |
| `currentUser()` in Confluence CQL | Only valid in Jira JQL | Fetch accountId from `/wiki/rest/api/user/current`, use `creator.accountid` |
| Jira filter chips broken | Hardcoded status names didn't match actual statuses | Build chips dynamically from `useMemo` over issue data |
| GitHub PRs from wrong org | `org:` API search qualifier unreliable | Client-side filter on `pr.html_url` containing `github.com/${org}/` |
| Zero GitHub PRs despite correct username | PAT not SSO-authorized for private org | GitHub Settings → PAT → Configure SSO → Authorize org |
| Wrong display name showing | GitHub API call fails/races, falls back to username | Use `VITE_DISPLAY_NAME` env var as primary; API only for avatar |

---

## Customisation Guide for Teammates

1. Copy `.env.example` (or the template above), fill in your own credentials
2. Update `VITE_DISPLAY_NAME`, `VITE_DESIGNATION` with your name and title
3. Update `VITE_GITHUB_ORG` to your org's GitHub org name (check any PR URL: `github.com/{ORG}/repo`)
4. Update `VITE_GITHUB_USERNAME` to your GitHub username
5. Run `npm install && npm run dev`
6. Open `http://localhost:5173`

To add a new section:
1. Create `src/components/MySection.jsx` — use `Section` component wrapper, pull data from `useData()`
2. Add it to `src/config/sections.js`
3. Add a nav entry + route in `src/App.jsx`
4. Add a stat card entry in `CARD_CONFIG` in `src/pages/HomePage.jsx`
