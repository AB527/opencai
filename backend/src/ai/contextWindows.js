const { AI_PROVIDERS } = require('../constants/aiProviders');

// Context window sizes (tokens) for models whose size is documented. Matched
// by exact model id first, then by the longest listed prefix. Anything not
// listed has an unknown window unless ChatSettings.config sets
// `context_window`, which always wins (new models, custom deployments).
const CONTEXT_WINDOWS = {
  [AI_PROVIDERS.ANTHROPIC]: {
    exact: {},
    prefixes: [
      ['claude-fable-5', 1_000_000],
      ['claude-mythos-5', 1_000_000],
      ['claude-opus-5', 1_000_000],
      ['claude-opus-4-8', 1_000_000],
      ['claude-opus-4-7', 1_000_000],
      ['claude-opus-4-6', 1_000_000],
      ['claude-sonnet-5', 1_000_000],
      ['claude-sonnet-4-6', 1_000_000],
      ['claude-haiku-4-5', 200_000],
    ],
  },
  [AI_PROVIDERS.GROQ]: {
    exact: {
      'openai/gpt-oss-120b': 131_072,
      'openai/gpt-oss-20b': 131_072,
      'llama-3.3-70b-versatile': 131_072,
    },
    prefixes: [],
  },
  [AI_PROVIDERS.OPENAI]: {
    exact: {},
    prefixes: [['gpt-4o', 128_000]],
  },
  [AI_PROVIDERS.GEMINI]: {
    exact: {},
    prefixes: [['gemini-2.5-', 1_048_576]],
  },
};

/**
 * @param {string} provider  An AI_PROVIDERS value.
 * @param {string} model     The configured model id.
 * @param {object} [config]  ChatSettings.config; `context_window` overrides.
 * @returns {number|null} The window in tokens, or null when unknown.
 */
function contextWindowFor(provider, model, config) {
  const override = Number(config?.context_window);
  if (Number.isInteger(override) && override > 0) return override;

  const table = CONTEXT_WINDOWS[provider];
  if (!table || typeof model !== 'string') return null;
  if (table.exact[model]) return table.exact[model];

  let best = null;
  for (const [prefix, size] of table.prefixes) {
    if (model.startsWith(prefix) && (!best || prefix.length > best[0].length))
      best = [prefix, size];
  }
  return best ? best[1] : null;
}

module.exports = { contextWindowFor };
