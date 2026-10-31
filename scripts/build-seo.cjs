'use strict';
// A single source of public identity, canonical metadata and indexable URLs.
// Never read or render private CV content here.
const fs=require('node:fs/promises');
const path=require('node:path');
const SITE='https://www.wyassine.com';
const AUTHOR='Yassine W. Medjati';
const UPDATED='2026-10-30';
const escape=value=>String(value).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const person={
  '@type':'Person','@id':SITE+'/#person',name:AUTHOR,url:SITE+'/about',
  image:SITE+'/assets/yassine-portrait.png',
  description:'AI and digital transformation leader based in Hamburg, writing about AI strategy, adoption and organisational change.',
  sameAs:['https://www.linkedin.com/in/yassine-medjati/'],
  knowsAbout:['AI strategy','Digital transformation','AI adoption','Program leadership','Change management'],
  homeLocation:{'@type':'Place',name:'Hamburg, Germany'}
};
const website={'@type':'WebSite','@id':SITE+'/#website',url:SITE+'/',name:AUTHOR,inLanguage:'en',publisher:{'@id':person['@id']}};
const arrow='<svg class="ui-arrow-icon" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="1em" height="1em" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false"><path d="M7 17 17 7M7 7h10v10"/></svg>';
const aboutBody=`<p class="article-lede">I’m Yassine W. Medjati, an AI and digital transformation leader based in Hamburg, Germany. My work connects business priorities, technical delivery and the people responsible for putting change into practice.</p>
<h2 id="approach">How I approach transformation</h2>
<p>I start with the operating problem: what people need to do, where the friction sits and what improvement would matter. I then connect priorities to a practical sequence, clear ownership and evidence for the next decision. Adoption belongs in that conversation from the beginning.</p>
<p>My approach is to create clarity, give people ownership and make progress visible. I connect the leaders setting direction with the technical and operational teams making it happen.</p>
<h2 id="communication">Languages and communication</h2>
<p>I speak Arabic, French and English, with German at B1 level. I am based in Hamburg.</p>
<h2 id="next">For hiring teams and business leaders</h2>
<p>For recruiters and hiring teams, I welcome conversations about AI and digital transformation leadership. My full digital CV remains private: <a href="/digital-cv?request=pin">request access to the digital CV</a> or <a href="/digital-cv?request=pdf">request a PDF résumé</a>.</p>
<p>For business leaders, explore the <a href="/ai-strategy">AI strategy and advisory discussion areas</a> or read my <a href="/blog">notes on AI roadmaps, adoption and operating models</a>. I welcome relevant conversations with organisations in Germany, Switzerland, Luxembourg, the United States and the United Kingdom.</p>
<p><a class="text-link" href="/contact">Discuss a role or business challenge ${arrow}</a></p>
<p>Find my professional profile on <a href="https://www.linkedin.com/in/yassine-medjati/" target="_blank" rel="noopener noreferrer">LinkedIn ${arrow}</a>.</p>`;
const strategyBody=`<p class="article-lede">AI strategy connects a business outcome to the decisions, responsibilities and changes needed to deliver it. A useful roadmap explains what to do next, who owns the work and what evidence will justify scaling.</p>
<p>I’m <a href="/about">Yassine W. Medjati</a>, an AI and digital transformation leader based in Hamburg. My articles explore practical questions about priorities, ownership and adoption.</p>
<h2 id="priorities">Prioritise AI use cases around an operating problem</h2>
<p>When a team has many ideas, the first task is to agree which problem matters. A strategy conversation can clarify the intended outcome, the people affected, the available information and the dependencies that need attention before delivery starts.</p>
<p>A useful starting point is a short description of each initiative: the person, the task, the friction, the owner and the next decision. My <a href="/blog/ai-roadmap-prioritisation">five-decision guide to AI roadmap prioritisation</a> provides a working frame for that discussion.</p>
<h2 id="adoption">Connect AI implementation with adoption</h2>
<p>A successful demonstration is only one part of implementation. The surrounding workflow, user expectations, support and feedback need owners too. Reviewing those together helps a leadership team understand what is ready for a broader rollout and what still needs to be learned.</p>
<p>My <a href="/blog/ai-adoption-beyond-pilots">AI adoption review</a> sets out practical questions about the whole task, useful expectations, feedback, ongoing support and evidence of usefulness.</p>
<h2 id="operating-model">Give GenAI an operating model</h2>
<p>As experiments multiply, teams need a shared way to decide what continues, what changes and who remains accountable. That includes workflow choices, human review, ongoing maintenance and a rhythm for revisiting decisions.</p>
<p>The <a href="/brief-genai-operating-model">GenAI operating model discussion guide</a> offers a starting agenda for leadership. It is a working perspective for discussion, rather than a promise of a particular delivery outcome.</p>
<h2 id="conversation">Start with your next decision</h2>
<p>For an initial conversation, describe the operating problem, the AI activity already in motion and the decision you need to make next. We can discuss where priorities, delivery or adoption need greater clarity.</p>
<p>Based in Hamburg and working internationally, I welcome business and advisory enquiries from Germany, Switzerland, Luxembourg, the United States and the United Kingdom. This website’s articles and discussion guides are available in English.</p>
<p><a class="text-link" href="/contact">Send a business or advisory enquiry ${arrow}</a></p>
<p><a class="text-link" href="https://cal.com/yassine-m-zowgc4/15min" data-cal-popup target="_blank" rel="noopener noreferrer">Book a 15-minute conversation ${arrow}</a></p>`;
function publicPage({title,heading,deck,body,portrait=false}) {
  return `<!doctype html>
<html lang="en" data-typography="instrument-newsreader"><head>
<meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>${escape(title)}</title>
<link rel="icon" href="/favicon.ico"><link rel="preload" href="/assets/fonts/instrument-sans-normal.woff2" as="font" type="font/woff2" crossorigin>
<link rel="stylesheet" href="/profile.css"><link rel="stylesheet" href="/journal.css"><link rel="stylesheet" href="/site-ui.css"><link rel="stylesheet" href="/typography-fonts.css"><link rel="stylesheet" href="/typography-proposals.css"><link rel="stylesheet" href="/privacy.css">
<script src="/site-ui.js" defer></script><script src="/site-config.js" defer></script><script src="/privacy-core.js" defer></script><script src="/privacy.js" defer></script><script src="/booking.js" defer></script>
</head><body class="journal-page${portrait?' about-page':''}"><a class="skip-link" href="#main-content">Skip to content</a><div class="journal-shell">
<header class="journal-header"><a class="brand-link" href="/" aria-label="${AUTHOR} — home"><img class="brand-symbol" src="/assets/brand/logo-ivory.png" width="36" height="36" alt=""></a><nav class="journal-nav" aria-label="Main navigation"><a href="/">Home</a><a href="/about">About</a><a href="/ai-strategy">AI strategy</a><a href="/blog">Blog</a><a href="/contact">Contact</a></nav></header>
<main id="main-content"><nav class="article-breadcrumb mono" aria-label="Breadcrumb"><a href="/">Home</a><span aria-hidden="true">/</span><span>${escape(heading)}</span></nav><header class="article-header${portrait?' about-hero':''}"><div class="public-page-heading"><span class="story-kicker mono">AI · Transformation · People</span><h1>${escape(heading)}</h1><p class="article-deck">${escape(deck)}</p></div>${portrait?'<figure class="about-portrait"><img src="/assets/yassine-portrait.png" width="500" height="500" alt="Portrait of Yassine W. Medjati" decoding="async"></figure>':''}</header><article class="article-body" style="max-width:760px;margin:0 auto 70px">${body}</article></main>
<footer class="journal-footer"><span>© 2026 ${AUTHOR}</span><div class="journal-footer-links"><a href="/about">About &amp; experience</a><a href="/ai-strategy">AI strategy</a><a href="/blog">Blog</a><a href="/privacy">Privacy</a></div></footer></div></body></html>\n`;
}
function inventory(posts) {
  return [
    {file:'index.html',route:'/',title:'Yassine W. Medjati | AI & Digital Transformation Leader',description:'Explore AI strategy, transformation leadership and adoption perspectives from Hamburg-based Yassine W. Medjati. Discuss a role or a business challenge.',label:'Home',modified:UPDATED},
    {file:'about.html',route:'/about',title:'About Yassine W. Medjati | AI Transformation Leadership',description:'Meet Yassine W. Medjati: perspectives on AI strategy, transformation leadership and change adoption, with routes for recruitment and advisory enquiries.',label:'About & experience',modified:UPDATED,type:'ProfilePage'},
    {file:'ai-strategy.html',route:'/ai-strategy',title:'AI Strategy & Transformation Advisory | Yassine W. Medjati',description:'Discuss AI roadmap priorities, implementation, adoption and GenAI operating models with Hamburg-based AI and transformation leader Yassine W. Medjati.',label:'AI strategy & advisory',modified:UPDATED},
    {file:'blog.html',route:'/blog',title:'AI Strategy & Digital Transformation Blog | Yassine W. Medjati',description:'Practical notes on AI roadmaps, digital transformation and leadership. Decision guides for teams turning ambition into everyday business value.',label:'Blog',modified:UPDATED,type:'CollectionPage'},
    ...posts.map(p=>({file:p.url+'.html',route:'/'+p.url,title:p.seo_title+' | '+AUTHOR,description:p.description,label:p.title,modified:p.date_modified,post:p})),
    {file:'signals.html',route:'/signals',title:'AI Signals — Research, Adoption & Governance | Yassine W. Medjati',description:'Explore an attributed collection of AI research, reporting and practitioner perspectives, alongside original notes on AI strategy, adoption and operating models.',label:'AI Signals',type:'CollectionPage'}
  ];
}
function graphFor(page,posts) {
  const url=SITE+page.route;
  const webpage={'@type':page.type||'WebPage','@id':url+'#webpage',url,name:page.title,description:page.description,inLanguage:'en',isPartOf:{'@id':website['@id']},about:{'@id':person['@id']}};
  if(page.type==='ProfilePage')webpage.mainEntity={'@id':person['@id']};
  const graph=[person,website,webpage];
  if(page.route!=='/')graph.push({'@type':'BreadcrumbList','@id':url+'#breadcrumbs',itemListElement:[{'@type':'ListItem',position:1,name:'Home',item:SITE+'/'},...(page.post?[{'@type':'ListItem',position:2,name:'Blog',item:SITE+'/blog'}]:[]),{'@type':'ListItem',position:page.post?3:2,name:page.label,item:url}]});
  const article=p=>({'@type':'BlogPosting','@id':SITE+'/'+p.url+'#article',headline:p.title,description:p.description,url:SITE+'/'+p.url,mainEntityOfPage:{'@id':SITE+'/'+p.url+'#webpage'},datePublished:p.date_published,dateModified:p.date_modified,author:{'@id':person['@id']},publisher:{'@id':person['@id']},isPartOf:{'@id':SITE+'/blog#blog'},articleSection:p.category,inLanguage:'en',image:SITE+'/assets/blog-social.png'});
  if(page.post){graph.push(article(page.post),{'@type':'Blog','@id':SITE+'/blog#blog',name:'Notes on change',url:SITE+'/blog',author:{'@id':person['@id']}});webpage.mainEntity={'@id':url+'#article'};}
  if(page.route==='/blog'){
    graph.push({'@type':'Blog','@id':url+'#blog',name:'Notes on change',url,author:{'@id':person['@id']},blogPost:posts.map(p=>({'@id':SITE+'/'+p.url+'#article'}))},...posts.map(article));
    webpage.mainEntity={'@id':url+'#blog'};
  }
  return {'@context':'https://schema.org','@graph':graph};
}
function metadata(html,page,posts) {
  const title=escape(page.title),description=escape(page.description),url=SITE+page.route;
  // Replace only metadata managed here; preserve page-specific styles, scripts and article timestamps.
  html=html.replace(/<title>[^<]*<\/title>/i,'<title>'+title+'</title>');
  html=html.replace(/<meta\b[^>]*(?:name=["'](?:description|author|robots|twitter:card|twitter:title|twitter:description|twitter:image)["']|property=["']og:[^"']+["'])[^>]*>\s*/gi,'');
  html=html.replace(/<link\b[^>]*rel=["']canonical["'][^>]*>\s*/gi,'');
  html=html.replace(/<script\b[^>]*type=["']application\/ld\+json["'][^>]*>[\s\S]*?<\/script>\s*/gi,'');
  const image=SITE+(page.post||page.route==='/blog'?'/assets/blog-social.png':'/assets/yassine-portrait.png');
  const tags=`\n<meta name="description" content="${description}">
<meta name="author" content="${AUTHOR}">
<meta name="robots" content="index,follow,max-image-preview:large">
<link rel="canonical" href="${url}">
<meta property="og:site_name" content="${AUTHOR}"><meta property="og:locale" content="en_US">
<meta property="og:type" content="${page.post?'article':'website'}">
<meta property="og:url" content="${url}"><meta property="og:title" content="${title}"><meta property="og:description" content="${description}">
<meta property="og:image" content="${image}"><meta property="og:image:alt" content="${page.post||page.route==='/blog'?'Notes on change — AI, transformation and leadership by '+AUTHOR:'Portrait of '+AUTHOR}">
<meta name="twitter:card" content="${page.post||page.route==='/blog'?'summary_large_image':'summary'}"><meta name="twitter:title" content="${title}"><meta name="twitter:description" content="${description}"><meta name="twitter:image" content="${image}">
<script type="application/ld+json">${JSON.stringify(graphFor(page,posts)).replace(/</g,'\\u003c')}</script>\n`;
  html=html.replace(/<link rel="stylesheet" href="\/site-intro\.css">\s*<script src="\/site-intro\.js"><\/script>\s*/g,'');
  return html.replace(/\s*<\/head>/,tags+'<link rel="stylesheet" href="/site-intro.css"><script src="/site-intro.js"></script>\n</head>');
}
async function buildSeo(root=path.resolve(__dirname,'..')) {
  const posts=JSON.parse(await fs.readFile(path.join(root,'content/posts.json'),'utf8'));
  const pages=inventory(posts);
  const generated={
    'about.html':publicPage({title:pages[1].title,heading:'About Yassine W. Medjati',deck:'Perspectives on AI strategy and transformation, with people at the centre.',body:aboutBody,portrait:true}),
    'ai-strategy.html':publicPage({title:pages[2].title,heading:'AI strategy that connects to delivery.',deck:'Priorities, ownership and adoption for teams turning AI activity into a practical next step.',body:strategyBody})
  };
  for(const page of pages){
    const file=path.join(root,page.file);
    const source=generated[page.file]||await fs.readFile(file,'utf8');
    await fs.writeFile(file,metadata(source,page,posts));
  }
  // Only canonical public pages belong in the sitemap: no PIN gates, contact forms or noindex pages.
  const xml='<?xml version="1.0" encoding="utf-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n'+pages.map(p=>'  <url><loc>'+SITE+p.route+'</loc>'+(p.modified?'<lastmod>'+p.modified+'</lastmod>':'')+'</url>').join('\n')+'\n</urlset>\n';
  await fs.writeFile(path.join(root,'sitemap.xml'),xml);
  return pages;
}
if(require.main===module)buildSeo().then(pages=>console.log('SEO: '+pages.length+' public pages, shared identity and canonical sitemap generated.')).catch(error=>{console.error(error.message);process.exitCode=1;});
module.exports={buildSeo,inventory,graphFor,SITE,person};
