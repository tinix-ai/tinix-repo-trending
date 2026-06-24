const countryMap: Record<string, string> = {
  // Vietnam & cities (normalized to ascii)
  "vietnam": "VN", "viet nam": "VN", "hanoi": "VN", "saigon": "VN", "ho chi minh": "VN", "da nang": "VN", "ha noi": "VN", "viet": "VN",
  "can tho": "VN", "hai phong": "VN", "quang ninh": "VN", "binh duong": "VN", "dong nai": "VN", "ba ria": "VN", "vung tau": "VN", "nha trang": "VN", "hue": "VN", "vinh": "VN", "da lat": "VN",

  // United States, US States
  "united states": "US", "usa": "US", "america": "US", "san francisco": "US", "new york": "US", "california": "US", "seattle": "US", "boston": "US", "chicago": "US", "los angeles": "US", "austin": "US", "texas": "US", "washington": "US", "portland": "US", "redmond": "US", "silicon valley": "US", "sf": "US", "nyc": "US", "wa": "US", "ca": "US", "ny": "US", "tx": "US", "ma": "US", "fl": "US", "il": "US", "va": "US", "co": "US", "or": "US", "ga": "US", "mi": "US", "nc": "US", "nj": "US", "pa": "US", "oh": "US",

  // China, non-latin scripts
  "china": "CN", "beijing": "CN", "shanghai": "CN", "shenzhen": "CN", "guangzhou": "CN", "hong kong": "HK", "taiwan": "TW", "beijing, china": "CN",
  "中国": "CN", "zhongguo": "CN", "nihon": "JP", "nippon": "JP", "日本": "JP", "대한민국": "KR", "hanguk": "KR", "россия": "RU",

  // UK & Europe
  "united kingdom": "GB", "uk": "GB", "great britain": "GB", "london": "GB", "england": "GB", "scotland": "GB", "wales": "GB",
  "germany": "DE", "deutschland": "DE", "berlin": "DE", "munich": "DE", "hamburg": "DE", "frankfurt": "DE", "köln": "DE", "cologne": "DE",
  "france": "FR", "francia": "FR", "paris": "FR", "lyon": "FR", "marseille": "FR", "toulouse": "FR",
  "spain": "ES", "españa": "ES", "espana": "ES", "madrid": "ES", "barcelona": "ES", "valencia": "ES",
  "italy": "IT", "italia": "IT", "rome": "IT", "milan": "IT", "florence": "IT", "turin": "IT",
  "russia": "RU", "moscow": "RU", "saint petersburg": "RU",
  "switzerland": "CH", "zurich": "CH", "geneva": "CH", "basel": "CH",
  "netherlands": "NL", "amsterdam": "NL", "rotterdam": "NL", "utrecht": "NL",
  "ukraine": "UA", "kyiv": "UA", "kiev": "UA",
  "sweden": "SE", "stockholm": "SE", "gothenburg": "SE",
  "norway": "NO", "oslo": "NO",
  "finland": "FI", "helsinki": "FI",
  "denmark": "DK", "copenhagen": "DK",
  "ireland": "IE", "dublin": "IE",
  "austria": "AT", "vienna": "AT",
  "belgium": "BE", "brussels": "BE",
  "poland": "PL", "warsaw": "PL", "krakow": "PL",

  // Others
  "japan": "JP", "tokyo": "JP", "osaka": "JP", "kyoto": "JP", "yokohama": "JP",
  "india": "IN", "bangalore": "IN", "mumbai": "IN", "delhi": "IN", "hyderabad": "IN", "pune": "IN", "bengaluru": "IN", "chennai": "IN",
  "canada": "CA", "toronto": "CA", "vancouver": "CA", "montreal": "CA", "ottawa": "CA",
  "australia": "AU", "sydney": "AU", "melbourne": "AU", "brisbane": "AU",
  "brazil": "BR", "brasil": "BR", "sao paulo": "BR", "rio de janeiro": "BR",
  "singapore": "SG",
  "south korea": "KR", "korea": "KR", "seoul": "KR",
  "turkey": "TR", "istanbul": "TR", "ankara": "TR", "izmir": "TR",
  "canada, ca": "CA", "nz": "NZ", "new zealand": "NZ"
};

