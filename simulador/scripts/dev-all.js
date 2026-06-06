import { spawn } from 'node:child_process';

const processes = [
  ['api', ['run', 'dev:api']],
  ['front', ['run', 'dev:front']]
];

const children = processes.map(([name, args]) => {
  const child = spawn('npm', args, {
    stdio: 'inherit',
    shell: false
  });
  child.on('exit', code => {
    if (code && code !== 0) {
      console.error(`${name} termino con codigo ${code}`);
      shutdown();
    }
  });
  return child;
});

process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);

function shutdown() {
  for (const child of children) child.kill('SIGTERM');
  process.exit(0);
}
