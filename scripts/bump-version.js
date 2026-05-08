const { readFileSync, writeFileSync, existsSync } = require('node:fs');
const { join } = require('node:path');

const releaseType = process.argv[2];
const validReleaseTypes = new Set(['patch', 'minor', 'major']);

if (!validReleaseTypes.has(releaseType)) {
  console.error('Usage: npm run version:patch|version:minor|version:major');
  process.exit(1);
}

const root = join(__dirname, '..');
const packageJsonPath = join(root, 'package.json');
const packageLockPath = join(root, 'package-lock.json');

function readJson(path) {
  return JSON.parse(readFileSync(path, 'utf8'));
}

function writeJson(path, value) {
  writeFileSync(path, `${JSON.stringify(value, null, 2)}\n`);
}

function nextVersion(currentVersion, type) {
  const parts = currentVersion.split('.').map((part) => Number(part));

  if (
    parts.length !== 3 ||
    parts.some((part) => !Number.isInteger(part) || part < 0)
  ) {
    throw new Error(`Unsupported version format: ${currentVersion}`);
  }

  const [major, minor, patch] = parts;

  if (type === 'major') return `${major + 1}.0.0`;
  if (type === 'minor') return `${major}.${minor + 1}.0`;
  return `${major}.${minor}.${patch + 1}`;
}

const packageJson = readJson(packageJsonPath);
const oldVersion = packageJson.version;
const newVersion = nextVersion(oldVersion, releaseType);

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

console.log(`Corelens version bumped: ${oldVersion} -> ${newVersion}`);
