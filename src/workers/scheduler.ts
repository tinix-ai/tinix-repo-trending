import cron from 'node-cron';
import { spawn } from 'child_process';
import path from 'path';

console.log('[Scheduler] Starting Automated Cron Daemon...');
console.log('[Scheduler] Scheduled to run at 00:00 every day.');

// "0 0 * * *" means at 00:00 (midnight) every day
cron.schedule('0 0 * * *', () => {
  console.log('[Scheduler] Triggering Daily Cron Jobs...');
  
  // We spawn the cron process so it runs in its own memory space
  const scriptPath = path.join(__dirname, 'cron.ts');
  const cronProcess = spawn('npx', ['tsx', scriptPath], {
    stdio: 'inherit',
    shell: true,
  });

  cronProcess.on('close', (code) => {
    console.log(`[Scheduler] Daily Cron Jobs finished with code ${code}`);
  });
});

// Keep the process alive
process.stdin.resume();
