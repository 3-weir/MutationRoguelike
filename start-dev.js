const { spawn } = require('child_process');
const path = require('path');
const fs = require('fs');

const nodePath = 'C:\\Users\\Elina\\.workbuddy\\binaries\\node\\versions\\22.12.0';
const npmCli = path.join(nodePath, 'node_modules', 'npm', 'bin', 'npm-cli.js');
const cwd = 'C:\\Users\\Elina\\Desktop\\GameEngine-main';

const env = Object.assign({}, process.env, {
  PATH: nodePath + ';' + (process.env.SystemRoot || 'C:\\Windows') + '\\system32;' + (process.env.SystemRoot || 'C:\\Windows'),
  NODE_OPTIONS: ''
});

const logStream = fs.createWriteStream(path.join(cwd, 'vite-dev.log'), { flags: 'w' });

const child = spawn(process.execPath, [npmCli, 'run', 'dev'], {
  cwd,
  env,
  detached: true,
  stdio: ['ignore', logStream, logStream]
});

child.unref();
fs.writeFileSync(path.join(cwd, 'vite-dev.pid'), String(child.pid));
console.log('Started Vite dev server with PID:', child.pid);
