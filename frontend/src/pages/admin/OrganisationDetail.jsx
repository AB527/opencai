import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { useAuth } from '../../lib/AuthContext';
import {
  getOrganisation,
  updateOrganisation,
  createWorkspace,
  updateWorkspace,
  setWorkspaceCredential,
} from '../../lib/adminApi';
import { AdminLayout } from './AdminLayout';

const CSP_OPTIONS = ['AWS'];

function WorkspaceRow({ orgId, workspace, token, onChanged }) {
  const [editingFields, setEditingFields] = useState(false);
  const [account, setAccount] = useState(workspace.account);
  const [environment, setEnvironment] = useState(workspace.environment);

  const [editingCredential, setEditingCredential] = useState(false);
  const [accessKeyId, setAccessKeyId] = useState('');
  const [secretAccessKey, setSecretAccessKey] = useState('');
  const [error, setError] = useState('');

  async function saveFields() {
    setError('');
    try {
      await updateWorkspace(token, orgId, workspace.id, { account, environment });
      setEditingFields(false);
      onChanged();
    } catch (err) {
      setError(err.message);
    }
  }

  async function saveCredential(e) {
    e.preventDefault();
    setError('');
    try {
      await setWorkspaceCredential(token, orgId, workspace.id, { accessKeyId, secretAccessKey });
      setEditingCredential(false);
      setAccessKeyId('');
      setSecretAccessKey('');
      onChanged();
    } catch (err) {
      setError(err.message);
    }
  }

  return (
    <div className="rounded-xl border border-gray-200 bg-white p-4 dark:border-gray-700 dark:bg-gray-900">
      <div className="flex items-center justify-between">
        {editingFields ? (
          <div className="flex flex-wrap items-end gap-2">
            <div>
              <label className="text-xs text-gray-500">Account</label>
              <input
                value={account}
                onChange={(e) => setAccount(e.target.value)}
                className="block rounded-lg border border-gray-300 px-2 py-1 text-sm dark:border-gray-600 dark:bg-gray-800 dark:text-gray-100"
              />
            </div>
            <div>
              <label className="text-xs text-gray-500">Environment</label>
              <input
                value={environment}
                onChange={(e) => setEnvironment(e.target.value)}
                className="block rounded-lg border border-gray-300 px-2 py-1 text-sm dark:border-gray-600 dark:bg-gray-800 dark:text-gray-100"
              />
            </div>
            <button
              type="button"
              onClick={saveFields}
              className="rounded-lg bg-teal-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-teal-700"
            >
              Save
            </button>
            <button
              type="button"
              onClick={() => setEditingFields(false)}
              className="rounded-lg border border-gray-300 px-3 py-1.5 text-sm dark:border-gray-600 dark:text-gray-200"
            >
              Cancel
            </button>
          </div>
        ) : (
          <div>
            <p className="font-medium text-gray-900 dark:text-gray-100">
              {workspace.csp} &middot; {workspace.account} &middot; {workspace.environment}
            </p>
            <p className="text-xs text-gray-500 dark:text-gray-400">
              Credentials:{' '}
              {workspace.credential ? (
                <span className="text-teal-700 dark:text-teal-400">set</span>
              ) : (
                <span className="text-amber-600">not set</span>
              )}
            </p>
          </div>
        )}
        {!editingFields && (
          <div className="flex gap-3">
            <button
              type="button"
              onClick={() => setEditingFields(true)}
              className="text-sm font-medium text-teal-700 hover:underline dark:text-teal-400"
            >
              Edit
            </button>
            <button
              type="button"
              onClick={() => setEditingCredential((v) => !v)}
              className="text-sm font-medium text-gray-600 hover:underline dark:text-gray-300"
            >
              {workspace.credential ? 'Replace credentials' : 'Attach credentials'}
            </button>
          </div>
        )}
      </div>

      {editingCredential && (
        <form
          onSubmit={saveCredential}
          className="mt-3 flex flex-wrap items-end gap-2 border-t border-gray-100 pt-3 dark:border-gray-800"
        >
          <div>
            <label className="text-xs text-gray-500">AWS Access Key ID</label>
            <input
              required
              value={accessKeyId}
              onChange={(e) => setAccessKeyId(e.target.value)}
              className="block rounded-lg border border-gray-300 px-2 py-1 text-sm dark:border-gray-600 dark:bg-gray-800 dark:text-gray-100"
            />
          </div>
          <div>
            <label className="text-xs text-gray-500">AWS Secret Access Key</label>
            <input
              required
              type="password"
              value={secretAccessKey}
              onChange={(e) => setSecretAccessKey(e.target.value)}
              className="block rounded-lg border border-gray-300 px-2 py-1 text-sm dark:border-gray-600 dark:bg-gray-800 dark:text-gray-100"
            />
          </div>
          <button
            type="submit"
            className="rounded-lg bg-teal-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-teal-700"
          >
            Save
          </button>
        </form>
      )}
      {error && <p className="mt-2 text-sm text-red-600">{error}</p>}
    </div>
  );
}

