const bcrypt = require('bcryptjs');
const prisma = require('../../config/db');
const { ROLES } = require('../../constants/roles');
const { MASTER_ADMIN_USERNAME } = require('../../constants/admin');
const { AppError } = require('../../middleware/errorHandler');
const { ERROR_CODES } = require('../../constants/errors');

const BCRYPT_COST = 12;

const ADMIN_SELECT = {
  id: true,
  username: true,
  isActive: true,
  createdAt: true,
};

function serialize(user) {
  return { ...user, isMasterAdmin: user.username === MASTER_ADMIN_USERNAME };
}

async function listAdministrators() {
  const admins = await prisma.user.findMany({
    where: { role: ROLES.ADMIN },
    select: ADMIN_SELECT,
    orderBy: { createdAt: 'asc' },
  });
  return admins.map(serialize);
}

async function createAdministrator(username, password) {
  const existing = await prisma.user.findUnique({ where: { username } });
  if (existing) {
    throw new AppError(409, ERROR_CODES.VALIDATION_ERROR, 'That username is already taken.');
  }

  const passwordHash = await bcrypt.hash(password, BCRYPT_COST);
  const admin = await prisma.user.create({
    data: { username, passwordHash, role: ROLES.ADMIN },
    select: ADMIN_SELECT,
  });
  return serialize(admin);
}

async function deleteAdministrator(userId) {
  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user || user.role !== ROLES.ADMIN) {
    throw new AppError(404, ERROR_CODES.NOT_FOUND);
  }
  if (user.username === MASTER_ADMIN_USERNAME) {
    throw new AppError(403, ERROR_CODES.FORBIDDEN, 'The master admin account cannot be deleted.');
  }
  await prisma.user.delete({ where: { id: userId } });
}

module.exports = { listAdministrators, createAdministrator, deleteAdministrator };
