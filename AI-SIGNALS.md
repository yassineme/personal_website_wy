# AI Signals

The homepage retains its three-layer glass stack, 5.5-second headline rotation, pause control and expandable reader. The stack adds a small new-since-last-visit indicator only when there are unseen story groups. Motion settings never stop network refreshes.

## Collection and selection

Seventeen registered publisher feeds cover company announcements, independent reporting, practitioners and policy institutions. The registry in `lib/ai-signals.cjs` includes OpenAI, Google DeepMind, Hugging Face, NIST, Google AI, Mistral, Microsoft AI, MIT News, AWS Machine Learning, NVIDIA, Ars Technica, The Decoder, Simon Willison, One Useful Thing, AI as Normal Technology, Interconnects and the UK AI Security Institute. Mixed-topic feeds have an AI relevance filter. All article links must use HTTPS on the registry's approved domains; Hugging Face community paths are excluded.

Feeds are fetched concurrently with an eight-second timeout and a 5 MB size limit. XML with entity or doctype declarations is rejected. Publisher excerpts are converted to plain text, including HTML entity decoding, and displayed with DOM text nodes. Future-dated, undated and older-than-30-day incoming reports are excluded. Existing historical reports remain in the archive for up to 180 days, subject to a 1,500-report bound.

The visitor-triggered service checks shared collection timestamps and caches in memory for five minutes. CDN caching is limited to 60 seconds plus a 60-second revalidation window. Browser requests revalidate. There is **no scheduled collection**, paid search or LLM API. When nobody visits, collection stops. The API collects on arrival and when a visible page polls every five minutes. Partial publisher failures preserve previous reports; a complete outage keeps the last collection and its real successful-check timestamp.

`lib/signals-archive.cjs` groups similar titles within a seven-day window, excluding conflicting version numbers. This is conservative matching rather than semantic AI grouping: different phrasing can remain separate. Groups retain stable IDs, original links and all their constituent reports. The homepage shows up to 24 recent groups, newest first and capped at four per primary publisher.

## Reader and archive

The reader provides search, the five topic filters, New and Saved filters, publisher dates, source links, related reports, bookmarks, copy-link and permanent-link controls. The selected homepage bubble opens expanded. Existing dismissal and restore controls remain available.

`signals.html` provides the full retained history, publication-date filters, pagination and the same reader controls. A URL such as `signals.html?story=<group-id>` opens the selected story first. If it falls outside retention, the page says so. Saved browser copies remain available in the Saved filter.

Business questions are fixed prompts chosen using topic rules. They are labelled **Automatic topic-based prompt**, not article summaries or Yassine's commentary. Publisher excerpts retain a separate label. There are no fabricated human endorsements or automated article summaries.

An optional AI Zeitgeist JSON request selects a recent, short attributed quotation once per Berlin calendar day, including its speaker, source date, upstream context, original source, curator and declared CC BY 4.0 licence. A small independently inspected fallback is labelled Saved selection and expires after seven days. Context adaptations are labelled. Dataset failures do not block the news. During verification, direct connections to the upstream dataset were reset; the saved fallback was verified in the browser.

## Browser state

`signals-core.js` handles bookmarks, search filters and visit baselines. A first visit establishes a baseline without marking everything new. A visit continues for 30 minutes of inactivity; a later visit compares against previously encountered group/report IDs and discovery timestamps. Extra reporting on an encountered group does not count as a new announcement. New indicators persist during that browsing session until Mark as seen is chosen. Forget reading history resets the baseline.

Saved stories (up to 200 copies), paused motion and dismissal preferences stay in this browser. They do not sync between devices. No visitor baseline or bookmark data is sent to the API. The privacy notice describes the local state.

## Storage and deployment

Local development persists history in the ignored `.signals/archive.json` directory, blocked from preview static serving. Writes use revision comparison, a lock and atomic rename. Production supports an Upstash Redis REST store with atomic compare-and-set and merge/retry on conflicting writes. A production function without storage credentials reports `storage: unconfigured` and continues serving current news without claiming durable shared history.

Follow [SIGNALS-STORAGE-SETUP.md](SIGNALS-STORAGE-SETUP.md) to connect the server-only credentials in the existing Vercel project. No database is connected yet. The reviewed changes are prepared for the owner to commit and push manually from `Documents/personal_website`. Production publication remains pending. Scheduling stays disabled.

The API accepts GET and HEAD only. `?view=archive` returns retained groups; the default endpoint returns the homepage collection. `vercel.json` bundles the fallback JSON assets and allows 30 seconds for collection and storage. The blog builder includes the shared scripts for future posts.

## Verification

```sh
npm run test:signals
npm run refresh:signals
npm run preview:signals
```

The regression suite covers source/XML/URL filtering, outages, entity handling, TTL, coalescing, grouping and version distinctions, history retention, stable identifiers, local persistence, stale-write rejection, shared-store request construction, conflicting-writer merging, visit baselines, extra-report handling, combined filters, attribution and paused-motion refreshes.

Browser checks cover the unchanged homepage stack, reader controls, bookmarks across page navigation, combined search and topics, publication-date filtering, empty results, permanent links, labelled business prompts and the attributed fallback. Desktop and phone layouts are checked separately. Shared production storage still requires configuration and live verification.
