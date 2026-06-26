const countryMap: Record<string, string> = {
  // Vietnam & cities (normalized to ascii)
  "vietnam": "VN", "viet nam": "VN", "hanoi": "VN", "saigon": "VN", "ho chi minh": "VN", "da nang": "VN", "ha noi": "VN", "viet": "VN",
  "can tho": "VN", "hai phong": "VN", "quang ninh": "VN", "binh duong": "VN", "dong nai": "VN", "ba ria": "VN", "vung tau": "VN", "nha trang": "VN", "hue": "VN", "vinh": "VN", "da lat": "VN",

  // United States, US States & cities
  "united states": "US", "usa": "US", "america": "US", "san francisco": "US", "new york": "US", "california": "US", "seattle": "US", "boston": "US", "chicago": "US", "los angeles": "US", "austin": "US", "texas": "US", "washington": "US", "portland": "US", "redmond": "US", "silicon valley": "US", "sf": "US", "nyc": "US", "wa": "US", "ca": "US", "ny": "US", "tx": "US", "ma": "US", "fl": "US", "il": "US", "va": "US", "co": "US", "or": "US", "ga": "US", "mi": "US", "nc": "US", "nj": "US", "pa": "US", "oh": "US",
  "denver": "US", "atlanta": "US", "miami": "US", "dallas": "US", "houston": "US", "phoenix": "US", "san diego": "US", "san jose": "US", "philadelphia": "US", "pittsburgh": "US", "minneapolis": "US", "raleigh": "US", "charlotte": "US", "nashville": "US", "salt lake city": "US", "bay area": "US", "palo alto": "US", "mountain view": "US", "cupertino": "US", "sunnyvale": "US", "menlo park": "US", "santa clara": "US",
  "ct": "US", "md": "US", "az": "US", "mn": "US", "tn": "US", "mo": "US", "wi": "US", "ut": "US", "sc": "US", "ia": "US", "ar": "US", "ks": "US", "ky": "US",

  // China — Pinyin & Chinese characters
  "china": "CN", "beijing": "CN", "shanghai": "CN", "shenzhen": "CN", "guangzhou": "CN", "hong kong": "HK", "taiwan": "TW", "beijing, china": "CN",
  "中国": "CN", "zhongguo": "CN", "北京": "CN", "上海": "CN", "深圳": "CN", "广州": "CN", "杭州": "CN", "成都": "CN", "南京": "CN", "武汉": "CN", "西安": "CN", "苏州": "CN", "重庆": "CN", "天津": "CN", "长沙": "CN", "昆明": "CN", "合肥": "CN", "济南": "CN", "青岛": "CN", "大连": "CN", "厦门": "CN", "珠海": "CN", "福州": "CN", "哈尔滨": "CN", "郑州": "CN",
  "云南": "CN", "四川": "CN", "浙江": "CN", "江苏": "CN", "广东": "CN", "山东": "CN", "湖北": "CN", "湖南": "CN", "河南": "CN", "河北": "CN", "福建": "CN", "陕西": "CN", "辽宁": "CN", "吉林": "CN", "黑龙江": "CN", "安徽": "CN",
  "hangzhou": "CN", "chengdu": "CN", "nanjing": "CN", "wuhan": "CN", "xian": "CN", "suzhou": "CN", "chongqing": "CN", "tianjin": "CN", "changsha": "CN", "kunming": "CN", "hefei": "CN", "dalian": "CN", "qingdao": "CN", "xiamen": "CN", "zhuhai": "CN", "fuzhou": "CN", "harbin": "CN", "zhengzhou": "CN", "jinan": "CN",
  "台灣": "TW", "台北": "TW", "taipei": "TW", "香港": "HK",

  // Japan — Kanji & cities
  "nihon": "JP", "nippon": "JP", "日本": "JP", "東京": "JP", "大阪": "JP", "京都": "JP", "名古屋": "JP", "福岡": "JP", "札幌": "JP", "神戸": "JP",
  "nagoya": "JP", "fukuoka": "JP", "sapporo": "JP", "kobe": "JP",

  // Korea
  "대한민국": "KR", "hanguk": "KR", "서울": "KR", "부산": "KR", "인천": "KR", "대전": "KR",
  "busan": "KR", "incheon": "KR", "daejeon": "KR",

  // Russia
  "россия": "RU", "москва": "RU", "санкт-петербург": "RU",

  // UK & cities
  "united kingdom": "GB", "uk": "GB", "great britain": "GB", "london": "GB", "england": "GB", "scotland": "GB", "wales": "GB",
  "manchester": "GB", "birmingham": "GB", "edinburgh": "GB", "glasgow": "GB", "cambridge": "GB", "oxford": "GB", "bristol": "GB", "liverpool": "GB", "leeds": "GB", "nottingham": "GB", "sheffield": "GB", "cardiff": "GB",

  // Germany & cities
  "germany": "DE", "deutschland": "DE", "berlin": "DE", "munich": "DE", "münchen": "DE", "hamburg": "DE", "frankfurt": "DE", "köln": "DE", "cologne": "DE",
  "karlsruhe": "DE", "stuttgart": "DE", "düsseldorf": "DE", "dusseldorf": "DE", "dortmund": "DE", "essen": "DE", "leipzig": "DE", "dresden": "DE", "hannover": "DE", "nuremberg": "DE", "nürnberg": "DE", "bonn": "DE", "mannheim": "DE", "aachen": "DE", "freiburg": "DE", "heidelberg": "DE", "braunschweig": "DE", "augsburg": "DE", "wiesbaden": "DE", "mainz": "DE",

  // France & cities
  "france": "FR", "francia": "FR", "paris": "FR", "lyon": "FR", "marseille": "FR", "toulouse": "FR",
  "bordeaux": "FR", "nantes": "FR", "strasbourg": "FR", "lille": "FR", "nice": "FR", "montpellier": "FR", "grenoble": "FR", "rennes": "FR",

  // Spain & cities
  "spain": "ES", "españa": "ES", "espana": "ES", "madrid": "ES", "barcelona": "ES", "valencia": "ES",
  "seville": "ES", "sevilla": "ES", "malaga": "ES", "bilbao": "ES", "zaragoza": "ES",

  // Italy & cities
  "italy": "IT", "italia": "IT", "rome": "IT", "roma": "IT", "milan": "IT", "milano": "IT", "florence": "IT", "firenze": "IT", "turin": "IT", "torino": "IT",
  "naples": "IT", "napoli": "IT", "bologna": "IT", "genoa": "IT", "genova": "IT", "palermo": "IT", "venice": "IT", "venezia": "IT",

  // Russia
  "russia": "RU", "moscow": "RU", "saint petersburg": "RU", "novosibirsk": "RU", "yekaterinburg": "RU", "kazan": "RU",

  // Switzerland
  "switzerland": "CH", "zurich": "CH", "zürich": "CH", "geneva": "CH", "geneve": "CH", "basel": "CH", "bern": "CH", "lausanne": "CH",

  // Netherlands
  "netherlands": "NL", "holland": "NL", "amsterdam": "NL", "rotterdam": "NL", "utrecht": "NL", "eindhoven": "NL", "den haag": "NL", "the hague": "NL", "delft": "NL", "leiden": "NL", "groningen": "NL",

  // Eastern Europe
  "ukraine": "UA", "kyiv": "UA", "kiev": "UA", "kharkiv": "UA", "lviv": "UA", "odessa": "UA", "україна": "UA",
  "czech republic": "CZ", "czechia": "CZ", "czech": "CZ", "prague": "CZ", "praha": "CZ", "brno": "CZ",
  "romania": "RO", "bucharest": "RO", "bucuresti": "RO", "cluj": "RO", "timisoara": "RO",
  "hungary": "HU", "budapest": "HU",
  "bulgaria": "BG", "sofia": "BG",
  "croatia": "HR", "zagreb": "HR",
  "serbia": "RS", "belgrade": "RS", "beograd": "RS",
  "slovakia": "SK", "bratislava": "SK",
  "slovenia": "SI", "ljubljana": "SI",
  "estonia": "EE", "tallinn": "EE",
  "latvia": "LV", "riga": "LV",
  "lithuania": "LT", "vilnius": "LT",
  "greece": "GR", "athens": "GR", "thessaloniki": "GR",
  "portugal": "PT", "lisbon": "PT", "lisboa": "PT", "porto": "PT",
  "cyprus": "CY", "nicosia": "CY", "limassol": "CY",
  "malta": "MT",
  "luxembourg": "LU",
  "iceland": "IS", "reykjavik": "IS",

  // Nordics
  "sweden": "SE", "stockholm": "SE", "gothenburg": "SE", "malmö": "SE", "malmo": "SE", "uppsala": "SE",
  "norway": "NO", "oslo": "NO", "bergen": "NO", "trondheim": "NO",
  "finland": "FI", "helsinki": "FI", "espoo": "FI", "tampere": "FI",
  "denmark": "DK", "copenhagen": "DK", "kobenhavn": "DK", "aarhus": "DK",

  // Ireland
  "ireland": "IE", "dublin": "IE", "cork": "IE", "galway": "IE",

  // Austria & Belgium
  "austria": "AT", "vienna": "AT", "wien": "AT", "graz": "AT", "salzburg": "AT", "linz": "AT", "innsbruck": "AT",
  "belgium": "BE", "brussels": "BE", "bruxelles": "BE", "antwerp": "BE", "antwerpen": "BE", "ghent": "BE", "gent": "BE", "leuven": "BE",

  // Poland
  "poland": "PL", "polska": "PL", "warsaw": "PL", "warszawa": "PL", "krakow": "PL", "kraków": "PL", "wroclaw": "PL", "wrocław": "PL", "poznan": "PL", "poznań": "PL", "gdansk": "PL", "gdańsk": "PL", "lodz": "PL", "łódź": "PL", "katowice": "PL",

  // Asia
  "japan": "JP", "tokyo": "JP", "osaka": "JP", "kyoto": "JP", "yokohama": "JP",
  "india": "IN", "bangalore": "IN", "mumbai": "IN", "delhi": "IN", "new delhi": "IN", "hyderabad": "IN", "pune": "IN", "bengaluru": "IN", "chennai": "IN", "kolkata": "IN", "ahmedabad": "IN", "jaipur": "IN", "lucknow": "IN", "chandigarh": "IN", "thiruvananthapuram": "IN", "kochi": "IN", "noida": "IN", "gurgaon": "IN", "gurugram": "IN",
  "south korea": "KR", "korea": "KR", "seoul": "KR",
  "indonesia": "ID", "jakarta": "ID", "bandung": "ID", "surabaya": "ID", "yogyakarta": "ID", "bali": "ID",
  "thailand": "TH", "bangkok": "TH", "chiang mai": "TH",
  "malaysia": "MY", "kuala lumpur": "MY", "penang": "MY", "johor": "MY",
  "philippines": "PH", "manila": "PH", "cebu": "PH", "davao": "PH",
  "pakistan": "PK", "karachi": "PK", "lahore": "PK", "islamabad": "PK",
  "bangladesh": "BD", "dhaka": "BD",
  "sri lanka": "LK", "colombo": "LK",
  "nepal": "NP", "kathmandu": "NP",
  "myanmar": "MM", "yangon": "MM",
  "cambodia": "KH", "phnom penh": "KH",

  // Middle East
  "uae": "AE", "united arab emirates": "AE", "dubai": "AE", "abu dhabi": "AE", "sharjah": "AE",
  "israel": "IL", "tel aviv": "IL", "jerusalem": "IL", "haifa": "IL",
  "saudi arabia": "SA", "riyadh": "SA", "jeddah": "SA",
  "qatar": "QA", "doha": "QA",
  "bahrain": "BH",
  "kuwait": "KW",
  "oman": "OM",
  "iran": "IR", "tehran": "IR",
  "iraq": "IQ", "baghdad": "IQ",
  "jordan": "JO", "amman": "JO",
  "lebanon": "LB", "beirut": "LB",

  // Americas
  "canada": "CA", "toronto": "CA", "vancouver": "CA", "montreal": "CA", "ottawa": "CA", "calgary": "CA", "edmonton": "CA", "winnipeg": "CA", "quebec": "CA",
  "australia": "AU", "sydney": "AU", "melbourne": "AU", "brisbane": "AU", "perth": "AU", "adelaide": "AU", "canberra": "AU",
  "brazil": "BR", "brasil": "BR", "sao paulo": "BR", "rio de janeiro": "BR", "belo horizonte": "BR", "curitiba": "BR", "brasilia": "BR", "recife": "BR", "porto alegre": "BR", "fortaleza": "BR", "florianopolis": "BR",
  "singapore": "SG",
  "mexico": "MX", "mexico city": "MX", "ciudad de mexico": "MX", "guadalajara": "MX", "monterrey": "MX", "cdmx": "MX",
  "argentina": "AR", "buenos aires": "AR", "cordoba": "AR", "rosario": "AR",
  "colombia": "CO", "bogota": "CO", "medellin": "CO", "cali": "CO", "barranquilla": "CO",
  "chile": "CL", "santiago": "CL", "valparaiso": "CL",
  "peru": "PE", "lima": "PE",
  "uruguay": "UY", "montevideo": "UY",
  "venezuela": "VE", "caracas": "VE",
  "ecuador": "EC", "quito": "EC", "guayaquil": "EC",
  "costa rica": "CR",
  "panama": "PA",
  "dominican republic": "DO", "santo domingo": "DO",
  "puerto rico": "PR",
  "jamaica": "JM",

  // Africa
  "nigeria": "NG", "lagos": "NG", "abuja": "NG",
  "south africa": "ZA", "cape town": "ZA", "johannesburg": "ZA", "durban": "ZA", "pretoria": "ZA",
  "kenya": "KE", "nairobi": "KE",
  "egypt": "EG", "cairo": "EG", "alexandria": "EG",
  "morocco": "MA", "casablanca": "MA", "rabat": "MA",
  "tunisia": "TN", "tunis": "TN",
  "ghana": "GH", "accra": "GH",
  "ethiopia": "ET", "addis ababa": "ET",
  "tanzania": "TZ", "dar es salaam": "TZ",
  "uganda": "UG", "kampala": "UG",
  "rwanda": "RW", "kigali": "RW",
  "senegal": "SN", "dakar": "SN",
  "algeria": "DZ", "algiers": "DZ",

  // Oceania
  "new zealand": "NZ", "nz": "NZ", "auckland": "NZ", "wellington": "NZ", "christchurch": "NZ",

  // Turkey
  "turkey": "TR", "türkiye": "TR", "turkiye": "TR", "istanbul": "TR", "ankara": "TR", "izmir": "TR", "antalya": "TR", "bursa": "TR",

  // Misc short aliases
  "canada, ca": "CA",

  // Caucasus & Central Asia
  "armenia": "AM", "yerevan": "AM",
  "georgia": "GE", "tbilisi": "GE",
  "azerbaijan": "AZ", "baku": "AZ",
  "kazakhstan": "KZ", "almaty": "KZ", "astana": "KZ",
  "uzbekistan": "UZ", "tashkent": "UZ",
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

  // 2. Fallback check for substrings (skip short keys ≤3 chars to avoid false positives
  //    from US state codes like "ar", "or", "co", "in", "pa" matching country names)
  for (const [key, code] of Object.entries(countryMap)) {
    if (key.length <= 3) continue; // Skip short keys in substring fallback
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

  // 4. Check for emoji flags (e.g. "🇺🇸", "🇻🇳")
  const flagRegex = /[\uD83C][\uDDE6-\uDDFF][\uD83C][\uDDE6-\uDDFF]/;
  const flagMatch = flagRegex.exec(location);
  if (flagMatch) {
    const flag = flagMatch[0];
    const first = flag.codePointAt(0)! - 0x1F1E6; // A=0, B=1, ...
    const second = flag.codePointAt(2)! - 0x1F1E6;
    const isoCode = String.fromCharCode(65 + first) + String.fromCharCode(65 + second);
    const supportedCodes = new Set(Object.values(countryMap));
    if (supportedCodes.has(isoCode)) {
      return isoCode;
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
