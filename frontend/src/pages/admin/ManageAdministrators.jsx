import { useEffect, useState } from 'react';
import { useAuth } from '../../lib/AuthContext';
import { listAdministrators, createAdministrator, deleteAdministrator } from '../../lib/adminApi';
import { AdminLayout } from './AdminLayout';

export function ManageAdministrators() {
  const { token } = useAuth();
  const [admins, setAdmins] = useState(null);
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  function refresh() {
    listAdministrators(token).then(setAdmins).catch((err) => setError(err.message));
  }

  useEffect(refresh, [token]);

  async function handleCreate(e) {
    e.preventDefault();
    setError('');
    setSubmitting(true);
    try {
      await createAdministrator(token, { username, password });
      setUsername('');
      setPassword('');
      refresh();
    } catch (err) {
      setError(err.message);
    } finally {
      setSubmitting(false);
    }
  }

  async function handleDelete(id) {
    setError('');
    try {
      await deleteAdministrator(token, id);
      refresh();
    } catch (err) {
      setError(err.message);
    }
  }

  return (
    <AdminLayout title="Manage Administrators">
      <h1 className="text-2xl font-semibold text-gray-900 dark:text-gray-50">
        Manage Administrators
      </h1>

      <div className="mt-6 overflow-hidden rounded-xl border border-gray-200 bg-white dark:border-gray-700 dark:bg-gray-900">
        <table className="w-full text-left text-sm">
          <thead className="bg-gray-50 text-gray-500 dark:bg-gray-800 dark:text-gray-400">
            <tr>
              <th className="px-4 py-2 font-medium">Username</th>
              <th className="px-4 py-2 font-medium">Created</th>
              <th className="px-4 py-2 font-medium"></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
            {admins?.map((admin) => (
              <tr key={admin.id}>
                <td className="px-4 py-2 text-gray-900 dark:text-gray-100">
                  {admin.username}
                  {admin.isMasterAdmin && (
                    <span className="ml-2 rounded-full bg-teal-50 px-2 py-0.5 text-xs font-medium text-teal-700 dark:bg-teal-950 dark:text-teal-300">
                      Protected
                    </span>
                  )}
                </td>
                <td className="px-4 py-2 text-gray-500 dark:text-gray-400">
                  {new Date(admin.createdAt).toLocaleDateString()}
                </td>
                <td className="px-4 py-2 text-right">
                  {!admin.isMasterAdmin && (
                    <button
                      type="button"
                      onClick={() => handleDelete(admin.id)}
                      className="text-sm font-medium text-red-600 hover:underline"
                    >
                      Remove
                    </button>
                  )}
                </td>
              </tr>
            ))}
            {admins?.length === 0 && (
              <tr>
                <td colSpan={3} className="px-4 py-6 text-center text-gray-400">
                  No administrators yet.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <form
        onSubmit={handleCreate}
        className="mt-6 flex flex-wrap items-end gap-3 rounded-xl border border-gray-200 bg-white p-4 dark:border-gray-700 dark:bg-gray-900"
      >
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
          Add Administrator
        </button>
      </form>

      {error && <p className="mt-3 text-sm text-red-600">{error}</p>}
    </AdminLayout>
  );
}
