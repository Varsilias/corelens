const { constants, accessSync, existsSync } = require('node:fs');
const { spawnSync } = require('node:child_process');

if (!existsSync('.git')) {
  process.exit(0);
}

try {
  accessSync('.git/config', constants.W_OK);
} catch {
  console.warn('[corelens] skipped husky prepare: .git/config is not writable');
  process.exit(0);
}

const result = spawnSync('husky', { stdio: 'inherit', shell: true });

if (result.error || result.status !== 0) {
  const message = result.error?.message ?? `exit code ${result.status}`;
  console.warn(`[corelens] skipped husky prepare: ${message}`);
}
