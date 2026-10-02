// NVIDIA's hosted models (build.nvidia.com) serve an OpenAI-compatible chat
// completions API with tool calling, so this adapter reuses the OpenAI one and
// only points it at NVIDIA's endpoint. A Chat Settings base URL still wins, for
// self-hosted NIM deployments.
const openaiProvider = require('./openaiProvider');

const NVIDIA_BASE_URL = 'https://integrate.api.nvidia.com/v1';

function sendMessage(args) {
  return openaiProvider.sendMessage({ ...args, baseUrl: args.baseUrl || NVIDIA_BASE_URL });
}

module.exports = { sendMessage, NVIDIA_BASE_URL };
