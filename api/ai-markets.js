'use strict';
const {createQuoteService} = require('../lib/ai-markets.cjs');

function createHandler(getQuotes = createQuoteService()) {
  return async function handler(req, res) {
    res.setHeader('Content-Type', 'application/json; charset=utf-8');
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('Cache-Control', 'no-store');
    if (!['GET', 'HEAD'].includes(req.method)) {
      res.setHeader('Allow', 'GET, HEAD');
      res.statusCode = 405;
      return res.end(JSON.stringify({error:'Method not allowed'}));
    }
    try {
      const data = await getQuotes();
      res.statusCode = ['configuration_required','authentication_failed','unavailable'].includes(data.status) ? 503 : data.status === 'rate_limited' ? 429 : 200;
      if (res.statusCode === 429) res.setHeader('Retry-After', String(Math.ceil(data.refreshAfterMs / 1000)));
      res.end(req.method === 'HEAD' ? undefined : JSON.stringify(data));
    } catch {
      res.statusCode = 503;
      res.end(req.method === 'HEAD' ? undefined : JSON.stringify({provider:'Finnhub', status:'unavailable', refreshAfterMs:75000, quotes:[]}));
    }
  };
}
module.exports = createHandler();
module.exports.createHandler = createHandler;
