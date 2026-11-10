const {test}=require('node:test');
const assert=require('node:assert/strict');
const vm=require('node:vm');
const fs=require('node:fs');

// Minimal DOM runs the actual client, including its saved motion preference and timers.
function client({paused=false,home=false}={}) {
 const elements=[],intervals=[],events=new Map(),requests=[];
 class Element {
  constructor(tag){this.tagName=tag.toUpperCase();this.open=false;this.children=[];this.dataset={};this.style={setProperty(){}};this.classList={add(){},remove(){},contains(){return false}};this.listeners={};elements.push(this);}
  append(...children){this.children.push(...children);}
  prepend(...children){this.children.unshift(...children);}
  replaceChildren(...children){this.children=children;}
  setAttribute(key,value){this[key]=value;}
  addEventListener(key,fn){this.listeners[key]=fn;}
  querySelectorAll(){return [];}
  contains(){return false;}
  focus(){}
  animate(){}
  set innerHTML(value){this.firstChild=new Element('svg');}
 }
 const story=(id,date)=>({id,sourceId:'openai',source:'OpenAI',title:id,url:'https://openai.com/index/'+id,publishedAt:new Date(date).toISOString()});
 const now=Date.now();
 const seed={version:1,status:'ok',checkedAt:new Date(now).toISOString(),updatedAt:new Date(now).toISOString(),sources:[],items:[story('old',now-7200000)]};
 let incoming=seed;
 const introduction=home?new Element('section'):null;
 const document={currentScript:{src:'https://example.test/ai-signals.js'},body:new Element('body'),hidden:false,activeElement:null,createElement:tag=>new Element(tag),createTextNode:text=>({textContent:text}),createDocumentFragment:()=>new Element('fragment'),querySelector:selector=>selector==='.page .introduction'?introduction:null,addEventListener:(key,fn)=>events.set(key,fn)};
 const context=vm.createContext({
  window:{YWM_AI_SIGNALS_BOOTSTRAP:seed},document,URL,Intl,Date,Set,Array,Number,JSON,Math,AbortSignal,
  location:{protocol:'https:'},localStorage:{getItem:key=>key.endsWith('paused')?JSON.stringify(paused):null,setItem(){}},
  matchMedia:()=>({matches:false,addEventListener(){}}),
  setInterval:(fn,ms)=>intervals.push({fn,ms}),setTimeout:()=>1,clearTimeout(){},queueMicrotask,
  fetch:async(url,options)=>{requests.push({url,options});return {ok:true,json:async()=>incoming};}
 });
 for(const name of ['signals-core.js','signals-reader.js','ai-signals.js'])vm.runInContext(fs.readFileSync(require.resolve('../'+name),'utf8'),context);
 return {elements,intervals,document,requests,introduction,setIncoming:value=>{incoming=value;},seed,story};
}
const settle=()=>new Promise(resolve=>setImmediate(resolve));
test('motion paused on arrival still fetches and polls; new arrivals lead the stack',async()=>{
 const c=client({paused:true});await settle();
 assert.equal(c.requests.length,1);
 assert.equal(c.intervals[0].ms,300000);
 c.setIncoming({...c.seed,items:[c.story('new',Date.now()-60000),...c.seed.items]});
 await c.intervals[0].fn();
 assert.equal(c.requests.length,2);
 assert.equal(c.elements.find(el=>el.className==='signals-dock').dataset.story,'new');
 assert.equal(c.elements.find(el=>el.className==='signals-dock').dataset.paused,'true');
 assert.equal(c.requests[0].options.cache,'no-cache');
 c.document.hidden=true;
 await c.intervals[0].fn();
 assert.equal(c.requests.length,2);
});
test('manual news refresh requests the API independently of motion',async()=>{
 const c=client({paused:true});await settle();
 const refresh=c.elements.find(el=>el['aria-label']==='Check for new AI stories');
 await refresh.listeners.click();
 assert.equal(c.requests.length,2);
 assert.equal(refresh.disabled,false);
 assert.equal(refresh.textContent,'Refresh news');
});
test('inner pages start collapsed, can expand and collapse, and keep fetching while closed',async()=>{
 const c=client();await settle();
 const dock=c.elements.find(el=>el.className==='signals-dock');
 const content=c.elements.find(el=>el.id==='signals-dock-content');
 const toggle=c.elements.find(el=>el.className==='signals-dock-toggle');
 assert.equal(dock.dataset.collapsed,'true');assert.equal(content.hidden,true);assert.equal(toggle['aria-expanded'],'false');
 assert.equal(dock.dataset.paused,'true');assert.equal(c.requests.length,1);
 toggle.listeners.click();assert.equal(content.hidden,false);assert.equal(toggle['aria-expanded'],'true');assert.equal(dock.dataset.paused,'false');
 let prevented=false;
 dock.listeners.keydown({key:'Escape',preventDefault(){prevented=true;}});
 assert.equal(content.hidden,true);assert.ok(prevented);assert.equal(toggle['aria-expanded'],'false');
 await c.intervals[0].fn();assert.equal(c.requests.length,2);
});
test('the homepage retains the original inline stack and never creates a disclosure',async()=>{
 const c=client({home:true});await settle();
 const dock=c.elements.find(el=>el.className==='signals-dock');
 assert.ok(c.introduction.children.includes(dock));
 assert.equal(c.elements.some(el=>el.className==='signals-dock-toggle'),false);
 assert.equal(dock.dataset.collapsed,undefined);assert.equal(dock.dataset.paused,'false');
});
