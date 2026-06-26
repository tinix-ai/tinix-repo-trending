import 'dotenv/config';

async function test() {
  const tokensStr = process.env.GITHUB_TOKENS || '';
  const tokens = tokensStr.split(',').map(t => t.trim()).filter(Boolean);
  console.log(`Testing gakonst/ethers-rs with all ${tokens.length} tokens...`);

  const query = `
    query($owner: String!, $name: String!) {
      repository(owner: $owner, name: $name) {
        name
        stargazerCount
      }
    }
  `;

  for (let i = 0; i < tokens.length; i++) {
    const token = tokens[i];
    const masked = token.substring(0, 15) + '...';
    try {
      const res = await fetch('https://api.github.com/graphql', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
          'User-Agent': 'TiniX-Repo-Trending'
        },
        body: JSON.stringify({
          query,
          variables: { owner: 'gakonst', name: 'ethers-rs' }
        })
      });
      const body = await res.json() as any;
      console.log(`\nToken index ${i} (${masked}):`);
      console.log(`  HTTP status:`, res.status);
      if (body.errors) {
        console.log(`  Errors:`, JSON.stringify(body.errors, null, 2));
      } else {
        console.log(`  Success! Stars:`, body.data?.repository?.stargazerCount);
      }
    } catch (err: any) {
      console.log(`  Failed with exception:`, err.message);
    }
  }
  process.exit(0);
}

test();
