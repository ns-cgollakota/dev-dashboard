import { createContext, useContext, useEffect } from 'react';
import { useJira } from '../hooks/useJira';
import { useGitHub } from '../hooks/useGitHub';
import { useConfluence } from '../hooks/useConfluence';

const DataContext = createContext(null);

export function DataProvider({ githubUsername, githubOrg, children }) {
  const jira       = useJira();
  const github     = useGitHub(githubUsername, githubOrg);
  const confluence = useConfluence();

  // Fetch all data once on app startup — sections don't need their own useEffect
  useEffect(() => {
    jira.refresh();
    github.refresh();
    confluence.refresh();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <DataContext.Provider value={{ jira, github, confluence }}>
      {children}
    </DataContext.Provider>
  );
}

export function useData() {
  return useContext(DataContext);
}
