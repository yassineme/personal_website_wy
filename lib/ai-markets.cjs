'use strict';

const SYMBOLS = Object.freeze([
  'MSFT','GOOGL','AMZN','META','AAPL','TSLA','BABA','BIDU','IBM',
  'NVDA','AMD','AVGO','TSM','ASML','ARM','MU','INTC','QCOM','MRVL',
  'AMAT','LRCX','KLAC','SNPS','CDNS','ORCL','PLTR','CRWV','DELL','HPE','ANET','VRT','EQIX','SMCI'
]);
const REFRESH_MS = 75000;
const MAX_CACHE_MS = 15 * 60000;

function normalizeQuote(symbol, data, now) {
  if (!SYMBOLS.includes(symbol) || !Number.isFinite(data?.c) || data.c <= 0 || !Number.isFinite(data.t) || data.t <= 0 || data.t * 1000 > now + 300000) return null;
  const changePercent = Number.isFinite(data.dp) ? data.dp :
    Number.isFinite(data.pc) && data.pc > 0 ? (data.c - data.pc) / data.pc * 100 : null;
  if (!Number.isFinite(changePercent)) return null;
  return {
    symbol, price:data.c, changePercent, currency:'USD',
    quoteTime:new Date(data.t * 1000).toISOString(), receivedAt:new Date(now).toISOString()
  };
}

// One bounded, coalesced refresh for the whole watchlist. The key stays on the server.
function createQuoteService({
  apiKey = () => process.env.FINNHUB_API_KEY,
  fetcher = fetch, clock = Date.now,
  sleep = ms => new Promise(resolve => setTimeout(resolve, ms)),
  timeoutMs = 3500
} = {}) {
  let state;
  function snapshot(s) {
    const now = clock();
    const quotes = [...s.quotes.values()]
      .filter(quote => now - Date.parse(quote.receivedAt) <= MAX_CACHE_MS)
      .map(quote => ({ ...quote, stale:s.failed.has(quote.symbol) || now - Date.parse(quote.quoteTime) > 7 * 86400000 }));
    const status = s.error || (quotes.length === 0 ? 'unavailable' :
      quotes.some(quote => quote.stale) ? 'stale' : quotes.length < SYMBOLS.length ? 'partial' : 'ok');
    return {
      provider:'Finnhub', status, checkedAt:s.checkedAt ? new Date(s.checkedAt).toISOString() : null,
      refreshAfterMs:Math.max(REFRESH_MS, s.nextAt - now),
      quotes, unavailable:SYMBOLS.filter(symbol => !quotes.some(quote => quote.symbol === symbol))
    };
  }
  async function refresh(s) {
    s.failed = new Set();
    s.error = null;
    const deadline = clock() + 24000;
    for (let start = 0; start < SYMBOLS.length; start += 6) {
      if (s.error || clock() >= deadline) {
        SYMBOLS.slice(start).forEach(symbol => s.failed.add(symbol));
        break;
      }
      await Promise.all(SYMBOLS.slice(start, start + 6).map(async symbol => {
        try {
          const response = await fetcher('https://finnhub.io/api/v1/quote?symbol=' + symbol, {
            headers:{ 'X-Finnhub-Token':s.key, Accept:'application/json' },
            signal:AbortSignal.timeout(timeoutMs), redirect:'error'
          });
          if (response.status === 401 || response.status === 403) {
            s.error = 'authentication_failed';
            throw Error('authentication');
          }
          if (response.status === 429) {
            s.error = 'rate_limited';
            throw Error('rate limit');
          }
          if (!response.ok) throw Error('upstream');
          const data = await response.json();
          if (data?.error) throw Error('provider');
          const quote = normalizeQuote(symbol, data, clock());
          if (!quote) throw Error('invalid quote');
          s.quotes.set(symbol, quote);
        } catch {
          // Never return raw provider errors: they can contain request credentials.
          s.failed.add(symbol);
        }
      }));
      // At most 24 starts/second, in addition to the minute-level shared cache.
      if (start + 6 < SYMBOLS.length && !s.error) await sleep(300);
    }
    s.checkedAt = clock();
    s.nextAt = s.checkedAt + (s.error === 'rate_limited' ? 120000 : REFRESH_MS);
  }
  return async function getQuotes() {
    const key = String(apiKey() || '').trim();
    if (!key) {
      state = null;
      return {provider:'Finnhub', status:'configuration_required', checkedAt:null, refreshAfterMs:REFRESH_MS, quotes:[], unavailable:[...SYMBOLS]};
    }
    if (!state || state.key !== key) state = {key, quotes:new Map(), failed:new Set(), checkedAt:0, nextAt:0, pending:null, error:null};
    const current = state;
    if (clock() >= current.nextAt) {
      current.pending ||= refresh(current).finally(() => { current.pending = null; });
      await current.pending;
    }
    return snapshot(current);
  };
}

module.exports = {SYMBOLS, REFRESH_MS, MAX_CACHE_MS, normalizeQuote, createQuoteService};
