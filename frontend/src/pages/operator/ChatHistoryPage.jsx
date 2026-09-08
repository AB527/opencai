import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../../lib/AuthContext';
import { listChatSessions, getChatSession } from '../../lib/chatApi';
import { TopNav } from '../../components/TopNav';

const MODE_LABELS = {
  AIOPS: 'AIOps',
  FINOPS: 'FinOps',
};

export function ChatHistoryPage() {
  const { token } = useAuth();
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [result, setResult] = useState(null);
  const [expandedId, setExpandedId] = useState(null);
  const [messages, setMessages] = useState([]);
  const [error, setError] = useState('');

  useEffect(() => {
    listChatSessions(token, { search, page, pageSize: 20 })
      .then(setResult)
      .catch((err) => setError(err.message));
  }, [token, search, page]);

  async function toggleExpand(sessionId) {
    if (expandedId === sessionId) {
      setExpandedId(null);
      return;
    }
    setExpandedId(sessionId);
    try {
      const session = await getChatSession(token, sessionId);
      setMessages(session.messages);
    } catch (err) {
      setError(err.message);
    }
  }

  const totalPages = result ? Math.max(1, Math.ceil(result.total / result.pageSize)) : 1;

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-950">
      <TopNav />
      <main className="mx-auto max-w-4xl px-4 py-8">
        <div className="mb-6 flex items-center gap-2 text-sm">
          <Link to="/operator" className="font-medium text-teal-700 hover:underline dark:text-teal-400">
            Operator
          </Link>
          <span className="text-gray-400 dark:text-gray-600">/</span>
          <span className="text-gray-600 dark:text-gray-300">Chat History</span>
        </div>

        <h1 className="text-2xl font-semibold text-gray-900 dark:text-gray-50">Chat History</h1>

        <input
          value={search}
          onChange={(e) => {
            setSearch(e.target.value);
            setPage(1);
          }}
          placeholder="Search by Business, Environment, or Account..."
          className="mt-4 w-full max-w-md rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-teal-500 focus:outline-none dark:border-gray-600 dark:bg-gray-800 dark:text-gray-100"
        />

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
                    {MODE_LABELS[session.mode]}
                    {session.subMode ? ` · ${session.subMode.replace(/_/g, ' ')}` : ''}
                  </p>
                  <p className="text-xs text-gray-500 dark:text-gray-400">
                    {session.workspace.organisation.name} &middot; {session.workspace.account} (
                    {session.workspace.environment}) &middot;{' '}
                    {new Date(session.createdAt).toLocaleString()}
                  </p>
                </div>
              </button>
              {expandedId === session.id && (
                <div className="border-t border-gray-100 p-4 dark:border-gray-800">
                  {messages.length === 0 ? (
                    <p className="text-sm text-gray-400">No messages yet.</p>
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
      </main>
    </div>
  );
}
