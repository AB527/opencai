import { apiRequest } from './api';

export const listAccessibleOrganisations = (token) =>
  apiRequest('/api/operator/organisations', { token });

export const listOrganisationWorkspaces = (token, orgId) =>
  apiRequest(`/api/operator/organisations/${orgId}/workspaces`, { token });
