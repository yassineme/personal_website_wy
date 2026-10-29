# Website forms → your Google Sheet

Updated on 29 October 2026. The five tabs are created and verified in the existing Google workbook. The standalone Apps Script project is installed under yassine.medjati@gmail.com, setupSheet and installNotifications completed successfully in Google, and version 1 is deployed as a web app. OWNER_EMAIL is hello@wyassine.com. The user entered the signing key in Script Properties. The cloud receiver and email timer are active; no delivery test was sent.

The local website .env.local now contains WEBSITE_FORMS_URL and the existing WEBSITE_FORMS_SECRET while preserving other variables. It is ignored by Git and must not be committed. WEBSITE_FORMS_URL is configured in Vercel Production. The owner must save the matching WEBSITE_FORMS_SECRET in the prepared Secret/Production form before manually publishing the website. Existing CV settings have been preserved. No production form was submitted.

Cloud project: [Website submissions — wyassine.com](https://script.google.com/u/3/home/projects/1yqMHHxYuzZmvB6voTP9rzopr-DtD8W-ZA8fX_l7Z8jJHl6_t_48M2qrx/edit).

The project is standalone because launching a bound project from the Sheet failed. It writes to the configured Sheet ID and supports retries by Request ID. Sheet menus apply only to a bound installation.

Target: [Contact_sheet_wyassine_web](https://docs.google.com/spreadsheets/d/1xmwmDzMNpPYr8urnHLEWz0zPD0Qh-0bajSTsdP53hts/edit). Read-only inspection found one default tab, Sheet1, with no values in A1:E5. Sheet1 was preserved. The added tabs are Submissions, Enquiries, PIN requests, PDF requests and Guide. Headers, formulas, dropdowns and formatting were read back; Google-rendered layouts were checked.

## Review the local files

- `Code.gs`: receiver, tab setup, owner notifications and three acknowledgement templates in `autoReply_`.
- `appsscript.json`: Berlin timezone and permissions for Sheets, sending mail and installing the timer. No inbox-read permission.
- `schema.json`: tab names, column order and review statuses.
- `EMAIL-PREVIEW.md`: exact email copy with example references for review.
- `outputs/website-submissions-20261029/Website Submissions.xlsx`: local structural preview; request views are initially empty and receive their native formulas when you run `setupSheet`. Do not replace your existing Google workbook with an imported copy.

Flow: enquiry / PIN request / PDF request → website server → signed Apps Script request → private Google Sheet → queued owner email + visitor acknowledgement. The website confirms receipt only after storage succeeds. Emails are asynchronous; receipt on the website does not promise inbox delivery.

The three submission forms use this receiver. The eight-digit PIN unlock form authenticates access and does not create a new request. Cal.com owns appointments; mailto links open the visitor’s email app. Neither submits to this Sheet. Booking synchronization would require a separate Cal.com webhook integration.

## 1. Apps Script is installed in Google

The standalone project linked above already contains Code.gs and appsscript.json. Local copies remain available for review and future changes. Do not create a duplicate project.

Use the Google account that should own the Sheet and send the emails. MailApp sends from the account authorizing the script; `OWNER_EMAIL` controls notification delivery and reply-to, not the From address. This code does not claim to send from `hello@wyassine.com` as a Gmail alias.

## 2. Tabs are already created in Google

The following tabs are already present. Once Apps Script is installed, `setupSheet` can be run again to verify and maintain their layout:

| Tab | Purpose |
| --- | --- |
| Submissions | Master log; edit Review status and Owner notes here. |
| Enquiries | Automatic filtered view of enquiries. |
| PIN requests | Automatic filtered view of access requests. |
| PDF requests | Automatic filtered view of résumé requests. |
| Guide | Operating instructions and recovery steps. |

The target Sheet ID is already configured in `Code.gs`. `setupSheet` needs no secret or owner email and sends no mail. It preserves Sheet1 and does not clear unrelated tabs. It checks existing named tabs before overwriting their structure. It sets the workbook timezone to Europe/Berlin. You can rerun it safely on the generated structure. Keep the three view tabs free of manual edits so their formulas can expand.

Columns A:M preserve the earlier local log schema. N:Q add separate auto-reply status, time, attempts and last-attempt time. Upgrading a prior 13-column Submissions log marks old auto-replies Skipped, so past visitors do not suddenly receive acknowledgements.

## 3. Configure Script Properties

In **Project Settings → Script Properties**, add:

| Property | Value |
| --- | --- |
| OWNER_EMAIL | `hello@wyassine.com`, or your preferred notification/reply mailbox |
| WEBSITE_FORMS_SECRET | The same 64-character signing key used by the website server |
| SPREADSHEET_ID | Optional override; omit to use the Sheet you linked |

The existing local signing key is in `.secrets/local-config.json`. Copy it on this Mac without printing it:

```sh
node -e 'process.stdout.write(JSON.parse(require("fs").readFileSync("/Users/yassine/Documents/Talent applications/website-submissions/.secrets/local-config.json","utf8")).formsSecret)' | pbcopy
```

Store it only in Script Properties and the website server’s secret settings. Do not put it in Sheet cells, browser JavaScript, screenshots or Git. It is separate from the CV PIN and encryption key.

## 4. Receiver deployment is complete

Version 1 is deployed with Execute as Me and Who has access Anyone, after explicit approval. The script still requires a valid HMAC signature on recent submissions. Its URL is:

https://script.google.com/macros/s/AKfycbyqhPLX2St3LNbQ3wVWAMPeeQBItJr6zJMBbIriaA2qmy8q0KLbYiJ99fM6ithIT_sA/exec

The following steps describe future updates, not work still pending.

Choose **Deploy → New deployment → Web app**:

- Execute as: **Me**, the account that owns/sends this workflow.
- Access: **Anyone**, so your server can call it without a Google login.

Only requests signed by your website server with a recent timestamp are accepted. GET returns a service health message, never submission contents. Keep Sheet sharing **Restricted**. Copy the deployment URL ending in `/exec`; `/dev` is not the production endpoint. Your Google account must allow this web-app access setting.

Later script edits require a new version under **Manage deployments**. Git pushes do not update Apps Script versions.

## 5. Configure the website server manually

When you are ready to publish, add these variables in your hosting project:

| Name | Value |
| --- | --- |
| WEBSITE_FORMS_URL | The Apps Script `/exec` URL |
| WEBSITE_FORMS_SECRET | Exactly the same signing key as Script Properties |

Keep `CV_ACCESS_PIN` and `CV_DATA_KEY` configured for the existing CV gate. Do not replace them with the forms signing key. This implementation uses no Resend key.

See `MANUAL-TRANSFER.md` for local website files and test commands. You review, commit and push main yourself. The Vercel receiver URL has been saved for the next production deployment. No website deployment has been created.

## 6. Email timer is installed

`installNotifications` completed successfully and the Triggers page shows one time-based sendPendingNotifications trigger. To recreate a missing timer later, select `installNotifications` and run it. This installs one five-minute timer for `sendPendingNotifications`. Running it again does not duplicate the timer for the same account. Have only the intended owner install it.

Each new request queues two independent emails:

1. Owner notification: visitor details/message, private Sheet link and Reply-To set to the visitor.
2. Visitor acknowledgement: request-specific receipt, Reply-To set to OWNER_EMAIL, with no submitted message, PIN, CV attachment or approval promise.

Changing Review status never sends an email, grants CV access or distributes a PDF. Share those personally after review.

## Delivery and recovery

The script sends at most 20 emails per timer run and checks remaining Google recipient quota. Both emails count against quota. Pending mail stays queued when quota runs out; the original row remains saved. A persistent guard limits new submissions to 200/day in UTC.

Sent means Google accepted the send; it does not prove inbox delivery. Uncertain failures or abandoned Sending states become Needs review instead of being automatically resent. Inspect delivery first. Set the Script Property `RETRY_REQUEST_ID` to the exact Request ID from the master log, then run `retryOwnerNotificationById` or `retryAutoReplyById`. A successful retry clears that property. The other email’s state is preserved. Historical auto-replies marked Skipped are not sent.

Google’s documented limits currently include 100 recipients/day for consumer accounts and 1,500/day for Workspace; limits may change and are shared with other scripts. With two recipients per submission, the consumer quota can cover at most 50 complete pairs/day before other use. See [Google’s quota documentation](https://developers.google.com/apps-script/guides/services/quotas).

Do not sort/filter only part of the master table. Avoid sorting or moving master rows while the timer is processing emails. Use the separate view tabs to browse by request type. Preserve header order and view formulas.

## Local validation and eventual activation

`npm run test:forms` from `external-website/` exercises the real relay and Apps Script code in an in-memory Google mock, including storage acknowledgement, HMAC validation, deduplication, independent email queues, quota, failures and legacy migration. It does not call Google or send emails. Native Google execution and actual delivery remain unverified until you perform the manual setup.

Local UI preview: `node cv-digital-twin/preview-protected.cjs` from this workspace, then open `http://127.0.0.1:8772/contact` or `/digital-cv?request=pin` / `?request=pdf`. It saves requests to the private local outbox and sends no emails.

After your manual activation, verify one of each request type yourself, inspect the master log and filtered views, and confirm both emails. We have not submitted any production form.

## Official implementation references

- [Apps Script web apps and owner execution](https://developers.google.com/apps-script/guides/web)
- [MailApp sender options, reply-to and quota](https://developers.google.com/apps-script/reference/mail/mail-app)
- [Apps Script quotas](https://developers.google.com/apps-script/guides/services/quotas)
