import { useEffect, useRef, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useAuth } from '../../lib/AuthContext';
import { useToast } from '../../lib/ToastContext';
import { useWorkspace } from '../../lib/WorkspaceContext';
import {
  createChatSession,
  getChatSession,
  listChatSessions,
  sendChatMessage,
  confirmChatMessage,
  cancelChatMessage,
  renameChatSession,
} from '../../lib/chatApi';
import { TopNav } from '../../components/TopNav';
import { OperatorSidebar } from './components/OperatorSidebar';
import { WorkspaceSelectorForm } from './components/WorkspaceSelectorForm';
import { ChatSessionHeader } from './components/ChatSessionHeader';
import { AiOpsScreen } from './components/AiOpsScreen';
import { FinOpsScreen } from './components/FinOpsScreen';

// One open chat per workspace + mode (+ FinOps sub-mode).
function keyFor(workspaceId, mode, subMode) {
  return `${workspaceId}:${mode}:${mode === 'FINOPS' ? subMode || '' : ''}`;
}

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
  const toast = useToast();
  const { workspace, setWorkspace } = useWorkspace();
  const [cloudOrOnPrem, setCloudOrOnPrem] = useState('cloud');
  const [editingWorkspace, setEditingWorkspace] = useState(false);
  const [activeMode, setActiveMode] = useState('AIOPS');
  const [financeSubMode, setFinanceSubMode] = useState(null);
  const [sessionsByKey, setSessionsByKey] = useState({});
  const [messagesBySession, setMessagesBySession] = useState({});
  const [recentSessions, setRecentSessions] = useState([]);
  const [sending, setSending] = useState(false);

  const recentRequestRef = useRef(0);

  // Recent History follows the selected mode and skips sessions that were
  // opened but never used.
  function refreshRecentSessions() {
    const requestId = ++recentRequestRef.current;
    listChatSessions(token, { pageSize: 30, mode: activeMode, hasMessages: true })
      .then((res) => {
        // Ignore a slower response for a mode the user has already left.
        if (requestId === recentRequestRef.current) setRecentSessions(res.sessions);
      })
      .catch(() => {});
  }

  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(refreshRecentSessions, [token, activeMode]);

  async function handleRenameSession(sessionId, title) {
    const updated = await renameChatSession(token, sessionId, title);
    setRecentSessions((prev) => prev.map((s) => (s.id === sessionId ? { ...s, ...updated } : s)));
  }

  const sessionKey = workspace ? keyFor(workspace.id, activeMode, financeSubMode) : null;
  const currentSession = sessionKey ? sessionsByKey[sessionKey] : null;

  // The URL mirrors the open chat: `/operator?session=<id>`. Links (Recent
  // History, Chat History, a pasted URL, back/forward) open a chat through the
  // URL; opening, starting or leaving a chat in the page writes it back.
  const [searchParams, setSearchParams] = useSearchParams();
  const openSessionId = searchParams.get('session');
  // The session id being loaded from the URL. While set, the state -> URL sync
  // below must not overwrite the URL with the (not yet loaded) current chat.
  const loadingSessionIdRef = useRef(null);

  // URL -> state.
  useEffect(() => {
    if (!openSessionId) {
      // Navigated to plain /operator (e.g. back button): leave the open chat.
      if (sessionKey && currentSession) {
        setSessionsByKey((prev) => ({ ...prev, [sessionKey]: undefined }));
      }
      return;
    }
    if (openSessionId === currentSession?.id) return;

    let cancelled = false;
    loadingSessionIdRef.current = openSessionId;
    getChatSession(token, openSessionId)
      .then(({ messages, ...session }) => {
        if (cancelled) return;
        setWorkspace(session.workspace);
        setEditingWorkspace(false);
        setCloudOrOnPrem('cloud');
        setActiveMode(session.mode);
        setFinanceSubMode(session.subMode ?? null);
        setSessionsByKey((prev) => ({
          ...prev,
          [keyFor(session.workspace.id, session.mode, session.subMode)]: session,
        }));
        setMessagesBySession((prev) => ({ ...prev, [session.id]: messages }));
      })
      .catch((err) => {
        if (cancelled) return;
        toast.error(err.message || 'Could not open that chat.');
        // Point the URL back at whatever chat is still open.
        setSearchParams(currentSession ? { session: currentSession.id } : {}, { replace: true });
      })
      .finally(() => {
        if (!cancelled && loadingSessionIdRef.current === openSessionId) {
          loadingSessionIdRef.current = null;
        }
      });
    return () => {
      cancelled = true;
      if (loadingSessionIdRef.current === openSessionId) loadingSessionIdRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [openSessionId, token]);

  // State -> URL: whenever the open chat changes (first message creates one,
  // New Session clears it, switching mode shows that mode's chat).
  useEffect(() => {
    if (loadingSessionIdRef.current) return;
    const id = currentSession?.id ?? null;
    // A history entry, so browser back returns to the previous chat.
    if (id !== openSessionId) setSearchParams(id ? { session: id } : {});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentSession?.id]);

  // Sessions are created lazily by the first message (see handleSend), so
  // starting a new one just clears the current chat for this mode.
  // Context-window usage comes back with each reply; keep the open session's
  // copy current so the header ring updates.
  function applyContext(sessionId, context) {
    if (!context) return;
    setSessionsByKey((prev) => {
      const next = { ...prev };
      for (const [key, s] of Object.entries(prev)) {
        if (s?.id === sessionId) {
          next[key] = { ...s, contextTokens: context.tokens, contextWindow: context.window };
        }
      }
      return next;
    });
  }

  function handleNewSession() {
    if (!sessionKey) return;
    setSessionsByKey((prev) => ({ ...prev, [sessionKey]: undefined }));
  }

  // After a failed request the server may still have saved rows (the user's
  // message, steps before the failure); reload so the transcript matches it.
  function resyncMessages(sessionId) {
    getChatSession(token, sessionId)
      .then(({ messages }) => setMessagesBySession((prev) => ({ ...prev, [sessionId]: messages })))
      .catch(() => {});
  }

  async function handleSend(text) {
    if (!workspace || !sessionKey || sending) return;
    if (activeMode === 'FINOPS' && !financeSubMode) return;

    let session = currentSession;
    if (!session) {
      // Captured now: the Operator may switch modes while this is in flight.
      const key = sessionKey;
      setSending(true);
      try {
        session = await createChatSession(token, {
          workspaceId: workspace.id,
          mode: activeMode,
          subMode: activeMode === 'FINOPS' ? financeSubMode : undefined,
        });
      } catch (err) {
        setSending(false);
        toast.error(err.message || 'Could not start a new chat.');
        return;
      }
      setSessionsByKey((prev) => ({ ...prev, [key]: session }));
    }

    const sessionId = session.id;
    // Shown immediately; replaced by the persisted row the server returns.
    const optimistic = {
      id: `pending-${Date.now()}`,
      role: 'USER',
      kind: 'TEXT',
      content: text,
      createdAt: new Date().toISOString(),
    };
    const withoutOptimistic = (list) => (list || []).filter((m) => m.id !== optimistic.id);
    setMessagesBySession((prev) => ({
      ...prev,
      [sessionId]: [...(prev[sessionId] || []), optimistic],
    }));
    setSending(true);
    try {
      const res = await sendChatMessage(token, sessionId, text);
      applyContext(sessionId, res.context);
      setMessagesBySession((prev) => ({
        ...prev,
        [sessionId]: mergeMessages(withoutOptimistic(prev[sessionId]), res.messages),
      }));
      // The first message titles the session and makes it show in history.
      refreshRecentSessions();
    } catch (err) {
      setMessagesBySession((prev) => ({
        ...prev,
        [sessionId]: withoutOptimistic(prev[sessionId]),
      }));
      toast.error(err.message || 'The message could not be sent.');
      resyncMessages(sessionId);
    } finally {
      setSending(false);
    }
  }

  async function handleConfirm(messageId) {
    if (!currentSession) return;
    setSending(true);
    try {
      const res = await confirmChatMessage(token, currentSession.id, messageId);
      applyContext(currentSession.id, res.context);
      setMessagesBySession((prev) => ({
        ...prev,
        [currentSession.id]: mergeMessages(prev[currentSession.id] || [], res.messages),
      }));
    } catch (err) {
      toast.error(err.message || 'The command could not be confirmed.');
      resyncMessages(currentSession.id);
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
    } catch (err) {
      toast.error(err.message || 'The command could not be cancelled.');
      resyncMessages(currentSession.id);
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
    // Full-height shell: the sidebar and the chat section scroll independently.
    <div className="flex h-screen flex-col bg-gray-50 dark:bg-gray-950">
      <TopNav />
      <div className="flex min-h-0 flex-1">
        <OperatorSidebar
          cloudOrOnPrem={cloudOrOnPrem}
          onChangeCloudOrOnPrem={setCloudOrOnPrem}
          workspace={workspace}
          onEditWorkspace={() => setEditingWorkspace(true)}
          activeMode={activeMode}
          onSelectMode={handleSelectMode}
          recentSessions={recentSessions}
          activeSessionId={currentSession?.id}
          onRenameSession={handleRenameSession}
        />
        <main className="flex min-h-0 flex-1 flex-col overflow-y-auto px-6 pt-10">
          {cloudOrOnPrem === 'onprem' ? (
            <div className="flex flex-1 items-center justify-center pb-10 text-gray-400">
              On-Prem support is coming soon.
            </div>
          ) : !workspace || editingWorkspace ? (
            <div className="mx-auto w-full max-w-4xl pb-10">
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
                <div className="mx-auto mb-6 w-full max-w-4xl">
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
