# Native AI markets — Finnhub integration

The approved native ticker now receives actual Finnhub quotes through `/api/ai-markets`. No sample-price fixtures or TradingView widgets remain. All 33 US-listed stocks / ADRs share USD formatting. The Instrument Sans pill, compact disclosure, full-company-name tooltips, selection, keyboard controls and reduced-motion support are preserved.

## Configuration

Set `FINNHUB_API_KEY` on the server. For local preview, put it in the ignored, private `.env.local` file at the website root. The preview re-reads this one setting on each request, so changing it requires no restart. This file must never be committed or served. It is blocked by the preview server’s dot-file rule. The key is sent only to Finnhub in the `X-Finnhub-Token` header; it is never put in browser code, a browser URL or an API response.

Start local preview with `node scripts/preview-signals.cjs 4180` (the existing default remains port 4173). The same script serves AI Signals and the market endpoint. No new dependencies are required.

The Vercel handler uses the server environment variable. The localhost-only design gate has been removed for the owner-requested production release. Configure FINNHUB_API_KEY in the existing Vercel project’s Production environment before deployment. The owner is handling public-display permissions separately; no provider permission request has been sent.

## Update and failure behavior

The pill switches to another available company about every five seconds, using a 140ms fade-out and 220ms fade-in with a subtle two-pixel vertical movement. Its border and dimensions stay still. Hover, focus, expansion and pause cancel an in-progress transition cleanly; reduced-motion preferences disable the animation.

The browser checks every 75 seconds while visible; pausing ticker rotation does not pause quote updates. Only companies with available quotes enter automatic rotation. A selected company stays pinned until rotation resumes. Hidden tabs stop polling and check again when visible.

The server coalesces simultaneous requests into one bounded refresh and caches the watchlist for 75 seconds. Requests are sent in batches of six, separated by 300ms. Authentication failures and rate limits stop further batches; rate limiting delays the next refresh by two minutes. Provider timeouts and malformed prices never turn into zero-dollar quotes. An unsupported company gets an unavailable dash while the other stocks continue to work.

Only actual previously fetched quotes may be retained after an outage, with an older-data status. They expire 15 minutes after retrieval. Responses include each quote’s provider timestamp as well as its retrieval time. The pill tooltip shows the actual quote timestamp; the footer says when the feed was checked. Outside market hours, the latest available trade can be from an earlier session. Polling frequency does not establish exchange latency, and the UI does not claim tick-by-tick streaming.

The cache and rate budget are in memory per server process. Before scaling across multiple production instances, configure a shared cache/rate budget or account for the resulting aggregate usage in the provider plan.

Missing or rejected credentials produce an unavailable/disconnected state, not illustrative prices. HTTP error responses are sanitized and never include raw provider errors. The endpoint accepts GET/HEAD only and has a fixed 33-symbol allowlist; callers cannot proxy arbitrary URLs or symbols.

## Verification

Run `npm run test:markets`. Tests cover valid/invalid quotes, percentage-change fallback, zero change, missing credentials, concurrent refreshes, caching, unsupported symbols, stale expiry, authentication failure, throttling, credential redaction and HTTP methods. Successful local integration was also checked against Finnhub for all 33 symbols and in the actual website UI.

Provider reference: https://finnhub.io/docs/api/quote
