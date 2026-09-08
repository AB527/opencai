import { EditIcon } from '../../../components/icons';

export function WorkspaceSummaryCard({ workspace, onEdit }) {
  return (
    <div className="rounded-xl border border-teal-200 bg-teal-50/40 p-4 dark:border-teal-900 dark:bg-teal-950/20">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold text-gray-900 dark:text-gray-100">
          Choose your Workspace
        </h3>
        <button
          type="button"
          onClick={onEdit}
          aria-label="Edit workspace"
          className="text-gray-500 hover:text-teal-700 dark:text-gray-400 dark:hover:text-teal-400"
        >
          <EditIcon className="size-4" />
        </button>
      </div>
      <div className="mt-3 grid grid-cols-2 gap-3 text-sm">
        <div>
          <p className="text-xs text-gray-500 dark:text-gray-400">Business</p>
          <p className="font-medium text-gray-900 dark:text-gray-100">
            {workspace.organisation.name}
          </p>
        </div>
        <div>
          <p className="text-xs text-gray-500 dark:text-gray-400">Environment</p>
          <p className="font-medium text-gray-900 dark:text-gray-100">{workspace.environment}</p>
        </div>
        <div>
          <p className="text-xs text-gray-500 dark:text-gray-400">Cloud Provider</p>
          <p className="font-medium text-gray-900 dark:text-gray-100">{workspace.csp}</p>
        </div>
        <div>
          <p className="text-xs text-gray-500 dark:text-gray-400">Account / Subscription</p>
          <p className="font-medium text-gray-900 dark:text-gray-100">{workspace.account}</p>
        </div>
      </div>
    </div>
  );
}
