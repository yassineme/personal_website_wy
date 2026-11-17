'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm'),path=require('node:path');
const source=fs.readFileSync(path.join(__dirname,'../site-motion.js'),'utf8');
function environment({reduced=false,coarse=false,compact=false,paused=false,css=true,native=false,missing=false}={}) {
  let id=0;const frames=new Map(),timers=new Map(),events=new Map(),instances=[],assigned=[],queries=new Map();
  class Element {
    constructor(){this.style={overflowY:'visible',scrollMarginTop:'24px'};this.scrollHeight=0;this.clientHeight=0;}
    matches(){return !!this.control;}
    setAttribute(){} append(node){this.child=node;} remove(){this.removed=true;}
    getBoundingClientRect(){return {top:400};}
  }
  const root=new Element(),body=new Element(),target=new Element();
  const control={getAttribute:()=>String(paused)};
  const listen=(name,fn)=>{const list=events.get(name)||[];list.push(fn);events.set(name,list);};
  const document={documentElement:root,body,hidden:false,querySelector:()=>control,getElementById:id=>id==='note'?target:null,createElement:()=>new Element(),addEventListener:listen};
  const location={href:'https://example.com/blog',origin:'https://example.com',pathname:'/blog',search:'',hash:'',assign:url=>assigned.push(url)};
  const window={scrollY:100,innerHeight:800,addEventListener:listen,scrollTo(options){this.lastScroll=options;}};
  class Lenis {
    constructor(options){this.options=options;this.calls=[];instances.push(this);}
    raf(time){this.lastTime=time;}
    scrollTo(...args){this.calls.push(args);}
    destroy(){this.destroyed=true;}
  }
  if(!missing)window.Lenis=Lenis;
  if(native){window.onpagereveal=null;window.CSSViewTransitionRule=class {};}
  let mutation;
  const context={window,document,location,Element,URL,Date,JSON,Math,parseFloat,
    history:{pushState(_,__,hash){location.hash=hash;}},
    matchMedia(query){const q={matches:query.includes('reduced-motion')?reduced:query.includes('coarse')?coarse:compact,addEventListener(_,fn){(this.listeners??=[]).push(fn);}};queries.set(query,q);return q;},
    getComputedStyle:element=>({...element.style,getPropertyValue:()=>css?'1':''}),
    MutationObserver:class {constructor(fn){mutation=fn;}observe(){}},
    sessionStorage:{getItem:()=>null,setItem(){},removeItem(){}},
    setTimeout(fn){const key=++id;timers.set(key,fn);return key;},clearTimeout:key=>timers.delete(key),
    requestAnimationFrame(fn){const key=++id;frames.set(key,fn);return key;},cancelAnimationFrame:key=>frames.delete(key)};
  vm.runInNewContext(source,context);
  return {window,root,body,document,target,instances,frames,assigned,queries,mutation:()=>mutation?.(),
    emit(name,event={}){for(const fn of events.get(name)||[])fn(event);},
    advance(){const queued=[...frames.values()];frames.clear();queued.forEach(fn=>fn(16));},
    pause(value){paused=value;mutation();},
    click(href,options={}){const link={href,target:'',hasAttribute:()=>false,relList:{contains:()=>false}};const event={button:0,target:{closest:()=>link},preventDefault(){this.defaultPrevented=true;},...options};this.emit('click',event);return event;},
    timer(){const [key,fn]=timers.entries().next().value;timers.delete(key);fn();},Element};
}
test('uses the photography site’s exact Lenis settings and exponential easing',()=>{
  const e=environment(),o=e.instances[0].options;
  assert.equal(o.duration,1.5);assert.equal(o.orientation,'vertical');assert.equal(o.gestureOrientation,'vertical');
  assert.equal(o.smoothWheel,true);assert.equal(o.wheelMultiplier,1);assert.equal(o.smoothTouch,false);assert.equal(o.touchMultiplier,2);
  for(const t of [0,.1,.5,1])assert.equal(o.easing(t),Math.min(1,1.001-Math.pow(2,-10*t)));
  assert.equal(e.frames.size,1);e.advance();assert.equal(e.instances[0].lastTime,16);assert.equal(e.frames.size,1);
});
test('reduced motion, paused motion, compact touch, missing CSS or library retain native scrolling',()=>{
  for(const options of [{reduced:true},{paused:true},{compact:true,coarse:true},{css:false},{missing:true}])assert.equal(environment(options).instances.length,0);
  assert.equal(environment({compact:true}).instances.length,1);
  assert.equal(environment({coarse:true}).instances.length,1);
});
test('nested panels, native regions, inputs and dialogs keep their own wheel input',()=>{
  const e=environment(),prevent=e.instances[0].options.prevent;
  const panel=new e.Element();panel.style.overflowY='auto';panel.scrollHeight=900;panel.clientHeight=300;
  assert.equal(prevent(panel),true);assert.equal(prevent(e.body),false);
  const control=new e.Element();control.control=true;assert.equal(prevent(control),true);
});
test('pause, page locks, visibility, media changes and restored history cleanly restart one instance',()=>{
  const e=environment();e.pause(true);assert.ok(e.instances[0].destroyed);assert.equal(e.frames.size,0);
  e.pause(false);assert.equal(e.instances.length,2);e.mutation();assert.equal(e.instances.length,2);
  e.body.style.overflowY='hidden';e.mutation();assert.ok(e.instances[1].destroyed);assert.equal(e.frames.size,0);
  e.body.style.overflowY='visible';e.mutation();assert.equal(e.instances.length,3);
  e.document.hidden=true;e.emit('visibilitychange');assert.equal(e.frames.size,0);
  e.document.hidden=false;e.emit('visibilitychange');assert.equal(e.instances.length,4);
  const q=e.queries.get('(prefers-reduced-motion: reduce)');q.matches=true;q.listeners.forEach(fn=>fn());assert.equal(e.frames.size,0);
  q.matches=false;q.listeners.forEach(fn=>fn());assert.equal(e.instances.length,5);
  e.emit('pagehide');assert.equal(e.frames.size,0);e.emit('pageshow',{persisted:true});assert.equal(e.frames.size,1);
});
test('anchors share the same easing, preserve sticky-header offset and update the URL',()=>{
  const e=environment({native:true});assert.ok(e.click('https://example.com/blog#note').defaultPrevented);
  const [target,options]=e.instances[0].calls.at(-1);assert.equal(target,e.target);assert.equal(options.offset,-24);assert.equal(options.duration,1.5);assert.equal(e.window.lastScroll,undefined);
  e.window.siteScroll.scrollTo(0);assert.equal(e.instances[0].calls.at(-1)[0],0);
  const mobile=environment({compact:true});mobile.window.siteScroll.scrollTo(0);assert.equal(mobile.instances[0].calls.at(-1)[1].duration,.65);
  const reduced=environment({reduced:true});reduced.window.siteScroll.scrollTo(0);assert.equal(reduced.window.lastScroll.behavior,'instant');
});
test('explicit native input interrupts a running anchor glide',()=>{
  for(const action of [e=>e.emit('keydown',{key:'PageDown'}),e=>e.emit('pointerdown'),e=>e.emit('touchstart'),e=>e.emit('popstate')]){
    const e=environment();action(e);const [target,options]=e.instances[0].calls.at(-1);assert.equal(target,100);assert.equal(options.immediate,true);
  }
});
test('page transitions leave external links, anchors and modified clicks native',()=>{
  const e=environment();
  for(const href of ['https://external.com/about','https://example.com/blog#missing','https://example.com/assets/file.pdf','https://example.com/api/contact'])assert.ok(!e.click(href).defaultPrevented);
  assert.ok(!e.click('https://example.com/about',{metaKey:true}).defaultPrevented);
  assert.ok(e.click('https://example.com/about').defaultPrevented);assert.equal(e.frames.size,0);e.timer();assert.equal(e.assigned[0],'https://example.com/about');
  e.timer();assert.ok(e.body.child.removed);assert.equal(e.frames.size,1);
  assert.ok(!environment({native:true}).click('https://example.com/about').defaultPrevented);
});
test('every shared-motion page loads the pinned local library before its controller',()=>{
  const root=path.join(__dirname,'..');
  for(const file of [...fs.readdirSync(root).filter(f=>f.endsWith('.html')), ...fs.readdirSync(path.join(root,'blog')).filter(f=>f.endsWith('.html')).map(f=>'blog/'+f)]){
    const html=fs.readFileSync(path.join(root,file),'utf8'),controller=html.indexOf('<script src="/site-motion.js"');
    if(controller<0)continue;
    const vendor=html.indexOf('<script src="/assets/vendor/lenis-1.1.18.min.js"');assert.ok(vendor>=0&&vendor<controller,file);
  }
  const {ROOT_FILES}=require('../scripts/build-public.cjs');assert.ok(ROOT_FILES.includes('site-motion.js'));
  assert.match(fs.readFileSync(path.join(root,'assets/vendor/lenis-1.1.18.min.js'),'utf8'),/1\.1\.18/);
});
