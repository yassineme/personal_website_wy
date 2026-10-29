# Digital CV: local PIN and manual approval revision

**Status: prepared in this Git checkout for local review. The prior checkout was backed up before transfer. The Google receiver and email timer are active, and WEBSITE_FORMS_URL is configured in Vercel Production. The website has not been staged, committed, pushed or deployed. The owner publishes manually.**

## Visitor flow

- Homepage “Explore my experience” and “my experience” links open `/digital-cv` directly.
- Signed-out visitors see a fully blurred visual CV background, eight individual PIN boxes in two groups of four, separated by a dash, and “Request it from me”.
- The blurred facade at `assets/cv-locked-preview.html` contains public identity/artwork and layout placeholders; the actual professional CV text remains encrypted until the server accepts the PIN.
- The server accepts exactly eight digits, including a leading zero. Existing secure session-cookie, expiry, PIN-attempt throttle and same-origin form checks are retained.
- “Request PDF résumé” opens a request form rather than downloading a file. The legacy `?download=pdf` endpoints redirect to that form, even after login. No PDF is bundled in the encrypted website payload.
- PIN and PDF requests collect name, reply email and an optional message. Owner notifications go to `hello@wyassine.com` by default; visitors receive a separate automatic acknowledgement. The owner reviews and replies manually; no PIN or résumé is automatically sent to visitors.
- The former public résumé page redirects to the PIN gate. The two public PDF copies have been moved out of this local deployable website into the private local archive. Their old URLs redirect to the PDF request form when the configuration is manually published.

## Local preview

From `/Users/yassine/Documents/Talent applications`:

```sh
node cv-digital-twin/preview-protected.cjs
```

Open `http://127.0.0.1:8772/` for the homepage or `/digital-cv` for the PIN gate. This preview uses an injected local notification sink: requests are saved to `cv-digital-twin/.secrets/request-outbox.jsonl`. **It does not contact an email provider or send emails.** Successful preview submissions explicitly say so. Use example.invalid addresses for testing.

The local PIN is in `../cv-digital-twin/.secrets/LOCAL-CV-ACCESS.txt`; it has not been applied to production. Its key and PIN are stored in `local-cv-access.json` in the same private directory. The earlier live password file has been preserved separately.

## Settings for your eventual manual publication

Do this only after you have reviewed and approved the source:

- `CV_ACCESS_PIN`: the eight-digit PIN you choose, without the visual dash. The local sample PIN is in the owner file above.
- `CV_DATA_KEY`: preserve the existing server key. The local revision reuses it; it is not derived from the PIN.
- `WEBSITE_FORMS_URL`: the Apps Script web-app `/exec` URL you manually deploy.
- `WEBSITE_FORMS_SECRET`: the 64-character signing secret from the local forms configuration; use the same value in Apps Script Script Properties.

No Resend account, Resend API key or sender-domain verification is required. The former `RESEND_API_KEY`, `CV_REQUEST_FROM`, `CV_REQUEST_TO` and `CV_ACCESS_PASSWORD` settings are unused by this revision. Hosting variables are managed separately from Git. The forms signing key must match Apps Script; production settings take effect on a new deployment.

All website forms post to their own website server. The server signs a minimal request and sends it to Apps Script. The script accepts only correctly signed recent requests, appends one row per request ID to the private Google Sheet, and returns a storage acknowledgement. The website reports receipt only after that acknowledgement.

An Apps Script timer sends owner notifications and visitor acknowledgements through separate delivery queues every five minutes. Rows stay queued if Google’s email quota is exhausted. Failed or uncertain deliveries are marked Needs review, with a manual retry option in the Sheet. The visitor’s email is used as reply-to. No visitor receives an automatic PIN, PDF or attachment; Review status changes do not send emails. No CV PIN, encryption key, cookies or visitor IP address is included in submissions.

The Google account that authorizes Apps Script is the email sender. The owner notification recipient is set separately as `OWNER_EMAIL` in Script Properties. Keep the Sheet’s sharing Restricted. The supplied Sheet is configured in the active standalone Apps Script project. The receiver and email timer are installed; Google setup does not publish this website.

See `apps-script/SETUP.md` for Google setup and maintenance. Apps Script source is retained in `apps-script/` for version history; a website push does not update its cloud deployment.

## Files to review and manually transfer

The reviewed source has been transferred into this checkout. All website changes remain unstaged for the owner to review. Existing local changes and the previous public PDFs were backed up before transfer.

Review `ai-markets.css`, `privacy.html`, `api/contact.js`, `lib/contact.cjs`, `lib/website-submissions.cjs`, `tests/website-submissions.test.cjs`, `index.html`, `mydigital-resume.html`, `vercel.json`, `api/digital-cv.js`, `lib/private-cv.cjs`, `lib/cv-access-ui.cjs`, `lib/cv-pin-entry.cjs`, `lib/cv-request-mail.cjs` (compatibility shim), `lib/private-cv-content.json`, `assets/cv-locked-preview.html`, and `tests/private-cv.test.cjs`.

Include these deletions when you manually apply the revision to your checkout, so they cannot remain public files:

- `assets/Yassine-W-Medjati-Resume.pdf`
- `assets/YassineW.Medjati_Resume.pdf`

The preserved local copies are in `../cv-digital-twin/.secrets/previous-public-copies/`. Your original optimized PDF is also untouched in the task workspace. Do not copy `.secrets/` or the old `.release/` snapshot into the website. The old automatic release and live verification scripts have been disabled.

## Rebuild and check locally

```sh
python3 cv-digital-twin/build.py
node --test external-website/tests/private-cv.test.cjs
```

The builder updates standalone/GSite files and the public visual facade; `protect.cjs` refreshes the encrypted HTML only. GSite request links target the intended website request route and will need your manually published revision before that route can send notifications.

The backend checks cover PIN format, sessions, locked-content separation, direct-PDF blocking, requests, owner-notification and visitor-acknowledgement payloads, sender failures, throttles, form tokens and duplicate submission. Browser checks used only localhost. Both sample approval requests were written to the local outbox; no real emails were sent.

## Latest local polish

The PIN is displayed as `XXXX-XXXX`, with eight individual boxes and a decorative dash. Pasting accepts either format. Keep the environment value as eight digits without a dash. The homepage markets panel, company tooltips, and quote indicators use the existing `--paper`, `--ink`, and `--muted` colours. Include `ai-markets.css` in your manual copy and Git staging list as well as the CV files.

Contact navigation links now open `/contact`; booking links still use Cal.com. Include the HTML pages whose navigation was updated when transferring the local revision.
