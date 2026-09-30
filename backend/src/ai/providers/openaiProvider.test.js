const { test, beforeEach } = require('node:test');
const assert = require('node:assert/strict');

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

const { sendMessage } = require('./openaiProvider');

beforeEach(() => {
  lastConstructorArgs = undefined;
  lastCreateArgs = undefined;
  createImpl = async () => ({ choices: [{ message: { content: '' } }] });
});

const baseArgs = {
  systemPrompt: 'You are a helpful ops assistant.',
  history: [
    { role: 'user', content: 'earlier question' },
    { role: 'assistant', content: 'earlier answer' },
  ],
  newMessage: 'What is the status of my instances?',
  model: 'gpt-4o',
  apiKey: 'sk-test-openai-key',
};

test('plain-text response maps to type: text', async () => {
  const fixture = { choices: [{ message: { content: 'All instances are healthy.' } }] };
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
    choices: [
      {
        message: {
          content: null,
          tool_calls: [
            {
              id: 'call_1',
              function: {
                name: 'run_lookup',
                arguments: JSON.stringify({
                  command: 'aws ec2 describe-instances --help',
                  explanation: 'checking syntax',
                }),
              },
            },
          ],
        },
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
    choices: [
      {
        message: {
          content: null,
          tool_calls: [
            {
              id: 'call_2',
              function: {
                name: 'run_command',
                arguments: JSON.stringify({
                  command: 'aws ec2 terminate-instances --instance-ids i-0abc123',
                  explanation: 'Operator asked to remove the idle instance.',
                }),
              },
            },
          ],
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

test('malformed tool call (bad JSON arguments) falls back to type: text without throwing', async () => {
  const fixture = {
    choices: [
      {
        message: {
          content: null,
          tool_calls: [
            { id: 'call_3', function: { name: 'run_command', arguments: '{not valid json' } },
          ],
        },
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

test('malformed tool call (missing command field) falls back to type: text without throwing', async () => {
  const fixture = {
    choices: [
      {
        message: {
          content: 'partial thought before the call',
          tool_calls: [
            {
              id: 'call_4',
              function: {
                name: 'run_lookup',
                arguments: JSON.stringify({ explanation: 'no command' }),
              },
            },
          ],
        },
      },
    ],
  };
  createImpl = async () => fixture;

  const result = await sendMessage(baseArgs);

  assert.equal(result.type, 'text');
  assert.equal(result.content, 'partial thought before the call');
});

test('baseUrl and config are passed through to the SDK client and call', async () => {
  createImpl = async () => ({ choices: [{ message: { content: 'ok' } }] });

  await sendMessage({
    ...baseArgs,
    baseUrl: 'https://custom.openai.example.com',
    config: { max_tokens: 1234, temperature: 0.75 },
  });

  assert.equal(lastConstructorArgs.apiKey, 'sk-test-openai-key');
  assert.equal(lastConstructorArgs.baseURL, 'https://custom.openai.example.com');

  assert.equal(lastCreateArgs.model, 'gpt-4o');
  assert.equal(lastCreateArgs.max_tokens, 1234);
  assert.equal(lastCreateArgs.temperature, 0.75);
  assert.equal(lastCreateArgs.tool_choice, 'auto');
  assert.deepEqual(lastCreateArgs.messages, [
    { role: 'system', content: baseArgs.systemPrompt },
    { role: 'user', content: 'earlier question' },
    { role: 'assistant', content: 'earlier answer' },
    { role: 'user', content: 'What is the status of my instances?' },
  ]);

  const toolNames = lastCreateArgs.tools.map((tool) => tool.function.name);
  assert.deepEqual(toolNames.sort(), ['run_command', 'run_lookup']);
  const lookupTool = lastCreateArgs.tools.find((tool) => tool.function.name === 'run_lookup');
  assert.equal(lookupTool.type, 'function');
  assert.equal(lookupTool.function.parameters.type, 'object');
  assert.deepEqual(lookupTool.function.parameters.required, ['command']);
});

test('omitted baseUrl/config falls back to SDK default baseURL and documented defaults', async () => {
  createImpl = async () => ({ choices: [{ message: { content: 'ok' } }] });

  await sendMessage(baseArgs);

  assert.equal(lastConstructorArgs.baseURL, undefined);
  assert.equal(lastCreateArgs.max_tokens, 4096);
  assert.equal(lastCreateArgs.temperature, 0.2);
});

test('reasoning_content is returned as reasoning when present', async () => {
  createImpl = async () => ({
    choices: [{ message: { content: 'One instance.', reasoning_content: 'Count the IDs.' } }],
  });
  assert.equal((await sendMessage(baseArgs)).reasoning, 'Count the IDs.');
});
