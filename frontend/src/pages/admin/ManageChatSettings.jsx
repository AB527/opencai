import { useEffect, useState } from 'react';
import { useAuth } from '../../lib/AuthContext';
import { getChatSettings, updateChatSettings } from '../../lib/adminApi';
import { AdminLayout } from './AdminLayout';

// Settings the backend understands, offered as ready-made rows and filled with
// their defaults (sent by the backend for the stored provider and model). A row
// still at its default is not saved, so defaults keep following the model --
// e.g. context_window when the model changes. Only changed values are saved.
const KNOWN_SETTINGS = [
  { key: 'temperature', hint: 'Randomness of replies, 0–1.' },
  { key: 'max_tokens', hint: 'Longest reply the model may write, in tokens.' },
  {
    key: 'context_window',
    hint: 'The model’s context size in tokens, for the usage ring.',
    unknown: 'unknown for this model — set it',
  },
  {
    key: 'history_chars',
    hint: 'Characters of earlier conversation sent with each request. Raise on larger plans.',
  },
  { key: 'tool_output_chars', hint: 'Characters of the newest command output sent to the model.' },
  {
    key: 'chat_template_kwargs',
    hint: 'OpenAI-compatible servers such as NVIDIA: model template options, as JSON.',
    unknown: '{"thinking": true}',
  },
];
const KNOWN = Object.fromEntries(KNOWN_SETTINGS.map((s) => [s.key, s]));

// Used until the backend has answered (or on a fresh install with no settings).
const FALLBACK_DEFAULTS = {
  temperature: 0.2,
  max_tokens: 4096,
  context_window: null,
  history_chars: 9000,
  tool_output_chars: 6000,
};

const show = (v) => (typeof v === 'string' ? v : JSON.stringify(v));
const defaultText = (defaults, key) =>
  defaults?.[key] === null || defaults?.[key] === undefined ? '' : show(defaults[key]);

let rowId = 0;
const newRow = (key = '', value = '') => ({ id: ++rowId, key, value });

/** Every known setting (its saved value, else its default), then any others. */
function rowsFromConfig(config, defaults) {
  const values = config && typeof config === 'object' ? config : {};
  const known = KNOWN_SETTINGS.map((s) =>
    newRow(s.key, s.key in values ? show(values[s.key]) : defaultText(defaults, s.key)),
  );
  const extra = Object.entries(values)
    .filter(([k]) => !KNOWN[k])
    .map(([k, v]) => newRow(k, show(v)));
  return [...known, ...extra];
}

/** Numbers, booleans and JSON objects are saved as such; anything else as text. */
function parseValue(text) {
  try {
    const parsed = JSON.parse(text);
    if (typeof parsed !== 'string') return parsed;
  } catch {
    // Not JSON: plain text.
  }
  return text;
}

const isAtDefault = (key, value, defaults) =>
  Boolean(KNOWN[key]) && value !== '' && value === defaultText(defaults, key);

function configFromRows(rows, defaults) {
  const config = {};
  const seen = new Set();
  for (const { key, value } of rows) {
    const k = key.trim();
    const v = value.trim();
    if (!v) continue;
    if (!k) throw new Error('Every setting with a value needs a key.');
    if (seen.has(k)) throw new Error(`The setting "${k}" appears more than once.`);
    seen.add(k);
    if (isAtDefault(k, v, defaults)) continue;
    config[k] = parseValue(v);
  }
  // Always an object: an omitted config would leave the stored one unchanged,
  // so clearing every row would silently do nothing.
  return config;
}

const inputClass =
  'block w-full rounded-lg border border-gray-300 px-3 py-2 text-sm dark:border-gray-600 dark:bg-gray-800 dark:text-gray-100';

function ConfigEditor({ rows, defaults, onChange }) {
  const update = (id, field, value) =>
    onChange(rows.map((r) => (r.id === id ? { ...r, [field]: value } : r)));
  const remove = (id) => onChange(rows.filter((r) => r.id !== id));

  return (
    <div className="mt-2 space-y-3">
      {rows.map((row) => {
        const key = row.key.trim();
        const known = KNOWN[key];
        return (
          <div key={row.id}>
            <div className="flex items-center gap-2">
              <input
                value={row.key}
                onChange={(e) => update(row.id, 'key', e.target.value)}
                placeholder="key"
                aria-label="Setting key"
                className={`${inputClass} w-48 shrink-0 font-mono`}
              />
              <input
                value={row.value}
                onChange={(e) => update(row.id, 'value', e.target.value)}
                placeholder={known?.unknown ?? 'value'}
                aria-label={`Value for ${row.key || 'new setting'}`}
                className={`${inputClass} min-w-0 flex-1 font-mono`}
              />
              <button
                type="button"
                onClick={() => remove(row.id)}
                aria-label={`Remove ${row.key || 'setting'}`}
                title="Remove"
                className="shrink-0 rounded-md p-2 text-gray-400 hover:bg-gray-100 hover:text-gray-700 dark:hover:bg-gray-800 dark:hover:text-gray-200"
              >
                <svg viewBox="0 0 20 20" fill="currentColor" aria-hidden="true" className="size-4">
                  <path d="M6.28 5.22a.75.75 0 0 0-1.06 1.06L8.94 10l-3.72 3.72a.75.75 0 1 0 1.06 1.06L10 11.06l3.72 3.72a.75.75 0 1 0 1.06-1.06L11.06 10l3.72-3.72a.75.75 0 0 0-1.06-1.06L10 8.94 6.28 5.22Z" />
                </svg>
              </button>
            </div>
            {known && (
              <p className="mt-1 pl-[12.5rem] text-xs text-gray-500 dark:text-gray-400">
                {known.hint}
              </p>
            )}
          </div>
        );
      })}
      <button
        type="button"
        onClick={() => onChange([...rows, newRow()])}
        className="rounded-lg border border-dashed border-gray-300 px-3 py-1.5 text-sm font-medium text-gray-700 hover:border-teal-500 hover:text-teal-700 dark:border-gray-600 dark:text-gray-200 dark:hover:text-teal-400"
      >
        + Add setting
      </button>
    </div>
  );
}

