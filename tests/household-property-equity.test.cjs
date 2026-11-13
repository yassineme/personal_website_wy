'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const {propertyEquity,propertyValueProjection}=require('../lib/household/property-equity.cjs');
const sample=()=>({debtCents:18000000,modelledValuation:{valueCents:20000000,annualRate:0.02},monthlyEquityAssumption:{baseMonth:'2026-11',lastMonth:'2033-05',monthlyPrincipalCents:30000}});
test('monthly steps retain original baseline, compound annual growth monthly and reconcile equity exactly',()=>{
 const m=sample(),before=JSON.stringify(m),start=propertyEquity(m,'2026-11'),next=propertyEquity(m,'2026-12'),year=propertyEquity(m,'2027-11');
 assert.equal(start.current.repaidCents,0);assert.equal(start.current.equityCents,2000000);assert.equal(start.current.monthlyPrincipalCents,0);
 assert.equal(next.current.debtCents,17970000);assert.equal(next.current.valueCents,Math.round(20000000*Math.pow(1.02,1/12)));
 assert.equal(year.current.valueCents,20400000);assert.equal(year.current.repaidCents,360000);
 assert.equal(year.current.equityCents-start.current.equityCents,year.current.repaidCents+year.current.appreciationCents);
 assert.equal(JSON.stringify(m),before);assert.equal(start.rows.length,12);
});
test('projection stops at fixed-rate expiry and refuses backdating or incomplete assumptions',()=>{
 const m=sample();assert.equal(propertyEquity(m,'2033-05').rows.length,1);assert.equal(propertyEquity(m,'2033-06').current,null);assert.equal(propertyEquity(m,'2026-10').ready,false);
 assert.equal(propertyEquity({},'2026-11'),null);m.monthlyEquityAssumption.monthlyPrincipalCents=-1;assert.equal(propertyEquity(m,'2026-11'),null);
});
test('principal is capped at zero debt and later months never invent negative balances',()=>{
 const m=sample();m.debtCents=45000;const p=propertyEquity(m,'2027-02');assert.equal(p.current.debtCents,0);assert.equal(p.current.repaidCents,45000);assert.equal(p.current.monthlyPrincipalCents,0);
});
test('long-term property values are independent of loan expiry and recovery uses first monthly crossing after selling costs',()=>{
 const m=sample();m.acquisitionRecovery={budgetCents:22000000,label:'Example budget',status:'Estimate'};
 const before=JSON.stringify(m),p=propertyValueProjection(m,'2026-11');
 assert.deepEqual(p.milestones.map(x=>x.years),[5,10,15,20]);assert.equal(p.milestones[3].valueCents,Math.round(20000000*1.02**20));
 for(const r of p.recovery){assert.ok(r.months>0);assert.ok(p.points[r.months].valueCents>=r.thresholdCents);assert.ok(p.points[r.months-1].valueCents<r.thresholdCents);assert.ok(p.points[r.months].valueCents*(1-r.sellingCostRate)>=m.acquisitionRecovery.budgetCents);}
 assert.ok(p.recovery[1].months>p.recovery[0].months);assert.equal(propertyEquity(m,'2034-01').ready,false);assert.ok(propertyValueProjection(m,'2034-01'));assert.equal(JSON.stringify(m),before);
});
test('flat growth never invents a recovery date and already-recovered budgets use the selected month',()=>{
 const m=sample();m.modelledValuation.annualRate=0;m.acquisitionRecovery={budgetCents:22000000};assert.equal(propertyValueProjection(m,'2026-11').recovery[0].months,null);
 m.acquisitionRecovery.budgetCents=19000000;assert.equal(propertyValueProjection(m,'2026-11').recovery[0].months,0);
 delete m.acquisitionRecovery;assert.deepEqual(propertyValueProjection(m,'2026-11').recovery,[]);assert.equal(propertyValueProjection(m,'2026-10'),null);
});
