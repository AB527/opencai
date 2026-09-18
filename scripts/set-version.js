#!/usr/bin/env node
// Writes the version semantic-release computed into frontend/package.json and
// backend/package.json's "version" field. Invoked by .releaserc.json's
// @semantic-release/exec prepareCmd as `node scripts/set-version.js <version>`.
// Each app's own package.json otherwise governs its own dependencies/scripts;
// this script only ever touches the "version" field.
const fs = require('fs');
const path = require('path');

const version = process.argv[2];
if (!version) {
  console.error('Usage: node scripts/set-version.js <version>');
  process.exit(1);
}

for (const pkgDir of ['frontend', 'backend']) {
  const pkgPath = path.join(__dirname, '..', pkgDir, 'package.json');
  const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf8'));
  pkg.version = version;
  fs.writeFileSync(pkgPath, JSON.stringify(pkg, null, 2) + '\n');
  console.log(`${pkgDir}/package.json -> ${version}`);
}
