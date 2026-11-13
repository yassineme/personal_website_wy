'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const source=fs.readFileSync(path.join(__dirname,'../owner-entry.js'),'utf8');
function setup(){
 let time=0,next=0;const timers=new Map(),navigations=[];
 class Node{
  constructor(){this.handlers=new Map();this.attrs={};this.children=[];}
  addEventListener(type,fn){const list=this.handlers.get(type)||[];list.push(fn);this.handlers.set(type,list);}
  emit(type,props={}){const e={target:this,button:0,isPrimary:true,clientX:10,clientY:10,preventDefault(){this.defaultPrevented=true;},...props};for(const fn of this.handlers.get(type)||[])fn(e);return e;}
  setAttribute(k,v){this.attrs[k]=v;}
  append(n){this.children.push(n);}
  focus(){this.focused=true;}
  click(){navigations.push(this.href);}
  closest(){return this.editable?this:null;}
 }
 const brand=new Node(),header=new Node(),footer=new Node(),body=new Node(),document=new Node(),window=new Node();
 document.body=body;document.createElement=()=>new Node();document.querySelector=s=>s.includes('brand-link')?brand:s==='.header-right'?header:s==='.closing-row'?footer:null;
 vm.runInNewContext(source,{document,window,Date:{now:()=>time},Math,setTimeout(fn,ms){const id=++next;timers.set(id,{fn,at:time+ms});return id;},clearTimeout:id=>timers.delete(id)});
 return{brand,header,footer,body,document,window,navigations,Node,advance(ms){time+=ms;for(const[id,t]of [...timers])if(t.at<=time){timers.delete(id);t.fn();}}};
}
test('dashboard entry is hidden, untabbable and absent from the visible footer',()=>{
 const e=setup(),entry=e.body.children[0];assert.equal(entry.hidden,true);assert.equal(entry.tabIndex,-1);assert.equal(entry.attrs['aria-hidden'],'true');assert.equal(entry.href,'http://127.0.0.1:8790/private-desk');assert.ok('data-no-transition' in entry.attrs);assert.equal(e.footer.children.length,0);
});
test('the homepage keyboard shortcut opens the dashboard but does not intercept editable fields or key repeats',()=>{
 const e=setup(),combo={altKey:true,shiftKey:true,code:'KeyD'};
 assert.ok(e.document.emit('keydown',combo).defaultPrevented);assert.deepEqual(e.navigations,['http://127.0.0.1:8790/private-desk']);
 e.document.emit('keydown',{...combo,repeat:true});
 const input=new e.Node();input.editable=true;e.document.emit('keydown',{...combo,target:input});
 e.document.emit('keydown',{...combo,ctrlKey:true});assert.equal(e.navigations.length,1);
});
test('holding the logo opens only after 1.2 seconds and does not reveal the fieldnotes link',()=>{
 const e=setup();e.brand.emit('pointerdown');e.advance(1199);assert.equal(e.navigations.length,0);e.advance(1);assert.deepEqual(e.navigations,['http://127.0.0.1:8790/private-desk']);
 e.brand.emit('click');assert.equal(e.header.children[0].hidden,true);
});
test('short presses, scrolling gestures, cancelled input and backgrounding never trigger the hidden entry',()=>{
 for(const cancel of [e=>e.document.emit('pointerup'),e=>e.brand.emit('pointermove',{clientX:30}),e=>e.brand.emit('pointerleave'),e=>e.document.emit('pointercancel'),e=>e.window.emit('pagehide'),e=>{e.document.hidden=true;e.document.emit('visibilitychange');}]){
  const e=setup();e.brand.emit('pointerdown');e.advance(500);cancel(e);e.advance(1500);assert.equal(e.navigations.length,0);
 }
 const secondary=setup();secondary.brand.emit('pointerdown',{button:2});secondary.advance(1500);assert.equal(secondary.navigations.length,0);
});
test('existing fieldnotes gestures remain separate from dashboard access',()=>{
 const e=setup();for(let i=0;i<5;i++)e.brand.emit('click');assert.equal(e.header.children[0].hidden,false);assert.equal(e.navigations.length,0);
 const key=setup();key.document.emit('keydown',{altKey:true,shiftKey:true,code:'KeyE'});assert.equal(key.header.children[0].hidden,false);assert.equal(key.navigations.length,0);
});
