# Search and AI discovery — revised 30 October 2026

The public website presents independent perspectives on AI strategy, transformation leadership and adoption. Recruiters and business/advisory prospects have equal priority. Target markets are Germany, Switzerland, Luxembourg, the United States and the United Kingdom; current content is English.

## Confidentiality boundary

No employer work belongs on the public website. The former employer case study is removed from the source tree, public-build allowlist, sitemap, links and structured data. Employer names, project descriptions, use-case counts and community references are removed from public biography text and author notes. Do not substitute anonymised employer examples. The private CV and its access controls remain unchanged. AGENTS.md records this requirement, and SEO tests scan generated public pages for regressions.

## Public discovery pages

- `/about`: personal positioning, independent approach, languages, and private CV request links.
- `/ai-strategy`: independent discussion areas linked to the three original articles and enquiry form.
- `/`: clear identity and direct public discovery links.
- `/blog` and the three articles: independent perspectives and clearly hypothetical examples with primary source links.
- `/signals`: attributed public reporting, separated from original perspectives.

Shared canonical metadata, social previews, author identity, page/article schema and a sitemap cover eight public pages. Private CV gates, contact forms and noindex pages remain outside the sitemap. Wildcard crawler access includes AI search crawlers; model-training policy is unchanged. The build and blog generator both preserve shared SEO metadata.

## After the owner publishes

1. Verify Google Search Console and Bing Webmaster Tools, submit the sitemap, inspect the priority public URLs and request indexing through their ordinary interfaces.
2. Validate public structured data and canonical selection. Check production Core Web Vitals and PageSpeed Insights on desktop and mobile.
3. Align public profile links and personal positioning across existing independent profiles. Do not use employer-branded authority or solicit inauthentic mentions.
4. Monitor impressions, queries, country, clicks and qualified enquiries weekly. Separate branded discovery from broader topics and recruiters from advisory prospects.
5. Develop useful, independently authored content based on actual reader questions. Use publicly available primary sources and clearly hypothetical examples. Never disclose employer processes, outcomes or internal work.

There are no verified keyword-volume estimates or ranking baselines in this review. Avoid near-duplicate country landing pages, invented local offices and hreflang for translations that do not exist. Complete German/French editions can be considered after reviewing demand. Neither technical changes nor crawler access guarantee first-page rankings or LLM recommendations.

## Maintenance

Edit public profile/advisory copy and shared metadata in `scripts/build-seo.cjs`; their HTML is generated. Edit original articles in `content/posts/` and metadata in `content/posts.json`, then run `python3 scripts/build_blog.py`. `npm run build` generates SEO before packaging. The public build excludes private documents and server source.

Run `npm run test:seo`, `npm run test:urls`, `npm run test:forms`, `npm run test:privacy` and `npm run test:security` as appropriate. The earlier broad test run had two pre-existing AI Signals mock failures (`document.createTextNode` missing), independently reproduced before this revision. No live forms, publishing or search-engine submissions were performed.

## Primary guidance

- [Google AI features guidance](https://developers.google.com/search/docs/appearance/ai-features)
- [Google generative search guidance](https://developers.google.com/search/docs/fundamentals/ai-optimization-guide)
- [Google sitemap guidance](https://developers.google.com/search/docs/crawling-indexing/sitemaps/build-sitemap)
- [OpenAI crawler controls](https://developers.openai.com/api/docs/bots)
