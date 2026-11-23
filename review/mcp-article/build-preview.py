"""Build only the local article draft using the current site's article shell."""
from pathlib import Path
import html
import json
import math
import re

HERE = Path(__file__).resolve().parent
ROOT = HERE.parents[1]
metadata = json.loads((HERE / 'metadata.json').read_text())
body = (HERE / 'body.html').read_text()
page = (ROOT / 'blog/ai-roadmap-prioritisation.html').read_text()
escape = html.escape

# Keep the current, user-edited article shell, typography, navigation and footer.
# This isolated draft is intentionally absent from posts.json, RSS and sitemap.
page = re.sub(r'<script\b[^>]*type="application/ld\+json"[^>]*>.*?</script>', '', page, flags=re.S)
page = re.sub(r'<meta\b[^>]*(?:name="(?:description|robots|twitter:[^"]+)"|property="(?:og:[^"]+|article:[^"]+)")[^>]*>', '', page)
page = re.sub(r'<link\b[^>]*rel="canonical"[^>]*>', '', page)
page = re.sub(r'<title>.*?</title>', '<title>' + escape(metadata['seo_title'] + ' | Yassine W. Medjati — draft') + '</title>', page)
page = page.replace('</head>', '<meta name="robots" content="noindex,nofollow">\n<meta name="description" content="' + escape(metadata['description'], quote=True) + '">\n</head>')
page = re.sub(r'((?:src|href)=")\.\./', r'\1/', page)
page = re.sub(r'<header class="article-header">.*?</header>',
    '<header class="article-header"><span class="story-kicker mono">Local draft / Strategy</span><h1>' + escape(metadata['title']) + '</h1><p class="article-deck">' + escape(metadata['excerpt']) + '</p><div class="article-byline"><a href="/about" rel="author">Yassine W. Medjati</a><span>Research checked <time datetime="2026-11-23">23 Nov 2026</time></span><span>' + str(math.ceil(len(re.sub(r'<[^>]*>', ' ', body).split()) / 200)) + ' min read</span></div></header>', page, flags=re.S)
toc = ''.join('<a href="#' + key + '">' + escape(label) + '</a>' for key, label in metadata['toc'])
page = page.replace('</head>', '<link rel="stylesheet" href="/review/mcp-article/article-actions.css">\n<script src="/review/mcp-article/article-actions.js" defer></script>\n</head>')
actions = (HERE / 'article-actions.html').read_text()
page = page.replace(' min read</span></div></header>', ' min read</span></div>' + actions + '</header>', 1)
page = re.sub(r'(<nav class="article-toc"[^>]*>).*?</nav>', lambda match: match[1] + toc + '</nav>', page, flags=re.S)
# Remove draft link-sharing controls: there is no public article URL yet.
page = re.sub(r'<div class="article-utility">.*?</div>', '', page, flags=re.S)
start = page.index('<article class="article-body" aria-label="Article text">') + len('<article class="article-body" aria-label="Article text">')
end = page.index('<section class="author-note"', start)
page = page[:start] + '<div class="article-takeaway"><span class="mono">What you can use</span><p>' + escape(metadata['takeaway']) + '</p></div>' + body + page[end:]
# The borrowed page's related list contains itself; make all three existing notes available.
related_start = page.index('<section class="related-notes"')
related_end = page.index('</main>', related_start)
posts = json.loads((ROOT / 'content/posts.json').read_text())
related = '<section class="related-notes" aria-labelledby="related-heading"><h2 id="related-heading">Keep the conversation going.</h2><div class="related-grid">'
for post in posts:
    related += '<a class="related-link" href="/' + post['url'] + '"><span class="mono">' + escape(post['category']) + '</span><h3>' + escape(post['title']) + '</h3><p>' + escape(post['excerpt']) + '</p><span aria-hidden="true">↗</span></a>'
related += '</div></section>'
page = page[:related_start] + related + page[related_end:]
page = re.sub(r'Bring your roadmap into the conversation\.', 'Choose a useful first AI connection.', page)
page = page.replace('If the priorities are hard to sequence or the ownership is unclear, let’s explore the next decision your team needs to make.', 'Let’s discuss the workflow, access and evidence your next AI experiment needs.')
(HERE / 'index.html').write_text(page)
print('Built local MCP article draft:', HERE / 'index.html')
