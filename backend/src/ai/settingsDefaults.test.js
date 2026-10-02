const { test } = require('node:test');
const assert = require('node:assert/strict');

const { defaultConfig } = require('./settingsDefaults');

test('defaultConfig lists every setting with its effective default', () => {
  assert.deepEqual(defaultConfig('GROQ', 'openai/gpt-oss-120b'), {
    temperature: 0.2,
    max_tokens: 4096,
    context_window: 131_072,
    history_chars: 9000,
    tool_output_chars: 6000,
  });
});

test('context_window follows the model and is null when unknown', () => {
  assert.equal(defaultConfig('ANTHROPIC', 'claude-opus-5-5').context_window, 1_000_000);
  assert.equal(defaultConfig('NVIDIA', 'nvidia/some-model').context_window, null);
});
