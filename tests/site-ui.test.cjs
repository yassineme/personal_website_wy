'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');

test('scroll veil updates stay local and stop writing once its opacity has settled',()=>{
  const events=new Map(),frames=[],rootWrites=[],veilWrites=[];
  const root={dataset:{},style:{setProperty:(...args)=>rootWrites.push(args)}};
  const veil={setAttribute(){},style:{set opacity(value){veilWrites.push(value);}}};
  const context={
    document:{documentElement:root,body:{prepend(){}},querySelectorAll:()=>[],createElement:()=>veil},
    window:{scrollY:0},location:{search:'',pathname:'/'},URLSearchParams,URL,Math,
    addEventListener:(name,fn)=>events.set(name,fn),requestAnimationFrame:fn=>frames.push(fn)
  };
  vm.runInNewContext(fs.readFileSync(path.join(__dirname,'../site-ui.js'),'utf8'),context);
  const scrollTo=y=>{context.window.scrollY=y;events.get('scroll')();frames.shift()();};
  scrollTo(40);scrollTo(80);scrollTo(500);scrollTo(1000);scrollTo(0);
  assert.deepEqual(rootWrites,[],'scroll must not invalidate inherited styles on the document root');
  assert.deepEqual(veilWrites,['0.000','0.500','1.000','0.000']);
});
