import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../../lib/AuthContext';
import { listOrganisations, createOrganisation } from '../../lib/adminApi';
import { AdminLayout } from './AdminLayout';

export function ManageOrganisations() {
  const { token } = useAuth();
  const [orgs, setOrgs] = useState(null);
  const [name, setName] = useState('');
  const [address, setAddress] = useState('');
  const [phone, setPhone] = useState('');
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  function refresh() {
    listOrganisations(token).then(setOrgs).catch((err) => setError(err.message));
  }

  useEffect(refresh, [token]);

  async function handleCreate(e) {
    e.preventDefault();
    setError('');
    setSubmitting(true);
    try {
      await createOrganisation(token, { name, address: address || undefined, phone: phone || undefined });
      setName('');
      setAddress('');
      setPhone('');
      refresh();
    } catch (err) {
      setError(err.message);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <AdminLayout title="Manage Organisations">
      <h1 className="text-2xl font-semibold text-gray-900 dark:text-gray-50">
        Manage Organisations
      </h1>

      <div className="mt-6 grid grid-cols-1 gap-3 sm:grid-cols-2">
        {orgs?.map((org) => (
          <Link
            key={org.id}
            to={`/admin/organisations/${org.id}`}
            className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm transition hover:border-teal-300 dark:border-gray-700 dark:bg-gray-900"
          >
            <p className="font-medium text-gray-900 dark:text-gray-100">{org.name}</p>
            <p className="text-sm text-gray-500 dark:text-gray-400">
              {[org.address, org.phone].filter(Boolean).join(' · ') || 'No contact details'}
            </p>
          </Link>
        ))}
        {orgs?.length === 0 && <p className="text-sm text-gray-400">No Organisations yet.</p>}
      </div>

      <form
        onSubmit={handleCreate}
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
          disabled={submitting}
          className="rounded-lg bg-teal-600 px-4 py-2 text-sm font-semibold text-white hover:bg-teal-700 disabled:opacity-60"
        >
          Add Organisation
        </button>
      </form>

      {error && <p className="mt-3 text-sm text-red-600">{error}</p>}
    </AdminLayout>
  );
}
