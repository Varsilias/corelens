const { existsSync, readFileSync, writeFileSync } = require('node:fs');
const { join } = require('node:path');

const root = join(__dirname, '..');
const packageJsonPath = join(root, 'package.json');
const packageLockPath = join(root, 'package-lock.json');
const changelogPath = join(root, 'CHANGELOG.md');

const releaseInput = process.argv[2];
const releaseTypes = new Set(['patch', 'minor', 'major']);

if (!releaseInput) {
  console.error('Usage: npm run release:prepare -- <version|patch|minor|major>');
  process.exit(1);
}

function readJson(path) {
  return JSON.parse(readFileSync(path, 'utf8'));
}

function writeJson(path, value) {
  writeFileSync(path, `${JSON.stringify(value, null, 2)}\n`);
}

function normaliseVersion(version) {
  return version.replace(/^v/, '');
}

function assertStableSemver(version) {
  if (!/^\d+\.\d+\.\d+$/.test(version)) {
    throw new Error(`Expected a stable semver version like 1.2.3, got: ${version}`);
  }
}

function nextVersion(currentVersion, type) {
  const [major, minor, patch] = currentVersion.split('.').map(Number);

  if (type === 'major') return `${major + 1}.0.0`;
  if (type === 'minor') return `${major}.${minor + 1}.0`;
  return `${major}.${minor}.${patch + 1}`;
}

function resolveTargetVersion(currentVersion, input) {
  if (releaseTypes.has(input)) {
    return nextVersion(currentVersion, input);
  }

  const version = normaliseVersion(input);
  assertStableSemver(version);
  return version;
}

function updateChangelog(version) {
  if (!existsSync(changelogPath)) {
    throw new Error('CHANGELOG.md is missing');
  }

  const changelog = readFileSync(changelogPath, 'utf8');
  const heading = `## [${version}]`;

  if (changelog.includes(heading)) {
    return false;
  }

  const marker =
    'The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/), and this project follows semantic versioning after the 1.0.0 release.\n';

  if (!changelog.includes(marker)) {
    throw new Error('Could not find the changelog insertion point');
  }

  const entry = `
${heading}

### Added

- TODO: Describe new user-facing functionality.

### Changed

- TODO: Describe changed behavior or compatibility updates.

### Fixed

- TODO: Describe bug fixes.
`;

  writeFileSync(changelogPath, changelog.replace(marker, `${marker}${entry}`));
  return true;
}

const packageJson = readJson(packageJsonPath);
const oldVersion = packageJson.version;
assertStableSemver(oldVersion);

const newVersion = resolveTargetVersion(oldVersion, releaseInput);
packageJson.version = newVersion;
writeJson(packageJsonPath, packageJson);

if (existsSync(packageLockPath)) {
  const packageLock = readJson(packageLockPath);
  packageLock.version = newVersion;

  if (packageLock.packages?.['']) {
    packageLock.packages[''].version = newVersion;
  }

  writeJson(packageLockPath, packageLock);
}

const insertedChangelogEntry = updateChangelog(newVersion);

console.log(`Corelens release prepared: ${oldVersion} -> ${newVersion}`);
console.log(`Tag to publish: v${newVersion}`);

if (insertedChangelogEntry) {
  console.log('CHANGELOG.md entry was created with TODO placeholders.');
  console.log('Fill the placeholders before running npm run release:check.');
}

console.log('');
console.log('Next steps:');
console.log('  npm run release:check');
console.log(`  git add package.json package-lock.json CHANGELOG.md`);
console.log(`  git commit -m "chore: release v${newVersion}"`);
console.log(`  git tag v${newVersion}`);
console.log('  git push origin main --tags');
