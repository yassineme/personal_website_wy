'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const source=fs.readFileSync(require('node:path').join(__dirname,'../journal.js'),'utf8');
function setup() {
  let top=1000,height=2400,reads=0,fontReady,serial=0;
  const frames=new Map(),events=new Map(),observers=[],writes=[];
  const window={scrollY:0,innerHeight:800,ResizeObserver:null,addEventListener(name,fn){events.set(name,fn);}};
  const article={getBoundingClientRect(){reads++;return {top:top-window.scrollY};},get offsetHeight(){reads++;return height;}};
  const progress={style:new Proxy({}, {set(target,name,value){assert.notEqual(name,'width','scrolling must not change layout width');writes.push(value);target[name]=value;return true;}})};
  const pageBody={};
  const document={body:pageBody,querySelector(selector){return selector==='.article-body'?article:selector==='.article-progress'?progress:null;},querySelectorAll:()=>[],fonts:{ready:{then(fn){fontReady=fn;}}}};
  class ResizeObserver {constructor(fn){this.callback=fn;this.targets=[];observers.push(this);}observe(node){this.targets.push(node);}}
  window.ResizeObserver=ResizeObserver;
  const context=vm.createContext({window,document,ResizeObserver,requestAnimationFrame(fn){const id=++serial;frames.set(id,fn);return id;},get innerHeight(){return window.innerHeight;},get scrollY(){return window.scrollY;}});
  // Keep window properties and browser-global aliases synchronized in the fixture.
  Object.defineProperties(context,{innerHeight:{get:()=>window.innerHeight},scrollY:{get:()=>window.scrollY}});
  vm.runInContext(source,context);
  return {window,events,frames,writes,observers,get reads(){return reads;},get transform(){return progress.style.transform;},emit(name,y=window.scrollY){window.scrollY=y;events.get(name)?.();},bounds(nextTop,nextHeight){top=nextTop;height=nextHeight;},fontsReady(){fontReady();},flush(){const pending=[...frames.values()];frames.clear();pending.forEach(fn=>fn());}};
}
test('article scrolling coalesces updates without remeasuring geometry or changing layout width',()=>{
  const e=setup();assert.equal(e.transform,'scaleX(0)');assert.equal(e.reads,2);
  e.emit('scroll',1100);e.emit('scroll',1300);e.emit('scroll',1500);
  assert.equal(e.frames.size,1);e.flush();assert.equal(e.reads,2);
  assert.equal(e.transform,`scaleX(${700/1880})`);
  e.emit('scroll',10000);e.flush();assert.equal(e.transform,'scaleX(1)');
  const writes=e.writes.length;e.emit('scroll',11000);e.flush();assert.equal(e.writes.length,writes);
});
test('article progress refreshes geometry after content, font, viewport and history changes',()=>{
  const e=setup();assert.equal(e.observers[0].targets.length,2);
  e.bounds(1200,3000);e.emit('scroll',1500);e.observers[0].callback();e.flush();
  assert.equal(e.transform,`scaleX(${500/2480})`);assert.equal(e.reads,4);
  e.bounds(1400,3200);e.fontsReady();e.flush();assert.equal(e.transform,`scaleX(${300/2680})`);
  e.window.innerHeight=600;e.emit('resize');e.flush();assert.equal(e.transform,`scaleX(${250/2810})`);
  e.bounds(1800,3200);e.emit('pageshow');e.flush();assert.equal(e.transform,'scaleX(0)');
});
