#!/usr/bin/env python3
"""Build the static blog from editable metadata and article fragments. No dependencies."""
from pathlib import Path
from datetime import date, datetime, timezone
from email.utils import format_datetime
from html import escape, unescape
from urllib.parse import quote
import json, math, re, xml.etree.ElementTree as ET
ROOT = Path(__file__).resolve().parents[1]
SITE = 'https://www.wyassine.com/'
AUTHOR = 'Yassine W. Medjati'
E = escape
POSTS = json.loads((ROOT/'content/posts.json').read_text())
for p in POSTS:
    p['body_html'] = (ROOT/'content/posts'/p['body']).read_text()
    p['words'] = len(re.sub(r'<[^>]+>', ' ', p['body_html']).split())
    p['minutes'] = max(1, math.ceil(p['words']/200))
    p['date_label'] = date.fromisoformat(p['date_modified']).strftime('%d %b %Y').lstrip('0')
    p['prefix'] = '../' if '/' in p['url'] else ''
PERSON = {'@type':'Person','@id':SITE+'#person','name':AUTHOR,'url':SITE+'mydigital-resume.html','sameAs':['https://www.linkedin.com/in/yassine-medjati/']}

def article_schema(p):
    return {'@type':'BlogPosting','@id':SITE+p['url']+'#article','headline':p['title'],'description':p['description'],'url':SITE+p['url'],'mainEntityOfPage':SITE+p['url'],'datePublished':p['date_published'],'dateModified':p['date_modified'],'author':{'@id':SITE+'#person'},'publisher':{'@id':SITE+'#person'},'isPartOf':{'@id':SITE+'blog.html#blog'},'articleSection':p['category'],'inLanguage':'en','wordCount':p['words'],'image':SITE+'assets/blog-social.png'}

def head(title,description,url,prefix='',graph=None,article=False):
    schema={'@context':'https://schema.org','@graph':graph or []}
    schema_json=json.dumps(schema,ensure_ascii=False).replace('</','<\\/')
    return f'''<!doctype html>
<html lang="en" data-typography="instrument-newsreader">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>{E(title)}</title>
  <meta name="description" content="{E(description)}">
  <meta name="author" content="{AUTHOR}">
  <meta name="theme-color" content="#0b0c0c">
  <link rel="canonical" href="{SITE}{url}">
  <link rel="icon" href="{prefix}favicon.ico" sizes="any">
  <link rel="icon" href="{prefix}assets/brand/icon-32.png" type="image/png" sizes="32x32">
  <link rel="apple-touch-icon" href="{prefix}assets/brand/icon-180.png">
  <link rel="manifest" href="{prefix}site.webmanifest">
  <link rel="alternate" type="application/rss+xml" title="Notes on change — Yassine W. Medjati" href="{prefix}blog/feed.xml">
  <meta property="og:site_name" content="{AUTHOR}">
  <meta property="og:type" content="{'article' if article else 'website'}">
  <meta property="og:title" content="{E(title)}">
  <meta property="og:description" content="{E(description)}">
  <meta property="og:url" content="{SITE}{url}">
  <meta property="og:image" content="{SITE}assets/blog-social.png">
  <meta property="og:image:width" content="1200">
  <meta property="og:image:height" content="630">
  <meta property="og:image:alt" content="Notes on change — AI, transformation and leadership by Yassine W. Medjati">
  <meta name="twitter:card" content="summary_large_image">
  <script type="application/ld+json">{schema_json}</script>
  <link rel="preload" href="{prefix}assets/fonts/instrument-sans-normal.woff2" as="font" type="font/woff2" crossorigin>
  <link rel="stylesheet" href="{prefix}profile.css">
  <link rel="stylesheet" href="{prefix}journal.css">
  <script src="{prefix}journal.js" defer></script>
  <link rel="stylesheet" href="{prefix}site-ui.css">
  <link rel="stylesheet" href="{prefix}typography-fonts.css">
  <link rel="stylesheet" href="{prefix}typography-proposals.css">
  <script src="{prefix}site-ui.js" defer></script>
  <link rel="stylesheet" href="{prefix}ai-signals.css">
  <script src="{prefix}data/ai-signals-snapshot.js" defer></script>
  <script src="{prefix}ai-signals.js" defer></script>
  <link rel="stylesheet" href="{prefix}privacy.css">
  <script src="{prefix}site-config.js" defer></script>
  <script src="{prefix}privacy-core.js" defer></script>
  <script src="{prefix}privacy.js" defer></script>
  <script src="{prefix}booking.js" defer></script>
<meta name="referrer" content="strict-origin">
</head>
<body class="journal-page">
<a class="skip-link" href="#main-content">Skip to content</a>
<div class="journal-shell">
'''

