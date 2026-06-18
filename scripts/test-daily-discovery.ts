import 'dotenv/config';
import { runDailyDiscovery } from '../src/workers/cron';

async function main() {
  console.log("Running Daily Discovery Test...");
  try {
    await runDailyDiscovery();
    console.log("Daily Discovery completed successfully.");
  } catch (error) {
    console.error("Daily Discovery failed:", error);
  }
  process.exit(0);
}

main().catch(console.error);
