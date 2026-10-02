const anthropicProvider = require('./anthropicProvider');
const openaiProvider = require('./openaiProvider');
const geminiProvider = require('./geminiProvider');
const groqProvider = require('./groqProvider');
const nvidiaProvider = require('./nvidiaProvider');

const PROVIDERS = {
  ANTHROPIC: anthropicProvider,
  OPENAI: openaiProvider,
  GEMINI: geminiProvider,
  GROQ: groqProvider,
  NVIDIA: nvidiaProvider,
};

function getProvider(providerName) {
  const provider = PROVIDERS[providerName];
  if (!provider) {
    throw new Error(`Unknown AI provider: ${providerName}`);
  }
  return provider;
}

module.exports = { getProvider };
