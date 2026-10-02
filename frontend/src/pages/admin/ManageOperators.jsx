import { useEffect, useState } from 'react';
import { useAuth } from '../../lib/AuthContext';
import {
  listOperators,
  createOperator,
  updateOperator,
  deactivateOperator,
  deleteOperator,
  listOrganisations,
} from '../../lib/adminApi';
import { useToast } from '../../lib/ToastContext';
import { ConfirmDialog, Field, FormDialog } from '../../components/Dialog';
import { AdminLayout } from './AdminLayout';

function OrgCheckboxes({ organisations, selected, onChange }) {
  return (
    <div className="flex flex-wrap gap-3">
      {organisations.map((org) => (
        <label
          key={org.id}
          className="flex items-center gap-1.5 text-sm text-gray-700 dark:text-gray-200"
        >
          <input
            type="checkbox"
            checked={selected.includes(org.id)}
            onChange={(e) => {
              onChange(
                e.target.checked ? [...selected, org.id] : selected.filter((id) => id !== org.id),
              );
            }}
          />
          {org.name}
        </label>
      ))}
      {organisations.length === 0 && (
        <p className="text-sm text-gray-400">No Organisations yet -- create one first.</p>
      )}
    </div>
  );
}

function OrgAccessField({ organisations, selected, onChange }) {
  return (
    <div>
      <p className="text-sm font-medium text-gray-700 dark:text-gray-200">Organisation access</p>
      <div className="mt-1">
        <OrgCheckboxes organisations={organisations} selected={selected} onChange={onChange} />
      </div>
    </div>
  );
}

function AddOperatorDialog({ organisations, busy, onSubmit, onClose }) {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [organisationIds, setOrganisationIds] = useState([]);
  return (
    <FormDialog
      title="Add operator"
      submitLabel="Add operator"
      submitting={busy}
      onSubmit={() => onSubmit({ username, password, organisationIds })}
      onClose={onClose}
    >
      <Field
        label="Username"
        required
        value={username}
        onChange={(e) => setUsername(e.target.value)}
      />
      <Field
        label="Password"
        type="password"
        required
        minLength={8}
        value={password}
        onChange={(e) => setPassword(e.target.value)}
      />
      <OrgAccessField
        organisations={organisations}
        selected={organisationIds}
        onChange={setOrganisationIds}
      />
    </FormDialog>
  );
}

function EditOrganisationsDialog({ operator, organisations, busy, onSubmit, onClose }) {
  const [organisationIds, setOrganisationIds] = useState(() =>
    operator.organisations.map((o) => o.id),
  );
  return (
    <FormDialog
      title={`Organisations for "${operator.username}"`}
      submitting={busy}
      onSubmit={() => onSubmit(organisationIds)}
      onClose={onClose}
    >
      <OrgAccessField
        organisations={organisations}
        selected={organisationIds}
        onChange={setOrganisationIds}
      />
    </FormDialog>
  );
}

