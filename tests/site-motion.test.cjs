'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const source=fs.readFileSync(require('node:path').join(__dirname,'../site-motion.js'),'utf8');
function environment({reduced=false,native=false,css=true,quantized=false,pixelRatio=1,scrollOnly=false}={}) {
  let time=0,id=0;const frames=new Map(),timers=new Map(),events=new Map(),assigned=[],scrollWrites=[];
  class Element {
    constructor(){this.classes=new Set();this.style={overflowY:'visible'};this.scrollHeight=0;this.clientHeight=0;this.parentElement=null;}
    classList={add:(...xs)=>xs.forEach(x=>this.classes.add(x)),remove:(...xs)=>xs.forEach(x=>this.classes.delete(x)),contains:x=>this.classes.has(x)};
    matches(selector){return !!this.control || (!!this.nativeScroll && selector.includes('[data-native-scroll]'));}
    setAttribute(){}
    append(node){this.child=node;}
    remove(){this.removed=true;}
  }
  const root=new Element(),body=new Element();root.scrollHeight=4000;
  const motion={matches:reduced,addEventListener(_,fn){this.change=fn;}};
  const listen=(name,fn)=>{const list=events.get(name)||[];list.push(fn);events.set(name,list);};
  const document={documentElement:root,body,hidden:false,currentScript:{hasAttribute:name=>scrollOnly&&name==='data-scroll-only'},createElement:()=>new Element(),addEventListener:listen};
  const location={href:'https://example.com/blog',origin:'https://example.com',pathname:'/blog',search:'',assign:url=>assigned.push(url)};
  const storage=new Map();
  const window={scrollY:100,innerHeight:800,devicePixelRatio:pixelRatio,addEventListener:listen,scrollTo({top}){this.scrollY=quantized?Math.round(top*pixelRatio)/pixelRatio:top;scrollWrites.push(this.scrollY);}};
  if(native){window.onpagereveal=null;window.CSSViewTransitionRule=class {};}
  const ctx={window,document,location,Element,URL,Date,JSON,Math,matchMedia:()=>motion,getComputedStyle:element=>({...element.style,getPropertyValue:()=>css?'1':''}),performance:{now:()=>time},sessionStorage:{getItem:k=>storage.get(k),setItem:(k,v)=>storage.set(k,v),removeItem:k=>storage.delete(k)},setTimeout(fn,delay){const key=++id;timers.set(key,{fn,at:time+delay});return key;},clearTimeout:key=>timers.delete(key),requestAnimationFrame(fn){const key=++id;frames.set(key,fn);return key;},cancelAnimationFrame:key=>frames.delete(key)};
  vm.runInNewContext(source,ctx);
  function emit(name,event={}){for(const fn of events.get(name)||[])fn(event);}
  function advance(ms){time+=ms;const queued=[...frames.values()];frames.clear();queued.forEach(fn=>fn(time));for(const [key,timer]of [...timers])if(timer.at<=time){timers.delete(key);timer.fn();}}
  function wheel(deltaY,options={}){const event={deltaY,deltaX:0,deltaMode:0,cancelable:true,target:body,preventDefault(){this.defaultPrevented=true;},...options};emit('wheel',event);return event;}
  function click(href,options={}){const link={href,target:'',hasAttribute:()=>false,relList:{contains:()=>false}};const event={button:0,target:{closest:()=>link},preventDefault(){this.defaultPrevented=true;},...options};emit('click',event);return event;}
  return {window,root,body,motion,document,frames,timers,assigned,storage,scrollWrites,emit,advance,wheel,click,Element};
}
test('pixel-rounded browsers settle without repeatedly writing the same final offsets',()=>{
  for(const pixelRatio of [1,2,3])for(const dt of [1000/60,1000/120])for(const delta of [600.25,-35.7,1.2,-1.2]){
    const e=environment({quantized:true,pixelRatio});e.wheel(delta);
    for(let i=0;i<240&&e.frames.size;i++)e.advance(dt);
    assert.equal(e.frames.size,0,'the subpixel tail must finish');
    assert.equal(e.window.scrollY,Math.round((100+delta)*pixelRatio)/pixelRatio);
    for(let i=1;i<e.scrollWrites.length;i++){
      assert.notEqual(e.scrollWrites[i],e.scrollWrites[i-1],'do not rewrite a pixel-rounded scroll position');
      assert.ok(delta>0?e.scrollWrites[i]>=e.scrollWrites[i-1]:e.scrollWrites[i]<=e.scrollWrites[i-1],'settling must not reverse direction');
    }
  }
});
test('spring converges without overshooting at 60 and 120 Hz and stops scheduling frames',()=>{
  const positions=[];
  for(const dt of [1000/60,1000/120]){
    const e=environment();assert.ok(e.wheel(600).defaultPrevented);
    e.advance(dt);assert.ok(e.window.scrollY>100&&e.window.scrollY<700);
    for(let t=dt;t<2000;t+=dt){e.advance(dt);assert.ok(e.window.scrollY<=700);}
    assert.equal(e.window.scrollY,700);assert.equal(e.frames.size,0);assert.ok(!e.root.classes.has('physics-scrolling'));positions.push(e.window.scrollY);
  }
  assert.equal(positions[0],positions[1]);
});
test('reversals and document boundaries settle within the native scroll range',()=>{
  const e=environment();e.wheel(500);e.advance(50);e.wheel(-1000);
  for(let i=0;i<100;i++){e.advance(16);assert.ok(e.window.scrollY>=0&&e.window.scrollY<=3200);}
  assert.equal(e.window.scrollY,0);e.wheel(100000);
  for(let i=0;i<130;i++)e.advance(16);
  assert.equal(e.window.scrollY,3200);
});
test('repeated wheel input cannot natively jump ahead of a glide toward a page boundary',()=>{
  const e=environment();e.wheel(10000);e.advance(16);
  assert.ok(e.window.scrollY<3200);
  assert.ok(e.wheel(100).defaultPrevented,'the active spring still owns the clamped gesture');
  for(let i=0;i<150&&e.frames.size;i++)e.advance(16);
  assert.equal(e.window.scrollY,3200);
  assert.ok(!e.wheel(100).defaultPrevented,'after settling native boundary handling is restored');
});
test('scrolling retains a gentle tail after release and slows progressively into rest',()=>{
  const e=environment();e.wheel(600);
  for(let i=0;i<36;i++)e.advance(1000/60);
  const remaining=700-e.window.scrollY;
  assert.ok(remaining>20&&remaining<70,'the glide should still be visibly settling at 600ms');
  assert.ok(e.frames.size>0);
  const steps=[];
  // Compare short visible intervals: individual frames can legitimately share
  // the same device pixel once the display rounds the spring's position.
  for(let i=0;i<4;i++){const before=e.window.scrollY;for(let j=0;j<6;j++)e.advance(1000/60);steps.push(e.window.scrollY-before);}
  for(let i=1;i<steps.length;i++)assert.ok(steps[i]>0&&steps[i]<steps[i-1]);
  for(let i=0;i<120;i++)e.advance(1000/60);
  assert.equal(e.window.scrollY,700);assert.equal(e.frames.size,0);
});
test('reduced motion, zoom, nested scrolling, controls, handled wheel and locked pages retain native input',()=>{
  const e=environment();const panel=new e.Element();panel.style.overflowY='auto';panel.scrollHeight=900;panel.clientHeight=300;
  const control=new e.Element();control.control=true;
  for(const options of [{ctrlKey:true},{shiftKey:true},{deltaX:500},{defaultPrevented:true},{target:panel},{target:control}])assert.equal(e.wheel(100,options).defaultPrevented,options.defaultPrevented);
  e.body.style.overflowY='hidden';assert.ok(!e.wheel(100).defaultPrevented);
  assert.ok(!environment({reduced:true}).wheel(100).defaultPrevented);
  assert.ok(!environment({css:false}).wheel(100).defaultPrevented);
});
test('keyboard, pointer, external scroll, motion preference and restored history stop momentum',()=>{
  for(const action of [e=>e.emit('keydown',{key:'PageDown'}),e=>e.emit('pointerdown'),e=>{e.window.scrollY=900;e.emit('scroll');},e=>{e.motion.matches=true;e.motion.change();},e=>e.emit('pageshow',{persisted:true})]){
    const e=environment();e.wheel(500);e.advance(16);action(e);const position=e.window.scrollY;e.advance(1000);assert.equal(e.frames.size,0);assert.equal(e.window.scrollY,position);
  }
});
test('native or already-handled wheel input cancels the spring before the browser takes over',()=>{
  for(const options of [{cancelable:false},{defaultPrevented:true},{ctrlKey:true},{deltaX:200}]){
    const e=environment();e.wheel(500);e.advance(16);
    assert.ok(e.frames.size>0);
    e.wheel(100,options);
    assert.equal(e.frames.size,0,'native input must not race an active animation');
    const nativePosition=e.window.scrollY+80;e.window.scrollY=nativePosition;
    e.advance(16);assert.equal(e.window.scrollY,nativePosition);
  }
});
test('mixed trackpad bursts stay native until idle, then regain the original glide',()=>{
  const e=environment();e.wheel(500);e.advance(16);
  e.wheel(60,{cancelable:false});
  e.window.scrollY+=60;e.emit('scroll');
  for(let i=0;i<4;i++){
    e.advance(30);
    assert.ok(!e.wheel(15).defaultPrevented);
    assert.equal(e.frames.size,0);
  }
  e.advance(181);
  assert.ok(e.wheel(100).defaultPrevented);
  assert.ok(e.frames.size>0);
});
test('empty wheel events do not cut off a settling glide',()=>{
  const e=environment();e.wheel(300);e.advance(16);
  const previous=e.window.scrollY;e.wheel(0);e.advance(16);
  assert.ok(e.frames.size>0);assert.ok(e.window.scrollY>previous);
});
test('fallback only delays ordinary internal page navigation and restores a cancelled departure',()=>{
  const e=environment();
  for(const href of ['https://external.com/about','https://example.com/blog#note','https://example.com/assets/file.pdf','https://example.com/api/contact'])assert.ok(!e.click(href).defaultPrevented);
  assert.ok(!e.click('https://example.com/about',{metaKey:true}).defaultPrevented);
  assert.ok(e.click('https://example.com/about').defaultPrevented);assert.equal(e.assigned.length,0);
  e.advance(360);assert.equal(e.assigned[0],'https://example.com/about');assert.ok(e.storage.has('ywm-page-arrival'));
  e.advance(1500);assert.ok(e.body.child.removed);
  const native=environment({native:true});assert.ok(!native.click('https://example.com/about').defaultPrevented);
});

