import { createContext, useContext, useState } from 'react';

export const WORKSPACE_STORAGE_KEY = 'opencai_workspace';

const WorkspaceContext = createContext(null);

function loadStoredWorkspace() {
  try {
    const raw = localStorage.getItem(WORKSPACE_STORAGE_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

export function WorkspaceProvider({ children }) {
  const [workspace, setWorkspaceState] = useState(loadStoredWorkspace);

  function setWorkspace(ws) {
    setWorkspaceState(ws);
    if (ws) {
      localStorage.setItem(WORKSPACE_STORAGE_KEY, JSON.stringify(ws));
    } else {
      localStorage.removeItem(WORKSPACE_STORAGE_KEY);
    }
  }

  return (
    <WorkspaceContext.Provider value={{ workspace, setWorkspace }}>
      {children}
    </WorkspaceContext.Provider>
  );
}

export function useWorkspace() {
  const ctx = useContext(WorkspaceContext);
  if (!ctx) throw new Error('useWorkspace must be used within a WorkspaceProvider');
  return ctx;
}
