import 'dotenv/config';

async function main() {
  const ports = [3000, 5000, 8000, 3001];
  for (const port of ports) {
    try {
      console.log(`Checking http://localhost:${port}...`);
      const res = await fetch(`http://localhost:${port}`, { method: 'HEAD', signal: AbortSignal.timeout(1000) });
      console.log(`Port ${port} is active! Status:`, res.status);
    } catch (err: any) {
      console.log(`Port ${port} is inactive or timed out:`, err.message);
    }
  }
  process.exit(0);
}

main();
