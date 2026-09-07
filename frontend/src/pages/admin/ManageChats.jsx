import { useEffect, useState } from 'react';
import { useAuth } from '../../lib/AuthContext';
import { listChatSessions, getChatSessionMessages } from '../../lib/adminApi';
import { AdminLayout } from './AdminLayout';

export function ManageChats() {
  const { token } = useAuth();
  const [result, setResult] = useState(null);
  const [expandedId, setExpandedId] = useState(null);
  const [messages, setMessages] = useState([]);
  const [error, setError] = useState('');

  useEffect(() => {
    listChatSessions(token).then(setResult).catch((err) => setError(err.message));
  }, [token]);

  async function toggleExpand(sessionId) {
    if (expandedId === sessionId) {
      setExpandedId(null);
      return;
    }
    setExpandedId(sessionId);
    try {
      setMessages(await getChatSessionMessages(token, sessionId));
    } catch (err) {
      setError(err.message);
    }
  }

  return (
    <AdminLayout title="Manage Chats">
      <h1 className="text-2xl font-semibold text-gray-900 dark:text-gray-50">Manage Chats</h1>
      <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
        Read-only oversight of every chat conversation, across all Operators.
      </p>

      {error && <p className="mt-3 text-sm text-red-600">{error}</p>}

      <div className="mt-6 space-y-2">
        {result?.sessions.map((session) => (
          <div
            key={session.id}
            className="rounded-xl border border-gray-200 bg-white dark:border-gray-700 dark:bg-gray-900"
          >
            <button
              type="button"
              onClick={() => toggleExpand(session.id)}
              className="flex w-full items-center justify-between p-4 text-left"
            >
              <div>
                <p className="font-medium text-gray-900 dark:text-gray-100">
                  {session.user.username} &middot; {session.mode}
                  {session.subMode ? ` / ${session.subMode}` : ''}
                </p>
                <p className="text-xs text-gray-500 dark:text-gray-400">
                  {session.workspace.account} ({session.workspace.environment}) &middot;{' '}
                  {session._count.messages} messages &middot;{' '}
                  {new Date(session.createdAt).toLocaleString()}
                </p>
              </div>
            </button>
            {expandedId === session.id && (
              <div className="border-t border-gray-100 p-4 dark:border-gray-800">
                {messages.length === 0 ? (
                  <p className="text-sm text-gray-400">No messages.</p>
                ) : (
                  <ul className="space-y-2">
                    {messages.map((m) => (
                      <li key={m.id} className="text-sm text-gray-700 dark:text-gray-200">
                        <span className="font-medium">{m.role}:</span> {m.content}
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            )}
          </div>
        ))}
        {result?.sessions.length === 0 && (
          <p className="text-sm text-gray-400">No chat sessions yet.</p>
        )}
      </div>
    </AdminLayout>
  );
}
