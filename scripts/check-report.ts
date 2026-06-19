import 'dotenv/config';
import { fetchCrawlerReport } from '../src/app/actions';

async function main() {
  const report = await fetchCrawlerReport();
  console.log("=== Crawler Report ===");
  console.log(JSON.stringify(report, null, 2));
  process.exit(0);
}

main().catch(console.error);
