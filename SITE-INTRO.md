# First-visit introduction

The public website plays a short presentation intro once per browser. An ivory counter and thin line rise from 0 to 100 along the right edge of the charcoal screen. The screen then lifts to reveal the page. The percentage describes this introduction’s animation; it is not a measurement of network bytes or external feeds.

The sequence is roughly three seconds, including its exit. Returning visits do not wait. “Skip intro” and Escape close it immediately. Reduced-motion preferences bypass it, including a preference change while it is playing. If local storage is unavailable, session storage is used; if neither can remember the choice, the intro is skipped. A five-second recovery timer releases the page if rendering or resources stall. Without JavaScript the normal website remains accessible.

`site-intro.js` owns the timing and first-visit preference `ywm-intro-seen-v1`. `site-intro.css` owns the presentation. No identifiers, analytics events or network submissions are introduced. The preference is described under storage/preferences in the privacy page and generator.

The shared SEO generator adds the two assets to the eight public discovery pages; the public build packages them. Private CV and enquiry gates are unchanged. The overlay does not replace, remove or rewrite page content.

Run `npm run test:intro` for first-visit, returning-visit, motion, skip, timeout, missing-style and build integration checks. The local preview was checked at desktop and 390px phone widths, including the counter at 100 and an immediate repeat visit. To review the first visit again, use a fresh browser profile or clear this site’s local preference in browser site-data controls. Clearing all site data also clears other site preferences.

All work remains local until the owner manually publishes it.