export function OrganisationDetail() {
  const { id } = useParams();
  const { token } = useAuth();
  const [org, setOrg] = useState(null);
  const [name, setName] = useState('');
  const [address, setAddress] = useState('');
  const [phone, setPhone] = useState('');
  const [error, setError] = useState('');
  const [saved, setSaved] = useState(false);

  const [csp, setCsp] = useState(CSP_OPTIONS[0]);
  const [account, setAccount] = useState('');
  const [environment, setEnvironment] = useState('');

  function refresh() {
    getOrganisation(token, id).then((data) => {
      setOrg(data);
      setName(data.name);
      setAddress(data.address || '');
      setPhone(data.phone || '');
    });
  }

  useEffect(refresh, [token, id]);

  async function handleSaveDetails(e) {
    e.preventDefault();
    setError('');
    setSaved(false);
    try {
      await updateOrganisation(token, id, { name, address: address || undefined, phone: phone || undefined });
      setSaved(true);
      refresh();
    } catch (err) {
      setError(err.message);
    }
  }

  async function handleAddWorkspace(e) {
    e.preventDefault();
    setError('');
    try {
      await createWorkspace(token, id, { csp, account, environment });
      setAccount('');
      setEnvironment('');
      refresh();
    } catch (err) {
      setError(err.message);
    }
  }

  if (!org) {
    return (
      <AdminLayout title="Organisation">
        <p className="text-sm text-gray-500">Loading...</p>
      </AdminLayout>
    );
  }

  return (
    <AdminLayout title={org.name}>
      <h1 className="text-2xl font-semibold text-gray-900 dark:text-gray-50">{org.name}</h1>

      <form
        onSubmit={handleSaveDetails}
        className="mt-6 flex flex-wrap items-end gap-3 rounded-xl border border-gray-200 bg-white p-4 dark:border-gray-700 dark:bg-gray-900"
      >
        <div>
          <label className="text-sm font-medium text-gray-700 dark:text-gray-200">Name</label>
          <input
            required
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="mt-1 block rounded-lg border border-gray-300 px-3 py-2 text-sm dark:border-gray-600 dark:bg-gray-800 dark:text-gray-100"
          />
        </div>
        <div>
          <label className="text-sm font-medium text-gray-700 dark:text-gray-200">Address</label>
          <input
            value={address}
            onChange={(e) => setAddress(e.target.value)}
            className="mt-1 block rounded-lg border border-gray-300 px-3 py-2 text-sm dark:border-gray-600 dark:bg-gray-800 dark:text-gray-100"
          />
        </div>
        <div>
          <label className="text-sm font-medium text-gray-700 dark:text-gray-200">Phone</label>
          <input
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            className="mt-1 block rounded-lg border border-gray-300 px-3 py-2 text-sm dark:border-gray-600 dark:bg-gray-800 dark:text-gray-100"
          />
        </div>
        <button
          type="submit"
          className="rounded-lg bg-teal-600 px-4 py-2 text-sm font-semibold text-white hover:bg-teal-700"
        >
          Save
        </button>
        {saved && <span className="text-sm text-teal-700 dark:text-teal-400">Saved.</span>}
      </form>

      <h2 className="mt-8 text-lg font-semibold text-gray-900 dark:text-gray-50">Workspaces</h2>
      <div className="mt-3 space-y-3">
        {org.workspaces.map((ws) => (
          <WorkspaceRow key={ws.id} orgId={id} workspace={ws} token={token} onChanged={refresh} />
        ))}
        {org.workspaces.length === 0 && (
          <p className="text-sm text-gray-400">No Workspaces yet.</p>
        )}
      </div>

      <form
        onSubmit={handleAddWorkspace}
        className="mt-4 flex flex-wrap items-end gap-3 rounded-xl border border-gray-200 bg-white p-4 dark:border-gray-700 dark:bg-gray-900"
      >
        <div>
          <label className="text-sm font-medium text-gray-700 dark:text-gray-200">
            Cloud Provider
          </label>
          <select
            value={csp}
            onChange={(e) => setCsp(e.target.value)}
            className="mt-1 block rounded-lg border border-gray-300 px-3 py-2 text-sm dark:border-gray-600 dark:bg-gray-800 dark:text-gray-100"
          >
            {CSP_OPTIONS.map((option) => (
              <option key={option} value={option}>
                {option}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="text-sm font-medium text-gray-700 dark:text-gray-200">Account</label>
          <input
            required
            value={account}
            onChange={(e) => setAccount(e.target.value)}
            className="mt-1 block rounded-lg border border-gray-300 px-3 py-2 text-sm dark:border-gray-600 dark:bg-gray-800 dark:text-gray-100"
          />
        </div>
        <div>
          <label className="text-sm font-medium text-gray-700 dark:text-gray-200">
            Environment
          </label>
          <input
            required
            value={environment}
            onChange={(e) => setEnvironment(e.target.value)}
            className="mt-1 block rounded-lg border border-gray-300 px-3 py-2 text-sm dark:border-gray-600 dark:bg-gray-800 dark:text-gray-100"
          />
        </div>
        <button
          type="submit"
          className="rounded-lg bg-teal-600 px-4 py-2 text-sm font-semibold text-white hover:bg-teal-700"
        >
          Add Workspace
        </button>
      </form>

      {error && <p className="mt-3 text-sm text-red-600">{error}</p>}
    </AdminLayout>
  );
}
