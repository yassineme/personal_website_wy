const {test}=require('node:test');const assert=require('node:assert/strict');const fs=require('node:fs/promises');const os=require('node:os');const path=require('node:path');
const {mergeArchive,groupsFrom,sameAnnouncement,responseFrom,parsePerspective}=require('../lib/signals-archive.cjs');
const {createStore}=require('../lib/signals-store.cjs');const {createArchiveService}=require('../lib/signals-service.cjs');
const core=require('../signals-core.js');
const now=Date.parse('2026-10-26T12:00:00Z');
const article=(id='a'.repeat(16),title='Acme Atlas 3 agent deployment evaluation')=>({id,title,url:'https://openai.com/index/'+id,sourceId:'openai',source:'OpenAI',excerpt:'An agent deployment report.',publishedAt:new Date(now-3600000).toISOString()});
const batch=(articles)=>({version:1,checkedAt:new Date(now).toISOString(),updatedAt:new Date(now).toISOString(),status:'ok',sources:[],articles,items:articles});
test('archive retains missing reports, preserves first discovery and stable group permalinks',()=>{
 const first=mergeArchive(null,batch([article()]),now);
 const second=mergeArchive(first,batch([{...article('b'.repeat(16),'Acme Atlas 3 agent deployment evaluation announced'),sourceId:'decoder',source:'The Decoder',url:'https://the-decoder.com/atlas-3'}]),now+10000);
 assert.equal(second.articles.length,2);const groups=groupsFrom(second);assert.equal(groups.length,1);assert.equal(groups[0].id,article().id);assert.equal(groups[0].reports.length,2);assert.equal(groups[0].firstSeenAt,new Date(now).toISOString());
 assert.ok(groups[0].topics.includes('Agents'));assert.match(groups[0].contextKind,/Automatic/);
 const refreshed=mergeArchive(second,batch([article()]),now+20000);assert.equal(refreshed.articles.find(i=>i.id===article().id).firstSeenAt,new Date(now).toISOString());
});
test('grouping distinguishes versions, events a week apart and weak title overlap',()=>{
 assert.equal(sameAnnouncement(article(),article('b'.repeat(16),'Acme Atlas 4 agent deployment evaluation')),false);
 assert.equal(sameAnnouncement(article(),{...article(),publishedAt:new Date(now-9*86400000).toISOString()}),false);
 assert.equal(sameAnnouncement(article(),article('b'.repeat(16),'Acme introduces new enterprise safety controls')),false);
});
test('history retains six months, recent stack keeps 30 days and untrusted links are excluded',()=>{
 const state=mergeArchive(null,batch([article(),{...article('b'.repeat(16),'Older policy milestone'),publishedAt:new Date(now-60*86400000).toISOString()},{...article('c'.repeat(16)),publishedAt:new Date(now-181*86400000).toISOString()},{...article('d'.repeat(16)),url:'https://evil.test/a'}]),now);
 assert.equal(state.articles.length,2);assert.equal(responseFrom(state,{archive:true,now}).items.length,2);assert.equal(responseFrom(state,{now}).items.length,1);
});
test('local archive survives a new store instance and rejects stale concurrent writes',async()=>{
 const dir=await fs.mkdtemp(path.join(os.tmpdir(),'signals-store-test-'));const file=path.join(dir,'archive.json');
 try{const a=createStore({env:{},file}),b=createStore({env:{},file});assert.equal(await a.save({articles:[article()]}),true);const read=await b.read();assert.equal(read.state.articles.length,1);assert.equal(await b.save({articles:[]},'stale-revision'),false);assert.equal((await a.read()).state.articles.length,1);assert.equal(await b.save({articles:[]},read.revision),true);}finally{await fs.rm(dir,{recursive:true,force:true});}
});
test('Vercel without configured durable storage reports unconfigured instead of writing ephemeral files',async()=>{
 const store=createStore({env:{VERCEL:'1'}});assert.equal(store.kind,'unconfigured');assert.equal(await store.save({}),false);
});
test('shared store sends authenticated commands and uses an atomic compare-and-set',async()=>{
 const calls=[];const store=createStore({env:{UPSTASH_REDIS_REST_URL:'https://example.upstash.io',UPSTASH_REDIS_REST_TOKEN:'test-token'},fetcher:async(url,options)=>{const command=JSON.parse(options.body);calls.push({command,headers:options.headers});return Response.json({result:command[0]==='GET'?null:1});}});
 assert.equal(await store.read(),null);assert.equal(await store.save({articles:[]}),true);assert.equal(calls[1].command[0],'EVAL');assert.equal(calls[0].headers.Authorization,'Bearer test-token');
});
test('first visit establishes a baseline; return visits show new groups, not additional reports',()=>{
 let time=now;const data=new Map();const store=core.storage({getItem:k=>data.get(k)||null,setItem:(k,v)=>data.set(k,v)});
 const first=core.createVisit(store,()=>time);const old={...article(),firstSeenAt:new Date(time).toISOString()};first.observe([old]);assert.equal(first.isNew(old),false);
 time+=31*60000;const next={...article('b'.repeat(16),'Different announcement'),firstSeenAt:new Date(time).toISOString()};const returning=core.createVisit(store,()=>time);returning.observe([old,next]);assert.equal(returning.isNew(next),true);assert.equal(returning.isNew(old),false);
 const expanded={...old,id:'c'.repeat(16),firstSeenAt:new Date(time).toISOString(),reports:[{id:old.id}]};assert.equal(returning.isNew(expanded),false);
 const historic={...article('d'.repeat(16)),firstSeenAt:new Date(now-86400000).toISOString()};assert.equal(returning.isNew(historic),false);
 const sameSession=core.createVisit(store,()=>time+1000);assert.equal(sameSession.isNew(next),true);sameSession.markSeen([next]);assert.equal(sameSession.isNew(next),false);
});
test('an open tab returning after inactivity starts a new visit baseline',()=>{
 let time=now;const store=core.storage({getItem(){return null;},setItem(){}});const visit=core.createVisit(store,()=>time);
 const old={...article(),firstSeenAt:new Date(time).toISOString()};visit.observe([old]);
 time+=1000;const second={...article('b'.repeat(16),'Another event'),firstSeenAt:new Date(time).toISOString()};visit.observe([old,second]);assert.equal(visit.isNew(second),true);
 time+=31*60000;const third={...article('c'.repeat(16),'A third event'),firstSeenAt:new Date(time).toISOString()};visit.observe([old,second,third]);assert.equal(visit.isNew(second),false);assert.equal(visit.isNew(third),true);
});
test('search, topic, date, bookmarks and new filters combine, including explicit empty results',()=>{
 const items=[{...article(),topics:['Agents']},{...article('b'.repeat(16),'Research on robotics'),topics:['Research']}];
 assert.equal(core.filterItems(items,{query:'robotics',topic:'Research',from:'2026-10-26',to:'2026-10-26'}).length,1);
 assert.equal(core.filterItems(items,{savedOnly:true,savedIds:new Set([items[0].id]),newOnly:true,isNew:()=>true}).length,1);
 assert.equal(core.filterItems(items,{topic:'Governance'}).length,0);
});
test('perspective requires attribution, declared licence, recent date and safe original link',()=>{
 const q={text:'Keep people in the decision.',speaker:'A researcher',date:'2026-10-26',url:'https://aizeitgeist.tv/quotes/test',source:{url:'https://example.org/original',publisher:'Example'},context:'An interview.'};
 const data={license:'https://creativecommons.org/licenses/by/4.0/',quotes:[q]};assert.equal(parsePerspective(data,now).speaker,q.speaker);assert.equal(parsePerspective({...data,license:''},now),null);assert.equal(parsePerspective({...data,quotes:[{...q,source:{url:'javascript:bad'}}]},now),null);
 assert.equal(parsePerspective({...data,quotes:[{...q,date:'2020-01-01'}]},now),null);
});
test('archive service coalesces requests and merges a conflicting writer without losing articles',async()=>{
 let envelope=null,saveCalls=0,collectCalls=0;
 const store={kind:'shared',async read(){return envelope;},async save(state){saveCalls++;if(saveCalls===1){envelope={revision:'other',state:mergeArchive(null,batch([article('b'.repeat(16),'Another independent development')]),now)};return false;}envelope={revision:'saved',state};return true;}};
 const service=createArchiveService({seed:batch([]),store,clock:()=>now,collector:async()=>{collectCalls++;return batch([article()]);},fetcher:async()=>{throw Error('optional unavailable');}});
 const [a,b]=await Promise.all([service({force:true,archive:true}),service({force:true,archive:true})]);assert.equal(collectCalls,1);assert.equal(saveCalls,2);assert.equal(a.items.length,2);assert.equal(b.storage,'shared');
});
test('storage and feed outages preserve the last collection and report the limitation',async()=>{
 const store={kind:'shared',async read(){throw Error('offline');},async save(){throw Error('offline');}};
 const service=createArchiveService({seed:batch([article()]),store,clock:()=>now+600000,collector:async()=>({...batch([]),status:'stale'}),fetcher:async()=>{throw Error();}});
 const result=await service({archive:true});assert.equal(result.items.length,1);assert.equal(result.status,'stale');assert.equal(result.storage,'unavailable');
});
