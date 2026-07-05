import { spawnSync } from 'node:child_process';

function run(command, args, options = {}) {
  console.log(`\n$ ${[command, ...args].join(' ')}`);
  const result = spawnSync(command, args, { stdio: 'inherit', ...options });
  if (result.status !== 0) process.exit(result.status || 1);
}

function output(command, args) {
  const result = spawnSync(command, args, { encoding: 'utf8' });
  if (result.status !== 0) {
    process.stderr.write(result.stderr || result.stdout || '');
    process.exit(result.status || 1);
  }
  return result.stdout.trim();
}

const branch = output('git', ['branch', '--show-current']);
if (branch !== 'main') {
  console.error(`Refusing production deploy from branch "${branch}". Switch to main first.`);
  process.exit(1);
}

run('git', ['fetch', 'origin', 'main']);

const status = output('git', ['status', '--porcelain']);
if (status) {
  console.error('Refusing production deploy with uncommitted changes:');
  console.error(status);
  process.exit(1);
}

const local = output('git', ['rev-parse', 'HEAD']);
const remote = output('git', ['rev-parse', 'origin/main']);
if (local !== remote) {
  console.error(`Refusing production deploy because local HEAD (${local.slice(0, 7)}) is not origin/main (${remote.slice(0, 7)}).`);
  process.exit(1);
}

run('node', ['scripts/smoke-live.mjs']);
run('vercel', ['pull', '--yes', '--environment', 'production']);
run('vercel', ['build', '--prod']);
run('vercel', ['deploy', '--prebuilt', '--prod']);
run('node', ['scripts/smoke-live.mjs']);
