async function test() {
  const urls = [
    'https://huggingface.co/api/models?sort=likes7d&limit=100&direction=-1',
    'https://huggingface.co/api/datasets?sort=likes7d&limit=100&direction=-1',
  ];

  for (const url of urls) {
    console.log(`Fetching: ${url}`);
    try {
      const res = await fetch(url, {
        headers: {
          'Accept': 'application/json',
          'User-Agent': 'TiniX-Repo-Trending/1.0'
        }
      });
      console.log(`  Status: ${res.status} ${res.statusText}`);
      if (res.ok) {
        const data = await res.json();
        console.log(`  Success! Found ${data.length || 0} items. Sample ID: ${data[0]?.id || 'none'}`);
      } else {
        const text = await res.text();
        console.log(`  Response body:`, text);
      }
    } catch (e: unknown) {
      const error = e as Error;
      console.error(`  Fetch failed:`, error.message);
    }
  }
}

test();
