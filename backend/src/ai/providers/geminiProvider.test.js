const { test, beforeEach } = require('node:test');
const assert = require('node:assert/strict');

const sdkPath = require.resolve('@google/genai');

let lastConstructorArgs;
let lastGenerateArgs;
let generateImpl;

class MockGoogleGenAI {
  constructor(args) {
    lastConstructorArgs = args;
    this.models = {
      generateContent: async (generateArgs) => {
        lastGenerateArgs = generateArgs;
        return generateImpl(generateArgs);
      },
    };
  }
}

require.cache[sdkPath] = {
  id: sdkPath,
  filename: sdkPath,
  loaded: true,
  exports: { GoogleGenAI: MockGoogleGenAI },
};

const { sendMessage } = require('./geminiProvider');

beforeEach(() => {
  lastConstructorArgs = undefined;
  lastGenerateArgs = undefined;
  generateImpl = async () => ({ text: '', functionCalls: undefined });
});

const baseArgs = {
  systemPrompt: 'You are a helpful ops assistant.',
  history: [
    { role: 'user', content: 'earlier question' },
    { role: 'assistant', content: 'earlier answer' },
  ],
  newMessage: 'What is the status of my instances?',
  model: 'gemini-flash-latest',
  apiKey: 'test-gemini-key',
};

test('plain-text response maps to type: text', async () => {
  const fixture = { text: 'All instances are healthy.', functionCalls: undefined };
  generateImpl = async () => fixture;

  const result = await sendMessage(baseArgs);

  assert.equal(result.type, 'text');
  assert.equal(result.content, 'All instances are healthy.');
  assert.equal(result.command, undefined);
  assert.equal(result.explanation, undefined);
  assert.equal(result.raw, fixture);
});

test('run_lookup function call maps to type: lookup_request', async () => {
  const fixture = {
    text: undefined,
    functionCalls: [
      {
        name: 'run_lookup',
        args: { command: 'aws ec2 describe-instances --help', explanation: 'checking syntax' },
      },
    ],
  };
  generateImpl = async () => fixture;

  const result = await sendMessage(baseArgs);

  assert.equal(result.type, 'lookup_request');
  assert.equal(result.content, 'aws ec2 describe-instances --help');
  assert.equal(result.command, 'aws ec2 describe-instances --help');
  assert.equal(result.explanation, 'checking syntax');
  assert.equal(result.raw, fixture);
});

test('run_command function call maps to type: command_request', async () => {
  const fixture = {
    text: undefined,
    functionCalls: [
      {
        name: 'run_command',
        args: {
          command: 'aws ec2 terminate-instances --instance-ids i-0abc123',
          explanation: 'Operator asked to remove the idle instance.',
        },
      },
    ],
  };
  generateImpl = async () => fixture;

  const result = await sendMessage(baseArgs);

  assert.equal(result.type, 'command_request');
  assert.equal(result.content, 'aws ec2 terminate-instances --instance-ids i-0abc123');
  assert.equal(result.command, 'aws ec2 terminate-instances --instance-ids i-0abc123');
  assert.equal(result.explanation, 'Operator asked to remove the idle instance.');
});

test('malformed function call (missing command field) falls back to type: text without throwing', async () => {
  const fixture = {
    text: 'partial thought before the call',
    functionCalls: [{ name: 'run_lookup', args: { explanation: 'no command' } }],
  };
  generateImpl = async () => fixture;

  const result = await sendMessage(baseArgs);

  assert.equal(result.type, 'text');
  assert.equal(result.content, 'partial thought before the call');
});

test('unknown function name falls back to type: text without throwing', async () => {
  const fixture = {
    text: undefined,
    functionCalls: [{ name: 'unknown_tool', args: { foo: 'bar' } }],
  };
  generateImpl = async () => fixture;

  const result = await sendMessage(baseArgs);

  assert.equal(result.type, 'text');
  assert.equal(typeof result.content, 'string');
  assert.ok(result.content.length > 0);
});

test('baseUrl and config are passed through to the SDK client and call', async () => {
  generateImpl = async () => ({ text: 'ok', functionCalls: undefined });

  await sendMessage({
    ...baseArgs,
    baseUrl: 'https://custom.gemini.example.com',
    config: { max_tokens: 1234, temperature: 0.75 },
  });

  assert.equal(lastConstructorArgs.apiKey, 'test-gemini-key');
  assert.deepEqual(lastConstructorArgs.httpOptions, {
    baseUrl: 'https://custom.gemini.example.com',
  });

  assert.equal(lastGenerateArgs.model, 'gemini-flash-latest');
  assert.equal(lastGenerateArgs.config.systemInstruction, baseArgs.systemPrompt);
  assert.equal(lastGenerateArgs.config.maxOutputTokens, 1234);
  assert.equal(lastGenerateArgs.config.temperature, 0.75);
  assert.deepEqual(lastGenerateArgs.contents, [
    { role: 'user', parts: [{ text: 'earlier question' }] },
    { role: 'model', parts: [{ text: 'earlier answer' }] },
    { role: 'user', parts: [{ text: 'What is the status of my instances?' }] },
  ]);

  const declarations = lastGenerateArgs.config.tools[0].functionDeclarations;
  const toolNames = declarations.map((decl) => decl.name);
  assert.deepEqual(toolNames.sort(), ['run_command', 'run_lookup']);
  const lookupDecl = declarations.find((decl) => decl.name === 'run_lookup');
  assert.equal(lookupDecl.parametersJsonSchema.type, 'object');
  assert.deepEqual(lookupDecl.parametersJsonSchema.required, ['command']);
});

test('omitted baseUrl/config falls back to SDK default and documented defaults', async () => {
  generateImpl = async () => ({ text: 'ok', functionCalls: undefined });

  await sendMessage(baseArgs);

  assert.equal(lastConstructorArgs.httpOptions, undefined);
  assert.equal(lastGenerateArgs.config.maxOutputTokens, 4096);
  assert.equal(lastGenerateArgs.config.temperature, 0.2);
});

test('thought parts are returned as reasoning', async () => {
  generateImpl = async () => ({
    text: 'One instance.',
    functionCalls: undefined,
    candidates: [
      {
        content: {
          parts: [{ text: 'Count the IDs.', thought: true }, { text: 'One instance.' }],
        },
      },
    ],
  });
  assert.equal((await sendMessage(baseArgs)).reasoning, 'Count the IDs.');
});
