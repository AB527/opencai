import { useEffect, useState } from 'react';
import { useAuth } from '../../lib/AuthContext';
import {
  listOperators,
  createOperator,
  updateOperator,
  deactivateOperator,
  listOrganisations,
} from '../../lib/adminApi';
import { AdminLayout } from './AdminLayout';

function OrgCheckboxes({ organisations, selected, onChange }) {
  return (
    <div className="flex flex-wrap gap-3">
      {organisations.map((org) => (
        <label key={org.id} className="flex items-center gap-1.5 text-sm text-gray-700 dark:text-gray-200">
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

export function ManageOperators() {
  const { token } = useAuth();
  const [operators, setOperators] = useState(null);
  const [organisations, setOrganisations] = useState([]);
  const [editingId, setEditingId] = useState(null);
  const [editingOrgIds, setEditingOrgIds] = useState([]);

  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [newOrgIds, setNewOrgIds] = useState([]);
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  function refresh() {
    listOperators(token).then(setOperators).catch((err) => setError(err.message));
    listOrganisations(token).then(setOrganisations).catch((err) => setError(err.message));
  }

  useEffect(refresh, [token]);

  async function handleCreate(e) {
    e.preventDefault();
    setError('');
    setSubmitting(true);
    try {
      await createOperator(token, { username, password, organisationIds: newOrgIds });
      setUsername('');
      setPassword('');
      setNewOrgIds([]);
      refresh();
    } catch (err) {
      setError(err.message);
    } finally {
      setSubmitting(false);
    }
  }

  async function handleToggleActive(operator) {
    setError('');
    try {
      if (operator.isActive) {
        await deactivateOperator(token, operator.id);
      } else {
        await updateOperator(token, operator.id, { isActive: true });
      }
      refresh();
    } catch (err) {
      setError(err.message);
    }
  }

  function startEditingOrgs(operator) {
    setEditingId(operator.id);
    setEditingOrgIds(operator.organisations.map((o) => o.id));
  }

  async function saveOrgs(operatorId) {
    setError('');
    try {
      await updateOperator(token, operatorId, { organisationIds: editingOrgIds });
      setEditingId(null);
      refresh();
    } catch (err) {
      setError(err.message);
    }
  }

  return (
    <AdminLayout title="Manage Operators">
      <h1 className="text-2xl font-semibold text-gray-900 dark:text-gray-50">Manage Operators</h1>

      <div className="mt-6 space-y-3">
        {operators?.map((operator) => (
          <div
            key={operator.id}
            className="rounded-xl border border-gray-200 bg-white p-4 dark:border-gray-700 dark:bg-gray-900"
          >
            <div className="flex items-center justify-between">
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
                  {operator.organisations.map((o) => o.name).join(', ') || 'No Organisations assigned'}
                </p>
              </div>
              <div className="flex gap-3">
                <button
                  type="button"
                  onClick={() => startEditingOrgs(operator)}
                  className="text-sm font-medium text-teal-700 hover:underline dark:text-teal-400"
                >
                  Edit Organisations
                </button>
                <button
                  type="button"
                  onClick={() => handleToggleActive(operator)}
                  className="text-sm font-medium text-gray-600 hover:underline dark:text-gray-300"
                >
                  {operator.isActive ? 'Deactivate' : 'Reactivate'}
                </button>
              </div>
            </div>

            {editingId === operator.id && (
              <div className="mt-3 border-t border-gray-100 pt-3 dark:border-gray-800">
                <OrgCheckboxes
                  organisations={organisations}
                  selected={editingOrgIds}
                  onChange={setEditingOrgIds}
                />
                <div className="mt-3 flex gap-2">
                  <button
                    type="button"
                    onClick={() => saveOrgs(operator.id)}
                    className="rounded-lg bg-teal-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-teal-700"
                  >
                    Save
                  </button>
                  <button
                    type="button"
                    onClick={() => setEditingId(null)}
                    className="rounded-lg border border-gray-300 px-3 py-1.5 text-sm font-medium text-gray-700 dark:border-gray-600 dark:text-gray-200"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            )}
          </div>
        ))}
        {operators?.length === 0 && (
          <p className="text-sm text-gray-400">No operators yet.</p>
        )}
      </div>

      <form
        onSubmit={handleCreate}
        className="mt-6 space-y-3 rounded-xl border border-gray-200 bg-white p-4 dark:border-gray-700 dark:bg-gray-900"
      >
        <h2 className="font-medium text-gray-900 dark:text-gray-100">Add Operator</h2>
        <div className="flex flex-wrap items-end gap-3">
          <div>
            <label className="text-sm font-medium text-gray-700 dark:text-gray-200">Username</label>
            <input
              required
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              className="mt-1 block rounded-lg border border-gray-300 px-3 py-2 text-sm dark:border-gray-600 dark:bg-gray-800 dark:text-gray-100"
            />
          </div>
          <div>
            <label className="text-sm font-medium text-gray-700 dark:text-gray-200">Password</label>
            <input
              type="password"
              required
              minLength={8}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="mt-1 block rounded-lg border border-gray-300 px-3 py-2 text-sm dark:border-gray-600 dark:bg-gray-800 dark:text-gray-100"
            />
          </div>
          <button
            type="submit"
            disabled={submitting}
            className="rounded-lg bg-teal-600 px-4 py-2 text-sm font-semibold text-white hover:bg-teal-700 disabled:opacity-60"
          >
            Add Operator
          </button>
        </div>
        <div>
          <p className="text-sm font-medium text-gray-700 dark:text-gray-200">Organisation access</p>
          <div className="mt-1">
            <OrgCheckboxes organisations={organisations} selected={newOrgIds} onChange={setNewOrgIds} />
          </div>
        </div>
      </form>

      {error && <p className="mt-3 text-sm text-red-600">{error}</p>}
    </AdminLayout>
  );
}