export function ManageChatSettings() {
  const { token } = useAuth();
  const [provider, setProvider] = useState('ANTHROPIC');
  const [model, setModel] = useState('');
  const [defaults, setDefaults] = useState(FALLBACK_DEFAULTS);
  const [configRows, setConfigRows] = useState(() => rowsFromConfig(null, FALLBACK_DEFAULTS));
  const [apiKey, setApiKey] = useState('');
  const [hasApiKey, setHasApiKey] = useState(false);
  // Saving before the stored settings load would overwrite them with the
  // form's initial values (e.g. switch the provider to Anthropic).
  const [loaded, setLoaded] = useState(false);
  const [error, setError] = useState('');
  const [saved, setSaved] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    getChatSettings(token)
      .then((settings) => {
        if (settings) {
          setProvider(settings.provider);
          setModel(settings.model);
          setDefaults(settings.defaults ?? FALLBACK_DEFAULTS);
          setConfigRows(rowsFromConfig(settings.config, settings.defaults ?? FALLBACK_DEFAULTS));
          setHasApiKey(settings.hasApiKey);
        }
        setLoaded(true);
      })
      .catch((err) => setError(err.message));
  }, [token]);

  async function handleSubmit(e) {
    e.preventDefault();
    if (!loaded) return;
    setError('');
    setSaved(false);
    setSubmitting(true);
    try {
      const config = configFromRows(configRows, defaults);
      // apiKey is write-only: omitting it leaves the stored key unchanged.
      const updated = await updateChatSettings(token, {
        provider,
        model,
        config,
        apiKey: apiKey.trim() || undefined,
      });
      setHasApiKey(updated.hasApiKey);
      setApiKey('');
      // Defaults follow the saved provider/model (e.g. its context window).
      const nextDefaults = updated.defaults ?? FALLBACK_DEFAULTS;
      setDefaults(nextDefaults);
      setConfigRows(rowsFromConfig(updated.config, nextDefaults));
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
        className="mt-6 max-w-2xl space-y-4 rounded-xl border border-gray-200 bg-white p-4 dark:border-gray-700 dark:bg-gray-900"
      >
        <div>
          <label className="text-sm font-medium text-gray-700 dark:text-gray-200">Provider</label>
          <select
            value={provider}
            onChange={(e) => setProvider(e.target.value)}
            disabled={!loaded}
            className={`mt-1 ${inputClass} disabled:opacity-60`}
          >
            <option value="ANTHROPIC">Anthropic</option>
            <option value="OPENAI">OpenAI</option>
            <option value="GEMINI">Gemini</option>
            <option value="GROQ">Groq</option>
            <option value="NVIDIA">NVIDIA</option>
          </select>
        </div>
        <div>
          <label className="text-sm font-medium text-gray-700 dark:text-gray-200">Model</label>
          <input
            required
            value={model}
            onChange={(e) => setModel(e.target.value)}
            placeholder="claude-sonnet-5"
            className={`mt-1 ${inputClass}`}
          />
        </div>
        <div>
          <label className="text-sm font-medium text-gray-700 dark:text-gray-200">API key</label>
          <input
            type="password"
            autoComplete="off"
            required={loaded && !hasApiKey}
            value={apiKey}
            onChange={(e) => setApiKey(e.target.value)}
            placeholder={
              hasApiKey ? '•••••••• (leave blank to keep current key)' : 'Paste provider API key'
            }
            className={`mt-1 ${inputClass}`}
          />
          <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
            {hasApiKey
              ? 'A key is saved. Enter a new one only to replace it.'
              : 'No key saved yet. Chats will not work until one is set.'}
          </p>
        </div>
        <div>
          <span className="text-sm font-medium text-gray-700 dark:text-gray-200">
            Additional settings (optional)
          </span>
          <p className="mt-0.5 text-xs text-gray-500 dark:text-gray-400">
            Numbers and JSON are saved as such.
          </p>
          <ConfigEditor rows={configRows} defaults={defaults} onChange={setConfigRows} />
        </div>

        {error && <p className="text-sm text-red-600">{error}</p>}
        {saved && <p className="text-sm text-teal-700 dark:text-teal-400">Saved.</p>}

        <button
          type="submit"
          disabled={submitting || !loaded}
          className="rounded-lg bg-teal-600 px-4 py-2 text-sm font-semibold text-white hover:bg-teal-700 disabled:opacity-60"
        >
          {loaded ? 'Save' : 'Loading…'}
        </button>
      </form>
    </AdminLayout>
  );
}
