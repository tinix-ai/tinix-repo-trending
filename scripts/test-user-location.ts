import 'dotenv/config';
import { parseCountryFromLocation } from '../src/lib/location-parser';
import { proxyManager } from '../src/lib/crawlers/proxy';

async function fetchLocation(owner: string): Promise<{ location: string | null; countryCode: string | null }> {
  const url = `https://api.github.com/users/${owner}`;
  const headers = {
    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
    "Accept": "application/vnd.github.v3+json"
  };

  const dispatcher = proxyManager.getRandomDispatcher();
  const fetchOptions: RequestInit & { dispatcher?: unknown } = { headers };
  if (dispatcher) {
    fetchOptions.dispatcher = dispatcher;
  }

  const response = await fetch(url, fetchOptions);
  if (!response.ok) {
    throw new Error(`GitHub API returned status ${response.status}`);
  }
  const data = await response.json() as { location?: string };
  const location = data.location || null;
  const countryCode = parseCountryFromLocation(location);
  return { location, countryCode };
}

async function main() {
  console.log("Testing GitHub Owner Profile Location Parser...");
  
  const testOwners = [
    'anthropics',
    'bytedance',
    'google',
    'microsoft',
    'facebook',
    'huggingface',
    'kubernetes',
    'tini-x',
    'vutm'
  ];

  for (const owner of testOwners) {
    try {
      const result = await fetchLocation(owner);
      console.log(`Owner: ${owner.padEnd(15)} | Location: ${(result.location || 'None').padEnd(30)} | Country Code: ${result.countryCode || 'Unknown'}`);
    } catch (err) {
      console.error(`Failed for owner ${owner}:`, err);
    }
  }
  process.exit(0);
}

main().catch(console.error);
