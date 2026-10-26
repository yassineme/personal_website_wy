# AI Signals

A continuously cycling glass notification stack on the seven public pages. The front bubble appears automatically, with two translucent cards receding behind it. A new headline drops into the stationary glass surface every 5.5 seconds, looping indefinitely through the current collection. The `01 / 16` counter and “Headlines in rotation” caption make clear that these are rotating stories, not claims of newly published alerts.

Click the front bubble to expand a glass reading view. The selected story is expanded first, followed by every other undismissed story in the collection. The expanded list is manually scrollable so the reading position stays still. Stories can be expanded, dismissed, restored, or opened at their original source. Dismissing every story leaves a bubble that still opens the restore control and source list.

The homepage stack sits below the introduction, with room for the main navigation, headline and contact action. On other pages it floats at the lower right, with reserved page-end space so footer links remain accessible. On phones the homepage stack follows the introduction naturally; other pages keep the compact floating stack. There is no browser notification permission or notification sound.

Autoplay pauses on hover, keyboard focus, touch-down, hidden tabs, and while the reader is open. A pause/resume control saves the preference in this browser; the down arrow advances manually and wraps around at the end. The website’s existing “Pause motion” button also pauses the stream. Reduced-motion preferences disable automatic cycling and transitions; the next-headline button remains available. Escape closes the reading view and returns focus to the bubble. Repeated headlines are not announced to screen readers (`aria-live="off"`), and decorative rear cards are hidden from accessibility APIs.

## Sources and selection

The fixed source registry is in `lib/ai-signals.cjs`: OpenAI News, Google DeepMind, Hugging Face’s official blog, and NIST’s information technology RSS feed. No X API, paid news service, LLM summaries, arbitrary user-provided feed URLs, or general web scraping are used. Hugging Face community URL paths are excluded; NIST entries must mention AI or related research. Company announcements reflect their publishers’ perspectives, not independent verification or an endorsement by Yassine.

Only HTTPS links on approved source domains are accepted. Feed XML is bounded to 5 MB, fetched with an 8-second timeout, rejects entity/doctype declarations, and is parsed using `fast-xml-parser`. Excerpts become plain text and are rendered using DOM text nodes. Undated, invalid, future-dated and older-than-30-day items are excluded; duplicate URLs are removed. A round-robin presentation shows a range of publishers rather than allowing a prolific source to dominate. Up to 16 items are collected; the expanded reader shows every undismissed story (up to 16).

## Vercel operation

`api/ai-signals.js` is a native Node function, automatically exposed at `/api/ai-signals` by Vercel. `vercel.json` bundles the saved JSON collection and sets a 15-second maximum duration. Existing static pages stay at their current paths. No environment secrets or additional accounts are required for the feed itself.

The endpoint refreshes **on demand**, coalesces concurrent requests within a function instance, and caches the collection for 15 minutes in memory. The response also uses Vercel CDN caching (`s-maxage=900`, `stale-while-revalidate=3600`). Pages check on load and every 15 minutes while visible; explicitly paused pages do not poll. Visual autoplay uses its own 5.5-second timer and does not trigger extra network requests. Publisher feed delays, CDN revalidation and outages mean this is near-real-time, not an instantaneous alert service. There is no paid cron schedule or guaranteed background scan when nobody is visiting.

The implementation uses public RSS and existing Vercel capacity; actual hosting cost depends on your Vercel plan and usage allowances. It does not enable upgrades, paid add-ons, or billing changes.

If a source fails, its previous items and last-success timestamp are retained when available, and that source is marked delayed. A full outage shows a saved edition. The checked timestamp is distinct from the last successful update timestamp. Local `file://` pages use the bundled snapshot and display **Saved edition** rather than suggesting a live connection. Without Vercel hosting, the snapshot will not refresh automatically. Old items disappear after 30 days.

## Local development

```sh
npm ci
npm run test:signals
npm run refresh:signals
npm run preview:signals
```

Preview at `http://127.0.0.1:4173`. The preview server serves the same API handler as Vercel. `refresh:signals` replaces the JSON and browser-compatible JS snapshot only after verified articles have been collected. The snapshot is data, not an independently authored blog post, and the tray links readers to the publishers and to Yassine’s original blog.

The blog publisher (`scripts/build_blog.py`) includes all three signal assets with correct article-relative paths, so future posts retain this feature.

## Deployment

Deploy these changes to the **existing wyassine.com Vercel project**, using its current account/team and domain. Use the existing static/Other framework configuration; the `api/` directory provides the Node endpoint. Do not change the project’s domain or enable a paid schedule. Verify `/api/ai-signals` returns JSON with current `checkedAt`, correct source status and real article links, then verify the automatic stack on the homepage and a nested blog article, and open both reading views.

The current session has no connected Vercel plugin or CLI login; the plugin connection has been suggested. Local implementation does not itself publish to wyassine.com.

Validation: Node tests cover XML/date/URL filtering, community exclusion, NIST relevance, Atom feeds, malformed XML, feed failure retention, partial failure, concurrent cache requests/TTL/retry, and method rejection. The new production dependency audit reports no known vulnerabilities. Existing legacy Tailwind development dependencies have separate audit findings outside the news runtime.

Design verification: checked the 5.5-second automatic advance, a complete 16-story wraparound, selected-story expansion, all-story dismissal and restoration, and phone/desktop layouts in the browser. The news collector and eight backend tests remain unchanged.
