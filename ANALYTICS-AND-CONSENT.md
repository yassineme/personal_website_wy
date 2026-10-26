# Analytics and consent setup

Status: **GA4 and Vercel Web Analytics are enabled in the local source configuration, subject to visitor opt-in on the production hosts. Production deployment is still pending.** GA4 measurement ID `G-6J6ZX1XD2N` is configured. The owner confirmed Vercel Web Analytics is enabled in the existing project dashboard on 26 October 2026. The consent controller loads its standard production endpoint, `/_vercel/insights/script.js`, only after Vercel-specific opt-in. No new account, billing change or unconditional tracker was added.

## Activate when ready

1. Complete/review `privacy.html` (source: `scripts/build_privacy.py`), the applicable controller details, provider processing agreements, international-transfer safeguards and actual retention settings. The Impressum assessment is unresolved; an unpublished owner-review draft is in the task workspace’s `legal-drafts/wyassine-impressum-draft.md` (outside the deployable website). No address or exemption has been invented. No public Impressum link exists while `legalNoticeUrl` is empty.
2. The owner has enabled Web Analytics in the existing **wyassine.com Vercel project**. `vercelAnalyticsEnabled: true` and `vercelAnalyticsScriptPath: '/_vercel/insights/script.js'` are now configured. The existing consent controller performs initialization; no npm package or additional unconditional HTML snippet is needed for this buildless site. Deploy the source and confirm the script returns HTTP 200 on production.
3. The GA4 web stream ID `G-6J6ZX1XD2N` is already set in `gaMeasurementId`. Confirm the provider’s processing/transfer terms and property-level retention. Disable automatic Enhanced Measurement, Google Signals, advertising features and user-provided-data collection in the property. This integration deliberately sends only a sanitized page view, not booking details or contact data. Additional GA property measurement settings must be reviewed separately.
4. Owner activation is controlled by `analyticsEnabled`, now `true` following the owner’s explicit request on 26 October 2026. `privacyReviewed` remains `false` as an honest record of the unfinished notice review; it does not disable the owner-authorized analytics switch. Set `privacyReviewed: true` only after the review is actually complete. Set `legalNoticeUrl` only if a completed notice is to be published. Remove the draft warning/noindex from the privacy source only after review. Increase `consentVersion` whenever disclosed purposes/providers materially change.
5. Deploy to the existing Vercel project and verify consent in production. The production allowlist is `wyassine.com` and `www.wyassine.com`; analytics are suppressed on localhost, file previews and unapproved preview domains.

## Consent behavior

First layer: **Only essential**, **Allow analytics**, **Manage choices**. Accept and refuse are equal-sized, equally styled buttons. There are no preselected optional checkboxes, automatic consent on scroll, or forced analytics to access the site.

The settings dialog offers separate opt-ins for Vercel and Google, an always-on essential-storage explanation, and another one-click **Only essential** action. The footer always exposes Cookie settings. A choice is stored for 180 days without a random user identifier. Changed provider configuration or notice version invalidates the previous decision. Denial and malformed/missing/expired storage all default to no analytics.

Google uses **basic** consent mode: no Google SDK and no cookieless consent pings before opt-in. Advertising-related consent always stays denied. Google Signals and ad personalization are disabled in the code. Query strings/fragments are stripped from page locations and referrers. GA cookie lifetime is explicitly 180 days; server-side property retention is configured in GA itself.

Vercel is also opt-in here, even though its audience measurement is cookieless. A before-send hook checks the current decision and strips URL query data. No paid custom-event features are enabled.

Withdrawal disables Google tracking, suppresses Vercel events, removes accessible first-party `_ga`, `_gid` and `_gat` cookies, and reloads if an analytics SDK had already been loaded. Reloading removes SDK listeners/timers and enforces the stored new decision. A late Google script callback cannot initialize tracking after withdrawal. Previously sent data is not automatically erased. Privacy changes in another tab are synchronized through the storage event.

## Booking popup

`booking.js` intercepts marked Cal.com links and loads the official Cal.com SDK only after a booking click. A local accessible dialog contains the calendar, a close button and a direct Cal.com fallback. No booking script, iframe or preconnect is added on ordinary page load. A booking request is separate from analytics consent; choosing Only essential does not prevent someone from explicitly requesting the calendar. No booking was submitted during implementation.

## Checks

Run `npm run test:privacy`. The eight tests exercise default-deny behavior, independent provider choices, basic Google consent sequencing, query redaction, late-script revocation, missing configuration/privacy review, production-host gates, decision expiry/configuration changes, duplicate initialization and the actual GA4 ID behind the consent gate.

Review sources:
- https://www.baden-wuerttemberg.datenschutz.de/faq-zu-cookies-und-tracking-2/
- https://www.edpb.europa.eu/system/files/2023-01/edpb_20230118_report_cookie_banner_taskforce_en.pdf
- https://developers.google.com/tag-platform/security/concepts/consent-mode
- https://vercel.com/docs/analytics/quickstart
- https://vercel.com/docs/analytics/package

These sources inform the implementation; the banner does not by itself certify legal compliance or settle the Impressum classification.
