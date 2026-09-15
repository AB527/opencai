const OpenAI = require('openai');

const DEFAULT_MAX_TOKENS = 4096;
const DEFAULT_TEMPERATURE = 0.2;

const MALFORMED_FALLBACK_TEXT = "(The model's response could not be parsed.)";

const RUN_LOOKUP_PARAMETERS = {
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
};

const RUN_COMMAND_PARAMETERS = {
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
};

const RUN_LOOKUP_TOOL = {
  type: 'function',
  function: {
    name: 'run_lookup',
    description:
      'Request a read-only lookup command to be run immediately (e.g. checking CLI syntax with --help, or a describe/list/get call). Use this when you need information before deciding what to do next, or to check exact command syntax.',
    parameters: RUN_LOOKUP_PARAMETERS,
  },
};

const RUN_COMMAND_TOOL = {
  type: 'function',
  function: {
    name: 'run_command',
    description:
      "Propose a real command to run against the current Workspace. This may be read-only (runs immediately) or mutating (requires the Operator's explicit confirmation first) — the system decides which, you don't need to. Always include a clear explanation of what this command does and why.",
    parameters: RUN_COMMAND_PARAMETERS,
  },
};

const TOOL_NAME_TO_TYPE = {
  run_lookup: 'lookup_request',
  run_command: 'command_request',
};

function parseResponse(response) {
  const message = response?.choices?.[0]?.message ?? {};
  const toolCalls = Array.isArray(message.tool_calls) ? message.tool_calls : [];

  if (toolCalls.length === 0) {
    return {
      type: 'text',
      content: typeof message.content === 'string' ? message.content : '',
      command: undefined,
      explanation: undefined,
    };
  }

  const toolCall = toolCalls[0];
  const type = TOOL_NAME_TO_TYPE[toolCall?.function?.name];

  let args;
  try {
    args = JSON.parse(toolCall?.function?.arguments ?? '');
  } catch {
    args = null;
  }

  if (!type || !args || typeof args !== 'object' || typeof args.command !== 'string') {
    const fallbackText = typeof message.content === 'string' ? message.content : '';
    return {
      type: 'text',
      content: fallbackText || MALFORMED_FALLBACK_TEXT,
      command: undefined,
      explanation: undefined,
    };
  }

  const explanation = typeof args.explanation === 'string' ? args.explanation : undefined;

  return {
    type,
    content: args.command,
    command: args.command,
    explanation,
  };
}

async function sendMessage({ systemPrompt, history, newMessage, model, apiKey, baseUrl, config }) {
  const client = new OpenAI({ apiKey, baseURL: baseUrl || undefined });

  const messages = [
    { role: 'system', content: systemPrompt },
    ...(Array.isArray(history) ? history.map(({ role, content }) => ({ role, content })) : []),
    { role: 'user', content: newMessage },
  ];

  const response = await client.chat.completions.create({
    model,
    messages,
    tools: [RUN_LOOKUP_TOOL, RUN_COMMAND_TOOL],
    tool_choice: 'auto',
    max_tokens: config?.max_tokens ?? DEFAULT_MAX_TOKENS,
    temperature: config?.temperature ?? DEFAULT_TEMPERATURE,
  });

  const parsed = parseResponse(response);

  return { ...parsed, raw: response };
}

module.exports = { sendMessage };
