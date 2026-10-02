import { useEffect, useRef, useState } from 'react';
import { useAuth } from '../../lib/AuthContext';
import { listChatSessions, getChatSessionMessages, deleteChatSession } from '../../lib/adminApi';
import { useToast } from '../../lib/ToastContext';
import { ConfirmDialog } from '../../components/Dialog';
import { ChatTranscript } from '../operator/components/ChatPanel';
import { AdminLayout } from './AdminLayout';

const MODE_LABELS = {
  AIOPS: 'AIOps',
  FINOPS: 'FinOps',
};

const PAGE_SIZE = 20;

export function ManageChats() {
  const { token } = useAuth();
  const toast = useToast();
  const [page, setPage] = useState(1);
  const [result, setResult] = useState(null);
  const [expandedId, setExpandedId] = useState(null);
  // null while the expanded session's messages are loading.
  const [messages, setMessages] = useState(null);
  const expandingRef = useRef(null);
  const [deleting, setDeleting] = useState(null);
  const [busy, setBusy] = useState(false);

  function refresh() {
    listChatSessions(token, { page, pageSize: PAGE_SIZE })
      .then((data) => {
        // Deleting the last chat on a page leaves it empty: step back a page.
        if (data.sessions.length === 0 && page > 1) setPage((p) => p - 1);
        else setResult(data);
      })
      .catch((err) => toast.error(err.message || 'Could not load chats.'));
  }

  useEffect(refresh, [token, page]);

  async function toggleExpand(sessionId) {
    if (expandedId === sessionId) {
      setExpandedId(null);
      expandingRef.current = null;
      return;
    }
    setExpandedId(sessionId);
    setMessages(null);
    expandingRef.current = sessionId;
    try {
      const loaded = await getChatSessionMessages(token, sessionId);
      // Ignore a slower response for a session that has since been collapsed.
      if (expandingRef.current === sessionId) setMessages(loaded);
    } catch (err) {
      toast.error(err.message || "Could not load that chat's messages.");
    }
  }

  async function handleDelete() {
    setBusy(true);
    try {
      await deleteChatSession(token, deleting.id);
      toast.success('Chat deleted.');
      if (expandedId === deleting.id) setExpandedId(null);
      setDeleting(null);
      refresh();
    } catch (err) {
      toast.error(err.message || 'Could not delete the chat.');
    } finally {
      setBusy(false);
    }
  }

  const totalPages = result ? Math.max(1, Math.ceil(result.total / result.pageSize)) : 1;

  return (
    <AdminLayout title="Manage Chats">
      <h1 className="text-2xl font-semibold text-gray-900 dark:text-gray-50">Manage Chats</h1>
      <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
        Oversight of every chat conversation, across all Operators.
      </p>

      <div className="mt-6 space-y-2">
        {result?.sessions.map((session) => (
          <div
            key={session.id}
            className="rounded-xl border border-gray-200 bg-white dark:border-gray-700 dark:bg-gray-900"
          >
            <div className="flex items-center justify-between gap-3 pr-4">
              <button
                type="button"
                onClick={() => toggleExpand(session.id)}
                aria-expanded={expandedId === session.id}
                className="min-w-0 flex-1 p-4 text-left"
              >
                <p className="truncate font-medium text-gray-900 dark:text-gray-100">
                  {session.title || 'Untitled chat'}
                </p>
                <p className="text-xs text-gray-500 dark:text-gray-400">
                  <span className="font-medium text-gray-700 dark:text-gray-300">
                    {session.user.username}
                  </span>{' '}
                  &middot; {MODE_LABELS[session.mode] ?? session.mode}
                  {session.subMode ? ` · ${session.subMode.replace(/_/g, ' ')}` : ''} &middot;{' '}
                  {session.workspace.organisation?.name} &middot; {session.workspace.account} (
                  {session.workspace.environment}) &middot; {session._count.messages} messages
                  &middot; {new Date(session.createdAt).toLocaleString()}
                </p>
              </button>
              <button
                type="button"
                onClick={() => setDeleting(session)}
                className="shrink-0 text-sm font-medium text-red-600 hover:underline"
              >
                Delete
              </button>
            </div>
            {expandedId === session.id && (
              <div className="border-t border-gray-100 p-4 dark:border-gray-800">
                {messages === null ? (
                  <p className="text-sm text-gray-400">Loading…</p>
                ) : messages.length === 0 ? (
                  <p className="text-sm text-gray-400">No messages yet.</p>
                ) : (
                  <ChatTranscript messages={messages} boxed />
                )}
              </div>
            )}
          </div>
        ))}
        {result?.sessions.length === 0 && (
          <p className="text-sm text-gray-400">No chat sessions yet.</p>
        )}
      </div>

      {result && totalPages > 1 && (
        <div className="mt-6 flex items-center gap-3">
          <button
            type="button"
            disabled={page <= 1}
            onClick={() => setPage((p) => p - 1)}
            className="rounded-lg border border-gray-300 px-3 py-1.5 text-sm disabled:opacity-40 dark:border-gray-600 dark:text-gray-200"
          >
            Previous
          </button>
          <span className="text-sm text-gray-500 dark:text-gray-400">
            Page {page} of {totalPages}
          </span>
          <button
            type="button"
            disabled={page >= totalPages}
            onClick={() => setPage((p) => p + 1)}
            className="rounded-lg border border-gray-300 px-3 py-1.5 text-sm disabled:opacity-40 dark:border-gray-600 dark:text-gray-200"
          >
            Next
          </button>
        </div>
      )}

      {deleting && (
        <ConfirmDialog
          title="Delete chat?"
          message={`"${deleting.title || 'Untitled chat'}" by ${deleting.user.username} and all ${deleting._count.messages} of its messages will be permanently deleted. If its sandbox is still running, it is stopped.`}
          confirmLabel="Delete"
          busy={busy}
          onClose={() => !busy && setDeleting(null)}
          onConfirm={handleDelete}
        />
      )}
    </AdminLayout>
  );
}
