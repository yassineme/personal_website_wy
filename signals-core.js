(function(root,factory){const api=factory();if(typeof module==='object'&&module.exports)module.exports=api;else root.YWM_SIGNALS=api;})(typeof window==='object'?window:globalThis,function(){
 'use strict';
 const topics=['Agents','Enterprise adoption','Research','Governance','People & work'];
 const hosts={openai:['openai.com','www.openai.com'],deepmind:['deepmind.google','blog.google'],huggingface:['huggingface.co'],nist:['nist.gov','www.nist.gov'],google:['blog.google'],mistral:['mistral.ai'],microsoft:['www.microsoft.com','blogs.microsoft.com'],mit:['news.mit.edu'],aws:['aws.amazon.com'],nvidia:['blogs.nvidia.com'],arstechnica:['arstechnica.com'],decoder:['the-decoder.com'],simon:['simonwillison.net'],usefulthing:['www.oneusefulthing.org','www.oneusefulthing.com'],snakeoil:['www.normaltech.ai','www.aisnakeoil.com'],interconnects:['www.interconnects.ai'],ukaisi:['www.gov.uk']};
 function https(raw){try{const u=new URL(raw);return u.protocol==='https:'&&!u.username&&!u.password&&!u.port?u.href:null;}catch{return null;}}
 function safeURL(raw,id){const url=https(raw);return url&&hosts[id]?.includes(new URL(url).hostname)?url:null;}
 function valid(item){return item&&typeof item.id==='string'&&typeof item.title==='string'&&safeURL(item.url,item.sourceId)&&Number.isFinite(Date.parse(item.publishedAt));}
 function storage(adapter){return {get(key,fallback){try{return JSON.parse(adapter.getItem('ywm-signals-'+key))??fallback;}catch{return fallback;}},set(key,value){try{adapter.setItem('ywm-signals-'+key,JSON.stringify(value));}catch{}}};}
 function createVisit(store,clock=Date.now){
  const old=store.get('visit',null);const validOld=old&&Array.isArray(old.known)&&Array.isArray(old.baseline)&&Number.isFinite(old.activeAt);
  const continuing=validOld&&clock()-old.activeAt<30*60000;
  let cutoff=validOld?(continuing?(old.cutoff||old.activeAt):old.activeAt):clock(),activeAt=validOld?old.activeAt:clock();
  let established=!!validOld,baseline=new Set(validOld?(continuing?old.baseline:old.known):[]),known=new Set(validOld?old.known:[]);
  const ids=item=>[item.id,...(item.reports||[]).map(report=>report.id)].filter(x=>typeof x==='string');
  const save=()=>{activeAt=clock();store.set('visit',{baseline:[...baseline].slice(-6000),known:[...known].slice(-6000),activeAt,cutoff});};
  return {
   observe(items){if(established&&clock()-activeAt>=30*60000){baseline=new Set(known);cutoff=activeAt;}for(const item of items.filter(valid)){for(const id of ids(item)){known.add(id);if(!established)baseline.add(id);}}established=true;save();},
   isNew(item){return established&&Date.parse(item.firstSeenAt||item.publishedAt)>cutoff&&ids(item).every(id=>!baseline.has(id));},
   markSeen(items){for(const item of items.filter(valid))for(const id of ids(item)){baseline.add(id);known.add(id);}save();}
  };
 }
 function filterItems(items,{query='',topic='',from='',to='',savedOnly=false,newOnly=false,savedIds=new Set(),isNew=()=>false}={}){
  const terms=query.trim().toLocaleLowerCase().split(/\s+/).filter(Boolean);
  return items.filter(valid).filter(item=>{
   const copy=[item.title,item.excerpt,item.source,...(item.topics||[]),...(item.reports||[]).map(r=>r.source)].join(' ').toLocaleLowerCase();
   const day=new Date(item.publishedAt).toISOString().slice(0,10);
   return terms.every(term=>copy.includes(term))&&(!topic||(item.topics||[]).includes(topic))&&(!from||day>=from)&&(!to||day<=to)&&(!savedOnly||savedIds.has(item.id))&&(!newOnly||isNew(item));
  });
 }
 return {topics,hosts,https,safeURL,valid,storage,createVisit,filterItems};
});
