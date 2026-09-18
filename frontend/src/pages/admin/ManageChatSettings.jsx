import { useEffect, useState } from 'react';
import { useAuth } from '../../lib/AuthContext';
import { getChatSettings, updateChatSettings } from '../../lib/adminApi';
import { AdminLayout } from './AdminLayout';

export function ManageChatSettings() {
  const { token } = useAuth();
  const [provider, setProvider] = useState('ANTHROPIC');
  const [model, setModel] = useState('');
  const [configText, setConfigText] = useState('');
  const [error, setError] = useState('');
  const [saved, setSaved] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    getChatSettings(token).then((settings) => {
      if (!settings) return;
      setProvider(settings.provider);
      setModel(settings.model);
      setConfigText(settings.config ? JSON.stringify(settings.config, null, 2) : '');
    });
  }, [token]);

  async function handleSubmit(e) {
    e.preventDefault();
    setError('');
    setSaved(false);
    setSubmitting(true);
    try {
      let config;
      if (configText.trim()) {
        try {
          config = JSON.parse(configText);
        } catch {
          throw new Error('Config must be valid JSON.');
        }
      }
      await updateChatSettings(token, { provider, model, config });
      setSaved(true);
    } catch (err) {
      setError(err.message);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <AdminLayout title="Manage Chat Settings">
      <h1 className="text-2xl font-semibold text-gray-900 dark:text-gray-50">
        Manage Chat Settings
      </h1>
      <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
        Selects which model the AIOps/FinOps chat modules use.
      </p>

      <form
        onSubmit={handleSubmit}
        className="mt-6 max-w-lg space-y-4 rounded-xl border border-gray-200 bg-white p-4 dark:border-gray-700 dark:bg-gray-900"
      >
        <div>
          <label className="text-sm font-medium text-gray-700 dark:text-gray-200">Provider</label>
          <select
            value={provider}
            onChange={(e) => setProvider(e.target.value)}
            className="mt-1 block w-full rounded-lg border border-gray-300 px-3 py-2 text-sm dark:border-gray-600 dark:bg-gray-800 dark:text-gray-100"
          >
            <option value="ANTHROPIC">Anthropic</option>
            <option value="OPENAI">OpenAI</option>
            <option value="GEMINI">Gemini</option>
            <option value="GROQ">Groq</option>
          </select>
        </div>
        <div>
          <label className="text-sm font-medium text-gray-700 dark:text-gray-200">Model</label>
          <input
            required
            value={model}
            onChange={(e) => setModel(e.target.value)}
            placeholder="claude-sonnet-5"
            className="mt-1 block w-full rounded-lg border border-gray-300 px-3 py-2 text-sm dark:border-gray-600 dark:bg-gray-800 dark:text-gray-100"
          />
        </div>
        <div>
          <label className="text-sm font-medium text-gray-700 dark:text-gray-200">
            Additional config (optional, JSON)
          </label>
          <textarea
            rows={4}
            value={configText}
            onChange={(e) => setConfigText(e.target.value)}
            placeholder='{ "temperature": 0.2 }'
            className="mt-1 block w-full rounded-lg border border-gray-300 px-3 py-2 font-mono text-sm dark:border-gray-600 dark:bg-gray-800 dark:text-gray-100"
          />
        </div>

        {error && <p className="text-sm text-red-600">{error}</p>}
        {saved && <p className="text-sm text-teal-700 dark:text-teal-400">Saved.</p>}

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
