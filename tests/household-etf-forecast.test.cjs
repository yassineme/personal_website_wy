'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const {etfForecast}=require('../lib/household/etf-forecast.cjs');
const snapshot={asOfDate:'2026-11-02',positions:[{id:'a',name:'Example ETF A',kind:'ETF',reportedValueCents:100000},{id:'b',name:'Example ETF B',kind:'ETF',reportedValueCents:200000},{id:'stock',name:'Example stock',kind:'Stock',reportedValueCents:900000}]};
function data(){return {settings:{scopeConfirmed:true,startMonth:'2026-11'},recurring:[{id:'fund',name:'Sample monthly funding',kind:'investment',include:'Yes',amountCents:10000,sharing:'personal',payer:'you',frequency:1,startMonth:'2026-11',endMonth:null}]};}
test('ETF projection uses only dated ETF values, applies an effective 7% annual rate and reconciles the zero-growth comparison',()=>{
 const r=etfForecast(data(),snapshot,'2026-11');assert.equal(r.ready,true);assert.equal(r.startingValueCents,300000);assert.equal(r.annualContributionsCents,120000);assert.equal(r.monthlyEquivalentCents,10000);
 assert.deepEqual(r.milestones.map(x=>x.months),[12,60,120,180]);assert.equal(r.series.length,181);
 for(const row of r.milestones){const q=Math.pow(1.07,1/12),expected=300000*Math.pow(q,row.months)+10000*(Math.pow(q,row.months)-1)/(q-1);assert.equal(row.projectedCents,Math.round(expected));assert.equal(row.contributionsCents,10000*row.months);assert.equal(row.withoutGrowthCents,300000+row.contributionsCents);assert.equal(row.growthCents,row.projectedCents-row.withoutGrowthCents);}
 assert.equal(r.funds.length,2);
});
test('zero funding grows existing ETFs by exactly 7% after twelve cycles and contribution timing is month-end',()=>{
 const d=data();d.recurring=[];let r=etfForecast(d,snapshot,'2026-11');assert.equal(r.milestones[0].projectedCents,321000);assert.equal(r.milestones[0].contributionsCents,0);
 r=etfForecast(data(),{...snapshot,positions:[{...snapshot.positions[0],reportedValueCents:0}]},'2026-11');assert.equal(r.series[1].projectedCents,10000);assert.equal(r.series[2].projectedCents,Math.round(10000*Math.pow(1.07,1/12)+10000));
});
test('the current funding versions are frozen while quarterly schedules and personal shares are retained',()=>{
 const d=data();d.recurring[0]={...d.recurring[0],frequency:3,sharing:'percentage',wifeBps:5000,endMonth:'2026-11'};d.recurring.push({...d.recurring[0],id:'future',startMonth:'2026-12',endMonth:null,amountCents:900000});
 const r=etfForecast(d,snapshot,'2026-11');assert.equal(r.ready,true);assert.equal(r.annualContributionsCents,20000);assert.equal(r.milestones[0].contributionsCents,20000);assert.equal(r.series[1].contributionsCents,5000);assert.equal(r.series[2].contributionsCents,5000);assert.equal(r.series[4].contributionsCents,10000);assert.equal(r.funding.length,1);
});
test('missing holdings, dates, incomplete values and unallocated funding never generate invented projections',()=>{
 assert.equal(etfForecast(data(),null,'2026-11').ready,false);
 for(const snap of [{...snapshot,asOfDate:null},{...snapshot,positions:[{...snapshot.positions[0],reportedValueCents:null}]}]){const r=etfForecast(data(),snap,'2026-11');assert.equal(r.ready,false);assert.equal(r.series.length,0);assert.ok(r.milestones.every(x=>x.projectedCents===null));}
 const d=data();d.recurring[0].sharing='unset';assert.equal(etfForecast(d,snapshot,'2026-11').ready,false);assert.equal(etfForecast(data(),snapshot,'2026-10').ready,false);
});

test('future-dated snapshots, duplicate positions and invalid months cannot produce a complete outlook',()=>{
 assert.equal(etfForecast(data(),{...snapshot,asOfDate:'2027-01-01'},'2026-11').ready,false);
 assert.equal(etfForecast(data(),{...snapshot,positions:[snapshot.positions[0],snapshot.positions[0]]},'2026-11').ready,false);
 assert.equal(etfForecast(data(),snapshot,'invalid').ready,false);
});

test('fund outlook includes mutual funds once, uses their own record dates and adds no invented funding',()=>{
 const fund={id:'mutual-fund',name:'Example mutual fund',kind:'Fund',reportedValueCents:200000,recordedDate:'2026-11-04',dateNote:'Record date only; source date format unconfirmed'};
 const r=etfForecast(data(),{...snapshot,positions:[...snapshot.positions,fund]},'2026-11');
 assert.equal(r.ready,true);assert.equal(r.startingValueCents,500000);assert.equal(r.monthlyEquivalentCents,10000);assert.equal(r.funds.length,3);assert.equal(r.funds.at(-1).recordedDate,'2026-11-04');
 assert.equal(r.milestones[0].projectedCents,Math.round(500000*1.07+10000*(1.07-1)/(Math.pow(1.07,1/12)-1)));
 assert.equal(etfForecast(data(),{...snapshot,positions:[...snapshot.positions,{...fund,recordedDate:'2026-12-01'}]},'2026-11').ready,false);
});
