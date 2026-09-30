import { useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { WorkspaceSummaryCard } from './WorkspaceSummaryCard';
import { BoltIcon, ChartIcon, EditIcon } from '../../../components/icons';

const MODES = [
  { key: 'AIOPS', label: 'AIOps', Icon: BoltIcon },
  { key: 'FINOPS', label: 'FinOps', Icon: ChartIcon },
];

function pillClass(active) {
  return `flex-1 rounded-full px-4 py-1.5 text-sm font-medium transition ${
    active
      ? 'bg-teal-600 text-white'
      : 'bg-gray-100 text-gray-600 hover:bg-gray-200 dark:bg-gray-800 dark:text-gray-300 dark:hover:bg-gray-700'
  }`;
}

function sessionSubtitle(session) {
  const parts = [];
  if (session.subMode) parts.push(session.subMode.replace(/_/g, ' '));
  parts.push(session.workspace.account);
  return parts.join(' · ');
}

function RecentSessionItem({ session, active, onRename }) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  // Set once Enter, Escape or blur has handled this edit, so the blur that can
  // follow Enter/Escape doesn't save a second time (or save a cancelled edit).
  const doneRef = useRef(false);
  const title = session.title || 'Untitled chat';

  function startEditing() {
    doneRef.current = false;
    setDraft(session.title || '');
    setError('');
    setEditing(true);
  }

  function cancel() {
    doneRef.current = true;
    setEditing(false);
  }

  async function save() {
    if (doneRef.current) return;
    const value = draft.trim();
    if (!value || value === session.title) {
      cancel();
      return;
    }
    doneRef.current = true;
    setSaving(true);
    try {
      await onRename(session.id, value);
      setEditing(false);
    } catch (err) {
      // Keep the input open with the error so the Operator can retry.
      doneRef.current = false;
      setError(err.message || 'Could not rename.');
    } finally {
      setSaving(false);
    }
  }

  if (editing) {
    return (
      <li className="px-1">
        <input
          autoFocus
          value={draft}
          maxLength={100}
          disabled={saving}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') save();
            if (e.key === 'Escape') cancel();
          }}
          onBlur={save}
          aria-label="Chat title"
          className="w-full rounded-lg border border-teal-500 px-2 py-1 text-sm focus:outline-none disabled:opacity-60 dark:bg-gray-800 dark:text-gray-100"
        />
        {error && <p className="mt-1 px-1 text-xs text-red-600">{error}</p>}
      </li>
    );
  }

  return (
    <li
      className={`group flex items-center rounded-lg ${
        active ? 'bg-teal-50 dark:bg-teal-950/60' : 'hover:bg-gray-50 dark:hover:bg-gray-800'
      }`}
    >
      <Link
        to={`/operator?session=${session.id}`}
        aria-current={active ? 'page' : undefined}
        className="min-w-0 flex-1 px-3 py-1.5"
        title={title}
      >
        <span className="block truncate text-sm text-gray-700 dark:text-gray-200">{title}</span>
        <span className="block truncate text-xs text-gray-400 dark:text-gray-500">
          {sessionSubtitle(session)}
        </span>
      </Link>
      <button
        type="button"
        onClick={startEditing}
        aria-label={`Rename "${title}"`}
        title="Rename"
        className="mr-1 shrink-0 rounded-md p-1.5 text-gray-400 opacity-0 hover:bg-gray-200 hover:text-gray-700 focus:opacity-100 group-hover:opacity-100 dark:hover:bg-gray-700 dark:hover:text-gray-200"
      >
        <EditIcon className="size-3.5" />
      </button>
    </li>
  );
}

export function OperatorSidebar({
  cloudOrOnPrem,
  onChangeCloudOrOnPrem,
  workspace,
  onEditWorkspace,
  activeMode,
  onSelectMode,
  recentSessions,
  onRenameSession,
  activeSessionId,
}) {
  return (
    <aside className="flex min-h-0 w-72 shrink-0 flex-col gap-5 border-r border-gray-200 bg-white p-4 dark:border-gray-800 dark:bg-gray-900">
      <div className="flex gap-2">
        <button
          type="button"
          onClick={() => onChangeCloudOrOnPrem('cloud')}
          className={pillClass(cloudOrOnPrem === 'cloud')}
        >
          Cloud
        </button>
        <button
          type="button"
          onClick={() => onChangeCloudOrOnPrem('onprem')}
          className={pillClass(cloudOrOnPrem === 'onprem')}
        >
          On-Prem
        </button>
      </div>

      {cloudOrOnPrem === 'onprem' ? (
        <p className="text-sm text-gray-500 dark:text-gray-400">Coming Soon.</p>
      ) : (
        <>
          {workspace && <WorkspaceSummaryCard workspace={workspace} onEdit={onEditWorkspace} />}

          <nav className="flex flex-col gap-1">
            {MODES.map(({ key, label, Icon }) => (
              <button
                key={key}
                type="button"
                onClick={() => onSelectMode(key)}
                className={`flex items-center gap-2.5 rounded-lg px-3 py-2 text-sm font-medium transition ${
                  activeMode === key
                    ? 'bg-teal-50 text-teal-700 dark:bg-teal-950/60 dark:text-teal-300'
                    : 'text-gray-600 hover:bg-gray-50 dark:text-gray-300 dark:hover:bg-gray-800'
                }`}
              >
                <Icon className="size-4" />
                {label}
              </button>
            ))}
          </nav>

          {/* Fills the rest of the sidebar: the list scrolls, "Show all" stays at the bottom. */}
          <div className="flex min-h-0 flex-1 flex-col">
            <h3 className="px-1 text-xs font-semibold uppercase tracking-wide text-gray-400 dark:text-gray-500">
              Recent History &middot; {MODES.find((m) => m.key === activeMode)?.label}
            </h3>
            <ul className="-mx-1 mt-2 min-h-0 flex-1 space-y-1 overflow-y-auto px-1">
              {recentSessions?.map((session) => (
                <RecentSessionItem
                  key={session.id}
                  session={session}
                  active={session.id === activeSessionId}
                  onRename={onRenameSession}
                />
              ))}
              {(!recentSessions || recentSessions.length === 0) && (
                <li className="px-3 py-1.5 text-sm text-gray-400">No sessions yet.</li>
              )}
            </ul>
            <Link
              to="/operator/history"
              className="mt-2 block shrink-0 border-t border-gray-100 px-3 pt-3 text-sm font-medium text-teal-700 hover:underline dark:border-gray-800 dark:text-teal-400"
            >
              Show all &rarr;
            </Link>
          </div>
        </>
      )}
    </aside>
  );
}
