'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const {project,value,chart}=require('../lib/household/ui/wealth.js');
function fixture(){return {ready:true,cashCents:1000000,etfCents:300000,fundCents:200000,stockCents:100000,planningCycles:Array.from({length:180},()=>({cash:100000,funding:20000})),propertyBridge:[{id:'home',name:'Home',ownershipPercent:50,valueCents:20000000,debtCents:15000000,reportedMortgage:{monthlyEquityAssumption:{monthlyPrincipalCents:50000}}},{id:'rental',name:'Rental',ownershipPercent:50,valueCents:null,debtCents:null,planningEstimate:{valueCents:10000000}}]};}
const close=(actual,expected)=>assert.ok(Math.abs(actual-expected)<.01,`${actual} != ${expected}`);
test('all ETF scenarios match independent annuity arithmetic at all horizons; fund return remains separate',()=>{
 const result=project(fixture());assert.equal(result.incomplete,true);
 for(const s of result.scenarios)for(const n of [60,120,180]){
  const p=s.points[n],q=Math.pow(1+s.rate/100,1/12);
  close(p.etfCents,300000*Math.pow(q,n)+20000*(Math.pow(q,n)-1)/(q-1));
  close(p.fundCents,200000*Math.pow(1.05,n/12));
  close(p.cashCents,1000000+100000*n);
  close(p.financialCents,p.cashCents+p.etfCents+p.fundCents+100000);
  assert.equal(p.properties[1].debtCents,null);assert.equal(p.properties[1].equityCents,null);
  close(p.propertyCents,(20000000*Math.pow(1.02,n/12)-(15000000-50000*n))*.5+10000000*Math.pow(1.02,n/12)*.5);
 }
});
test('mortgage overrides subtract ownership-weighted debt without mutating source records; explicit zero is known',()=>{
 const w=fixture(),before=JSON.stringify(w),a=project(w),b=project(w,{debtOverrides:{rental:6000000}}),zero=project(w,{debtOverrides:{rental:0}});
 assert.equal(b.incomplete,false);assert.equal(zero.incomplete,false);assert.equal(JSON.stringify(w),before);
 for(const n of [0,60,120,180])close(a.scenarios[0].points[n].totalCents-b.scenarios[0].points[n].totalCents,3000000);
 assert.equal(b.scenarios[0].points[180].properties[1].debtCents,6000000);
});
test('surplus reallocation preserves initial wealth and monthly savings; deficits never produce negative ETF purchases',()=>{
 const w=fixture();w.planningCycles[1].cash=-10000;
 const a=project(w),b=project(w,{surplusPercent:100}),p=b.scenarios[0].points;
 close(a.scenarios[0].points[0].totalCents,p[0].totalCents);
 close(p[1].cashCents,1000000);close(p[2].cashCents,990000);
 const q=Math.pow(1.07,1/12);close(p[2].etfCents,p[1].etfCents*q+20000);
 close(p[180].cashAddedCents+p[180].contributionsCents,a.scenarios[0].points[180].cashAddedCents+a.scenarios[0].points[180].contributionsCents);
});
test('missing values remain incomplete, paid-off principal is capped, and invalid inputs are rejected',()=>{
 const w=fixture();w.propertyBridge[0].debtCents=10000;w.propertyBridge[1].planningEstimate=null;
 const r=project(w);assert.equal(r.incomplete,true);assert.equal(r.scenarios[0].points[60].properties[0].debtCents,0);assert.equal(r.scenarios[0].points[60].properties[1].valueCents,null);
 for(const options of [{surplusPercent:-1},{propertyRate:Infinity},{fundRate:50}])assert.throws(()=>project(w,options));
 assert.equal(project({...w,ready:false}).ready,false);assert.equal(project({...w,planningCycles:[]}).ready,false);
});
test('real-value display discounts each scope correctly and responsive geometry stays finite at narrow widths',()=>{
 const r=project(fixture(),{display:'real',scope:'financial'}),p=r.scenarios[0].points[120];close(value(p,r.options),p.financialCents/Math.pow(1.02,10));
 for(const width of [240,320,736,1200]){const svg=chart(r,width);assert.ok(!/NaN|Infinity/.test(svg));assert.ok(svg.includes(`viewBox="0 0 ${width} 300"`));assert.ok(svg.includes('7, 9 and 11'));}
});
test('changing the planning month carries the home principal baseline forward rather than restarting debt',()=>{
 const w=fixture();w.startMonth='2027-11';w.propertyBridge[0].debtCents=null;
 w.propertyBridge[0].reportedMortgage.debtCents=15000000;
 w.propertyBridge[0].reportedMortgage.monthlyEquityAssumption.baseMonth='2026-11';
 const r=project(w);assert.equal(r.scenarios[0].points[0].properties[0].debtCents,14400000);assert.equal(r.scenarios[0].points[60].properties[0].debtCents,11400000);
});

test('assessment growth rates apply per property by default and explicit controls override both',()=>{
 const w=fixture();w.propertyBridge[1].planningEstimate.annualRate=.01;
 const result=project(w),explicit=project(w,{propertyRate:3});
 close(result.scenarios[0].points[120].properties[1].valueCents,10000000*Math.pow(1.01,10));
 close(explicit.scenarios[0].points[120].properties[1].valueCents,10000000*Math.pow(1.03,10));
 assert.equal(result.scenarios[0].points[120].properties[1].debtCents,null);
});
