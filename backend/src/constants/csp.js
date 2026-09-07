// Mirrors the Prisma CloudServiceProvider enum. AWS-only today; adding a
// provider later is just a new entry here plus a new enum value in schema.prisma.
const CSP = Object.freeze({
  AWS: 'AWS',
});

module.exports = { CSP };
