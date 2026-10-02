import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../../lib/AuthContext';
import { listOrganisations, createOrganisation } from '../../lib/adminApi';
import { useToast } from '../../lib/ToastContext';
import { Field, FormDialog } from '../../components/Dialog';
import { AdminLayout } from './AdminLayout';

/** Name / address / phone, for adding an Organisation or editing its details. */
export function OrganisationDialog({ title, submitLabel, initial, busy, onSubmit, onClose }) {
  const [name, setName] = useState(initial?.name ?? '');
  const [address, setAddress] = useState(initial?.address ?? '');
  const [phone, setPhone] = useState(initial?.phone ?? '');
  return (
    <FormDialog
      title={title}
      submitLabel={submitLabel}
      submitting={busy}
      onSubmit={() => onSubmit({ name, address: address || undefined, phone: phone || undefined })}
      onClose={onClose}
    >
      <Field label="Name" required value={name} onChange={(e) => setName(e.target.value)} />
      <Field label="Address" value={address} onChange={(e) => setAddress(e.target.value)} />
      <Field label="Phone" value={phone} onChange={(e) => setPhone(e.target.value)} />
    </FormDialog>
  );
}

export function ManageOrganisations() {
  const { token } = useAuth();
  const toast = useToast();
  const [orgs, setOrgs] = useState(null);
  const [adding, setAdding] = useState(false);
  const [busy, setBusy] = useState(false);

  function refresh() {
    listOrganisations(token)
      .then(setOrgs)
      .catch((err) => toast.error(err.message || 'Could not load organisations.'));
  }

  useEffect(refresh, [token]);

  async function handleCreate(body) {
    setBusy(true);
    try {
      await createOrganisation(token, body);
      toast.success(`Organisation "${body.name}" added.`);
      setAdding(false);
      refresh();
    } catch (err) {
      toast.error(err.message || 'Could not add the organisation.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <AdminLayout title="Manage Organisations">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-semibold text-gray-900 dark:text-gray-50">
          Manage Organisations
        </h1>
        <button
          type="button"
          onClick={() => setAdding(true)}
          className="rounded-lg bg-teal-600 px-4 py-2 text-sm font-semibold text-white hover:bg-teal-700"
        >
          + Add organisation
        </button>
      </div>

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

      {adding && (
        <OrganisationDialog
          title="Add organisation"
          submitLabel="Add organisation"
          busy={busy}
          onSubmit={handleCreate}
          onClose={() => !busy && setAdding(false)}
        />
      )}
    </AdminLayout>
  );
}
