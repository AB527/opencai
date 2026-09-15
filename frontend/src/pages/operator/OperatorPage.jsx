import { useEffect, useState } from 'react';
import { useAuth } from '../../lib/AuthContext';
import { useWorkspace } from '../../lib/WorkspaceContext';
import {
  createChatSession,
  listChatSessions,
  sendChatMessage,
  confirmChatMessage,
  cancelChatMessage,
} from '../../lib/chatApi';
import { TopNav } from '../../components/TopNav';
import { OperatorSidebar } from './components/OperatorSidebar';
import { WorkspaceSelectorForm } from './components/WorkspaceSelectorForm';
import { ChatSessionHeader } from './components/ChatSessionHeader';
import { AiOpsScreen } from './components/AiOpsScreen';
import { FinOpsScreen } from './components/FinOpsScreen';

function mergeMessages(existing, incoming) {
  const merged = [...existing];
  for (const m of incoming) {
    const idx = merged.findIndex((x) => x.id === m.id);
    if (idx === -1) merged.push(m);
    else merged[idx] = m;
  }
  return merged;
}

export function OperatorPage() {
  const { token } = useAuth();
  const { workspace, setWorkspace } = useWorkspace();
  const [cloudOrOnPrem, setCloudOrOnPrem] = useState('cloud');
  const [editingWorkspace, setEditingWorkspace] = useState(false);
  const [activeMode, setActiveMode] = useState('AIOPS');
  const [financeSubMode, setFinanceSubMode] = useState(null);
  const [sessionsByKey, setSessionsByKey] = useState({});
  const [messagesBySession, setMessagesBySession] = useState({});
  const [recentSessions, setRecentSessions] = useState([]);
  const [sending, setSending] = useState(false);

  function refreshRecentSessions() {
    listChatSessions(token, { pageSize: 5 })
      .then((res) => setRecentSessions(res.sessions))
      .catch(() => {});
  }

  useEffect(refreshRecentSessions, [token]);

  const sessionKey = workspace
    ? `${workspace.id}:${activeMode}:${activeMode === 'FINOPS' ? financeSubMode || '' : ''}`
    : null;
  const currentSession = sessionKey ? sessionsByKey[sessionKey] : null;

  useEffect(() => {
    if (!workspace || editingWorkspace || !sessionKey || currentSession) return;
    if (activeMode === 'FINOPS' && !financeSubMode) return;

    createChatSession(token, {
      workspaceId: workspace.id,
      mode: activeMode,
      subMode: activeMode === 'FINOPS' ? financeSubMode : undefined,
    }).then((session) => {
      setSessionsByKey((prev) => ({ ...prev, [sessionKey]: session }));
      refreshRecentSessions();
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [workspace, editingWorkspace, sessionKey, currentSession, activeMode, financeSubMode]);

  async function handleNewSession() {
    if (!workspace || !sessionKey) return;
    const session = await createChatSession(token, {
      workspaceId: workspace.id,
      mode: activeMode,
      subMode: activeMode === 'FINOPS' ? financeSubMode : undefined,
    });
    setSessionsByKey((prev) => ({ ...prev, [sessionKey]: session }));
    setMessagesBySession((prev) => ({ ...prev, [session.id]: [] }));
    refreshRecentSessions();
  }

  async function handleSend(text) {
    if (!currentSession || sending) return;
    setSending(true);
    try {
      const res = await sendChatMessage(token, currentSession.id, text);
      setMessagesBySession((prev) => ({
        ...prev,
        [currentSession.id]: mergeMessages(prev[currentSession.id] || [], res.messages),
      }));
    } finally {
      setSending(false);
    }
  }

  async function handleConfirm(messageId) {
    if (!currentSession) return;
    setSending(true);
    try {
      const res = await confirmChatMessage(token, currentSession.id, messageId);
      setMessagesBySession((prev) => ({
        ...prev,
        [currentSession.id]: mergeMessages(prev[currentSession.id] || [], res.messages),
      }));
    } finally {
      setSending(false);
    }
  }

  async function handleCancel(messageId) {
    if (!currentSession) return;
    setSending(true);
    try {
      const res = await cancelChatMessage(token, currentSession.id, messageId);
      setMessagesBySession((prev) => ({
        ...prev,
        [currentSession.id]: mergeMessages(prev[currentSession.id] || [], res.messages),
      }));
    } finally {
      setSending(false);
    }
  }

  function handleSelectMode(mode) {
    setActiveMode(mode);
    if (mode !== 'FINOPS') setFinanceSubMode(null);
  }

  const messages = currentSession ? messagesBySession[currentSession.id] || [] : [];

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-950">
      <TopNav />
      <div className="flex min-h-[calc(100vh-4rem)]">
        <OperatorSidebar
          cloudOrOnPrem={cloudOrOnPrem}
          onChangeCloudOrOnPrem={setCloudOrOnPrem}
          workspace={workspace}
          onEditWorkspace={() => setEditingWorkspace(true)}
          activeMode={activeMode}
          onSelectMode={handleSelectMode}
          recentSessions={recentSessions}
        />
        <main className="flex-1 px-6 py-10">
          {cloudOrOnPrem === 'onprem' ? (
            <div className="flex h-full items-center justify-center text-gray-400">
              On-Prem support is coming soon.
            </div>
          ) : !workspace || editingWorkspace ? (
            <div className="mx-auto max-w-4xl">
              <WorkspaceSelectorForm
                onComplete={(ws) => {
                  setWorkspace(ws);
                  setEditingWorkspace(false);
                }}
              />
            </div>
          ) : (
            <>
              {currentSession && (
                <div className="mx-auto mb-6 max-w-4xl">
                  <ChatSessionHeader session={currentSession} onNewSession={handleNewSession} />
                </div>
              )}
              {activeMode === 'AIOPS' ? (
                <AiOpsScreen
                  workspace={workspace}
                  onEditWorkspace={() => setEditingWorkspace(true)}
                  messages={messages}
                  onSend={handleSend}
                  onConfirm={handleConfirm}
                  onCancel={handleCancel}
                  sending={sending}
                />
              ) : (
                <FinOpsScreen
                  subMode={financeSubMode}
                  onSelectSubMode={setFinanceSubMode}
                  messages={messages}
                  onSend={handleSend}
                  onConfirm={handleConfirm}
                  onCancel={handleCancel}
                  sending={sending}
                />
              )}
            </>
          )}
        </main>
      </div>
    </div>
  );
}
