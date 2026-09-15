import { apiRequest } from './api';

// Administrators
export const listAdministrators = (token) =>
  apiRequest('/api/admin/administrators', { token });
export const createAdministrator = (token, body) =>
  apiRequest('/api/admin/administrators', { method: 'POST', token, body });
export const deleteAdministrator = (token, id) =>
  apiRequest(`/api/admin/administrators/${id}`, { method: 'DELETE', token });

// Operators
export const listOperators = (token) => apiRequest('/api/admin/operators', { token });
export const createOperator = (token, body) =>
  apiRequest('/api/admin/operators', { method: 'POST', token, body });
export const updateOperator = (token, id, body) =>
  apiRequest(`/api/admin/operators/${id}`, { method: 'PATCH', token, body });
export const deactivateOperator = (token, id) =>
  apiRequest(`/api/admin/operators/${id}/deactivate`, { method: 'POST', token });

// Organisations + Workspaces
export const listOrganisations = (token) => apiRequest('/api/admin/organisations', { token });
export const createOrganisation = (token, body) =>
  apiRequest('/api/admin/organisations', { method: 'POST', token, body });
export const getOrganisation = (token, id) =>
  apiRequest(`/api/admin/organisations/${id}`, { token });
export const updateOrganisation = (token, id, body) =>
  apiRequest(`/api/admin/organisations/${id}`, { method: 'PATCH', token, body });
export const createWorkspace = (token, orgId, body) =>
  apiRequest(`/api/admin/organisations/${orgId}/workspaces`, { method: 'POST', token, body });
export const updateWorkspace = (token, orgId, workspaceId, body) =>
  apiRequest(`/api/admin/organisations/${orgId}/workspaces/${workspaceId}`, {
    method: 'PATCH',
    token,
    body,
  });
export const setWorkspaceCredential = (token, orgId, workspaceId, body) =>
  apiRequest(`/api/admin/organisations/${orgId}/workspaces/${workspaceId}/credential`, {
    method: 'PUT',
    token,
    body,
  });

// Chat Settings
export const getChatSettings = (token) => apiRequest('/api/admin/chat-settings', { token });
export const updateChatSettings = (token, body) =>
  apiRequest('/api/admin/chat-settings', { method: 'PUT', token, body });
export const listAgentPersonas = (token) =>
  apiRequest('/api/admin/chat-settings/personas', { token });
export const updateAgentPersona = (token, body) =>
  apiRequest('/api/admin/chat-settings/personas', { method: 'PUT', token, body });

// Branding
export const getBranding = () => apiRequest('/branding');
export const updateBranding = (token, { displayName, logoFile, loginImageFile }) => {
  const formData = new FormData();
  if (displayName !== undefined) formData.append('displayName', displayName);
  if (logoFile) formData.append('logo', logoFile);
  if (loginImageFile) formData.append('loginImage', loginImageFile);
  return apiRequest('/api/admin/branding', { method: 'PUT', token, body: formData });
};

// Chats (read-only)
export const listChatSessions = (token, params = {}) => {
  const query = new URLSearchParams(params).toString();
  return apiRequest(`/api/admin/chats${query ? `?${query}` : ''}`, { token });
};
export const getChatSessionMessages = (token, id) =>
  apiRequest(`/api/admin/chats/${id}/messages`, { token });
