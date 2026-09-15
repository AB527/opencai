import { apiRequest } from './api';

export const createChatSession = (token, body) =>
  apiRequest('/api/chat/sessions', { method: 'POST', token, body });

export const listChatSessions = (token, params = {}) => {
  const query = new URLSearchParams(
    Object.fromEntries(Object.entries(params).filter(([, v]) => v !== undefined && v !== '')),
  ).toString();
  return apiRequest(`/api/chat/sessions${query ? `?${query}` : ''}`, { token });
};

export const getChatSession = (token, id) => apiRequest(`/api/chat/sessions/${id}`, { token });

export const sendChatMessage = (token, sessionId, text) =>
  apiRequest(`/api/chat/sessions/${sessionId}/messages`, { method: 'POST', token, body: { text } });

export const confirmChatMessage = (token, sessionId, messageId) =>
  apiRequest(`/api/chat/sessions/${sessionId}/messages/${messageId}/confirm`, {
    method: 'POST',
    token,
  });

export const cancelChatMessage = (token, sessionId, messageId) =>
  apiRequest(`/api/chat/sessions/${sessionId}/messages/${messageId}/cancel`, {
    method: 'POST',
    token,
  });