def header(prefix='',blog_current=False):
    return f'''<header class="journal-header">
  <a class="brand-link" href="{prefix}index.html" aria-label="{AUTHOR} — home"><img class="brand-symbol" src="{prefix}assets/brand/logo-ivory.png" width="36" height="36" alt=""></a>
  <nav class="journal-nav" aria-label="Main navigation">
    <a href="{prefix}index.html">Home</a>
    <a href="{prefix}blog.html"{' aria-current="page"' if blog_current else ''}>Blog</a>
    <a class="nav-experience" href="{prefix}mydigital-resume.html">Experience</a>
    <a class="nav-contact" href="mailto:hello@wyassine.com">Let’s talk ↗</a>
  </nav>
</header>'''

def footer(prefix=''):
    return f'''<footer class="journal-footer"><span>© 2026 {AUTHOR}</span><div class="journal-footer-links"><a href="{prefix}mydigital-resume.html">About &amp; experience</a><a href="{prefix}blog/feed.xml">RSS ↗</a><a href="https://www.linkedin.com/in/yassine-medjati/" target="_blank" rel="noopener noreferrer">LinkedIn ↗</a></div></footer>
</div></body></html>'''

def invitation(title,text,subject,eyebrow='From reading to doing'):
    return f'''<section class="journal-invitation" aria-label="Work together"><div><span class="mono">{E(eyebrow)}</span><h2>{title}</h2></div><div class="invitation-copy"><p>{E(text)}</p><a class="solid-link" href="mailto:hello@wyassine.com?subject={quote(subject)}">Start a conversation <span aria-hidden="true">↗</span></a><div style="margin-top:18px"><a class="text-link" href="https://cal.com/yassine-m-zowgc4/15min" data-cal-popup target="_blank" rel="noopener noreferrer">Book a 15-minute call <span class="link-arrow" aria-hidden="true">↗</span></a></div></div></section>'''

def row(p):
    stamp='Updated ' if p['date_published']!=p['date_modified'] else ''
    return f'''<a class="journal-row" data-category="{E(p['category'])}" data-search="{E(p['seo_title']+' '+p['description'])}" href="{p['url']}"><span class="row-number" aria-hidden="true">{p['number']}</span><span class="row-category mono">{E(p['category'])}</span><div class="row-story"><h3>{E(p['title'])}</h3><p>{E(p['excerpt'])}</p></div><span class="row-meta mono">{stamp}<time datetime="{p['date_modified']}">{p['date_label']}</time><br><span class="meta-time">{p['minutes']} min read</span></span><span class="row-arrow" aria-hidden="true">↗</span></a>'''

