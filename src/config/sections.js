// ============================================================
// SECTIONS REGISTRY — extensibility entry point
//
// To add a new section:
//   1. Create src/api/yourservice.js  (if needed)
//   2. Create src/hooks/useYourService.js  (if needed)
//   3. Create src/components/YourSection.jsx
//   4. Import and add an entry below (set enabled: true)
// ============================================================

import { JiraIssues }      from '../components/JiraIssues';
import { GitHubPRs }       from '../components/GitHubPRs';
import { ConfluencePages } from '../components/ConfluencePages';
import { Notes }           from '../components/Notes';

export const SECTIONS = [
  { id: 'jira',       title: 'Jira Issues',          component: JiraIssues,      enabled: true },
  { id: 'github-prs', title: 'GitHub PRs',           component: GitHubPRs,       enabled: true },
  { id: 'confluence', title: 'Confluence Pages',     component: ConfluencePages, enabled: true },
  { id: 'notes',      title: 'Notes',                component: Notes,           enabled: true },
  // Add more sections here
];
