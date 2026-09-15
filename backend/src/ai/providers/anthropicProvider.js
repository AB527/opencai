const Anthropic = require('@anthropic-ai/sdk');

const DEFAULT_MAX_TOKENS = 4096;
const DEFAULT_TEMPERATURE = 0.2;

const MALFORMED_FALLBACK_TEXT = "(The model's response could not be parsed.)";

const RUN_LOOKUP_TOOL = {
  name: 'run_lookup',
  description:
    'Request a read-only lookup command to be run immediately (e.g. checking CLI syntax with --help, or a describe/list/get call). Use this when you need information before deciding what to do next, or to check exact command syntax.',
  input_schema: {
    type: 'object',
    properties: {
      command: {
        type: 'string',
        description: 'The exact shell command to run, e.g. "aws ec2 describe-instances --help".',
      },
      explanation: {
        type: 'string',
        description: 'Optional one-sentence reason for this lookup.',
      },
    },
    required: ['command'],
  },
};

const RUN_COMMAND_TOOL = {
  name: 'run_command',
  description:
    "Propose a real command to run against the current Workspace. This may be read-only (runs immediately) or mutating (requires the Operator's explicit confirmation first) — the system decides which, you don't need to. Always include a clear explanation of what this command does and why.",
  input_schema: {
    type: 'object',
    properties: {
      command: {
        type: 'string',
        description:
          'The exact shell command to run, e.g. "aws ec2 terminate-instances --instance-ids i-0abc123".',
      },
      explanation: {
        type: 'string',
        description:
          "A clear, plain-language explanation of what this command does and why you're proposing it — shown directly to the Operator.",
      },
    },
    required: ['command', 'explanation'],
  },
};

const TOOL_NAME_TO_TYPE = {
  run_lookup: 'lookup_request',
  run_command: 'command_request',
};

function extractText(contentBlocks) {
  return contentBlocks
    .filter((block) => block && block.type === 'text' && typeof block.text === 'string')
    .map((block) => block.text)
    .join('');
}

function parseResponse(response) {
  const contentBlocks = Array.isArray(response?.content) ? response.content : [];

  const toolUseBlock = contentBlocks.find((block) => block && block.type === 'tool_use');

  if (!toolUseBlock) {
    return {
      type: 'text',
      content: extractText(contentBlocks),
      command: undefined,
      explanation: undefined,
    };
  }

  const type = TOOL_NAME_TO_TYPE[toolUseBlock.name];
  const input = toolUseBlock.input;

  if (!type || !input || typeof input !== 'object' || typeof input.command !== 'string') {
    const fallbackText = extractText(contentBlocks);
    return {
      type: 'text',
      content: fallbackText || MALFORMED_FALLBACK_TEXT,
      command: undefined,
      explanation: undefined,
    };
  }

  const explanation = typeof input.explanation === 'string' ? input.explanation : undefined;

  return {
    type,
    content: input.command,
    command: input.command,
    explanation,
  };
}

async function sendMessage({ systemPrompt, history, newMessage, model, apiKey, baseUrl, config }) {
  const client = new Anthropic({ apiKey, baseURL: baseUrl || undefined });

  const messages = [
    ...(Array.isArray(history) ? history.map(({ role, content }) => ({ role, content })) : []),
    { role: 'user', content: newMessage },
  ];

  const response = await client.messages.create({
    model,
    system: systemPrompt,
    messages,
    tools: [RUN_LOOKUP_TOOL, RUN_COMMAND_TOOL],
    max_tokens: config?.max_tokens ?? DEFAULT_MAX_TOKENS,
    temperature: config?.temperature ?? DEFAULT_TEMPERATURE,
  });

  const parsed = parseResponse(response);

  return { ...parsed, raw: response };
}

module.exports = { sendMessage };
