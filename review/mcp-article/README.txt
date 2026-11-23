LOCAL MCP ARTICLE DRAFT

Audience: professionals and AI decision-makers.
Research date: 23 November 2026.

Edit body.html for the article, metadata.json for its proposed title,
description, slug and table of contents. Rebuild the preview with:
python3 review/mcp-article/build-preview.py

index.html uses the current article shell, fonts, sizes and palette.
Serve the project root and open /review/mcp-article/index.html.
The preview is noindex,nofollow and is absent from the blog index,
RSS, sitemap and content/posts.json. Nothing has been published.

Article actions live in article-actions.html, .css and .js. Share article
offers Copy link and, where supported, the device's native share sheet.
The draft shares its actual local preview URL; a future public page should
use its canonical URL. Escape and clicking outside dismiss the share panel.
The Google link uses the documented domain-level Preferred Sources deeplink:
https://developers.google.com/search/docs/appearance/preferred-sources
The reader must confirm their preference on Google; domain eligibility is
controlled by Google and is not established by adding this link.

SEO / GEO EDITORIAL APPROACH

Primary topic: Model Context Protocol / MCP explained.
Related questions: what is an MCP server; does MCP use more tokens;
best MCP servers; MCP vs API; MCP security; how to start using MCP;
which products support MCP; Codex, Claude and ChatGPT MCP connections.

The draft uses a direct definition, descriptive question headings,
an ELI5 section, concise FAQ answers, links beside factual claims,
a dated provider-documentation shortlist and relevant internal links.
The shortlist is not an exhaustive comparison or hands-on benchmark.
All examples are independent and hypothetical.

Google says its normal SEO practices apply to AI Overviews and AI Mode;
there are no special additional optimisation requirements:
https://developers.google.com/search/docs/appearance/ai-features
These choices support clarity and discoverability; they cannot guarantee
rankings, traffic or citations by generative search systems.

WHEN THE USER DECIDES THE ARTICLE IS READY

Add an entry in content/posts.json using the reviewed metadata, an actual
publication date and the existing CTA/number fields. Copy the approved
body fragment into content/posts. Review generated changes carefully:
the workspace already contains user edits to existing generated pages.
The existing blog pipeline supplies BlogPosting schema, canonical and
social metadata, index links, RSS and sitemap entries. Keep structured
data consistent with visible text. FAQ headings need no extra schema.
Any later publication remains the user's manual action.
