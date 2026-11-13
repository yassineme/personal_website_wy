'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const source=fs.readFileSync(require('node:path').join(__dirname,'../site-ui.js'),'utf8');
function setup() {
  let serial=0;const frames=new Map(),events=new Map(),writes=[];
  const veil={style:{setProperty(name,value){writes.push({name,value});}},setAttribute(){}};
  const root={dataset:{},style:{setProperty(){throw Error('A local veil must not write inherited root styles');}}};
  const document={documentElement:root,body:{prepend(node){assert.equal(node,veil);}},createElement:()=>veil};
  const window={scrollY:0};
  vm.runInNewContext(source,{window,document,location:{search:''},URLSearchParams,addEventListener(name,fn){events.set(name,fn);},requestAnimationFrame(fn){const id=++serial;frames.set(id,fn);return id;}});
  return {writes,frames,emit(name='scroll',y=window.scrollY){window.scrollY=y;events.get(name)?.();},flush(){const pending=[...frames.values()];frames.clear();pending.forEach(fn=>fn());}};
}
test('the veil preserves its 80px fade while keeping styles local to its element',()=>{
  const e=setup();assert.equal(e.writes[0].value,'0.000');
  for(const [y,value]of [[20,'0.250'],[40,'0.500'],[60,'0.750'],[80,'1.000'],[-10,'0.000']]){
    e.emit('scroll',y);e.flush();assert.deepEqual(e.writes.at(-1),{name:'--scroll-veil-opacity',value});
  }
});
test('scroll events share a frame and saturated or unchanged fade values do not write again',()=>{
  const e=setup();e.emit('scroll',80);e.emit('scroll',100);e.emit('resize',120);
  assert.equal(e.frames.size,1);e.flush();assert.equal(e.writes.length,2);
  for(const y of [160,200,500,300]){e.emit('scroll',y);e.flush();}
  e.emit('pageshow');e.flush();assert.equal(e.writes.length,2);
  e.emit('scroll',0);e.flush();assert.equal(e.writes.at(-1).value,'0.000');
});
