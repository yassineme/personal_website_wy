# Shared AI Signals archive on Vercel

The feature is implemented locally. Scheduling remains disabled. The homepage keeps its glass stack; the reader and `signals.html` add search, topics, publication-date filters, bookmarks, new-story indicators, permanent links, related reports, topic-based business prompts and an optional attributed AI Zeitgeist perspective.

## Connect persistent storage

1. In your existing Vercel project, connect an **Upstash Redis** database using Storage / Marketplace, or create one in your existing Upstash account. Select an appropriate region and review its current plan and usage limits. This change does not itself create an account, subscribe to a paid plan or provision a database.
2. Set these **server-only** environment variables for Production (and Preview if you want a separate preview archive):

   ```text
   UPSTASH_REDIS_REST_URL=<database HTTPS REST endpoint>
   UPSTASH_REDIS_REST_TOKEN=<database read/write REST token>
   ```

   Use the read/write token, not the read-only token. Do not put either value in HTML, browser JavaScript, the repository or a `NEXT_PUBLIC_` variable. No token needs to be pasted into this chat. Use a separate database for Preview if its collected data should remain separate.
3. Deploy the updated source to the **existing wyassine.com Vercel project**. No new domain, cron entry or scheduled automation is required. The owner will commit and push the prepared changes manually from `Documents/personal_website`; publication has not been performed.
4. Open `/api/ai-signals?view=archive`. Confirm `storage` is `shared`, `items` contains story groups, and source statuses reflect recent checks. Some sources can legitimately be delayed; `status: partial` is supported.
5. Open `signals.html`, save a story and follow its permanent link. Visit again after 30 minutes with the same browser to check the next-session baseline. A first visit does not label the entire collection new.

The database holds public article metadata and short publisher excerpts, not visitor histories or bookmarks. Browser visits and five-minute visible-page polling trigger collection, subject to shared collection timestamps and CDN caching. No collection runs while the site has no visitors. Existing feeds are fetched concurrently, bounded to 5 MB each, with an eight-second timeout. No paid search or LLM API is required.

## Storage behaviour

- **Local development:** `.signals/archive.json` persists across preview restarts. This directory is ignored by Git and blocked by the preview's static-file handler. Writes use a lock, revision comparison and atomic rename.
- **Vercel with credentials:** the shared store uses authenticated HTTPS commands and an atomic Redis compare-and-set. Conflicting writers reload and merge, preserving existing reports and first-discovery timestamps. The key is `wyassine:signals:archive:v1`.
- **Vercel without credentials:** current news and browser bookmarks continue working, but the API reports `storage: unconfigured` and shared history cannot accumulate across instances. It does not pretend the function filesystem is durable storage.
- **Store failure:** continue serving the last available collection, expose `storage: unavailable`, and retry on the next collection attempt. Do not cache a fully stale outage response.

The archive keeps at most 1,500 reports within 180 days. The homepage selects up to 24 recent groups with a four-per-publisher cap. Same-announcement grouping is deliberately conservative and excludes different model versions; dissimilar headlines can remain separate. Titles and source links remain available for every grouped report. A saved browser copy remains available through the Saved filter even if the server later removes that story; its public link may then report that it is outside the retained archive.

## Content and visitor state

Publisher excerpts are labelled. Business questions are fixed, topic-based prompts, clearly labelled as automatic; they are not generated article summaries or Yassine's commentary. The optional AI Zeitgeist JSON integration displays one recent short quotation with speaker, date, upstream context, original source, curator and CC BY 4.0 link. It is supplementary and never blocks the news feed.

`ywm-signals-visit` contains local story IDs, a baseline and an activity timestamp. A visit continues for 30 minutes of inactivity. New indicators compare first-discovery timestamps and group/report identifiers, so another report about an already encountered group is not a new announcement. `ywm-signals-bookmarks` stores up to 200 saved story copies locally. Neither is sent to the archive endpoint. The archive page provides a Forget reading history action. Preferences and bookmarks do not sync between devices, and blocked browser storage means they only last for the open page.

## Verification and references

Run `npm run test:signals`, `npm run refresh:signals`, and `npm run preview:signals`. The refresh command updates the local archive and public fallback snapshot; it is not scheduled.

- [Upstash REST API](https://upstash.com/docs/redis/features/restapi)
- [AI Zeitgeist JSON and declared licence](https://aizeitgeist.tv/data/quotes.json)
- [AI Zeitgeist source list](https://aizeitgeist.tv/sources.html)
