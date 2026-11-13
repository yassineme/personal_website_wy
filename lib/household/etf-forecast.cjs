'use strict';
const {allocation,due,addMonths,monthOK,dateOK}=require('./model.cjs');
const {isFund,recordDate}=require('./portfolio.cjs');
const HORIZONS=[12,60,120,180],ANNUAL_RATE=.07;
const validMoney=n=>Number.isSafeInteger(n)&&n>=0&&n<=1000000000000;
function etfForecast(data,snapshot,month){
 const issues=[],positions=(snapshot?.positions||[]).filter(isFund);
 if(!positions.length)issues.push('Record your ETF and fund holdings and a dated portfolio value first.');
 if(!dateOK(snapshot?.asOfDate))issues.push('The fund starting value needs a valid snapshot date.');
 else if(monthOK(month)&&snapshot.asOfDate.slice(0,7)>month)issues.push('The recorded fund snapshot is later than the selected planning month.');
 if(positions.some(p=>!dateOK(recordDate(p,snapshot))||monthOK(month)&&recordDate(p,snapshot).slice(0,7)>month))issues.push('Every fund needs a record date within the selected planning period.');
 if(new Set(positions.map(p=>p.id)).size!==positions.length)issues.push('Each fund must have a unique position ID.');
 if(positions.some(p=>!validMoney(p.reportedValueCents)))issues.push('Every fund needs a recorded EUR position value.');
 if(!monthOK(month)||!data.settings?.scopeConfirmed||month<data.settings.startMonth)issues.push('Select a month within the confirmed plan.');
 const funding=data.recurring.filter(x=>x.kind==='investment'&&x.include!=='No'&&(!monthOK(x.startMonth)||x.startMonth<=month)&&(!x.endMonth||month<=x.endMonth));
 const contributions=[];
 for(const x of funding){
  if(x.include!=='Yes'||!validMoney(x.amountCents)||![1,3,12].includes(x.frequency)||!monthOK(x.startMonth)){issues.push(x.name+': investment funding needs review.');continue;}
  const wife=allocation(x);
  if(wife===null){issues.push(x.name+': confirm the funding allocation.');continue;}
  const personal=x.amountCents-wife;
  if(personal>0)contributions.push({...x,amount:personal,endMonth:null});
 }
 const startingValue=positions.every(p=>validMoney(p.reportedValueCents))&&positions.length?positions.reduce((n,p)=>n+p.reportedValueCents,0):null;
 if(startingValue!==null&&!validMoney(startingValue))issues.push('The total fund starting value is outside the supported range.');
 const ready=issues.length===0,monthlyRate=Math.pow(1+ANNUAL_RATE,1/12)-1;
 const annualFunding=monthOK(month)?Array.from({length:12},(_,i)=>contributions.reduce((n,x)=>n+(due(x,addMonths(month,i))?x.amount:0),0)).reduce((a,b)=>a+b,0):0;
 let balance=startingValue??0,paid=0;
 const series=[{months:0,contributionsCents:0,withoutGrowthCents:startingValue,projectedCents:startingValue,growthCents:ready?0:null}];
 if(ready)for(let step=1;step<=180;step++){
  const period=addMonths(month,step-1),payment=contributions.reduce((n,x)=>n+(due(x,period)?x.amount:0),0);
  // Carry full precision between cycles; round only the displayed EUR cents.
  balance=balance*(1+monthlyRate)+payment;paid+=payment;
  if(!Number.isFinite(balance)||balance>1000000000000||!Number.isSafeInteger(paid)){issues.push('The projection exceeds the supported range.');break;}
  series.push({months:step,contributionsCents:paid,withoutGrowthCents:startingValue+paid,projectedCents:Math.round(balance),growthCents:Math.round(balance)-(startingValue+paid)});
 }
 const complete=ready&&issues.length===0;
 return {ready:complete,issues,startMonth:month,annualReturnPercent:7,monthlyRate,startingValueCents:startingValue,snapshotDate:dateOK(snapshot?.asOfDate)?snapshot.asOfDate:null,
  annualContributionsCents:annualFunding,monthlyEquivalentCents:Math.round(annualFunding/12),
  funds:positions.map(p=>({id:p.id,name:p.name,kind:p.kind,recordedDate:recordDate(p,snapshot),dateNote:p.dateNote||'',valueCents:validMoney(p.reportedValueCents)?p.reportedValueCents:null})),
  funding:contributions.map(x=>({id:x.id,name:x.name,amountCents:x.amount,frequency:x.frequency})),
  series:complete?series:[],milestones:HORIZONS.map(months=>({months,label:months===12?'12 months':months/12+' years',...(complete?series[months]:{contributionsCents:null,withoutGrowthCents:null,projectedCents:null,growthCents:null})}))};
}
module.exports={etfForecast,HORIZONS,ANNUAL_RATE};
