const prisma = require('../../config/db');
const { AppError } = require('../../middleware/errorHandler');
const { ERROR_CODES } = require('../../constants/errors');

const ORG_LIST_SELECT = { id: true, name: true, address: true, phone: true, createdAt: true };

const WORKSPACE_SELECT = {
  id: true,
  csp: true,
  account: true,
  environment: true,
  isActive: true,
  createdAt: true,
  credential: { select: { id: true, updatedAt: true } },
};

async function listOrganisations() {
  return prisma.organisation.findMany({ select: ORG_LIST_SELECT, orderBy: { name: 'asc' } });
}

async function createOrganisation(data) {
  return prisma.organisation.create({ data, select: ORG_LIST_SELECT });
}

async function getOrganisation(id) {
  const org = await prisma.organisation.findUnique({
    where: { id },
    select: { ...ORG_LIST_SELECT, workspaces: { select: WORKSPACE_SELECT } },
  });
  if (!org) throw new AppError(404, ERROR_CODES.NOT_FOUND);
  return org;
}

async function updateOrganisation(id, data) {
  const org = await prisma.organisation.findUnique({ where: { id } });
  if (!org) throw new AppError(404, ERROR_CODES.NOT_FOUND);
  return prisma.organisation.update({ where: { id }, data, select: ORG_LIST_SELECT });
}

module.exports = { listOrganisations, createOrganisation, getOrganisation, updateOrganisation };
