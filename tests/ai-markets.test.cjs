'use strict';
const {test} = require('node:test');
const assert = require('node:assert/strict');
const {SYMBOLS, REFRESH_MS, MAX_CACHE_MS, normalizeQuote, createQuoteService} = require('../lib/ai-markets.cjs');
const {createHandler} = require('../api/ai-markets.js');

const NOW = Date.parse('2026-10-27T10:00:00Z');
const valid = now => ({c:110, pc:100, dp:10, t:Math.floor(now / 1000)});
const response = (data, status = 200) => ({ok:status === 200, status, json:async () => data});

test('only real, valid prices and timestamps are accepted; zero daily change is preserved', () => {
  assert.equal(normalizeQuote('NVDA', {...valid(NOW), dp:0}, NOW).changePercent, 0);
  assert.equal(normalizeQuote('NVDA', {...valid(NOW), dp:null}, NOW).changePercent, 10);
  for (const data of [null, {}, {...valid(NOW), c:0}, {...valid(NOW), c:'110'}, {...valid(NOW), dp:null, pc:0}, {...valid(NOW), t:0}, {...valid(NOW), t:NOW / 1000 + 301}]) {
    assert.equal(normalizeQuote('NVDA', data, NOW), null);
  }
  assert.equal(normalizeQuote('USER-SUPPLIED-URL', valid(NOW), NOW), null);
});

test('missing credentials makes no provider requests and never substitutes sample prices', async () => {
  let calls = 0, key = '';
  const get = createQuoteService({apiKey:() => key, clock:() => NOW, sleep:async () => {}, fetcher:async () => {calls++; return response(valid(NOW));}});
  const missing = await get();
  assert.equal(missing.status, 'configuration_required');
  assert.deepEqual(missing.quotes, []);
  assert.equal(calls, 0);
  key = 'test-only-secret';
  assert.equal((await get()).quotes.length, 33);
  assert.equal(calls, 33);
  key = '';
  assert.deepEqual((await get()).quotes, []);
});

test('concurrent visitors share one refresh, credentials stay in headers, and the cache limits polling', async () => {
  let now = NOW, calls = 0;
  const get = createQuoteService({apiKey:() => 'test-only-secret', clock:() => now, sleep:async () => {}, fetcher:async (url, options) => {
    calls++;
    assert.equal(options.headers['X-Finnhub-Token'], 'test-only-secret');
    assert.equal(new URL(url).origin, 'https://finnhub.io');
    assert.equal(new URL(url).searchParams.has('token'), false);
    assert.ok(SYMBOLS.includes(new URL(url).searchParams.get('symbol')));
    return response(valid(now));
  }});
  const batches = await Promise.all(Array.from({length:20}, () => get()));
  assert.equal(calls, 33);
  assert.equal(batches[0].status, 'ok');
  assert.equal(JSON.stringify(batches).includes('test-only-secret'), false);
  await get(); assert.equal(calls, 33);
  now += REFRESH_MS + 1;
  await get(); assert.equal(calls, 66);
});

test('unsupported symbols are unavailable individually instead of becoming zero-dollar quotes', async () => {
  const get = createQuoteService({apiKey:() => 'key', clock:() => NOW, sleep:async () => {}, fetcher:async url => response(new URL(url).searchParams.get('symbol') === 'ARM' ? {c:0, dp:null, t:0} : valid(NOW))});
  const data = await get();
  assert.equal(data.status, 'partial');
  assert.deepEqual(data.unavailable, ['ARM']);
  assert.equal(data.quotes.length, 32);
  assert.ok(data.quotes.every(quote => quote.price > 0));
});

test('provider outages retain only actual cached quotes, mark them stale and expire them', async () => {
  let now = NOW, fail = false;
  const get = createQuoteService({apiKey:() => 'key', clock:() => now, sleep:async () => {}, fetcher:async () => {
    if (fail) throw Error('provider failed');
    return response(valid(now));
  }});
  await get();
  now += REFRESH_MS + 1; fail = true;
  const cached = await get();
  assert.equal(cached.status, 'stale');
  assert.ok(cached.quotes.every(quote => quote.stale));
  assert.equal(cached.quotes[0].price, 110);
  now += MAX_CACHE_MS + 1;
  const expired = await get();
  assert.equal(expired.status, 'unavailable');
  assert.deepEqual(expired.quotes, []);
});

test('authentication and rate limits stop the batch and back off without exposing provider errors', async () => {
  for (const [status, expected, delay] of [[401,'authentication_failed',REFRESH_MS],[429,'rate_limited',120000]]) {
    let calls = 0;
    const get = createQuoteService({apiKey:() => 'test-only-secret', clock:() => NOW, sleep:async () => {}, fetcher:async () => {calls++; return response({error:'test-only-secret'}, status);}});
    const data = await get();
    assert.equal(data.status, expected);
    assert.equal(data.refreshAfterMs, delay);
    assert.ok(calls <= 6);
    assert.equal(JSON.stringify(data).includes('test-only-secret'), false);
    const count = calls;
    await get(); assert.equal(calls, count);
  }
});

function res() {
  return {headers:{}, setHeader(key,value){this.headers[key]=value;}, end(body){this.body=body;}};
}
test('HTTP handler handles missing configuration, HEAD and methods without leaking internals', async () => {
  const handler = createHandler(createQuoteService({apiKey:() => ''}));
  const missing = res(); await handler({method:'GET'}, missing);
  assert.equal(missing.statusCode, 503);
  assert.equal(JSON.parse(missing.body).status, 'configuration_required');
  assert.equal(missing.headers['Cache-Control'], 'no-store');
  const head = res(); await handler({method:'HEAD'}, head);
  assert.equal(head.body, undefined);
  const post = res(); await handler({method:'POST'}, post);
  assert.equal(post.statusCode, 405);
});
