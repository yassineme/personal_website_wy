'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),vm=require('node:vm'),fs=require('node:fs');
const source=fs.readFileSync(require('node:path').join(__dirname,'../profile.js'),'utf8');
function setup({reduced=false,animate=true}={}) {
 let id=0;const timers=new Map(),events=new Map(),animations=[];
 const media={matches:reduced,listeners:[],addEventListener(_,fn){this.listeners.push(fn);}};
 const items=[true,true,false].map(side=>{
   const trigger={attrs:{'aria-expanded':'false'},listeners:{},setAttribute(k,v){this.attrs[k]=v;},getAttribute(k){return this.attrs[k];},addEventListener(k,fn){this.listeners[k]=fn;},focus(){document.activeElement=this;},click(){this.listeners.click();}};
   const close={addEventListener(k,fn){this[k]=fn;}};
   const panel={hidden:true,inert:false,attrs:{},setAttribute(k,v){this.attrs[k]=v;},querySelector:()=>close};
   if(animate)panel.animate=(keys,options)=>{const animation={keys,options,cancel(){this.cancelled=true;},finish(){this.onfinish?.();}};animations.push(animation);return animation;};
   const item={panel,trigger,close,listeners:{},closest:()=>side?{}:null,contains:target=>[trigger,panel,close].includes(target),querySelector:selector=>selector==='.books-trigger'?trigger:panel,addEventListener(k,fn){this.listeners[k]=fn;}};
   return item;
 });
 const document={activeElement:null,querySelectorAll:selector=>selector==='.explore-item'?items:[],querySelector:()=>null,getElementById:()=>null,addEventListener(k,fn){const callbacks=events.get(k)||[];callbacks.push(fn);events.set(k,callbacks);}};
 vm.runInNewContext(source,{document,window:{addEventListener(){}},location:{hash:''},matchMedia:query=>query.includes('reduce')?media:{matches:false},getComputedStyle:()=>({opacity:'.4',translate:'8px 0',scale:'.99'}),setTimeout(fn,delay){const key=++id;timers.set(key,{fn,delay});return key;},clearTimeout:key=>timers.delete(key)});
 function runTimers(delay){for(const [key,timer]of [...timers])if(timer.delay===delay){timers.delete(key);timer.fn();}}
 return {items,media,animations,timers,runTimers,emit(key,event){for(const fn of events.get(key)||[])fn(event);}};
}
test('panels remain visible for their exit animation but stop accepting focus immediately',()=>{
 const e=setup(),{trigger,panel,close}=e.items[0];trigger.click();
 assert.equal(panel.hidden,false);assert.equal(panel.inert,false);assert.equal(trigger.attrs['aria-expanded'],'true');
 assert.equal(e.animations[0].options.duration,540);e.animations[0].finish();
 close.click();assert.equal(panel.hidden,false);assert.equal(panel.inert,true);assert.equal(panel.attrs['aria-hidden'],'true');
 assert.equal(trigger.attrs['aria-expanded'],'false');e.animations[1].finish();assert.equal(panel.hidden,true);
});
test('hover intent avoids accidental flashes and pointer leave has a forgiving delay',()=>{
 const e=setup(),item=e.items[0];
 item.listeners.pointerenter({pointerType:'mouse'});assert.equal(item.panel.hidden,true);
 item.listeners.pointerleave();e.runTimers(80);assert.equal(item.panel.hidden,true);
 item.listeners.pointerenter({pointerType:'mouse'});e.runTimers(80);assert.equal(item.panel.hidden,false);
 e.animations[0].finish();item.listeners.pointerleave();assert.equal(item.trigger.attrs['aria-expanded'],'true');
 e.runTimers(220);assert.equal(item.trigger.attrs['aria-expanded'],'false');
});
test('rapid reversals cancel the previous animation without hiding the reopened panel',()=>{
 const e=setup(),item=e.items[0];item.trigger.click();const entering=e.animations[0];
 item.trigger.click();assert.ok(entering.cancelled);const leaving=e.animations[1];
 item.trigger.click();assert.ok(leaving.cancelled);assert.equal(item.panel.hidden,false);assert.equal(item.panel.inert,false);
 assert.equal(e.animations[2].keys[0].opacity,'.4');leaving.finish();assert.equal(item.panel.hidden,false);
 e.animations[2].finish();assert.equal(item.panel.hidden,false);
});
test('switching panels, Escape, and animation watchdog restore the correct state',()=>{
 const e=setup(),[first,second]=e.items;first.trigger.click();second.trigger.click();
 assert.equal(first.trigger.attrs['aria-expanded'],'false');assert.equal(first.panel.inert,true);
 assert.equal(second.trigger.attrs['aria-expanded'],'true');
 e.emit('keydown',{key:'Escape',preventDefault(){}});e.runTimers(360);
 assert.equal(first.panel.hidden,true);assert.equal(second.panel.hidden,true);
});
test('reduced motion, missing animation support, and footer menus remain immediate',()=>{
 for(const options of [{reduced:true},{animate:false}]){
   const e=setup(options),item=e.items[0];item.trigger.click();assert.equal(item.panel.hidden,false);item.trigger.click();assert.equal(item.panel.hidden,true);assert.equal(e.animations.length,0);
 }
 const e=setup();e.items[2].trigger.click();assert.equal(e.items[2].panel.hidden,false);assert.equal(e.animations.length,0);
 e.items[0].trigger.click();e.media.matches=true;e.media.listeners.forEach(fn=>fn());assert.equal(e.items[0].panel.hidden,false);assert.ok(e.animations[0].cancelled);
});
