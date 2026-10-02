const Anthropic = require('@anthropic-ai/sdk');
const { REGIONS_PROPERTY, parseRegions } = require('./regionsParam');

const { DEFAULT_MAX_TOKENS, DEFAULT_TEMPERATURE } = require('../settingsDefaults');

const MALFORMED_FALLBACK_TEXT = "(The model's response could not be parsed.)";

const RUN_LOOKUP_TOOL = {
  name: 'run_lookup',
  description:
    'Request a read-only lookup command to be run immediately (e.g. reading AWS CLI documentation with "aws <service> <operation> help", or a describe/list/get call). Use this when you need information before deciding what to do next, or to check exact command syntax.',
  input_schema: {
    type: 'object',
    properties: {
      command: {
        type: 'string',
        description: 'The exact shell command to run, e.g. "aws ec2 describe-instances help".',
      },
      regions: REGIONS_PROPERTY,
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
      regions: REGIONS_PROPERTY,
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

// Extended-thinking blocks, when the model returned readable ones. Some models
// return thinking blocks with empty text; those contribute nothing.
function extractReasoning(response) {
  const blocks = Array.isArray(response?.content) ? response.content : [];
  const text = blocks
    .filter((block) => block && block.type === 'thinking' && typeof block.thinking === 'string')
    .map((block) => block.thinking.trim())
    .filter(Boolean)
    .join('\n\n');
  return text || undefined;
}

// Tokens this call used. Cached prompt tokens are billed separately but still
// occupy the context window, so they count as input here.
function extractUsage(response) {
  const u = response?.usage;
  if (!u) return undefined;
  const inputTokens =
    (u.input_tokens ?? 0) + (u.cache_read_input_tokens ?? 0) + (u.cache_creation_input_tokens ?? 0);
  return { inputTokens, outputTokens: u.output_tokens ?? 0 };
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

  const regions = parseRegions(input);

  return {
    type,
    content: input.command,
    command: input.command,
    explanation,
    regions,
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

  return {
    ...parsed,
    reasoning: extractReasoning(response),
    usage: extractUsage(response),
    raw: response,
  };
}

module.exports = { sendMessage };
