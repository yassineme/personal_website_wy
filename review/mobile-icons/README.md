# Mobile SVG icon fix

Replaces text northeast arrows with monochrome inline SVGs across static pages, server-rendered contact/CV forms, AI Signals, Privacy links and booking fallbacks. Dynamic script URLs are versioned to refresh cached files.

The patch is prepared against the local personal_website checkout. It has not been applied, committed, pushed or published.

Apply and review manually:

```bash
cd "/Users/yassine/Documents/personal_website"
git apply --check "/Users/yassine/Documents/Talent applications/external-website/review/mobile-icons/mobile-svg-icons.patch"
git apply "/Users/yassine/Documents/Talent applications/external-website/review/mobile-icons/mobile-svg-icons.patch"
git diff --check
git diff
```

Verification: JavaScript syntax checks passed. Local mobile inspection confirmed SVGs in Blog, rotating AI Signals, experience and Privacy links, including the Signals dialog. Homepage and blog have no remaining text northeast arrows or horizontal overflow at 390px. Privacy and private CV tests: 31 passed. Submission tests: 23 passed in an isolated temporary fixture using the existing website-submissions/schema.json (the working source apps-script directory lacks its schema file). Patch application check against personal_website passed.
