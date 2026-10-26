'use strict';
const { XMLParser, XMLValidator } = require('fast-xml-parser');
const { createHash } = require('node:crypto');
const TTL = 5 * 60 * 1000;
const SOURCES = Object.freeze([
  {id:'openai', name:'OpenAI', feed:'https://openai.com/news/rss.xml', home:'https://openai.com/news/', hosts:['openai.com','www.openai.com'], lens:'Models & deployment'},
  {id:'deepmind', name:'Google DeepMind', feed:'https://deepmind.google/blog/rss.xml', home:'https://deepmind.google/blog/', hosts:['deepmind.google','blog.google'], lens:'Research & capability'},
  {id:'huggingface', name:'Hugging Face', feed:'https://huggingface.co/blog/feed.xml', home:'https://huggingface.co/blog', hosts:['huggingface.co'], lens:'Open models & tools'},
  {id:'nist', name:'NIST', feed:'https://www.nist.gov/news-events/information%20technology/rss.xml', home:'https://www.nist.gov/artificial-intelligence', hosts:['www.nist.gov','nist.gov'], lens:'Trust & governance'},
  {id:'google', name:'Google AI', feed:'https://blog.google/innovation-and-ai/technology/ai/rss/', home:'https://blog.google/innovation-and-ai/technology/ai/', hosts:['blog.google'], lens:'AI products & adoption'},
  {id:'mistral', name:'Mistral AI', feed:'https://mistral.ai/news/rss', home:'https://mistral.ai/news', hosts:['mistral.ai'], lens:'Open models & deployment'},
  {id:'microsoft', name:'Microsoft AI', feed:'https://www.microsoft.com/en-us/microsoft-cloud/blog/feed//', home:'https://www.microsoft.com/en-us/ai/blog/', hosts:['www.microsoft.com','blogs.microsoft.com'], lens:'Enterprise AI'},
  {id:'mit', name:'MIT News', feed:'https://news.mit.edu/topic/mitartificial-intelligence2-rss.xml', home:'https://news.mit.edu/topic/artificial-intelligence2', hosts:['news.mit.edu'], lens:'Research & society'},
  {id:'aws', name:'AWS Machine Learning', feed:'https://aws.amazon.com/blogs/machine-learning/feed/', home:'https://aws.amazon.com/blogs/machine-learning/', hosts:['aws.amazon.com'], lens:'AI engineering & deployment'},
  {id:'nvidia', name:'NVIDIA', feed:'https://blogs.nvidia.com/blog/category/generative-ai/feed/', home:'https://blogs.nvidia.com/blog/category/generative-ai/', hosts:['blogs.nvidia.com'], lens:'AI infrastructure & applications'},
  {id:'arstechnica', name:'Ars Technica', feed:'https://arstechnica.com/ai/feed/', home:'https://arstechnica.com/ai/', hosts:['arstechnica.com'], lens:'Independent reporting', filterAI:true},
  {id:'decoder', name:'The Decoder', feed:'https://the-decoder.com/feed/', home:'https://the-decoder.com/', hosts:['the-decoder.com'], lens:'Independent reporting'},
  {id:'simon', name:'Simon Willison', feed:'https://simonwillison.net/atom/everything/', home:'https://simonwillison.net/', hosts:['simonwillison.net'], lens:'Practitioner perspective', filterAI:true},
  {id:'usefulthing', name:'One Useful Thing', feed:'https://www.oneusefulthing.org/feed', home:'https://www.oneusefulthing.org/', hosts:['www.oneusefulthing.org','www.oneusefulthing.com'], lens:'People & adoption'},
  {id:'snakeoil', name:'AI as Normal Technology', feed:'https://www.normaltech.ai/feed', home:'https://www.normaltech.ai/', hosts:['www.normaltech.ai','www.aisnakeoil.com'], lens:'Critical perspective'},
  {id:'interconnects', name:'Interconnects', feed:'https://www.interconnects.ai/feed', home:'https://www.interconnects.ai/', hosts:['www.interconnects.ai'], lens:'Research & practice'},
  {id:'ukaisi', name:'UK AI Security Institute', feed:'https://www.gov.uk/government/organisations/ai-security-institute.atom', home:'https://www.gov.uk/government/organisations/ai-security-institute', hosts:['www.gov.uk'], lens:'Policy & governance'}
]);
const parser = new XMLParser({ignoreAttributes:false, processEntities:true, htmlEntities:true, parseTagValue:false, trimValues:true});
const list = x => x == null ? [] : Array.isArray(x) ? x : [x];
const scalar = x => typeof x === 'object' && x ? String(x['#text'] || '') : String(x || '');
function text(value, max=400) {
  const entities={amp:'&',quot:'"',apos:"'",lt:'<',gt:'>',nbsp:' ',mdash:'—',ndash:'–',rsquo:'’',lsquo:'‘',rdquo:'”',ldquo:'“'};
  const decode=input=>input.replace(/&#(\d+);|&#x([a-f\d]+);|&(amp|quot|apos|lt|gt|nbsp|mdash|ndash|rsquo|lsquo|rdquo|ldquo);/gi,(match,decimal,hex,named)=>{if(named)return entities[named.toLowerCase()];const code=parseInt(decimal||hex,decimal?10:16);return code>0&&code<=0x10ffff?String.fromCodePoint(code):'';});
  return decode(decode(scalar(value))).replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi,'').replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi,'').replace(/<[^>]*>/g,' ').replace(/\s+/g,' ').trim().slice(0,max);
}
function allowedURL(raw, source) {
  try {
    const url = new URL(raw);
    if (url.protocol !== 'https:' || url.username || url.password || url.port || !source.hosts.includes(url.hostname)) return null;
    if (source.id === 'huggingface' && !/^\/blog\/[^/]+\/?$/.test(url.pathname)) return null;
    url.hash='';
    for (const key of [...url.searchParams.keys()]) if (/^utm_|^(fbclid|gclid)$/.test(key)) url.searchParams.delete(key);
    return url.href;
  } catch { return null; }
}
function parseFeed(xml, source, now=Date.now()) {
  if (/<!DOCTYPE|<!ENTITY/i.test(xml) || XMLValidator.validate(xml) !== true) throw Error('Invalid feed');
  const document = parser.parse(xml);
  const entries = document.rss?.channel?.item ?? document.feed?.entry;
  if (!entries) throw Error('Unsupported feed');
  const seen = new Set();
  return list(entries).slice(0,2000).flatMap(entry => {
    const link = list(entry.link).find(x=>typeof x==='string' || !x['@_rel'] || x['@_rel']==='alternate');
    const url = allowedURL(typeof link === 'object' ? link['@_href'] : scalar(link), source);
    const title=text(entry.title,180);
    const excerpt=text(entry.description || entry.summary,350);
    const time=Date.parse(scalar(entry.pubDate || entry.published || entry.updated || entry['dc:date']));
    // A rolling month leaves room for slower institutional publishers. Dates stay visible.
    if (!url || !title || !Number.isFinite(time) || time>now+300000 || now-time>30*86400000 || seen.has(url)) return [];
    if (source.id==='nist' && !/\bAI\b|artificial intelligence|machine learning|generative|neural|language model/i.test(title+' '+excerpt)) return [];
    if (source.filterAI && !/\bAI\b|\bLLMs?\b|GPT|Claude|Gemini|agentic|\bagents?\b|language models?|machine learning|artificial intelligence|OpenAI|Anthropic/i.test(title+' '+excerpt)) return [];
    seen.add(url);
    return [{id:createHash('sha256').update(url).digest('hex').slice(0,16),sourceId:source.id,source:source.name,lens:source.lens,title,excerpt,url,publishedAt:new Date(time).toISOString()}];
  });
}
async function fetchFeed(source, fetcher=fetch) {
  const controller=new AbortController();
  const timer=setTimeout(()=>controller.abort(),8000);
  try {
    const response=await fetcher(source.feed,{signal:controller.signal,redirect:'error',headers:{Accept:'application/rss+xml, application/atom+xml, application/xml, text/xml','User-Agent':'Wyassine-AI-Signals/1.0 (+https://www.wyassine.com)'}});
    if (!response.ok || Number(response.headers.get('content-length'))>5_000_000) throw Error('Feed unavailable');
    const reader=response.body.getReader();
    let total=0; const chunks=[];
    while (true) {
      const {done,value}=await reader.read(); if (done) break;
      total+=value.length;
      if (total>5_000_000) { await reader.cancel(); throw Error('Feed too large'); }
      chunks.push(Buffer.from(value));
    }
    return Buffer.concat(chunks).toString('utf8');
  } finally { clearTimeout(timer); }
}
async function collect({fetcher=fetch,now=Date.now(),previous=null}={}) {
  const results=await Promise.allSettled(SOURCES.map(source=>fetchFeed(source,fetcher).then(xml=>parseFeed(xml,source,now))));
  const statuses=[]; const all=[];
  results.forEach((result,index)=>{
    const source=SOURCES[index]; const ok=result.status==='fulfilled';
    const old=previous?.sources?.find(x=>x.id===source.id);
    statuses.push({id:source.id,name:source.name,home:source.home,status:ok?'ok':'unavailable',lastSuccessfulAt:ok?new Date(now).toISOString():old?.lastSuccessfulAt||null});
    all.push(...(ok?result.value:(previous?.items||[]).filter(x=>x.sourceId===source.id && now-Date.parse(x.publishedAt)<30*86400000)));
  });
  const items=[]; const urls=new Set(); const counts=new Map();
  // Lead with recent reporting; cap each publisher so busy feeds cannot take over.
  for (const item of all.sort((a,b)=>Date.parse(b.publishedAt)-Date.parse(a.publishedAt))) {
    if (urls.has(item.url) || (counts.get(item.sourceId)||0)>=4) continue;
    items.push(item); urls.add(item.url); counts.set(item.sourceId,(counts.get(item.sourceId)||0)+1);
    if (items.length===24) break;
  }
  const successful=statuses.some(s=>s.status==='ok');
  return {version:1,checkedAt:new Date(now).toISOString(),updatedAt:successful?new Date(now).toISOString():previous?.updatedAt||null,refreshMinutes:TTL/60000,status:successful?(statuses.every(s=>s.status==='ok')?'ok':'partial'):'stale',sources:statuses,items,articles:all.slice(0,1500)};
}
function createService({seed=null,collector=collect,clock=Date.now}={}) {
  let cached=seed, checked=0, pending=null;
  return async function getSignals(){
    if(checked && clock()-checked<TTL) return cached;
    if(!pending) pending=collector({previous:cached,now:clock()}).then(data=>{cached=data;checked=clock();return data;}).finally(()=>{pending=null;});
    return pending;
  };
}
module.exports={SOURCES,TTL,text,allowedURL,parseFeed,fetchFeed,collect,createService};
