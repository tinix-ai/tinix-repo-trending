import { ProxyAgent } from 'undici';

class ProxyManager {
  private proxies: string[] = [];
  private agents: Map<string, ProxyAgent> = new Map();

  constructor() {
    this.initializePool();
  }

  private initializePool() {
    const proxyStr = process.env.PROXY_URLS;
    if (proxyStr) {
      const parsedProxies = proxyStr.split(',').map(p => p.trim()).filter(Boolean);
      this.proxies = parsedProxies;
      if (this.proxies.length > 0) {
        console.log(`[ProxyManager] Initialized with ${this.proxies.length} proxy URL(s).`);
      }
    } else {
      console.log(`[ProxyManager] No PROXY_URLS provided. Will connect directly.`);
    }
  }

  public getRandomDispatcher(): ProxyAgent | undefined {
    if (this.proxies.length === 0) return undefined;

    // Pick a random proxy
    const proxyUrl = this.proxies[Math.floor(Math.random() * this.proxies.length)];
    
    // Cache the agent instances
    if (!this.agents.has(proxyUrl)) {
      this.agents.set(proxyUrl, new ProxyAgent(proxyUrl));
    }

    return this.agents.get(proxyUrl);
  }
}

export const proxyManager = new ProxyManager();
