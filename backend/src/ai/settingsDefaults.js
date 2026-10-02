// The defaults behind ChatSettings.config, in one place: the provider adapters
// and the orchestrator use them, and Manage Chat Settings shows them.
const { contextWindowFor } = require('./contextWindows');

const DEFAULT_MAX_TOKENS = 4096;
const DEFAULT_TEMPERATURE = 0.2;

// What each model call may send, in characters (about 3-4 per token). The
// defaults keep a request near 6,300 tokens even for dense JSON output --
// inside an 8,000 tokens-per-minute plan such as Groq's free tier, where one
// larger request can never be accepted. Larger plans can raise them via
// ChatSettings.config: tool_output_chars (newest output) and history_chars
// (everything before it).
const DEFAULT_REQUEST_LIMITS = Object.freeze({
  toolOutputChars: 6000,
  historyChars: 9000,
  // Older outputs only need enough for the model to recall what it saw.
  olderResultChars: 1500,
});

/**
 * The effective value of every configurable setting when ChatSettings.config
 * does not set it. context_window depends on the model and is null when
 * OpenCAI does not know it.
 */
function defaultConfig(provider, model) {
  return {
    temperature: DEFAULT_TEMPERATURE,
    max_tokens: DEFAULT_MAX_TOKENS,
    context_window: contextWindowFor(provider, model),
    history_chars: DEFAULT_REQUEST_LIMITS.historyChars,
    tool_output_chars: DEFAULT_REQUEST_LIMITS.toolOutputChars,
  };
}

module.exports = {
  DEFAULT_MAX_TOKENS,
  DEFAULT_TEMPERATURE,
  DEFAULT_REQUEST_LIMITS,
  defaultConfig,
};
