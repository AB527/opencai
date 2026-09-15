const anthropicProvider = require('./anthropicProvider');
const openaiProvider = require('./openaiProvider');

const PROVIDERS = {
  ANTHROPIC: anthropicProvider,
  OPENAI: openaiProvider,
};

function getProvider(providerName) {
  const provider = PROVIDERS[providerName];
  if (!provider) {
    throw new Error(`Unknown AI provider: ${providerName}`);
  }
  return provider;
}

module.exports = { getProvider };