test('scroll-only workspaces keep the same spring without delaying links or drawing navigation curtains',()=>{
  const e=environment({scrollOnly:true});
  assert.ok(e.wheel(600).defaultPrevented);e.advance(16);
  assert.ok(e.window.scrollY>100&&e.window.scrollY<700);
  assert.ok(!e.click('https://example.com/about').defaultPrevented);
  assert.equal(e.timers.size,0);assert.equal(e.body.child,undefined);
  for(let i=0;i<150&&e.frames.size;i++)e.advance(16);
  assert.equal(e.window.scrollY,700);assert.equal(e.frames.size,0);
  assert.ok(!environment({scrollOnly:true,reduced:true}).wheel(100).defaultPrevented);
});

test('changing an app view cancels old momentum before the next view starts scrolling',()=>{
  const e=environment({scrollOnly:true});e.wheel(500);e.advance(16);
  assert.ok(e.frames.size>0);e.emit('site-motion:reset-scroll');
  e.window.scrollY=0;e.emit('scroll');e.advance(1000);
  assert.equal(e.frames.size,0);assert.equal(e.window.scrollY,0);
  e.wheel(100);e.advance(16);
  assert.ok(e.window.scrollY>0&&e.window.scrollY<100);
  for(let i=0;i<150&&e.frames.size;i++)e.advance(16);
  assert.equal(e.window.scrollY,100);
});

test('explicit native sidebar and table regions own input even when they have no vertical overflow',()=>{
  const e=environment({scrollOnly:true}),panel=new e.Element(),child=new e.Element();
  panel.nativeScroll=true;panel.parentElement=e.body;child.parentElement=panel;
  e.wheel(500);e.advance(16);const position=e.window.scrollY;
  assert.ok(!e.wheel(100,{target:child}).defaultPrevented);
  assert.equal(e.frames.size,0);e.advance(1000);assert.equal(e.window.scrollY,position);
});
