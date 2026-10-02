const bcrypt = require('bcryptjs');
const prisma = require('../../config/db');
const { ROLES } = require('../../constants/roles');
const { AppError } = require('../../middleware/errorHandler');
const { ERROR_CODES } = require('../../constants/errors');
const { clearMfa, mfaEnrolled } = require('./mfa');

const BCRYPT_COST = 12;

const OPERATOR_SELECT = {
  id: true,
  username: true,
  isActive: true,
  createdAt: true,
  totpSecretEncrypted: true,
  organisations: {
    select: { organisation: { select: { id: true, name: true } } },
  },
};

function serialize(user) {
  return {
    id: user.id,
    username: user.username,
    isActive: user.isActive,
    mfaEnrolled: mfaEnrolled(user),
    createdAt: user.createdAt,
    organisations: user.organisations.map((uo) => uo.organisation),
  };
}

async function listOperators() {
  const users = await prisma.user.findMany({
    where: { role: ROLES.OPERATOR },
    select: OPERATOR_SELECT,
    orderBy: { createdAt: 'asc' },
  });
  return users.map(serialize);
}

async function createOperator(username, password, organisationIds = []) {
  const existing = await prisma.user.findUnique({ where: { username } });
  if (existing) {
    throw new AppError(409, ERROR_CODES.VALIDATION_ERROR, 'That username is already taken.');
  }

  const passwordHash = await bcrypt.hash(password, BCRYPT_COST);
  const user = await prisma.user.create({
    data: {
      username,
      passwordHash,
      role: ROLES.OPERATOR,
      organisations: { create: organisationIds.map((organisationId) => ({ organisationId })) },
    },
    select: OPERATOR_SELECT,
  });
  return serialize(user);
}

async function findOperatorOrThrow(userId) {
  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user || user.role !== ROLES.OPERATOR) {
    throw new AppError(404, ERROR_CODES.NOT_FOUND);
  }
  return user;
}

async function updateOperator(userId, { organisationIds, isActive }) {
  await findOperatorOrThrow(userId);

  if (organisationIds !== undefined) {
    await prisma.userOrganisation.deleteMany({ where: { userId } });
    if (organisationIds.length > 0) {
      await prisma.userOrganisation.createMany({
        data: organisationIds.map((organisationId) => ({ userId, organisationId })),
      });
    }
  }

  const updated = await prisma.user.update({
    where: { id: userId },
    data: isActive !== undefined ? { isActive } : {},
    select: OPERATOR_SELECT,
  });
  return serialize(updated);
}

async function deactivateOperator(userId) {
  await findOperatorOrThrow(userId);
  const updated = await prisma.user.update({
    where: { id: userId },
    data: { isActive: false },
    select: OPERATOR_SELECT,
  });
  return serialize(updated);
}

// Only an Operator without chat history can be deleted -- their sessions
// reference them; deactivating keeps that history. Organisation links go with
// the user (cascade); audit logs keep their rows.
async function deleteOperator(userId) {
  await findOperatorOrThrow(userId);

  const chatCount = await prisma.chatSession.count({ where: { userId } });
  if (chatCount > 0) {
    throw new AppError(
      409,
      ERROR_CODES.OPERATOR_HAS_CHATS,
      `This operator has ${chatCount} chat session${chatCount === 1 ? '' : 's'} and cannot be deleted. Deactivate them instead.`,
    );
  }

  await prisma.user.delete({ where: { id: userId } });
}

// The Operator sets MFA up again (new authenticator + backup codes) at their
// next login -- e.g. after losing their phone.
async function resetOperatorMfa(userId) {
  await findOperatorOrThrow(userId);
  await clearMfa(userId);
}

module.exports = {
  listOperators,
  createOperator,
  updateOperator,
  deactivateOperator,
  deleteOperator,
  resetOperatorMfa,
};
