'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const {wealthAssessment,assessedState,reportedMortgage}=require('../lib/household/wealth.cjs');
function fixture(){return {settings:{scopeConfirmed:true,startMonth:'2026-11'},assets:[{id:'cash',name:'Example cash',type:'Cash',valueCents:1000000,asOfDate:'2026-11-01'},{id:'vehicle',name:'Example vehicle',type:'Vehicle',valueCents:null,asOfDate:'2026-11-01'}],properties:[{id:'home',name:'Example home',ownershipPercent:50,valueCents:null,debtCents:null}],exceptions:[{kind:'cost',amountCents:900000,include:'Yes',date:'2026-11-01'}],recurring:[{id:'income',streamId:'income',name:'Pay',kind:'income',payer:'you',amountCents:200000,include:'Yes',frequency:1,startMonth:'2026-11',endMonth:null},{id:'etf',streamId:'etf',name:'Funding',kind:'investment',payer:'you',sharing:'personal',amountCents:20000,include:'Yes',frequency:1,startMonth:'2026-11',endMonth:null}]};}
const snapshot={asOfDate:'2026-11-01',positions:[{id:'fund',kind:'ETF',reportedValueCents:300000},{id:'stock',kind:'Stock',reportedValueCents:100000}]};
const run=(d=fixture(),s=snapshot)=>wealthAssessment(d,s,'2026-11','2026-11-04');
test('financial assets remain gross; unknown property equity and debts never produce total net wealth',()=>{
 const r=run();assert.equal(r.financialAssetsCents,1400000);assert.equal(r.netWealthCents,null);assert.ok(r.missing.some(x=>/mortgage/.test(x)));assert.equal(r.ready,true);
});
test('zero-return growth counts savings and ETF transfers once; 3% matches independent annuity arithmetic',()=>{
 const r=run();
 for(let i=0;i<3;i++){
  const n=[60,120,180][i],zero=r.scenarios[0].milestones[i],three=r.scenarios[1].milestones[i],q=Math.pow(1.03,1/12);
  assert.equal(zero.totalCents,1400000+120000*n); // income less living costs; transfer is internal
  const portfolio=300000*Math.pow(q,n)+20000*(Math.pow(q,n)-1)/(q-1);
  assert.equal(three.totalCents,Math.round(1000000+100000*n+portfolio+100000));
  assert.equal(three.totalCents,1400000+three.cashAddedCents+three.contributionsCents+three.growthCents);
  assert.equal(three.realCents,Math.round(three.totalCents/Math.pow(1.02,n/12)));
 }
});
test('known final payments stop, later versions stay frozen, periodic schedules remain exact',()=>{
 const d=fixture();d.recurring.push({id:'bill',streamId:'bill',kind:'commitment',name:'Term bill',payer:'you',sharing:'personal',amountCents:10000,frequency:3,include:'Yes',startMonth:'2026-11',endMonth:'2027-02'});
 const r=run(d);assert.equal(r.scenarios[0].milestones[0].cashAddedCents,100000*60-20000);
 d.recurring.push({...d.recurring[2],id:'later',startMonth:'2027-03',endMonth:null,amountCents:90000});
 assert.equal(run(d).scenarios[0].milestones[0].cashAddedCents,100000*60-200000);
});
test('missing dates, future data, duplicate holdings and overlapping investment registers block projections',()=>{
 for(const s of [null,{...snapshot,asOfDate:'2026-12-01'},{...snapshot,positions:[snapshot.positions[0],snapshot.positions[0]]},{...snapshot,positions:[{...snapshot.positions[0],reportedValueCents:null}]}])assert.equal(run(fixture(),s).ready,false);
 const d=fixture();d.assets.push({type:'Investments',valueCents:300000,asOfDate:'2026-11-01'});assert.equal(run(d).ready,false);assert.equal(run(d).financialAssetsCents,null);
 const x=fixture();x.assets[0].asOfDate='2026-11-05';assert.equal(run(x).ready,false);
});
test('incomplete allocations suppress all scenarios; a cash shortfall persists in horizon flags',()=>{
 const d=fixture();d.recurring[1].sharing='unset';assert.equal(run(d).ready,false);assert.ok(run(d).scenarios.every(s=>s.milestones.length===0));
 d.recurring[1].sharing='personal';d.recurring[0].amountCents=0;assert.ok(run(d).scenarios.every(s=>s.milestones.every(m=>m.cashShortfall)));
});
test('assessment links are local overlays, dated and never mutate original register data',()=>{
 const d=fixture(),a={asOfDate:'2026-11-04',links:{income:'home'}};
 assert.equal(assessedState(d,a,'2026-10'),d);
 assert.equal(assessedState(d,a,'2026-11').recurring[0].propertyId,'home');assert.equal(d.recurring[0].propertyId,undefined);
});
test('owner planning valuations stay separate from confirmed register values and respect evidence dates',()=>{
 const d=fixture(),a={asOfDate:'2026-11-01',scenarioProperties:{home:{valueCents:20000000,asOfDate:'2026-11-04',source:'Owner estimate'}}},overlay=assessedState(d,a,'2026-11');
 assert.equal(d.properties[0].planningEstimate,undefined);assert.equal(overlay.properties[0].valueCents,null);
 assert.equal(wealthAssessment(overlay,snapshot,'2026-11','2026-11-03').propertyBridge[0].planningEstimate,null);
 assert.equal(run(overlay).propertyBridge[0].planningEstimate.valueCents,20000000);
 assert.equal(run(overlay).netWealthCents,null);assert.equal(run(overlay).planningCycles.length,180);
 assert.equal(run(overlay).planningCycles[0].cash,100000);
});

