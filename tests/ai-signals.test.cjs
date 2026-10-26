const {test}=require('node:test');const assert=require('node:assert/strict');
const {SOURCES,TTL,parseFeed,allowedURL,collect,createService}=require('../lib/ai-signals.cjs');
const now=Date.parse('2026-10-25T12:00:00Z');
const rss=(items)=>'<rss><channel>'+items.map(i=>`<item><title><![CDATA[${i.title||'AI model release'}]]></title><link>${i.url||'https://openai.com/news/release'}</link><description><![CDATA[${i.body||'New research.'}]]></description><pubDate>${i.date||'Sun, 25 Oct 2026 10:00:00 GMT'}</pubDate></item>`).join('')+'</channel></rss>';
test('RSS dates, deduplication, excerpts and URL validation',()=>{
 const items=parseFeed(rss([{body:'<p>New <b>AI</b> model.</p><script>alert(1)</script>'},{},{url:'javascript:alert(1)'},{url:'https://openai.com.evil.test/a'},{url:'https://openai.com/news/old',date:'2020-01-01'},{url:'https://openai.com/news/future',date:'2027-01-01'},{url:'https://openai.com/news/invalid',date:'nonsense'}]),SOURCES[0],now);
 assert.equal(items.length,1);assert.equal(items[0].excerpt,'New AI model.');assert.equal(items[0].publishedAt,'2026-10-25T10:00:00.000Z');
 assert.equal(allowedURL('https://user@openai.com/news/a',SOURCES[0]),null);
 assert.equal(allowedURL('https://openai.com:4433/news/a',SOURCES[0]),null);
 assert.equal(allowedURL('https://openai.com/a?utm_source=x#b',SOURCES[0]),'https://openai.com/a');
});
test('official Hugging Face paths only; NIST AI relevance filter',()=>{
 assert.equal(allowedURL('https://huggingface.co/blog/user/post',SOURCES[2]),null);
 assert.ok(allowedURL('https://huggingface.co/blog/new-release',SOURCES[2]));
 assert.equal(parseFeed(rss([{title:'New atomic clock',url:'https://www.nist.gov/news/a'}]),SOURCES[3],now).length,0);
 assert.equal(parseFeed(rss([{title:'AI measurement',url:'https://www.nist.gov/news/a'}]),SOURCES[3],now).length,1);
});
test('Atom, malformed XML and entity declarations',()=>{
 const atom='<feed><entry><title>Research &amp; models</title><link rel="alternate" href="https://deepmind.google/blog/research/"/><updated>2026-10-24T12:00:00Z</updated><summary>One result.</summary></entry></feed>';
 assert.equal(parseFeed(atom,SOURCES[1],now)[0].title,'Research & models');
 assert.throws(()=>parseFeed('<rss><channel>',SOURCES[0],now));
 assert.throws(()=>parseFeed('<!DOCTYPE x [<!ENTITY xx "bad">]><rss/>',SOURCES[0],now));
});
test('publisher failure retains last good stories and their real timestamps',async()=>{
 const previous={updatedAt:'2026-10-24T12:00:00Z',sources:[{id:'openai',lastSuccessfulAt:'2026-10-24T12:00:00Z'}],items:parseFeed(rss([{}]),SOURCES[0],now)};
 const fail=await collect({fetcher:async()=>{throw Error('offline')},previous,now});
 assert.equal(fail.status,'stale');assert.equal(fail.updatedAt,previous.updatedAt);assert.equal(fail.items.length,1);assert.equal(fail.sources[0].lastSuccessfulAt,previous.updatedAt);
});
test('partial feeds stay useful and cannot inject unapproved URLs',async()=>{
 const fetcher=async url=>{if(!url.includes('openai'))throw Error('offline');return new Response(rss([{}, {url:'https://untrusted.test/a'}]));};
 const data=await collect({fetcher,now});assert.equal(data.status,'partial');assert.equal(data.items.length,1);assert.equal(data.sources.filter(x=>x.status==='ok').length,1);
});
test('concurrent requests coalesce, TTL refreshes, and rejection allows retry',async()=>{
 let calls=0,time=now;const get=createService({clock:()=>time,collector:async()=>{calls++;await new Promise(resolve=>setTimeout(resolve,5));return {items:[]};}});
 await Promise.all([get(),get(),get()]);assert.equal(calls,1);await get();assert.equal(calls,1);time+=TTL+1;await get();assert.equal(calls,2);
 let attempts=0;const retry=createService({collector:async()=>{if(!attempts++)throw Error('fail');return {items:[]};}});await assert.rejects(retry());await retry();assert.equal(attempts,2);
});
test('API blocks mutation methods',async()=>{
 const handler=require('../api/ai-signals.js');
 const response=()=>({headers:{},setHeader(k,v){this.headers[k]=v},end(v){this.body=v}});
 const bad=response();await handler({method:'POST'},bad);assert.equal(bad.statusCode,405);assert.equal(bad.headers.Allow,'GET, HEAD');
});
test('feed fetch rejects HTTP failures and oversized streams',async()=>{
 const {fetchFeed}=require('../lib/ai-signals.cjs');
 await assert.rejects(fetchFeed(SOURCES[0],async()=>new Response('no',{status:503})),/unavailable/);
 await assert.rejects(fetchFeed(SOURCES[0],async()=>new Response('x',{headers:{'content-length':'5000001'}})),/unavailable/);
 await assert.rejects(fetchFeed(SOURCES[0],async()=>new Response(new Uint8Array(5000001))),/too large/);
});
