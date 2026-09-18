const { GoogleGenAI } = require('@google/genai');

const DEFAULT_MAX_TOKENS = 4096;
const DEFAULT_TEMPERATURE = 0.2;

const MALFORMED_FALLBACK_TEXT = "(The model's response could not be parsed.)";

const RUN_LOOKUP_DECLARATION = {
  name: 'run_lookup',
  description:
    'Request a read-only lookup command to be run immediately (e.g. checking CLI syntax with --help, or a describe/list/get call). Use this when you need information before deciding what to do next, or to check exact command syntax.',
  parametersJsonSchema: {
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

const RUN_COMMAND_DECLARATION = {
  name: 'run_command',
  description:
    "Propose a real command to run against the current Workspace. This may be read-only (runs immediately) or mutating (requires the Operator's explicit confirmation first) — the system decides which, you don't need to. Always include a clear explanation of what this command does and why.",
  parametersJsonSchema: {
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

const FUNCTION_NAME_TO_TYPE = {
  run_lookup: 'lookup_request',
  run_command: 'command_request',
};

function parseResponse(response) {
  const functionCalls = Array.isArray(response?.functionCalls) ? response.functionCalls : [];

  if (functionCalls.length === 0) {
    return {
      type: 'text',
      content: typeof response?.text === 'string' ? response.text : '',
      command: undefined,
      explanation: undefined,
    };
  }

  const call = functionCalls[0];
  const type = FUNCTION_NAME_TO_TYPE[call?.name];
  const args = call?.args;

  if (!type || !args || typeof args !== 'object' || typeof args.command !== 'string') {
    const fallbackText = typeof response?.text === 'string' ? response.text : '';
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

// Gemini's Content.role only accepts 'user' or 'model' -- our internal history
// uses 'user'/'assistant', matching the other providers' conventions.
function toGeminiRole(role) {
  return role === 'assistant' ? 'model' : 'user';
}

async function sendMessage({ systemPrompt, history, newMessage, model, apiKey, baseUrl, config }) {
  const client = new GoogleGenAI({
    apiKey,
    httpOptions: baseUrl ? { baseUrl } : undefined,
  });

  const contents = [
    ...(Array.isArray(history)
      ? history.map(({ role, content }) => ({
          role: toGeminiRole(role),
          parts: [{ text: content }],
        }))
      : []),
    { role: 'user', parts: [{ text: newMessage }] },
  ];

  const response = await client.models.generateContent({
    model,
    contents,
    config: {
      systemInstruction: systemPrompt,
      tools: [{ functionDeclarations: [RUN_LOOKUP_DECLARATION, RUN_COMMAND_DECLARATION] }],
      maxOutputTokens: config?.max_tokens ?? DEFAULT_MAX_TOKENS,
      temperature: config?.temperature ?? DEFAULT_TEMPERATURE,
    },
  });

  const parsed = parseResponse(response);

  return { ...parsed, raw: response };
}

module.exports = { sendMessage };