export function ManageOperators() {
  const { token } = useAuth();
  const toast = useToast();
  const [operators, setOperators] = useState(null);
  const [organisations, setOrganisations] = useState([]);
  // { type: 'add' | 'orgs' | 'deactivate' | 'reactivate' | 'delete', operator? }
  const [dialog, setDialog] = useState(null);
  const [busy, setBusy] = useState(false);

  function refresh() {
    listOperators(token)
      .then(setOperators)
      .catch((err) => toast.error(err.message || 'Could not load operators.'));
    listOrganisations(token)
      .then(setOrganisations)
      .catch((err) => toast.error(err.message || 'Could not load organisations.'));
  }

  useEffect(refresh, [token]);

  /** Runs a dialog's action; closes it on success, keeps it open on failure. */
  async function run(action, success, failure) {
    setBusy(true);
    try {
      await action();
      toast.success(success);
      setDialog(null);
      refresh();
    } catch (err) {
      toast.error(err.message || failure);
    } finally {
      setBusy(false);
    }
  }

  const close = () => !busy && setDialog(null);
  const op = dialog?.operator;

  return (
    <AdminLayout title="Manage Operators">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-semibold text-gray-900 dark:text-gray-50">Manage Operators</h1>
        <button
          type="button"
          onClick={() => setDialog({ type: 'add' })}
          className="rounded-lg bg-teal-600 px-4 py-2 text-sm font-semibold text-white hover:bg-teal-700"
        >
          + Add operator
        </button>
      </div>

      <div className="mt-6 space-y-3">
        {operators?.map((operator) => (
          <div
            key={operator.id}
            className="rounded-xl border border-gray-200 bg-white p-4 dark:border-gray-700 dark:bg-gray-900"
          >
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <p className="font-medium text-gray-900 dark:text-gray-100">
                  {operator.username}
                  {!operator.isActive && (
                    <span className="ml-2 rounded-full bg-gray-100 px-2 py-0.5 text-xs font-medium text-gray-500 dark:bg-gray-800 dark:text-gray-400">
                      Deactivated
                    </span>
                  )}
                </p>
                <p className="text-xs text-gray-500 dark:text-gray-400">
                  {operator.organisations.map((o) => o.name).join(', ') ||
                    'No Organisations assigned'}
                </p>
              </div>
              <div className="flex gap-3">
                <button
                  type="button"
                  onClick={() => setDialog({ type: 'orgs', operator })}
                  className="text-sm font-medium text-teal-700 hover:underline dark:text-teal-400"
                >
                  Edit Organisations
                </button>
                <button
                  type="button"
                  onClick={() =>
                    setDialog({ type: operator.isActive ? 'deactivate' : 'reactivate', operator })
                  }
                  className="text-sm font-medium text-gray-600 hover:underline dark:text-gray-300"
                >
                  {operator.isActive ? 'Deactivate' : 'Reactivate'}
                </button>
                <button
                  type="button"
                  onClick={() => setDialog({ type: 'delete', operator })}
                  className="text-sm font-medium text-red-600 hover:underline"
                >
                  Delete
                </button>
              </div>
            </div>
          </div>
        ))}
        {operators?.length === 0 && <p className="text-sm text-gray-400">No operators yet.</p>}
      </div>

      {dialog?.type === 'add' && (
        <AddOperatorDialog
          organisations={organisations}
          busy={busy}
          onClose={close}
          onSubmit={(body) =>
            run(
              () => createOperator(token, body),
              `Operator "${body.username}" added.`,
              'Could not add the operator.',
            )
          }
        />
      )}
      {dialog?.type === 'orgs' && (
        <EditOrganisationsDialog
          operator={op}
          organisations={organisations}
          busy={busy}
          onClose={close}
          onSubmit={(organisationIds) =>
            run(
              () => updateOperator(token, op.id, { organisationIds }),
              `Organisations for "${op.username}" updated.`,
              "Could not update the operator's organisations.",
            )
          }
        />
      )}
      {dialog?.type === 'deactivate' && (
        <ConfirmDialog
          title="Deactivate operator?"
          message={`"${op.username}" will no longer be able to sign in. Their chat history is kept, and you can reactivate them later.`}
          confirmLabel="Deactivate"
          busy={busy}
          onClose={close}
          onConfirm={() =>
            run(
              () => deactivateOperator(token, op.id),
              `Operator "${op.username}" deactivated.`,
              'Could not deactivate the operator.',
            )
          }
        />
      )}
      {dialog?.type === 'reactivate' && (
        <ConfirmDialog
          title="Reactivate operator?"
          message={`"${op.username}" will be able to sign in again.`}
          confirmLabel="Reactivate"
          tone="primary"
          busy={busy}
          onClose={close}
          onConfirm={() =>
            run(
              () => updateOperator(token, op.id, { isActive: true }),
              `Operator "${op.username}" reactivated.`,
              'Could not reactivate the operator.',
            )
          }
        />
      )}
      {dialog?.type === 'delete' && (
        <ConfirmDialog
          title="Delete operator?"
          message={`This permanently deletes "${op.username}". Operators with chat history can't be deleted; deactivate them instead.`}
          confirmLabel="Delete"
          busy={busy}
          onClose={close}
          onConfirm={() =>
            run(
              () => deleteOperator(token, op.id),
              `Operator "${op.username}" deleted.`,
              'Could not delete the operator.',
            )
          }
        />
      )}
    </AdminLayout>
  );
}