/**
 * Parses free-form location text into an ISO 3166-1 alpha-2 country code.
 */
export function parseCountryFromLocation(location: string | null | undefined): string | null {
  if (!location) return null;
  
  // Normalize string to lowercase and strip diacritics (accents) for accents-agnostic matching
  const normalized = location.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/đ/g, "d").trim();
  
  // 1. Direct match by word boundaries for ASCII/Latin words
  for (const [key, code] of Object.entries(countryMap)) {
    if (/^[a-z0-9 ]+$/.test(key)) {
      const escapedKey = key.replace(/[-\/\\^$*+?.()|[\]{}]/g, "\\$&");
      const regex = new RegExp(`\\b${escapedKey}\\b`, "i");
      if (regex.test(normalized)) {
        return code;
      }
    } else {
      // For non-latin script keys (like "中国", "日本", "대한민국", "россия"), check substring inclusion directly
      if (normalized.includes(key)) {
        return code;
      }
    }
  }

  // 2. Fallback check for substrings
  for (const [key, code] of Object.entries(countryMap)) {
    if (normalized.includes(key)) {
      return code;
    }
  }

  // 3. Check ISO country codes directly if they appear as distinct uppercase words (e.g. "VN", "USA")
  const upperClean = location.trim();
  const isoMatch = /(?:^|\s|[^a-zA-Z])([A-Z]{2})(?:$|\s|[^a-zA-Z])/.exec(upperClean);
  if (isoMatch) {
    const code = isoMatch[1];
    const supportedCodes = new Set(Object.values(countryMap));
    if (supportedCodes.has(code)) {
      return code;
    }
  }

  return null;
}

/**
 * Parses a user profile's multiple fields (location, email, blog, company) 
 * to find the best possible country indicator.
 */
export function parseCountryFromProfile(profile: {
  location?: string | null;
  email?: string | null;
  blog?: string | null;
  company?: string | null;
}): string | null {
  // 1. Try standard location parsing first
  if (profile.location) {
    const code = parseCountryFromLocation(profile.location);
    if (code) return code;
  }

  // 2. Fallback: Parse public email domain TLD
  if (profile.email) {
    const emailMatch = /\@.*\.([a-z]{2})$/i.exec(profile.email.trim().toLowerCase());
    if (emailMatch) {
      const tld = emailMatch[1].toUpperCase();
      const supportedCodes = new Set(Object.values(countryMap));
      if (supportedCodes.has(tld)) {
        return tld;
      }
      if (tld === "UK") return "GB"; // special handling for .uk TLD
    }
  }

  // 3. Fallback: Parse personal blog/homepage domain TLD
  if (profile.blog) {
    try {
      let urlStr = profile.blog.trim().toLowerCase();
      if (!urlStr.startsWith("http://") && !urlStr.startsWith("https://")) {
        urlStr = "https://" + urlStr;
      }
      const url = new URL(urlStr);
      const hostname = url.hostname;
      const tldMatch = /\.([a-z]{2})$/i.exec(hostname);
      if (tldMatch) {
        const tld = tldMatch[1].toUpperCase();
        const supportedCodes = new Set(Object.values(countryMap));
        if (supportedCodes.has(tld)) {
          return tld;
        }
        if (tld === "UK") return "GB";
      }
    } catch {
      // Ignore URL parsing errors
    }
  }

  // 4. Fallback: Match major Vietnamese company names
  if (profile.company) {
    const comp = profile.company.toLowerCase().trim();
    const vnCompanyKeywords = [
      "fpt", "viettel", "vng", "vinagame", "coc coc", "bkav", 
      "tiki", "sendo", "vnpt", "mobifone", "vtv", "vtc", 
      "shopee vietnam", "grab vietnam", "lazada vietnam"
    ];
    if (vnCompanyKeywords.some(kw => comp.includes(kw))) {
      return "VN";
    }
  }

  return null;
}