featured=next(p for p in POSTS if p.get('featured'))
blogschema={'@type':'Blog','@id':SITE+'blog.html#blog','name':'Notes on change','description':'Practical perspectives on AI strategy, digital transformation and leadership.','url':SITE+'blog.html','author':{'@id':SITE+'#person'},'blogPost':[article_schema(p) for p in POSTS]}
breadcrumb={'@type':'BreadcrumbList','itemListElement':[{'@type':'ListItem','position':1,'name':'Home','item':SITE},{'@type':'ListItem','position':2,'name':'Blog','item':SITE+'blog.html'}]}
index=head('AI Strategy & Digital Transformation Blog | Yassine W. Medjati','Practical notes on AI roadmaps, digital transformation and leadership. Decision guides for teams turning ambition into everyday business value.','blog.html',graph=[PERSON,blogschema,breadcrumb])+header(blog_current=True)
index+='''<main id="main-content">
<section class="journal-intro" aria-labelledby="journal-title">
  <div class="journal-edition mono"><span>Notes on change / The blog</span><span>AI · Transformation · People</span></div>
  <div class="journal-title-row"><h1 id="journal-title">Ideas into <em>practice.</em></h1><div class="journal-intro-copy"><p>Perspectives for the decisions between a promising idea and a change that works.</p><a class="text-link" href="#reading-room">Explore the notes <span class="link-arrow" aria-hidden="true">↓</span></a></div></div>
</section>
'''
index+=f'''<a class="featured-story" href="{featured['url']}"><div class="featured-copy"><span class="story-kicker mono">Start here / {E(featured['category'])}</span><h2>{E(featured['title'])}</h2><p>{E(featured['excerpt'])}</p><div class="featured-bottom"><span class="mono">{featured['minutes']} min read · A practical decision frame</span><span aria-hidden="true">↗</span></div></div><div class="featured-art" aria-hidden="true"><img src="assets/editorial-orbits.svg" width="800" height="580" alt=""><div class="art-caption"><span class="mono">Clarity before scale.<br>Direction before momentum.</span><span class="art-number">01</span></div></div></a>'''
index+='''<section class="reading-room" id="reading-room" aria-labelledby="reading-heading"><div class="reading-heading"><h2 id="reading-heading">The reading room.</h2><span class="mono">Useful questions.<br>Practical next steps.</span></div>
<div class="journal-controls" hidden><div class="topic-filters" role="group" aria-label="Filter notes by topic">'''
for category in ['All','Strategy','Leadership','Operating models']:
    index+=f'<button class="topic-button" type="button" data-topic="{category}" aria-pressed="{str(category=="All").lower()}">{category}</button>'
index+='''</div><label class="journal-search"><span>Search</span><input id="journal-search" type="search" placeholder="Find a note…" autocomplete="off"></label></div>
<div class="journal-list">'''+''.join(row(p) for p in POSTS)+'''</div><div class="empty-state" hidden><p>No notes match that search.</p><button class="clear-filters" type="button">Show all notes</button></div>
<div class="reading-end"><span class="mono" id="reading-count" role="status" aria-live="polite">3 notes to explore</span><a href="blog/feed.xml">Follow via RSS ↗</a></div></section>'''
index+=invitation('A useful idea deserves<br>a <em>next step.</em>','If a note connects with a challenge in your organisation, let’s discuss what it could mean for your priorities, your people and your next decision.','Discuss a business challenge')+'</main>'+footer()
(ROOT/'blog.html').write_text(index)

for p in POSTS:
    prefix=p['prefix']
    graph=[PERSON,{'@type':'Blog','@id':SITE+'blog.html#blog','url':SITE+'blog.html','name':'Notes on change'},article_schema(p),{'@type':'BreadcrumbList','itemListElement':[{'@type':'ListItem','position':1,'name':'Home','item':SITE},{'@type':'ListItem','position':2,'name':'Blog','item':SITE+'blog.html'},{'@type':'ListItem','position':3,'name':p['title'],'item':SITE+p['url']}]}]
    s=head(p['seo_title']+' | '+AUTHOR,p['description'],p['url'],prefix,graph,True)
    s=s.replace('  <meta property="og:type" content="article">',f'  <meta property="og:type" content="article">\n  <meta property="article:published_time" content="{p["date_published"]}">\n  <meta property="article:modified_time" content="{p["date_modified"]}">')
    s+='<div class="article-progress" aria-hidden="true"></div>'+header(prefix)
    s+=f'''<main id="main-content"><nav class="article-breadcrumb mono" aria-label="Breadcrumb"><a href="{prefix}blog.html">The blog</a><span aria-hidden="true">/</span><span>{E(p['category'])}</span></nav>
<header class="article-header"><span class="story-kicker mono">Notes on change / {E(p['category'])}</span><h1>{E(p['title'])}</h1><p class="article-deck">{E(p['excerpt'])}</p><div class="article-byline"><a href="{prefix}mydigital-resume.html" rel="author">{AUTHOR}</a><span>{'Updated ' if p['date_modified']!=p['date_published'] else ''}<time datetime="{p['date_modified']}">{p['date_label']}</time></span><span>{p['minutes']} min read</span></div></header>
<div class="article-layout"><aside class="article-aside" aria-label="Article navigation"><h2 class="mono">In this note</h2><nav class="article-toc" aria-label="Table of contents">'''
    s+=''.join(f'<a href="#{id}">{E(label)}</a>' for id,label in p['toc'])
    s+='''</nav><div class="article-utility"><button class="copy-article" type="button">Copy article link ↗</button><span class="article-copy-status" role="status" aria-live="polite"></span><label class="article-copy-fallback" hidden>Select and copy this link:<input type="text" readonly aria-label="Article URL"></label></div></aside><article class="article-body" aria-label="Article text">'''
    s+=f'<div class="article-takeaway"><span class="mono">What you can use</span><p>{E(p["takeaway"])}</p></div>'+p['body_html']
    s+=f'''<section class="author-note" aria-label="About the author"><img src="{prefix}assets/brand/logo-ivory.png" width="40" height="40" alt=""><div><h2>{AUTHOR}</h2><p>AI and digital transformation leader with experience at Airbus spanning quality engineering, data science and change adoption. I connect strategy, technology and the people responsible for delivery.</p><a class="text-link" href="{prefix}mydigital-resume.html">Explore my experience <span aria-hidden="true">↗</span></a></div></section></article></div>'''
    s+=invitation(E(p['cta_title']),p['cta_text'],p['cta_subject'])
    s+='<section class="related-notes" aria-labelledby="related-heading"><h2 id="related-heading">Keep the conversation going.</h2><div class="related-grid">'
    for related in POSTS:
        if related is p:continue
        s+=f'<a class="related-link" href="{prefix}{related["url"]}"><span class="mono">{E(related["category"])} / {related["minutes"]} min read</span><h3>{E(related["title"])}</h3><p>{E(related["excerpt"])}</p><span aria-hidden="true">↗</span></a>'
    s+='</div></section></main>'+footer(prefix)
    (ROOT/p['url']).parent.mkdir(parents=True,exist_ok=True)
    (ROOT/p['url']).write_text(s)

