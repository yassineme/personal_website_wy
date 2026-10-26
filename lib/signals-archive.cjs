'use strict';
const {SOURCES,allowedURL}=require('./ai-signals.cjs');
const {createHash}=require('node:crypto');
const TOPICS=['Agents','Enterprise adoption','Research','Governance','People & work'];
const RULES=[
 ['Agents',/\bagents?\b|agentic|tool.use|computer.use/i],
 ['Governance',/govern|regulat|policy|policies|safety|secur|copyright|privacy|risk|responsib|legislat|\bEU\b/i],
 ['People & work',/worker|workforce|jobs?\b|employ|education|teach|human|adoption|skill|hiring|workplace/i],
 ['Enterprise adoption',/enterprise|business|deploy|workflow|customer|infrastructure|production|cloud|cost|industrial|computing|data centers?|chips?|capex|investment/i],
 ['Research',/research|benchmark|training|model|reasoning|science|neural|paper|evaluation/i]
];
const IMPLICATIONS={
 'Agents':'For an agent rollout, check the permissions, human checkpoints and recovery path before expanding its scope.',
 'Enterprise adoption':'For adoption planning, test the workflow fit, operating cost and ownership before scaling beyond a pilot.',
 'Research':'For a technology decision, compare this result with your own tasks, data and evaluation criteria.',
 'Governance':'For governance planning, review whether this changes your controls, evidence requirements or accountability.',
 'People & work':'For workforce planning, consider how roles, skills and support would need to change alongside the technology.'
};
function topicsFor(item){const copy=item.title+' '+(item.excerpt||'');return RULES.filter(([,rule])=>rule.test(copy)).map(([topic])=>topic).slice(0,3);}
const stop=new Set('a an the is are was were be been being to of in on at and or for with from by as it its this that how why what new introduces introducing announced announces launch launches release releases unveiled unveils'.split(' '));
function tokens(title){return [...new Set(title.toLowerCase().normalize('NFKC').replace(/[^\p{L}\p{N}.]+/gu,' ').split(/\s+/).filter(t=>(t.length>1||/\d/.test(t))&&!stop.has(t)))];}
function sameAnnouncement(a,b){
 if(Math.abs(Date.parse(a.publishedAt)-Date.parse(b.publishedAt))>7*86400000)return false;
 const x=tokens(a.title),y=tokens(b.title);if(!x.length||!y.length)return false;
 const versions=t=>t.filter(v=>/\d/.test(v)).sort().join('|');
 if(versions(x)!==versions(y))return false;
 const common=x.filter(t=>y.includes(t)).length;
 return (common>=3&&common/Math.max(x.length,y.length)>=0.78)||(x.join(' ')===y.join(' '));
}
function validArticle(item){const source=SOURCES.find(s=>s.id===item?.sourceId);return source&&typeof item.id==='string'&&/^[a-f0-9]{16}$/.test(item.id)&&typeof item.title==='string'&&allowedURL(item.url,source)&&Number.isFinite(Date.parse(item.publishedAt));}
function mergeArchive(previous,batch,now=Date.now()){
 const stamp=new Date(now).toISOString();const records=new Map((previous?.articles||[]).filter(validArticle).map(i=>[i.id,i]));
 // Earliest discovery anchors a group; later reports never change its permalink.
 const candidates=(batch.articles||batch.items||[]).filter(validArticle).sort((a,b)=>Date.parse(a.publishedAt)-Date.parse(b.publishedAt));
 for(const article of candidates){
  const old=records.get(article.id);
  const match=old?null:[...records.values()].find(existing=>sameAnnouncement(existing,article));
  records.set(article.id,{...article,firstSeenAt:old?.firstSeenAt||stamp,groupId:old?.groupId||match?.groupId||article.id});
 }
 const articles=[...records.values()].filter(i=>now-Date.parse(i.publishedAt)<180*86400000&&Date.parse(i.publishedAt)<=now+300000).sort((a,b)=>Date.parse(b.publishedAt)-Date.parse(a.publishedAt)).slice(0,1500);
 return {version:1,checkedAt:batch.checkedAt,updatedAt:batch.updatedAt,status:batch.status,sources:batch.sources,articles,perspective:batch.perspective||previous?.perspective||null};
}
function groupsFrom(state){
 const groups=new Map();
 for(const article of (state?.articles||[]).filter(validArticle)){
  const key=article.groupId||article.id;
  if(!groups.has(key))groups.set(key,[]);groups.get(key).push(article);
 }
 return [...groups].map(([id,reports])=>{
  reports.sort((a,b)=>Date.parse(a.firstSeenAt)-Date.parse(b.firstSeenAt)||Date.parse(a.publishedAt)-Date.parse(b.publishedAt));
  const primary=reports[0];const topics=topicsFor(primary);if(!topics.length)topics.push('Research');
  return {...primary,id,topics,implication:IMPLICATIONS[topics[0]],contextKind:'Automatic topic-based prompt',firstSeenAt:reports.reduce((date,r)=>r.firstSeenAt<date?r.firstSeenAt:date,primary.firstSeenAt),reports:reports.map(r=>({id:r.id,sourceId:r.sourceId,source:r.source,title:r.title,url:r.url,publishedAt:r.publishedAt})),publishedAt:primary.publishedAt};
 }).sort((a,b)=>Date.parse(b.publishedAt)-Date.parse(a.publishedAt));
}
function responseFrom(state,{archive=false,storage='unconfigured',now=Date.now()}={}){
 const groups=groupsFrom(state);const counts=new Map();
 const items=archive?groups:groups.filter(item=>{if(now-Date.parse(item.publishedAt)>=30*86400000)return false;const count=counts.get(item.sourceId)||0;if(count>=4)return false;counts.set(item.sourceId,count+1);return true;}).slice(0,24);
 const p=state?.perspective;
 return {version:1,checkedAt:state?.checkedAt||null,updatedAt:state?.updatedAt||null,status:state?.status||'stale',refreshMinutes:5,sources:state?.sources||[],items,total:groups.length,storage,perspective:p&&now-Date.parse(p.date)<7*86400000?p:null};
}
function parsePerspective(data,now=Date.now()){
 if(!data||!Array.isArray(data.quotes)||data.license!=='https://creativecommons.org/licenses/by/4.0/')return null;
 const safe=url=>{try{const u=new URL(url);return u.protocol==='https:'&&!u.username&&!u.password&&!u.port?u.href:null}catch{return null}};
 const candidates=data.quotes.filter(q=>typeof q.text==='string'&&q.text.length<=220&&q.text.trim().split(/\s+/).length<=25&&q.speaker&&safe(q.source?.url)&&safe(q.url)&&new URL(q.url).hostname==='aizeitgeist.tv'&&Date.parse(q.date)<=now&&now-Date.parse(q.date)<7*86400000).sort((a,b)=>Date.parse(b.date)-Date.parse(a.date));
 const day=new Intl.DateTimeFormat('en-CA',{timeZone:'Europe/Berlin',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date(now));const latest=candidates.filter(q=>q.date===candidates[0]?.date);if(!latest.length)return null;
 const q=latest[parseInt(createHash('sha256').update(day).digest('hex').slice(0,8),16)%latest.length];
 return {text:q.text,speaker:String(q.speaker).slice(0,160),date:q.date,context:String(q.context||'').slice(0,500),url:q.url,source:{url:q.source.url,publisher:String(q.source.publisher||'Original source').slice(0,100)},credit:'AI Zeitgeist · Büro Bloock',license:data.license};
}
module.exports={TOPICS,topicsFor,sameAnnouncement,mergeArchive,groupsFrom,responseFrom,parsePerspective};
