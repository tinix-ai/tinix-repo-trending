import { spawn, execSync, ChildProcess } from 'child_process';
import readline from 'readline';

console.log('\x1b[35m[Runner] Starting TiniX Dev Environment...\x1b[0m');

interface ProcessInfo {
  name: string;
  command: string;
  args: string[];
  color: string;
  instance?: ChildProcess;
}

// MEMORY BUDGET: ~4GB total (Next.js 2048 + 3 workers × 512 = 3584MB)
const processes: ProcessInfo[] = [
  {
    name: 'Next.js',
    command: 'npx',
    args: ['next', 'dev', '--turbopack'],
    color: '\x1b[36m', // Cyan
  },
  {
    name: 'GH Worker',
    command: 'npx',
    args: ['tsx', 'src/workers/crawler-worker.ts'],
    color: '\x1b[32m', // Green
  },
  {
    name: 'HF Worker',
    command: 'npx',
    args: ['tsx', 'src/workers/hf-worker.ts'],
    color: '\x1b[33m', // Yellow
  },
  {
    name: 'Scheduler',
    command: 'npx',
    args: ['tsx', 'src/workers/scheduler-worker.ts'],
    color: '\x1b[34m', // Blue
  },
  // NOTE: GH Updater and HF Updater workers are now handled by
  // crawler-worker.ts and hf-worker.ts respectively (merged)
];

let isExiting = false;

function logSystem(msg: string) {
  console.log(`\x1b[35m[Runner] ${msg}\x1b[0m`);
}

function getProcessEnv(procName: string): NodeJS.ProcessEnv {
  if (procName === 'Next.js') {
    return { ...process.env, NODE_OPTIONS: '--max-old-space-size=2048' };
  }
  // Workers: limit heap to 512MB + limit DB connections
  return {
    ...process.env,
    NODE_OPTIONS: '--max-old-space-size=512',
    DB_MAX_CONNECTIONS: '2',
  };
}

function startProcess(proc: ProcessInfo) {
  logSystem(`Starting ${proc.name}: ${proc.command} ${proc.args.join(' ')}`);

  const child = spawn(proc.command, proc.args, {
    stdio: ['ignore', 'pipe', 'pipe'],
    shell: true,
    env: getProcessEnv(proc.name),
  });

  proc.instance = child;

  // Stream stdout
  if (child.stdout) {
    const rl = readline.createInterface({ input: child.stdout });
    rl.on('line', (line) => {
      if (!isExiting) {
        console.log(`${proc.color}[${proc.name}]\x1b[0m ${line}`);
      }
    });
  }

  // Stream stderr
  if (child.stderr) {
    const rl = readline.createInterface({ input: child.stderr });
    rl.on('line', (line) => {
      if (!isExiting) {
        console.error(`${proc.color}[${proc.name} ERR]\x1b[31m ${line}\x1b[0m`);
      }
    });
  }

  child.on('close', (code) => {
    if (!isExiting) {
      logSystem(`${proc.name} exited with code ${code}`);
      cleanupAndExit(code || 0);
    }
  });

  child.on('error', (err) => {
    if (!isExiting) {
      logSystem(`Failed to start ${proc.name}: ${err.message}`);
    }
  });
}

function cleanupAndExit(exitCode = 0) {
  if (isExiting) return;
  isExiting = true;
  logSystem('Shutting down all processes cleanly...');

  for (const proc of processes) {
    if (proc.instance && proc.instance.pid) {
      logSystem(`Stopping ${proc.name} (PID: ${proc.instance.pid})...`);
      try {
        if (process.platform === 'win32') {
          // Windows: Force kill process tree recursively (/T /F)
          execSync(`taskkill /F /T /PID ${proc.instance.pid}`, { stdio: 'ignore' });
        } else {
          // Unix: standard SIGTERM
          proc.instance.kill('SIGTERM');
          const pid = proc.instance.pid;
          setTimeout(() => {
            try {
              process.kill(pid, 0); // Check if alive
              process.kill(pid, 'SIGKILL');
            } catch {
              // Already dead
            }
          }, 1000);
        }
      } catch {
        // Ignore error if process already exited
      }
    }
  }

  logSystem('All processes terminated.');
  process.exit(exitCode);
}

// Staggered startup: start processes with delays to avoid boot-time memory spike
async function startAllProcesses() {
  for (let i = 0; i < processes.length; i++) {
    startProcess(processes[i]);
    if (i < processes.length - 1) {
      // Wait 3 seconds between each process to let them settle
      await new Promise(resolve => global.setTimeout(resolve, 3000));
    }
  }
  logSystem('All processes started.');
}
startAllProcesses();

// Handle termination signals
process.on('SIGINT', () => {
  logSystem('Received SIGINT (Ctrl+C).');
  cleanupAndExit(0);
});

process.on('SIGTERM', () => {
  logSystem('Received SIGTERM.');
  cleanupAndExit(0);
});

process.on('exit', () => {
  cleanupAndExit(0);
});
