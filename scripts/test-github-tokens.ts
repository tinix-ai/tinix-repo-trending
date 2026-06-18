import 'dotenv/config';

async function testToken(token: string, idx: number) {
  const masked = `${token.substring(0, 10)}...${token.slice(-4)}`;
  console.log(`Testing token ${idx}: ${masked}`);
  try {
    const res = await fetch('https://api.github.com/rate_limit', {
      headers: {
        'Authorization': `Bearer ${token}`,
        'Accept': 'application/vnd.github.v3+json',
        'User-Agent': 'TiniX-Crawl-Test'
      }
    });
    console.log(`Token ${idx} status: ${res.status} ${res.statusText}`);
    if (res.ok) {
      const data = await res.json();
      console.log(`Token ${idx} remaining: ${data.resources.core.remaining}/${data.resources.core.limit}`);
      console.log(`Token ${idx} reset time: ${new Date(data.resources.core.reset * 1000).toLocaleString()}`);
    } else {
      const text = await res.text();
      console.error(`Token ${idx} error body:`, text);
    }
  } catch (err) {
    console.error(`Token ${idx} failed to fetch:`, err);
  }
}

async function main() {
  const tokensStr = process.env.GITHUB_TOKENS;
  const singleToken = process.env.GITHUB_TOKEN;

  console.log('--- GitHub Token Status Verification ---');
  if (tokensStr) {
    const parsed = tokensStr.split(',').map(t => t.trim()).filter(Boolean);
    console.log(`Found ${parsed.length} tokens in GITHUB_TOKENS`);
    for (let i = 0; i < parsed.length; i++) {
      await testToken(parsed[i], i + 1);
    }
  } else if (singleToken) {
    console.log('Found GITHUB_TOKEN');
    await testToken(singleToken, 1);
  } else {
    console.warn('No GitHub tokens found in environment!');
  }
  process.exit(0);
}

main();
