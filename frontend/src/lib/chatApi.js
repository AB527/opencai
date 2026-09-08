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
