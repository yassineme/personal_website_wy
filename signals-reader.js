(() => {
 'use strict';
 const core=window.YWM_SIGNALS;
 const make=(tag,cls,copy)=>{const el=document.createElement(tag);if(cls)el.className=cls;if(copy)el.textContent=copy;return el;};
 const button=(copy,label)=>{const el=make('button','signals-action',copy);el.type='button';if(label)el.setAttribute('aria-label',label);return el;};
 const link=(copy,url,external=false)=>{const el=make('a','signals-text-link',copy);el.href=url;if(external){el.target='_blank';el.rel='noopener noreferrer';}return el;};
 let adapter;try{adapter=localStorage;}catch{adapter={getItem(){return null;},setItem(){}};}
 const store=core.storage(adapter),visit=core.createVisit(store);
 let bookmarks=store.get('bookmarks',[]);bookmarks=Array.isArray(bookmarks)?bookmarks.filter(core.valid).slice(-200):[];
 const date=value=>new Intl.DateTimeFormat('en',{day:'numeric',month:'short',year:'numeric'}).format(new Date(value));
 function createReader({rootURL,archive=false,onChange=()=>{},onDismiss=null}){
  let data=null,limit=30;const root=make('div','signals-reader'),filters=make('div','signals-filters');
  const searchLabel=make('label','signals-field','Search signals');const search=make('input');search.type='search';search.placeholder='Search stories, sources, ideas…';searchLabel.append(search);
  const topicLabel=make('label','signals-field','Topic');const topic=make('select');
  for(const name of ['',...core.topics]){const option=make('option','',name||'All topics');option.value=name;topic.append(option);}topicLabel.append(topic);
  filters.append(searchLabel,topicLabel);
  let from=null,to=null;
  if(archive){for(const [name,key] of [['Published from','from'],['Published to','to']]){const label=make('label','signals-field',name),input=make('input');input.type='date';label.append(input);filters.append(label);if(key==='from')from=input;else to=input;}}
  const modes=make('div','signals-reader-modes');const saved=button('Saved','Show saved signals'),fresh=button('New','Show new signals'),reset=button('Clear filters'),mark=button('Mark as seen');
  saved.setAttribute('aria-pressed','false');fresh.setAttribute('aria-pressed','false');
  modes.append(saved,fresh,reset,mark);
  const notice=make('p','signals-result-count');notice.setAttribute('role','status');notice.setAttribute('aria-live','polite');
  const cards=make('div','signals-cards');const more=button('Load more signals');const perspective=make('aside','signals-perspective');perspective.setAttribute('aria-label','AI perspective of the day');
  root.append(filters,modes,notice,cards,more,perspective);
  if(!archive)root.append(link('Search the full signal archive ↗',new URL('signals.html',rootURL).href));
  const controls=[search,topic,from,to].filter(Boolean);controls.forEach(el=>el.addEventListener(el===search?'input':'change',()=>{limit=30;render();}));
  let savedOnly=false,newOnly=false;
  saved.addEventListener('click',()=>{savedOnly=!savedOnly;saved.setAttribute('aria-pressed',String(savedOnly));limit=30;render();});
  fresh.addEventListener('click',()=>{newOnly=!newOnly;fresh.setAttribute('aria-pressed',String(newOnly));limit=30;render();});
  reset.addEventListener('click',()=>{controls.forEach(el=>{el.value='';});savedOnly=false;newOnly=false;saved.setAttribute('aria-pressed','false');fresh.setAttribute('aria-pressed','false');limit=30;render();});
  mark.addEventListener('click',()=>{visit.markSeen(data?.items||[]);render();onChange();});
  more.addEventListener('click',()=>{limit+=30;render();});
  function cardFor(item,expanded){
   const card=make('article','signal-card');card.dataset.story=item.id;card.id='signal-'+item.id;
   const meta=make('div','signal-meta');meta.append(make('span','signal-source',item.source));
   if(visit.isNew(item)){const badge=make('span','signal-new','New');meta.append(badge);}
   const time=make('time','',date(item.publishedAt));time.dateTime=item.publishedAt;meta.append(time);
   if(onDismiss){const dismiss=button('×','Dismiss: '+item.title);dismiss.className='signal-dismiss';dismiss.addEventListener('click',()=>{onDismiss(item);search.focus({preventScroll:true});});meta.append(dismiss);}card.append(meta);
   const details=make('details','signal-story');details.open=expanded.has(item.id);details.dataset.story=item.id;
   const headline=make('summary');headline.append(make('h3','',item.title),make('span','signal-expand','+'));details.append(headline);
   const body=make('div','signal-body');body.append(make('span','signal-lens',(item.topics||[]).join(' · ')||item.lens),make('p','',item.excerpt||'Read the publisher’s article for the full details.'),make('small','','Publisher excerpt'));
   if(item.implication){body.append(make('h4','signal-context-label','A question for your business'),make('p','signal-context',item.implication),make('small','','Automatic topic-based prompt · not an article summary or Yassine’s commentary'));}
   body.append(link('Read original article ↗',core.safeURL(item.url,item.sourceId),true));
   const reports=(item.reports||[]).filter(r=>core.safeURL(r.url,r.sourceId));
   if(reports.length>1){const coverage=make('details','signal-coverage');coverage.append(make('summary','',reports.length+' reports on this announcement'));for(const report of reports)coverage.append(link(report.source+' · '+report.title,core.safeURL(report.url,report.sourceId),true));body.append(coverage);}
   const actions=make('div','signal-actions');const isSaved=bookmarks.some(b=>b.id===item.id);const save=button(isSaved?'Saved ✓':'Save',isSaved?'Remove saved signal: '+item.title:'Save signal: '+item.title);save.setAttribute('aria-pressed',String(isSaved));
   save.addEventListener('click',()=>{if(bookmarks.some(b=>b.id===item.id))bookmarks=bookmarks.filter(b=>b.id!==item.id);else bookmarks=[...bookmarks,item].slice(-200);store.set('bookmarks',bookmarks);render();const replacement=[...cards.children].find(el=>el.dataset.story===item.id)?.querySelector('.signal-actions button');(replacement||saved).focus({preventScroll:true});});
   const permalink=new URL('signals.html',rootURL);permalink.searchParams.set('story',item.id);
   const copy=button('Copy link','Copy link to signal: '+item.title);copy.addEventListener('click',async()=>{try{await navigator.clipboard.writeText(permalink.href);copy.textContent='Copied ✓';}catch{copy.textContent='Use permanent link ↗';}});
   actions.append(save,copy,link('Permanent link ↗',permalink.href));body.append(actions);details.append(body);card.append(details);return card;
  }
  function renderPerspective(){
   perspective.replaceChildren();const p=data?.perspective;
   if(!p||!core.https(p.url)||!core.https(p.source?.url)||new URL(p.url).hostname!=='aizeitgeist.tv'||p.license!=='https://creativecommons.org/licenses/by/4.0/'){perspective.hidden=true;return;}
   perspective.hidden=false;perspective.append(make('span','signals-kicker','AI perspective of the day'+(p.saved?' · Saved selection':'')),make('blockquote','',p.text),make('p','',p.speaker+' · '+date(p.date)),make('p','signal-perspective-context',(p.contextAdapted?'Context adapted from AI Zeitgeist · ':'Context from AI Zeitgeist · ')+p.context));
   const credits=make('div','signals-perspective-credit');credits.append(link('Original source · '+p.source.publisher,p.source.url,true),link('Curated by '+p.credit,p.url,true),link('CC BY 4.0',p.license,true));perspective.append(credits);
  }
  function render(){
   if(!data)return;
   const active=document.activeElement,activeID=active?.closest?.('.signal-card')?.dataset.story;
   const activeSelector=active?.tagName==='SUMMARY'?'.signal-story > summary':null;
   const expanded=new Set([...cards.querySelectorAll('details.signal-story[open]')].map(el=>el.dataset.story));
   const queryID=archive?new URL(location.href).searchParams.get('story'):null;
   let list=[...(data.items||[])];if(savedOnly){const map=new Map([...bookmarks,...list].map(i=>[i.id,i]));list=[...map.values()];}
   const filtered=core.filterItems(list,{query:search.value,topic:topic.value,from:from?.value,to:to?.value,savedOnly,newOnly,savedIds:new Set(bookmarks.map(i=>i.id)),isNew:visit.isNew});
   const selected=queryID?list.find(i=>i.id===queryID||(i.reports||[]).some(r=>r.id===queryID)):null;
   const showSelected=selected&&!search.value&&!topic.value&&!from?.value&&!to?.value&&!savedOnly&&!newOnly;
   if(showSelected){const index=filtered.findIndex(i=>i.id===selected.id);if(index>=0)filtered.unshift(...filtered.splice(index,1));expanded.add(selected.id);}
   notice.textContent=filtered.length+' '+(filtered.length===1?'signal':'signals')+(archive?' in the archive':' in this collection')+(queryID&&!selected?' · This story is outside the retained archive.':'');
   cards.replaceChildren();if(!filtered.length)cards.append(make('p','signals-empty',savedOnly?'No saved signals match these filters. Save a story to revisit it here.':'No signals match these filters. Try another topic or date.'));
   for(const item of filtered.slice(0,limit))cards.append(cardFor(item,expanded));
   more.hidden=filtered.length<=limit;mark.hidden=!(data.items||[]).some(visit.isNew);fresh.textContent='New · '+(data.items||[]).filter(visit.isNew).length;saved.textContent='Saved · '+bookmarks.length;
   renderPerspective();
   if(activeID&&activeSelector){const replacement=[...cards.children].find(el=>el.dataset.story===activeID)?.querySelector(activeSelector);(replacement||search).focus({preventScroll:true});}
  }
  return {element:root,visit,setData(next,{verified=false,selectedID=null}={}){data=next;if(verified)visit.observe(next.items||[]);render();if(selectedID){const card=[...cards.children].find(el=>el.dataset.story===selectedID);if(card)card.querySelector('details').open=true;}},render,newCount:()=>data?(data.items||[]).filter(visit.isNew).length:0};
 }
 window.YWM_SIGNALS_READER={createReader,visit};
})();
