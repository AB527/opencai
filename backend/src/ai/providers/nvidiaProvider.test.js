const { test, beforeEach } = require('node:test');
const assert = require('node:assert/strict');

// NVIDIA reuses the OpenAI adapter, so mock the same SDK it loads.
const sdkPath = require.resolve('openai');

let lastConstructorArgs;
let lastCreateArgs;
let createImpl;

class MockOpenAI {
  constructor(args) {
    lastConstructorArgs = args;
    this.chat = {
      completions: {
        create: async (createArgs) => {
          lastCreateArgs = createArgs;
          return createImpl(createArgs);
        },
      },
    };
  }
}

require.cache[sdkPath] = {
  id: sdkPath,
  filename: sdkPath,
  loaded: true,
  exports: MockOpenAI,
};

const { sendMessage, NVIDIA_BASE_URL } = require('./nvidiaProvider');
const { getProvider } = require('./index');

beforeEach(() => {
  lastConstructorArgs = undefined;
  lastCreateArgs = undefined;
  createImpl = async () => ({ choices: [{ message: { content: 'ok' } }] });
});

const baseArgs = {
  systemPrompt: 'You are a helpful ops assistant.',
  history: [],
  newMessage: 'How many instances?',
  model: 'nvidia/llama-3.3-nemotron-super-49b-v1',
  apiKey: 'nvapi-test-key',
};

test('calls NVIDIA’s OpenAI-compatible endpoint by default', async () => {
  const result = await sendMessage(baseArgs);
  assert.equal(NVIDIA_BASE_URL, 'https://integrate.api.nvidia.com/v1');
  assert.deepEqual(lastConstructorArgs, { apiKey: 'nvapi-test-key', baseURL: NVIDIA_BASE_URL });
  assert.equal(lastCreateArgs.model, 'nvidia/llama-3.3-nemotron-super-49b-v1');
  assert.equal(lastCreateArgs.tools.length, 2);
  assert.equal(result.type, 'text');
  assert.equal(result.content, 'ok');
});

test('a configured base URL wins, for self-hosted NIM', async () => {
  await sendMessage({ ...baseArgs, baseUrl: 'http://nim.internal:8000/v1' });
  assert.equal(lastConstructorArgs.baseURL, 'http://nim.internal:8000/v1');
});

test('chat_template_kwargs from config is passed through, and only when set', async () => {
  await sendMessage({ ...baseArgs, config: { chat_template_kwargs: { thinking: true } } });
  assert.deepEqual(lastCreateArgs.chat_template_kwargs, { thinking: true });

  await sendMessage(baseArgs);
  assert.equal('chat_template_kwargs' in lastCreateArgs, false);
});

test('tool calls and reasoning_content are parsed like any OpenAI-compatible reply', async () => {
  createImpl = async () => ({
    choices: [
      {
        message: {
          content: null,
          reasoning_content: 'List the instances first.',
          tool_calls: [
            {
              function: {
                name: 'run_lookup',
                arguments: JSON.stringify({
                  command: 'aws ec2 describe-instances',
                  regions: ['all'],
                }),
              },
            },
          ],
        },
      },
    ],
    usage: { prompt_tokens: 500, completion_tokens: 40 },
  });
  const result = await sendMessage(baseArgs);
  assert.equal(result.type, 'lookup_request');
  assert.equal(result.command, 'aws ec2 describe-instances');
  assert.deepEqual(result.regions, ['all']);
  assert.equal(result.reasoning, 'List the instances first.');
  assert.deepEqual(result.usage, { inputTokens: 500, outputTokens: 40 });
});

test('NVIDIA is registered as a provider', () => {
  assert.equal(getProvider('NVIDIA').sendMessage, sendMessage);
});
