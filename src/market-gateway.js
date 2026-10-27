// Rules shared by the local server. public/marche.php must accept the same ids.
const PRODUCTS = new Set(['BTC-USD', 'ETH-USD', 'SOL-USD']);
const RANGES = new Set(['5d', '1mo', '6mo', '1y', '5y']);
const DAY = 86400;
const cache = new Map();
const TTL = 10 * 60 * 1000;

export function isMarketSymbol(symbol) {
  return /^[A-Z0-9^=.-]{1,32}$/.test(symbol) && !symbol.includes('..') && !/^[.-]/.test(symbol);
}

function searchQuery(value) {
  const text = value.normalize('NFC').trim();
  if (text.length < 1 || text.length > 80) return null;
  if (!/^[\p{L}\p{N} .&'’+-]+$/u.test(text)) return null;
  return text;
}

export function buildUpstream(params) {
  const op = params.get('op');
  if (op === 'coinbase-product') {
    const product = params.get('product') || '';
    if (!PRODUCTS.has(product)) return null;
    return `https://api.coinbase.com/api/v3/brokerage/market/products/${product}`;
  }
  if (op === 'coinbase-candles') {
    const product = params.get('product') || '';
    const start = params.get('start') || '';
    const end = params.get('end') || '';
    if (!PRODUCTS.has(product) || !/^\d{9,12}$/.test(start) || !/^\d{9,12}$/.test(end)) return null;
    const span = Number(end) - Number(start);
    if (span <= 0 || span > 400 * DAY) return null;
    return `https://api.coinbase.com/api/v3/brokerage/market/products/${product}/candles?granularity=ONE_DAY&limit=350&start=${start}&end=${end}`;
  }
  if (op === 'yahoo') {
    const symbol = (params.get('symbol') || '').toUpperCase();
    const range = params.get('range') || '';
    if (!isMarketSymbol(symbol) || !RANGES.has(range)) return null;
    return `https://query2.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(symbol)}?interval=1d&range=${range}&includeAdjustedClose=false`;
  }
  if (op === 'search') {
    const q = searchQuery(params.get('q') || '');
    if (!q) return null;
    return `https://query2.finance.yahoo.com/v1/finance/search?q=${encodeURIComponent(q).replaceAll("'", '%27')}&quotesCount=24&newsCount=0&enableFuzzyQuery=false`;
  }
  return null;
}

async function fetchText(url) {
  const response = await fetch(url, {
    headers: {Accept: 'application/json', 'User-Agent': 'Mozilla/5.0 (compatible; PixrMarkets/1.0)'},
    signal: AbortSignal.timeout(20000)
  });
  if (!response.ok) {
    const error = new Error('upstream');
    error.status = response.status;
    throw error;
  }
  return response.text();
}

export async function handleMarket(urlString) {
  let upstream;
  let yahoo = false;
  try {
    const params = new URL(urlString, 'http://127.0.0.1').searchParams;
    const op = params.get('op');
    yahoo = op === 'yahoo' || op === 'search';
    upstream = buildUpstream(params);
  } catch {
    upstream = null;
  }
  if (!upstream) return {status: 400, body: JSON.stringify({error: 'Actif non pris en charge.'})};
  const hit = cache.get(upstream);
  if (hit && Date.now() - hit.at < TTL) return {status: 200, body: hit.body};
  const targets = yahoo ? [upstream, upstream.replace('query2.finance.yahoo.com', 'query1.finance.yahoo.com')] : [upstream];
  let status = 502;
  for (const target of targets) {
    try {
      const body = await fetchText(target);
      cache.set(upstream, {at: Date.now(), body});
      return {status: 200, body};
    } catch (error) {
      status = error.status || 502;
      if (status !== 429 && status !== 403 && status !== 500) break;
    }
  }
  const error = status === 429
    ? 'La source limite les requêtes. Réessayez dans une minute.'
    : 'La source est momentanément indisponible.';
  return {status, body: JSON.stringify({error})};
}
