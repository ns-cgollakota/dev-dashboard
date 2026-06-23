import { useState } from 'react';
import { LayoutDashboard, Ticket, GitPullRequest, FileText, StickyNote, Home, Bell } from 'lucide-react';
import { DataProvider } from './context/DataContext';
import { AlertProvider, useAlerts } from './context/AlertContext';
import { HomePage } from './pages/HomePage';
import { JiraIssues } from './components/JiraIssues';
import { GitHubPRs } from './components/GitHubPRs';
import { ConfluencePages } from './components/ConfluencePages';
import { Notes } from './components/Notes';
import { OnCallPage } from './pages/OnCallPage';
import './index.css';

const config = {
  jiraBaseUrl:       import.meta.env.VITE_JIRA_BASE_URL || '',
  confluenceBaseUrl: import.meta.env.VITE_CONFLUENCE_BASE_URL || '',
  githubUsername:    import.meta.env.VITE_GITHUB_USERNAME || '',
  githubOrg:         import.meta.env.VITE_GITHUB_ORG || '',
  displayName:       import.meta.env.VITE_DISPLAY_NAME || '',
  designation:       import.meta.env.VITE_DESIGNATION || '',
};

// Separate component so useAlerts() can be called inside AlertProvider
function AppShell() {
  const [view, setView] = useState('home');
  const { firing, needsAction } = useAlerts();

  function navigate(to) {
    setView(to);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  const NAV = [
    { id: 'home',       label: 'Home',          Icon: Home           },
    { id: 'jira',       label: 'Jira Issues',   Icon: Ticket         },
    { id: 'github-prs', label: 'Pull Requests', Icon: GitPullRequest },
    { id: 'confluence', label: 'Confluence',    Icon: FileText       },
    { id: 'notes',      label: 'Notes',         Icon: StickyNote     },
    { id: 'oncall',     label: 'On-Call',       Icon: Bell,
      badge: firing.length,
      urgent: needsAction.length > 0,
    },
  ];

  return (
    <div className="grid-bg min-h-screen text-slate-100 relative" style={{ background: '#080d1a' }}>
      {/* Radial glow */}
      <div className="fixed inset-x-0 top-0 h-96 pointer-events-none" style={{
        background: 'radial-gradient(ellipse 70% 40% at 50% -10%, rgba(59,130,246,0.14), transparent)',
        zIndex: 0,
      }} />

      {/* ── Header ──────────────────────────────────────────────────────────── */}
      <header className="sticky top-0 z-30" style={{
        background: 'rgba(8,13,26,0.82)',
        backdropFilter: 'blur(20px)',
        WebkitBackdropFilter: 'blur(20px)',
        borderBottom: '1px solid rgba(148,163,184,0.07)',
      }}>
        <div className="h-px w-full animated-gradient" style={{
          backgroundImage: 'linear-gradient(90deg, transparent 0%, #3b82f6 30%, #8b5cf6 60%, #06b6d4 80%, transparent 100%)',
        }} />

        <div className="max-w-7xl mx-auto px-5 py-2.5 flex items-center gap-4 relative z-10">
          {/* Logo */}
          <div className="flex items-center gap-2.5 shrink-0">
            <div className="p-1.5 rounded-lg" style={{
              background: 'linear-gradient(135deg, #3b82f6 0%, #8b5cf6 100%)',
              boxShadow: '0 0 14px rgba(99,102,241,0.5)',
            }}>
              <LayoutDashboard size={15} className="text-white" />
            </div>
            <span className="font-bold text-sm tracking-tight" style={{
              background: 'linear-gradient(135deg, #bfdbfe, #ddd6fe)',
              WebkitBackgroundClip: 'text',
              WebkitTextFillColor: 'transparent',
            }}>
              Dev Dashboard
            </span>
          </div>

          {/* Nav */}
          <nav className="flex items-center gap-0.5 ml-3">
            {NAV.map(({ id, label, Icon, badge, urgent }) => {
              const active = view === id;
              return (
                <button
                  key={id}
                  onClick={() => navigate(id)}
                  className="relative flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs transition-all duration-200"
                  style={active ? {
                    background: id === 'oncall' && urgent
                      ? 'linear-gradient(135deg, rgba(239,68,68,0.2), rgba(249,115,22,0.15))'
                      : 'linear-gradient(135deg, rgba(59,130,246,0.22), rgba(139,92,246,0.18))',
                    border: `1px solid ${id === 'oncall' && urgent ? 'rgba(239,68,68,0.4)' : 'rgba(99,102,241,0.35)'}`,
                    color: '#e0e7ff',
                    fontWeight: 500,
                    boxShadow: id === 'oncall' && urgent ? '0 0 12px rgba(239,68,68,0.2)' : '0 0 10px rgba(99,102,241,0.15)',
                  } : {
                    border: '1px solid transparent',
                    color: 'rgba(148,163,184,0.8)',
                  }}
                  onMouseEnter={e => { if (!active) { e.currentTarget.style.color = '#e2e8f0'; e.currentTarget.style.background = 'rgba(148,163,184,0.07)'; }}}
                  onMouseLeave={e => { if (!active) { e.currentTarget.style.color = 'rgba(148,163,184,0.8)'; e.currentTarget.style.background = 'transparent'; }}}
                >
                  <Icon size={13} style={active ? { color: id === 'oncall' && urgent ? '#fca5a5' : '#93c5fd' } : id === 'oncall' && badge > 0 ? { color: '#fca5a5' } : {}} />
                  {label}
                  {/* Alert badge on On-Call nav item */}
                  {badge > 0 && (
                    <span className="absolute -top-1 -right-1 min-w-[16px] h-4 rounded-full text-xs font-black flex items-center justify-center px-1" style={{
                      background: urgent ? '#ef4444' : '#f97316',
                      color: 'white',
                      fontSize: 9,
                      boxShadow: urgent ? '0 0 8px rgba(239,68,68,0.6)' : 'none',
                    }}>
                      {badge}
                    </span>
                  )}
                </button>
              );
            })}
          </nav>

          <div className="ml-auto hidden sm:flex items-center gap-2">
            <span className="text-xs px-2.5 py-1 rounded-full" style={{
              background: 'rgba(148,163,184,0.06)',
              border: '1px solid rgba(148,163,184,0.1)',
              color: 'rgba(148,163,184,0.6)',
            }}>
              {new Date().toLocaleDateString([], { weekday: 'short', month: 'short', day: 'numeric' })}
            </span>
          </div>
        </div>
      </header>

      {/* ── Page content ──────────────────────────────────────────────────────── */}
      <main className="max-w-7xl mx-auto px-5 py-7 relative z-10">
        {view === 'home' && (
          <HomePage
            onNavigate={navigate}
            jiraBaseUrl={config.jiraBaseUrl}
            githubUsername={config.githubUsername}
            displayName={config.displayName}
            fallbackDesignation={config.designation}
          />
        )}
        {view === 'jira'       && <JiraIssues jiraBaseUrl={config.jiraBaseUrl} sectionId="jira" />}
        {view === 'github-prs' && <GitHubPRs sectionId="github-prs" />}
        {view === 'confluence' && <ConfluencePages confluenceBaseUrl={config.confluenceBaseUrl} sectionId="confluence" />}
        {view === 'notes'      && <Notes sectionId="notes" />}
        {view === 'oncall'     && <OnCallPage />}
      </main>
    </div>
  );
}

export default function App() {
  return (
    <DataProvider githubUsername={config.githubUsername} githubOrg={config.githubOrg}>
      <AlertProvider>
        <AppShell />
      </AlertProvider>
    </DataProvider>
  );
}
