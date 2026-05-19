const { existsSync, readFileSync } = require('node:fs');
const { join } = require('node:path');

const root = join(__dirname, '..');
const packageJsonPath = join(root, 'package.json');
const packageLockPath = join(root, 'package-lock.json');
const changelogPath = join(root, 'CHANGELOG.md');

function fail(message) {
  console.error(`[release-check] ${message}`);
  process.exitCode = 1;
}

function readJson(path) {
  return JSON.parse(readFileSync(path, 'utf8'));
}

function normaliseVersion(version) {
  return version.replace(/^v/, '');
}

function isStableSemver(version) {
  return /^\d+\.\d+\.\d+$/.test(version);
}

function currentChangelogEntry(changelog, version) {
  const heading = `## [${version}]`;
  const start = changelog.indexOf(heading);

  if (start === -1) {
    return undefined;
  }

  const next = changelog.indexOf('\n## [', start + heading.length);
  return changelog.slice(start, next === -1 ? changelog.length : next);
}

const packageJson = readJson(packageJsonPath);
const packageVersion = packageJson.version;

if (!isStableSemver(packageVersion)) {
  fail(`package.json version must be stable semver x.y.z, got ${packageVersion}`);
}

if (!existsSync(packageLockPath)) {
  fail('package-lock.json is missing');
} else {
  const packageLock = readJson(packageLockPath);

  if (packageLock.version !== packageVersion) {
    fail(
      `package-lock.json version ${packageLock.version} does not match package.json version ${packageVersion}`,
    );
  }

  const rootPackageVersion = packageLock.packages?.['']?.version;
  if (rootPackageVersion !== packageVersion) {
    fail(
      `package-lock.json packages[""].version ${rootPackageVersion} does not match package.json version ${packageVersion}`,
    );
  }
}

if (!existsSync(changelogPath)) {
  fail('CHANGELOG.md is missing');
} else {
  const changelog = readFileSync(changelogPath, 'utf8');
  const entry = currentChangelogEntry(changelog, packageVersion);

  if (!entry) {
    fail(`CHANGELOG.md is missing heading ## [${packageVersion}]`);
  } else if (/\bTODO\b|Release notes pending/i.test(entry)) {
    fail(`CHANGELOG.md entry for ${packageVersion} still contains release placeholders`);
  }
}

const requestedVersion = process.argv[2] && normaliseVersion(process.argv[2]);
if (requestedVersion) {
  if (!isStableSemver(requestedVersion)) {
    fail(`requested version must be stable semver x.y.z, got ${process.argv[2]}`);
  } else if (requestedVersion !== packageVersion) {
    fail(
      `requested version ${requestedVersion} does not match package.json version ${packageVersion}`,
    );
  }
}

const githubRefType = process.env.GITHUB_REF_TYPE;
const githubRefName = process.env.GITHUB_REF_NAME;

if (githubRefName) {
  if (githubRefType && githubRefType !== 'tag') {
    fail(`release workflow must run from a tag, got ${githubRefType} ${githubRefName}`);
  }

  if (!/^v\d+\.\d+\.\d+$/.test(githubRefName)) {
    fail(`release tag must look like v1.2.3, got ${githubRefName}`);
  } else {
    const tagVersion = normaliseVersion(githubRefName);
    if (tagVersion !== packageVersion) {
      fail(
        `release tag ${githubRefName} does not match package.json version ${packageVersion}`,
      );
    }
  }
}

if (process.exitCode) {
  process.exit(process.exitCode);
}

console.log(`[release-check] ${packageJson.name}@${packageVersion} is release-ready`);