test('reported loan evidence calculates principal and equity scenarios without inventing valuation dates or net wealth',()=>{
 const d=fixture(),a={propertyId:'home',asOfDate:'2026-11-04',mortgage:{reportedAt:'2026-11-05',balanceDate:null,assumedValueCents:20000000,loans:[{name:'First',originalCents:15000000,balanceCents:14000000},{name:'Second',originalCents:5000000,balanceCents:4500000}]}};
 const m=reportedMortgage(a);assert.equal(m.debtCents,18500000);assert.equal(m.repaidCents,1500000);assert.equal(m.assumedEquityCents,1500000);assert.equal(m.ltvPercent,92.5);assert.equal(m.scenarios[0].equityCents,-500000);
 const overlay=assessedState(d,a,'2026-11');assert.equal(d.properties[0].reportedMortgage,undefined);assert.equal(overlay.properties[0].debtCents,null);assert.equal(overlay.properties[0].valueCents,null);
 const w=wealthAssessment(overlay,snapshot,'2026-11','2026-11-06');assert.equal(w.propertyBridge[0].reportedMortgage.debtCents,18500000);assert.equal(w.netWealthCents,null);assert.equal(w.financialAssetsCents,run().financialAssetsCents);assert.deepEqual(w.scenarios,run().scenarios);assert.ok(w.missing.some(x=>x.includes('exact common balance/value date')));
 assert.equal(wealthAssessment(overlay,snapshot,'2026-11','2026-11-04').propertyBridge[0].reportedMortgage,null);
 assert.equal(assessedState(d,a,'2026-10'),d);
 a.mortgage.valuationAssumption={annualRate:0.02,startYear:2024,endYear:2026,asOfDate:'2026-11-06'};
 const model=reportedMortgage(a).modelledValuation;assert.equal(model.valueCents,20808000);assert.equal(model.growthCents,808000);assert.equal(model.equityCents,2308000);
 const assumed=wealthAssessment(assessedState(d,a,'2026-11'),snapshot,'2026-11','2026-11-06');assert.equal(assumed.netWealthCents,null);assert.equal(assumed.propertyBridge[0].valueCents,null);assert.deepEqual(assumed.scenarios,w.scenarios);
 a.mortgage.loans[0].balanceCents=-1;assert.equal(reportedMortgage(a),null);
});

test('additional mutual funds increase assets once and compound alongside ETFs while stocks stay flat',()=>{
 const p={...snapshot,positions:[...snapshot.positions,{id:'mutual-fund',name:'Example mutual fund',kind:'Fund',reportedValueCents:200000,reportedGainCents:50000,recordedDate:'2026-11-04',dateNote:'Displayed price date unconfirmed'}]};
 const w=run(fixture(),p);assert.equal(w.ready,true);assert.equal(w.financialAssetsCents,1600000);assert.equal(w.etfCents,300000);assert.equal(w.fundCents,200000);assert.equal(w.stockCents,100000);
 for(let i=0;i<3;i++){
  const n=[60,120,180][i],q=Math.pow(1.03,1/12),m=w.scenarios[1].milestones[i];
  assert.equal(m.totalCents,Math.round(1000000+100000*n+500000*Math.pow(q,n)+20000*(Math.pow(q,n)-1)/(q-1)+100000));
  assert.equal(m.totalCents,1600000+m.cashAddedCents+m.contributionsCents+m.growthCents);
 }
 assert.equal(w.positionDates.at(-1).date,'2026-11-04');
 p.positions.at(-1).recordedDate='2026-11-05';assert.equal(run(fixture(),p).ready,false);
});

test('multiple property assessments retain prior evidence and add local payments once without changing registers',()=>{
 const d=fixture(),before=JSON.stringify(d);
 const payment={id:'local-cost',streamId:'local-cost',name:'Example service charge',kind:'commitment',amountCents:12000,frequency:1,startMonth:'2026-11',endMonth:null,include:'Yes',sharing:'personal',payer:'you',propertyId:'home'};
 const evidence={propertyId:'home',asOfDate:'2026-11-04',purchasePriceCents:9000000,planningEstimate:{valueCents:12000000,asOfDate:'2026-11-04',annualRate:.01},recurringAdditions:[payment]};
 const a={asOfDate:'2026-11-01',propertyId:'other',propertyAssessments:{home:evidence}};
 const result=assessedState(d,a,'2026-11');
 assert.equal(result.properties[0].assessment,evidence);assert.equal(result.properties[0].planningEstimate.annualRate,.01);
 assert.equal(result.recurring.at(-1).assessmentOnly,true);
 assert.equal(run(result).firstCycle.cash,run(d).firstCycle.cash-12000);
 assert.equal(assessedState(result,a,'2026-11').recurring.length,result.recurring.length);
 assert.equal(assessedState(d,a,'2026-10'),d);
 assert.equal(JSON.stringify(d),before);
});
