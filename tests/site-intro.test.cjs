'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const source=fs.readFileSync(require('node:path').join(__dirname,'../site-intro.js'),'utf8');
function environment({seen=false,reduced=false,blocked=false,sessionSeen=false,stylesheet=true}={}){
 let time=0,serial=0;const timers=new Map(),frames=new Map(),events=new Map();
 function element(tag){const classes=new Set();return{tag,children:[],textContent:'',attrs:{},isConnected:true,style:{values:{},setProperty(k,v){this.values[k]=v;}},classList:{add(...xs){xs.forEach(x=>classes.add(x));},remove(...xs){xs.forEach(x=>classes.delete(x));},contains(x){return classes.has(x);}},setAttribute(k,v){this.attrs[k]=v;},append(...xs){this.children.push(...xs);},addEventListener(k,fn){this.events??={};this.events[k]=fn;},focus(){doc.activeElement=this;},remove(){this.removed=true;this.isConnected=false;}};}
 const root=element('html'),body=element('body');
 const doc={documentElement:root,body,activeElement:body,readyState:'complete',styleSheets:stylesheet?[{href:'https://www.wyassine.com/site-intro.css'}]:[],createElement:element,addEventListener(k,fn){events.set(k,fn);},removeEventListener(k){events.delete(k);}};
 const values=new Map(seen?[['ywm-intro-seen-v1','1']]:[]),session=new Map(sessionSeen?[['ywm-intro-seen-v1','1']]:[]);
 const store=map=>({getItem:k=>map.get(k)||null,setItem(k,v){map.set(k,v);}});
 const motion={matches:reduced,addEventListener(k,fn){this.changed=fn;},removeEventListener(){}};
 const win={matchMedia:()=>motion,localStorage:store(values),sessionStorage:store(session)};
 if(blocked)for(const k of ['localStorage','sessionStorage'])Object.defineProperty(win,k,{get(){throw Error('disabled');}});
 const ctx={window:win,document:doc,location:{href:'https://www.wyassine.com/'},URL,performance:{now:()=>time},setTimeout(fn,delay){const id=++serial;timers.set(id,{fn,at:time+delay});return id;},clearTimeout:id=>timers.delete(id),requestAnimationFrame(fn){const id=++serial;frames.set(id,fn);return id;},cancelAnimationFrame:id=>frames.delete(id)};
 vm.runInNewContext(source,ctx);
 function advance(to){time=to;const queued=[...frames.values()];frames.clear();queued.forEach(fn=>fn(time));for(const [id,timer]of [...timers])if(timer.at<=time){timers.delete(id);timer.fn();}}
 return{root,body,doc,values,frames,timers,events,motion,advance,get overlay(){return body.children.find(x=>x.className==='site-intro');}};
}
test('intro runs once and reaches 100 before revealing the page',()=>{
 const e=environment();assert.ok(e.overlay);assert.equal(e.values.get('ywm-intro-seen-v1'),'1');assert.ok(e.root.classList.contains('site-intro-active'));
 const number=e.overlay.children[2].children[1].children[0];assert.equal(number.textContent,'0');
 e.advance(1200);assert.ok(Number(number.textContent)>0&&Number(number.textContent)<100);
 e.advance(2400);assert.equal(number.textContent,'100');e.advance(2600);assert.ok(e.overlay.classList.contains('is-leaving'));
 e.advance(3400);assert.ok(e.overlay.removed);assert.ok(!e.root.classList.contains('site-intro-active'));assert.equal(e.events.size,0);
});
test('returning visitors, reduced motion and blocked storage see the website immediately',()=>{
 for(const options of [{seen:true},{reduced:true},{blocked:true},{sessionSeen:true}]){const e=environment(options);assert.ok(!e.overlay);assert.ok(!e.root.classList.contains('site-intro-active'));}
});
test('skip and Escape remove the intro immediately without leaving scroll or focus traps',()=>{
 for(const method of ['skip','escape']){const e=environment();if(method==='skip')e.overlay.children[3].events.click();else e.events.get('keydown')({key:'Escape',preventDefault(){}});assert.ok(e.overlay.removed);assert.ok(!e.root.classList.contains('site-intro-active'));assert.equal(e.events.size,0);assert.equal(e.frames.size,0);}
});
test('watchdog, missing CSS and changed motion preference cannot strand the visitor',()=>{
 const stalled=environment();stalled.advance(5000);assert.ok(stalled.overlay.removed);assert.ok(!stalled.root.classList.contains('site-intro-active'));
 const unstyled=environment({stylesheet:false});assert.ok(!unstyled.overlay);assert.ok(!unstyled.root.classList.contains('site-intro-active'));
 const motion=environment();motion.motion.changed({matches:true});assert.ok(motion.overlay.removed);
});
test('the shared SEO build includes the intro once on public pages and ships its assets',()=>{
 const path=require('node:path'),root=path.join(__dirname,'..');
 for(const file of ['index.html','about.html','ai-strategy.html','blog.html','signals.html']){
  const html=fs.readFileSync(path.join(root,file),'utf8');assert.equal((html.match(/src="\/site-intro.js"/g)||[]).length,1,file);assert.equal((html.match(/href="\/site-intro.css"/g)||[]).length,1,file);
 }
 const {ROOT_FILES}=require('../scripts/build-public.cjs');for(const file of ['site-intro.css','site-intro.js'])assert.ok(ROOT_FILES.includes(file));
});
