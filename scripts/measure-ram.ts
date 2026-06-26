import { execSync } from 'child_process';
import 'dotenv/config';

interface ProcessInfo {
  ProcessId: number;
  Name: string;
  WorkingSetSize: number;
  CommandLine: string | null;
}

async function main() {
  console.log('=== Measuring Workspace Process RAM Usage ===\n');

  let processes: ProcessInfo[] = [];
  try {
    const rawJson = execSync(
      `powershell -Command "Get-CimInstance Win32_Process | Where-Object { $_.Name -match 'node|redis|postgres|postgres' -or $_.CommandLine -like '*tinix-repo-trending*' } | Select-Object ProcessId, Name, WorkingSetSize, CommandLine | ConvertTo-Json -Depth 2"`,
      { maxBuffer: 1024 * 1024 * 10 }
    ).toString();
    
    const parsed = JSON.parse(rawJson);
    processes = Array.isArray(parsed) ? parsed : [parsed];
  } catch (error) {
    console.error('Error fetching processes:', error);
    return;
  }

  // Filter and categorize
  const workspacePath = 'tinix-repo-trending';
  const categories: { [key: string]: { label: string; items: { pid: number; name: string; cmd: string; ram: number }[] } } = {
    web: { label: 'Web Server / Next.js', items: [] },
    workers: { label: 'Background Workers & Schedulers', items: [] },
    infra: { label: 'Infrastructure (Redis, Postgres)', items: [] },
    mcp: { label: 'MCP / DevTools / IDE Support', items: [] },
    other: { label: 'Other Workspace Related Processes', items: [] }
  };

  for (const proc of processes) {
    if (!proc.CommandLine && !['redis-server.exe', 'postgres.exe'].includes(proc.Name)) {
      continue;
    }

    const cmd = proc.CommandLine || '';
    const name = proc.Name;
    const ram = (proc.WorkingSetSize || 0) / 1024 / 1024; // MB
    const pid = proc.ProcessId;

    // Categorization logic
    if (name.includes('redis') || name.includes('postgres')) {
      categories.infra.items.push({ pid, name, cmd, ram });
    } else if (cmd.includes('chrome-devtools-mcp') || cmd.includes('playwright')) {
      categories.mcp.items.push({ pid, name, cmd, ram });
    } else if (cmd.includes('next dev') || cmd.includes('next start') || cmd.includes('next/dist/bin/next')) {
      categories.web.items.push({ pid, name, cmd, ram });
    } else if (
      cmd.includes('worker') || 
      cmd.includes('scheduler') || 
      cmd.includes('queue:') || 
      cmd.includes('bull') ||
      cmd.includes('dev:all') ||
      cmd.includes('npm-run-all')
    ) {
      categories.workers.items.push({ pid, name, cmd, ram });
    } else if (cmd.includes(workspacePath)) {
      categories.other.items.push({ pid, name, cmd, ram });
    }
  }

  let grandTotal = 0;

  for (const [key, cat] of Object.entries(categories)) {
    if (cat.items.length === 0) continue;
    
    console.log(`\n--- ${cat.label} ---`);
    let catTotal = 0;
    
    // Sort items by RAM descending
    cat.items.sort((a, b) => b.ram - a.ram);

    for (const item of cat.items) {
      const displayCmd = item.cmd.length > 80 ? item.cmd.substring(0, 77) + '...' : item.cmd;
      console.log(`  PID ${String(item.pid).padEnd(6)} | RAM: ${item.ram.toFixed(2).padStart(7)} MB | ${item.name.padEnd(10)} | ${displayCmd}`);
      catTotal += item.ram;
    }
    
    console.log(`  Subtotal: ${catTotal.toFixed(2)} MB`);
    grandTotal += catTotal;
  }

  console.log('\n======================================');
  console.log(`GRAND TOTAL WORKSPACE RAM: ${grandTotal.toFixed(2)} MB (${(grandTotal / 1024).toFixed(2)} GB)`);
  console.log('======================================');
}

main().catch(console.error);
