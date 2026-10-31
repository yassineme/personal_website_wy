# European events planner — local review

Prepared locally. Nothing has been committed, pushed or published; no live hosting or environment settings were changed.

## Open the preview

From `/Users/yassine/Documents/personal_website`, run `npm run preview:events`, then open http://127.0.0.1:8784/.

On the homepage, click/tap the bird logo **five times within three seconds**. This reveals **Open fieldnotes**. The keyboard alternative is **Alt + Shift + E** (Option + Shift + E on Mac). Reloading hides the button again.

The page opens directly at `/api/owner-events`, without a password, login cookie or environment setup. The entrance is hidden from ordinary navigation and the page is excluded from the sitemap and marked noindex. **This is an unlisted page, not a private page: anyone with the URL can open it.**

The preview serves only the generated public asset directory plus the events endpoint. It binds to 127.0.0.1. It does not call notification providers or submit forms to the live website. It does not implement the other site's backend routes. It no longer generates or reads a local events password file.

## Manual publication later

No `OWNER_EVENTS_PASSWORD` setting is needed. An existing setting has no effect on this page; no live environment settings have been changed. The existing CV access controls are separate and remain in place.

The source addition in `vercel.json` bundles the event template and data with the new function. The static build includes the UI code/styles, while the function serves the HTML and event records openly at `/api/owner-events`. Responses remain no-store and noindex. No clean-URL hosting rewrite is required.

## Content and maintenance

Edit `lib/owner-events-data.json` to update events. The initial edition records 28 events across 10 European countries: 22 dated editions and 6 watchlist records. All entries have official website links and ticket information/status. Checked on 31 October 2026. This is a curated major-event list, not a claim of exhaustive coverage.

Confirmed rates include Slush, E-world and the FT Commodities Global Summit. Other rates were not verifiable in the public organiser pages reviewed and are explicitly labelled for checking; none were estimated. Some official pages mix past and future editions. Conflicting dates stay null, with the reason in the admission notes. Reported but unverified TradeTech locations are labelled and not plotted on the map. Pins otherwise represent city centres, not precise venues.

The data is a manually researched snapshot, **not an automatic live event feed**. Review dates, prices, eligibility and source pages periodically. Update `checked` only after reviewing the records again. No automatic background research or scheduler is installed.

Topic, country, date, city and visit-status filters combine. Dated events are chronological, followed by the watchlist. Countdown days use the event's local calendar date; ongoing events show Happening now, and expired editions move to Past editions. Shortlisted/Going choices are stored only in this browser and device. Calendar export includes all dated saved events, regardless of current filters; unknown dates are omitted. All-day calendar end dates are exclusive, so multi-day events import correctly. The planner loads no analytics scripts.

## Validation

`npm run test:events` verifies direct access without credentials, GET/HEAD behavior, rejection of obsolete login/logout posts, record integrity and the unlisted entrance. `node --test tests/public-build.test.cjs` checks static-build isolation. The planner retains its map, filters, saved shortlist and calendar exports.
