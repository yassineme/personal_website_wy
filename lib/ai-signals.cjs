'use strict';
const { XMLParser, XMLValidator } = require('fast-xml-parser');
const { createHash } = require('node:crypto');
const TTL = 15 * 60 * 1000;
const SOURCES = Object.freeze([
  {id:'openai', name:'OpenAI', feed:'https://openai.com/news/rss.xml', home:'https://openai.com/news/', hosts:['openai.com','www.openai.com'], lens:'Models & deployment'},
  {id:'deepmind', name:'Google DeepMind', feed:'https://deepmind.google/blog/rss.xml', home:'https://deepmind.google/blog/', hosts:['deepmind.google','blog.google'], lens:'Research & capability'},
  {id:'huggingface', name:'Hugging Face', feed:'https://huggingface.co/blog/feed.xml', home:'https://huggingface.co/blog', hosts:['huggingface.co'], lens:'Open models & tools'},
  {id:'nist', name:'NIST', feed:'https://www.nist.gov/news-events/information%20technology/rss.xml', home:'https://www.nist.gov/artificial-intelligence', hosts:['www.nist.gov','nist.gov'], lens:'Trust & governance'}
]);
const parser = new XMLParser({ignoreAttributes:false, processEntities:true, htmlEntities:true, parseTagValue:false, trimValues:true});
const list = x => x == null ? [] : Array.isArray(x) ? x : [x];
const scalar = x => typeof x === 'object' && x ? String(x['#text'] || '') : String(x || '');
function text(value, max=400) {
  return scalar(value).replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi,'').replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi,'').replace(/<[^>]*>/g,' ').replace(/\s+/g,' ').trim().slice(0,max);
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
  const bySource=SOURCES.map(s=>all.filter(i=>i.sourceId===s.id).sort((a,b)=>Date.parse(b.publishedAt)-Date.parse(a.publishedAt)).slice(0,5));
  const items=[]; const urls=new Set();
  // Round-robin gives institutional and open-source voices space alongside company launches.
  for(let round=0;round<5;round++) for(const group of bySource) if(group[round] && !urls.has(group[round].url)){items.push(group[round]);urls.add(group[round].url);}
  const successful=statuses.some(s=>s.status==='ok');
  return {version:1,checkedAt:new Date(now).toISOString(),updatedAt:successful?new Date(now).toISOString():previous?.updatedAt||null,refreshMinutes:15,status:successful?(statuses.every(s=>s.status==='ok')?'ok':'partial'):'stale',sources:statuses,items:items.slice(0,16)};
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