# RSS and sitemap contain only complete public pages, with stable canonical URLs.
ET.register_namespace('atom','http://www.w3.org/2005/Atom')
rss=ET.Element('rss',{'version':'2.0'});channel=ET.SubElement(rss,'channel')
for tag,value in [('title','Notes on change — '+AUTHOR),('link',SITE+'blog.html'),('description','Practical notes on AI strategy, transformation and leadership.'),('language','en')]:ET.SubElement(channel,tag).text=value
ET.SubElement(channel,'{http://www.w3.org/2005/Atom}link',{'href':SITE+'blog/feed.xml','rel':'self','type':'application/rss+xml'})
for p in POSTS:
    item=ET.SubElement(channel,'item')
    for tag,value in [('title',p['title']),('link',SITE+p['url']),('guid',SITE+p['url']),('description',p['excerpt']),('category',p['category']),('pubDate',format_datetime(datetime.combine(date.fromisoformat(p['date_published']),datetime.min.time(),tzinfo=timezone.utc)))]:ET.SubElement(item,tag).text=value
ET.indent(rss,space='  ');ET.ElementTree(rss).write(ROOT/'blog/feed.xml',encoding='utf-8',xml_declaration=True)
ns='http://www.sitemaps.org/schemas/sitemap/0.9';ET.register_namespace('',ns)
sitemap=ET.parse(ROOT/'sitemap.xml');sm=sitemap.getroot()
urls={e.find('{'+ns+'}loc').text:e for e in sm}
for url,modified in [('blog.html','2026-10-25')]+[(p['url'],p['date_modified']) for p in POSTS]:
    node=urls.get(SITE+url)
    if node is None:
        node=ET.SubElement(sm,'{'+ns+'}url');ET.SubElement(node,'{'+ns+'}loc').text=SITE+url;urls[SITE+url]=node
    last=node.find('{'+ns+'}lastmod')
    if last is None:last=ET.SubElement(node,'{'+ns+'}lastmod')
    last.text=modified
for url in [SITE,SITE+'mydigital-resume.html',SITE+'case-study-airbus-digitalization.html']:
    if url in urls:urls[url].find('{'+ns+'}lastmod').text='2026-10-25'
ET.indent(sm,space='  ');sitemap.write(ROOT/'sitemap.xml',encoding='utf-8',xml_declaration=True)
for p in POSTS:print(p['url'],p['words'],'words,',p['minutes'],'min read')
print('Built blog index, three articles, RSS and sitemap.')
