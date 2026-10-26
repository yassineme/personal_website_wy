# The blog: Notes on change

The blog extends the personal website's dark editorial design. It is designed for readers making AI and transformation decisions, with a clear route from a useful article to a relevant conversation.

## Current content

- **AI roadmap prioritisation:** a new five-decision guide, with a working sentence readers can use in a roadmap meeting.
- **AI adoption beyond pilots:** a new review of workflows, expectations, feedback and ongoing ownership.
- **GenAI operating model:** the existing perspective updated and restyled at its original URL.

The new articles are original proposed editorial copy for this website. Illustrative examples are labelled. Google PAIR and NIST sources are linked at the relevant claims and under further reading. No client results, testimonials or statistics have been invented.

## Add or edit an article

1. Edit `content/posts.json` for the title, URL, description, category, real publication/modification dates, table of contents and article-specific contact prompt.
2. Write the article body in `content/posts/`. Use semantic HTML, descriptive heading IDs and clear links to supporting sources. These are source fragments, not public landing pages.
3. Run `python3 scripts/build_blog.py` from the website folder. It rebuilds the index, article pages, RSS feed and sitemap using the standard Python library. No package installation is required.
4. Review the generated article and its links at desktop and mobile widths before publishing.

New article URLs normally use `blog/descriptive-topic.html`. Set `featured` to true on one article. Reading times are calculated from article word counts. Topic buttons come from the categories in the build script; add a new category there when needed.

## Editorial approach

Choose a specific problem a prospective client would recognise. Explain a useful decision frame, show a clearly labelled example, and leave the reader with questions or a working method they can use. Close with a conversation prompt relevant to that problem. Tie internal links to the next useful article or to the author's experience.

Keep claims grounded in supplied experience or verified primary sources. Keep personal experiences and client outcomes factual. Research current technical, regulatory or product details before making claims about them. Prefer useful evergreen pieces to superficial trend coverage.

## Search and discovery

Every public article has a unique title and description, canonical URL, BlogPosting and BreadcrumbList structured data, author details, source links, related articles and a contextual contact route. The index uses Blog structured data and standard crawlable article links. The RSS feed is `blog/feed.xml`; the sitemap includes the blog and article URLs.

All article text is present in the generated HTML. Search and topic filtering enhance the index with JavaScript; reading and navigation work without it. Search includes the editorial title, search title, description, category and excerpt.

These technical foundations support discovery; traffic and conversion results depend on publication, content quality, distribution and ongoing work. No analytics or third-party tracking has been added.

## Personal identity

The approved symbol appears beside the name in the site headers. The website uses `assets/brand/logo-ivory.png`, prepared from the approved transparent stencil without changing its silhouette. Browser and app icons include 16, 32, 48, 180, 192 and 512 pixel versions. `favicon.ico`, `assets/favicon.png` and the web manifest use the symbol on the site's near-black background.

## Verification

Static checks cover local links and fragments, unique IDs, accessibility references, JSON-LD parsing, sitemap and RSS XML, favicon structure and app icon references. Browser checks cover desktop and phone layouts, search, topic filtering, the empty state, article navigation, share feedback and homepage access to the blog.

Deployment remains separate from these local changes.
