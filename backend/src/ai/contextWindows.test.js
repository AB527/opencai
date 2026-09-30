const { test } = require('node:test');
const assert = require('node:assert/strict');

const { contextWindowFor } = require('./contextWindows');

test('exact model ids resolve', () => {
  assert.equal(contextWindowFor('GROQ', 'openai/gpt-oss-120b'), 131_072);
});

test('the longest matching prefix wins', () => {
  assert.equal(contextWindowFor('ANTHROPIC', 'claude-opus-5-5'), 1_000_000);
  assert.equal(contextWindowFor('ANTHROPIC', 'claude-haiku-4-5'), 200_000);
});

test('unknown models and providers are null, not a guess', () => {
  assert.equal(contextWindowFor('GROQ', 'some-new-model'), null);
  assert.equal(contextWindowFor('NOPE', 'x'), null);
  assert.equal(contextWindowFor('ANTHROPIC', undefined), null);
});

test('config.context_window overrides the table, and only positive integers count', () => {
  assert.equal(contextWindowFor('GROQ', 'some-new-model', { context_window: 32768 }), 32768);
  assert.equal(contextWindowFor('GROQ', 'openai/gpt-oss-120b', { context_window: 8000 }), 8000);
  assert.equal(
    contextWindowFor('GROQ', 'openai/gpt-oss-120b', { context_window: 'lots' }),
    131_072,
  );
  assert.equal(contextWindowFor('GROQ', 'openai/gpt-oss-120b', { context_window: -1 }), 131_072);
});
