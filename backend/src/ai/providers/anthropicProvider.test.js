const { test, beforeEach } = require('node:test');
const assert = require('node:assert/strict');

const sdkPath = require.resolve('@anthropic-ai/sdk');

let lastConstructorArgs;
let lastCreateArgs;
let createImpl;

class MockAnthropic {
  constructor(args) {
    lastConstructorArgs = args;
    this.messages = {
      create: async (createArgs) => {
        lastCreateArgs = createArgs;
        return createImpl(createArgs);
      },
    };
  }
}

require.cache[sdkPath] = {
  id: sdkPath,
  filename: sdkPath,
  loaded: true,
  exports: MockAnthropic,
};

const { sendMessage } = require('./anthropicProvider');

beforeEach(() => {
  lastConstructorArgs = undefined;
  lastCreateArgs = undefined;
  createImpl = async () => ({ content: [] });
});

const baseArgs = {
  systemPrompt: 'You are a helpful ops assistant.',
  history: [
    { role: 'user', content: 'earlier question' },
    { role: 'assistant', content: 'earlier answer' },
  ],
  newMessage: 'What is the status of my instances?',
  model: 'claude-sonnet-5',
  apiKey: 'sk-test-anthropic-key',
};

test('plain-text response maps to type: text', async () => {
  const fixture = { id: 'msg_1', content: [{ type: 'text', text: 'All instances are healthy.' }] };
  createImpl = async () => fixture;

  const result = await sendMessage(baseArgs);

  assert.equal(result.type, 'text');
  assert.equal(result.content, 'All instances are healthy.');
  assert.equal(result.command, undefined);
  assert.equal(result.explanation, undefined);
  assert.equal(result.raw, fixture);
});

test('run_lookup tool call maps to type: lookup_request', async () => {
  const fixture = {
    id: 'msg_2',
    content: [
      {
        type: 'tool_use',
        id: 'tool_1',
        name: 'run_lookup',
        input: { command: 'aws ec2 describe-instances --help', explanation: 'checking syntax' },
      },
    ],
  };
  createImpl = async () => fixture;

  const result = await sendMessage(baseArgs);

  assert.equal(result.type, 'lookup_request');
  assert.equal(result.content, 'aws ec2 describe-instances --help');
  assert.equal(result.command, 'aws ec2 describe-instances --help');
  assert.equal(result.explanation, 'checking syntax');
  assert.equal(result.raw, fixture);
});

test('run_command tool call maps to type: command_request', async () => {
  const fixture = {
    id: 'msg_3',
    content: [
      {
        type: 'tool_use',
        id: 'tool_2',
        name: 'run_command',
        input: {
          command: 'aws ec2 terminate-instances --instance-ids i-0abc123',
          explanation: 'Operator asked to remove the idle instance.',
        },
      },
    ],
  };
  createImpl = async () => fixture;

  const result = await sendMessage(baseArgs);

  assert.equal(result.type, 'command_request');
  assert.equal(result.content, 'aws ec2 terminate-instances --instance-ids i-0abc123');
  assert.equal(result.command, 'aws ec2 terminate-instances --instance-ids i-0abc123');
  assert.equal(result.explanation, 'Operator asked to remove the idle instance.');
});

test('malformed tool call (missing command) falls back to type: text without throwing', async () => {
  const fixture = {
    id: 'msg_4',
    content: [
      {
        type: 'tool_use',
        id: 'tool_3',
        name: 'run_command',
        input: { explanation: 'no command here' },
      },
    ],
  };
  createImpl = async () => fixture;

  const result = await sendMessage(baseArgs);

  assert.equal(result.type, 'text');
  assert.equal(result.command, undefined);
  assert.equal(result.explanation, undefined);
  assert.equal(typeof result.content, 'string');
  assert.ok(result.content.length > 0);
});

test('malformed tool call falls back to any accompanying text block', async () => {
  const fixture = {
    id: 'msg_5',
    content: [
      { type: 'text', text: 'I tried to look something up but ' },
      { type: 'tool_use', id: 'tool_4', name: 'unknown_tool', input: { foo: 'bar' } },
    ],
  };
  createImpl = async () => fixture;

  const result = await sendMessage(baseArgs);

  assert.equal(result.type, 'text');
  assert.equal(result.content, 'I tried to look something up but ');
});

test('baseUrl and config are passed through to the SDK client and call', async () => {
  createImpl = async () => ({ content: [{ type: 'text', text: 'ok' }] });

  await sendMessage({
    ...baseArgs,
    baseUrl: 'https://custom.anthropic.example.com',
    config: { max_tokens: 1234, temperature: 0.75 },
  });

  assert.equal(lastConstructorArgs.apiKey, 'sk-test-anthropic-key');
  assert.equal(lastConstructorArgs.baseURL, 'https://custom.anthropic.example.com');

  assert.equal(lastCreateArgs.model, 'claude-sonnet-5');
  assert.equal(lastCreateArgs.system, baseArgs.systemPrompt);
  assert.equal(lastCreateArgs.max_tokens, 1234);
  assert.equal(lastCreateArgs.temperature, 0.75);
  assert.deepEqual(lastCreateArgs.messages, [
    { role: 'user', content: 'earlier question' },
    { role: 'assistant', content: 'earlier answer' },
    { role: 'user', content: 'What is the status of my instances?' },
  ]);

  const toolNames = lastCreateArgs.tools.map((tool) => tool.name);
  assert.deepEqual(toolNames.sort(), ['run_command', 'run_lookup']);
  const lookupTool = lastCreateArgs.tools.find((tool) => tool.name === 'run_lookup');
  assert.equal(lookupTool.input_schema.type, 'object');
  assert.deepEqual(lookupTool.input_schema.required, ['command']);
});

test('omitted baseUrl/config falls back to SDK default baseURL and documented defaults', async () => {
  createImpl = async () => ({ content: [{ type: 'text', text: 'ok' }] });

  await sendMessage(baseArgs);

  assert.equal(lastConstructorArgs.baseURL, undefined);
  assert.equal(lastCreateArgs.max_tokens, 4096);
  assert.equal(lastCreateArgs.temperature, 0.2);
});
