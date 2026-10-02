import { useEffect, useState } from 'react';
import { useAuth } from '../../lib/AuthContext';
import { getBranding, updateBranding } from '../../lib/adminApi';
import { applyFavicon } from '../../lib/useBranding';
import { useToast } from '../../lib/ToastContext';
import { AdminLayout } from './AdminLayout';

export function ManageBranding() {
  const { token } = useAuth();
  const [current, setCurrent] = useState(null);
  const [displayName, setDisplayName] = useState('');
  const [logoFile, setLogoFile] = useState(null);
  const [loginImageFile, setLoginImageFile] = useState(null);
  const [faviconFile, setFaviconFile] = useState(null);
  const toast = useToast();
  const [submitting, setSubmitting] = useState(false);

  function refresh() {
    getBranding()
      .then((data) => {
        setCurrent(data);
        setDisplayName(data.displayName);
        // Show a newly saved favicon in this tab without a reload.
        applyFavicon(data.faviconObjectKey);
      })
      .catch((err) => toast.error(err.message || 'Could not load branding.'));
  }

  useEffect(refresh, []);

  async function handleSubmit(e) {
    e.preventDefault();
    setSubmitting(true);
    try {
      await updateBranding(token, { displayName, logoFile, loginImageFile, faviconFile });
      setLogoFile(null);
      setLoginImageFile(null);
      setFaviconFile(null);
      toast.success('Branding saved.');
      refresh();
    } catch (err) {
      toast.error(err.message || 'Could not save branding.');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <AdminLayout title="Manage Branding">
      <h1 className="text-2xl font-semibold text-gray-900 dark:text-gray-50">Manage Branding</h1>
      <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
        This instance's own white-label branding -- separate from any client Organisation.
      </p>

      <form
        onSubmit={handleSubmit}
        className="mt-6 max-w-lg space-y-4 rounded-xl border border-gray-200 bg-white p-4 dark:border-gray-700 dark:bg-gray-900"
      >
        <div>
          <label className="text-sm font-medium text-gray-700 dark:text-gray-200">
            Display Name
          </label>
          <input
            required
            value={displayName}
            onChange={(e) => setDisplayName(e.target.value)}
            className="mt-1 block w-full rounded-lg border border-gray-300 px-3 py-2 text-sm dark:border-gray-600 dark:bg-gray-800 dark:text-gray-100"
          />
        </div>

        <div>
          <label className="text-sm font-medium text-gray-700 dark:text-gray-200">Logo</label>
          {current?.logoObjectKey && (
            <img src={current.logoObjectKey} alt="Current logo" className="mt-2 h-10 w-auto" />
          )}
          <input
            type="file"
            accept="image/*"
            onChange={(e) => setLogoFile(e.target.files?.[0] || null)}
            className="mt-2 block w-full text-sm text-gray-700 dark:text-gray-200"
          />
        </div>

        <div>
          <label className="text-sm font-medium text-gray-700 dark:text-gray-200">
            Login page image
          </label>
          {current?.loginImageObjectKey && (
            <img
              src={current.loginImageObjectKey}
              alt="Current login page"
              className="mt-2 h-24 w-auto rounded-lg"
            />
          )}
          <input
            type="file"
            accept="image/*"
            onChange={(e) => setLoginImageFile(e.target.files?.[0] || null)}
            className="mt-2 block w-full text-sm text-gray-700 dark:text-gray-200"
          />
        </div>

        <div>
          <label className="text-sm font-medium text-gray-700 dark:text-gray-200">
            Favicon (browser tab icon)
          </label>
          <p className="mt-0.5 text-xs text-gray-500 dark:text-gray-400">
            A square image works best, e.g. 64×64 PNG, SVG or ICO.
          </p>
          <img
            src={current?.faviconObjectKey || '/favicon.png'}
            alt="Current favicon"
            className="mt-2 size-8 rounded border border-gray-200 object-contain p-0.5 dark:border-gray-700"
          />
          <input
            type="file"
            accept="image/png,image/svg+xml,image/x-icon,image/vnd.microsoft.icon,image/*"
            onChange={(e) => setFaviconFile(e.target.files?.[0] || null)}
            className="mt-2 block w-full text-sm text-gray-700 dark:text-gray-200"
          />
        </div>

        <button
          type="submit"
          disabled={submitting}
          className="rounded-lg bg-teal-600 px-4 py-2 text-sm font-semibold text-white hover:bg-teal-700 disabled:opacity-60"
        >
          Save
        </button>
      </form>
    </AdminLayout>
  );
}
