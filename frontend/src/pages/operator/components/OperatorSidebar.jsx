import { Link } from 'react-router-dom';
import { WorkspaceSummaryCard } from './WorkspaceSummaryCard';
import { BoltIcon, ChartIcon } from '../../../components/icons';

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

export function OperatorSidebar({
  cloudOrOnPrem,
  onChangeCloudOrOnPrem,
  workspace,
  onEditWorkspace,
  activeMode,
  onSelectMode,
  recentSessions,
}) {
  return (
    <aside className="flex w-72 shrink-0 flex-col gap-5 border-r border-gray-200 bg-white p-4 dark:border-gray-800 dark:bg-gray-900">
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

          <div>
            <h3 className="px-1 text-xs font-semibold uppercase tracking-wide text-gray-400 dark:text-gray-500">
              Recent History
            </h3>
            <ul className="mt-2 space-y-1">
              {recentSessions?.map((session) => (
                <li key={session.id}>
                  <Link
                    to="/operator/history"
                    className="block truncate rounded-lg px-3 py-1.5 text-sm text-gray-600 hover:bg-gray-50 dark:text-gray-300 dark:hover:bg-gray-800"
                    title={session.id}
                  >
                    {session.mode === 'FINOPS' && session.subMode
                      ? `FinOps · ${session.subMode.replace('_', ' ')}`
                      : session.mode === 'FINOPS'
                        ? 'FinOps'
                        : 'AIOps'}{' '}
                    &middot; {session.workspace.account}
                  </Link>
                </li>
              ))}
              {(!recentSessions || recentSessions.length === 0) && (
                <li className="px-3 py-1.5 text-sm text-gray-400">No sessions yet.</li>
              )}
            </ul>
            <Link
              to="/operator/history"
              className="mt-2 block px-3 text-sm font-medium text-teal-700 hover:underline dark:text-teal-400"
            >
              Show all &rarr;
            </Link>
          </div>
        </>
      )}
    </aside>
  );
}
