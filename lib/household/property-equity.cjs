'use strict';
const {monthOK,addMonths}=require('./model.cjs');
const cents=n=>Number.isSafeInteger(n)&&n>=0&&n<=1e12;
const monthIndex=s=>Number(s.slice(0,4))*12+Number(s.slice(5,7))-1;

// A read-only planning scenario. No bank transactions or confirmed balances are created.
function propertyEquity(m,month){
 const a=m?.monthlyEquityAssumption,v=m?.modelledValuation;
 if(!a||!v||!monthOK(month)||!monthOK(a.baseMonth)||!monthOK(a.lastMonth)||a.lastMonth<a.baseMonth||!cents(a.monthlyPrincipalCents)||!cents(m.debtCents)||!cents(v.valueCents))return null;
 const limit=monthIndex(a.lastMonth)-monthIndex(a.baseMonth);
 if(limit>120)return null;
 const at=target=>{
  const elapsed=monthIndex(target)-monthIndex(a.baseMonth),repaidCents=Math.min(m.debtCents,elapsed*a.monthlyPrincipalCents),debtCents=m.debtCents-repaidCents;
  const valueCents=Math.round(v.valueCents*Math.pow(1+v.annualRate,elapsed/12)),appreciationCents=valueCents-v.valueCents,equityCents=valueCents-debtCents;
  const previous=elapsed?Math.round(v.valueCents*Math.pow(1+v.annualRate,(elapsed-1)/12)):v.valueCents;
  return {month:target,elapsed,debtCents,valueCents,equityCents,repaidCents,appreciationCents,equityAddedCents:repaidCents+appreciationCents,monthlyPrincipalCents:elapsed?Math.min(a.monthlyPrincipalCents,Math.max(0,m.debtCents-(elapsed-1)*a.monthlyPrincipalCents)):0,monthlyAppreciationCents:valueCents-previous,ltvPercent:valueCents?100*debtCents/valueCents:null};
 };
 const ready=month>=a.baseMonth&&month<=a.lastMonth;
 return {...a,ready,selectedMonth:month,current:ready?at(month):null,baseEquityCents:v.valueCents-m.debtCents,
  reason:month<a.baseMonth?'The selected month precedes the projection baseline.':month>a.lastMonth?'Projection stops at the first fixed-rate expiry. Update loan terms before extending it.':'',
  rows:ready?Array.from({length:Math.min(12,monthIndex(a.lastMonth)-monthIndex(month)+1)},(_,i)=>at(addMonths(month,i))):[]};
}
function propertyValueProjection(m,month){
 const v=m?.modelledValuation,a=m?.acquisitionRecovery;
 const baseMonth=m?.monthlyEquityAssumption?.baseMonth||v?.asOfDate?.slice(0,7);
 if(!v||!cents(v.valueCents)||!Number.isFinite(v.annualRate)||v.annualRate<0||v.annualRate>1||!monthOK(baseMonth)||!monthOK(month)||month<baseMonth||monthIndex(month)-monthIndex(baseMonth)>1200)return null;
 const elapsed=monthIndex(month)-monthIndex(baseMonth),valueAt=n=>Math.round(v.valueCents*Math.pow(1+v.annualRate,(elapsed+n)/12));
 const currentCents=valueAt(0),points=Array.from({length:241},(_,months)=>({months,month:addMonths(month,months),valueCents:valueAt(months)}));
 if(points.some(p=>!cents(p.valueCents)))return null;
 const recovery=cents(a?.budgetCents)&&a.budgetCents>0?[0,0.03].map(sellingCostRate=>{
  const thresholdCents=Math.ceil(a.budgetCents/(1-sellingCostRate));
  let months=null;
  if(currentCents>=thresholdCents)months=0;
  else if(v.annualRate>0){
   const estimate=Math.max(0,Math.ceil(12*Math.log(thresholdCents/v.valueCents)/Math.log(1+v.annualRate)-elapsed));
   if(estimate<=1200){months=estimate;while(months>0&&valueAt(months-1)>=thresholdCents)months--;while(valueAt(months)<thresholdCents)months++;}
  }
  return {sellingCostRate,thresholdCents,months,month:months===null?null:addMonths(month,months),withinTwentyYears:months!==null&&months<=240};
 }):[];
 return {startMonth:month,baseMonth,annualRate:v.annualRate,currentCents,points,milestones:[5,10,15,20].map(years=>({...points[years*12],years,growthCents:points[years*12].valueCents-currentCents})),budgetCents:a?.budgetCents??null,budgetLabel:a?.label||'Acquisition budget',budgetStatus:a?.status||'Unconfirmed actual spending',recovery};
}
module.exports={propertyEquity,propertyValueProjection};
