'use strict';
const {dateOK,monthOK,addMonths,personalBreakdown}=require('./model.cjs');
const {isFund,recordDate}=require('./portfolio.cjs');
const {propertyEquity,propertyValueProjection}=require('./property-equity.cjs');
const money=n=>Number.isSafeInteger(n)&&n>=0&&n<=1e12;

function reportedMortgage(assessment){
 const m=assessment?.mortgage;
 if(!m||!dateOK(m.reportedAt)||!Array.isArray(m.loans)||!m.loans.length||!money(m.assumedValueCents))return null;
 if(m.loans.some(x=>!money(x.originalCents)||!money(x.balanceCents)||x.balanceCents>x.originalCents))return null;
 const debtCents=m.loans.reduce((n,x)=>n+x.balanceCents,0),originalCents=m.loans.reduce((n,x)=>n+x.originalCents,0);
 if(!money(debtCents)||!money(originalCents))return null;
 const v=m.valuationAssumption;
 let modelledValuation=null;
 if(v&&Number.isFinite(v.annualRate)&&v.annualRate>=0&&v.annualRate<=1&&Number.isInteger(v.startYear)&&Number.isInteger(v.endYear)&&v.endYear>=v.startYear&&v.endYear-v.startYear<=100&&dateOK(v.asOfDate)){
  const years=v.endYear-v.startYear,valueCents=Math.round(m.assumedValueCents*Math.pow(1+v.annualRate,years));
  if(money(valueCents))modelledValuation={...v,years,valueCents,growthCents:valueCents-m.assumedValueCents,equityCents:valueCents-debtCents,ltvPercent:valueCents?100*debtCents/valueCents:null};
 }
 return {...m,modelledValuation,debtCents,originalCents,repaidCents:originalCents-debtCents,assumedEquityCents:m.assumedValueCents-debtCents,ltvPercent:m.assumedValueCents?100*debtCents/m.assumedValueCents:null,
  scenarios:[-10,-5,0,5,10].map(change=>{const valueCents=Math.round(m.assumedValueCents*(100+change)/100);return {change,valueCents,equityCents:valueCents-debtCents};})};
}

// Assessment evidence is encrypted separately from the synced Sheet registers.
// Apply confirmed links to a copy; never rewrite the Sheet on a dashboard read.
function propertyAssessments(assessment){
 return assessment?[assessment,...Object.values(assessment.propertyAssessments||{})]:[];
}
function assessedState(state,assessment,month){
 if(!assessment||month<assessment.asOfDate?.slice(0,7))return state;
 let result={...state,properties:state.properties.map(p=>({...p,...(assessment.scenarioProperties?.[p.id]?{planningEstimate:assessment.scenarioProperties[p.id]}:{})})),recurring:state.recurring.map(x=>({...x}))};
 for(const evidence of propertyAssessments(assessment)){
  if(!dateOK(evidence.asOfDate)||month<evidence.asOfDate.slice(0,7))continue;
  const mortgage=reportedMortgage(evidence);
  if(mortgage){mortgage.equityProjection=propertyEquity(mortgage,month);mortgage.valueProjection=propertyValueProjection(mortgage,month);}
  result.properties=result.properties.map(p=>p.id===evidence.propertyId?{...p,assessment:evidence,...(mortgage?{reportedMortgage:mortgage}:{}),...(evidence.planningEstimate?{planningEstimate:evidence.planningEstimate}: {})}:p);
  result.recurring=result.recurring.map(x=>({...x,propertyId:evidence.links?.[x.id]||x.propertyId}));
  for(const item of evidence.recurringAdditions||[]){
   // A synced replacement suppresses the local addition; never double count a payment.
   if(!result.recurring.some(x=>x.id===item.id||x.streamId===item.streamId))result.recurring.push({...item,assessmentOnly:true});
  }
 }
 return result;
}
function wealthAssessment(data,snapshot,month,asOfDate){
 const issues=[],validDate=d=>dateOK(d)&&d<=asOfDate&&d.slice(0,7)<=month;
 const recordedAssets=data.assets.filter(a=>money(a.valueCents)&&validDate(a.asOfDate));
 const cash=recordedAssets.filter(a=>a.type==='Cash').reduce((n,a)=>n+a.valueCents,0);
 const positions=(snapshot?.positions||[]).filter(p=>money(p.reportedValueCents));
 const validSnapshot=validDate(snapshot?.asOfDate)&&positions.every(p=>validDate(recordDate(p,snapshot)))&&positions.length>0&&positions.length===snapshot.positions.length&&new Set(positions.map(p=>p.id)).size===positions.length;
 const registerInvestments=recordedAssets.filter(a=>a.type==='Investments');
 // Unknown overlap is not solved by adding the same portfolio a second time.
 const overlap=registerInvestments.length>0&&positions.length>0;
 if(overlap)issues.push('Investment register and portfolio may overlap. Reconcile them before projecting.');
 if(!validSnapshot)issues.push('A complete dated portfolio snapshot is required.');
 if(!recordedAssets.some(a=>a.type==='Cash'))issues.push('Record a dated cash balance first.');
 if(data.assets.some(a=>money(a.valueCents)&&!validDate(a.asOfDate)))issues.push('Some asset dates fall outside this assessment; those values are excluded.');
 const etfs=validSnapshot?positions.filter(p=>p.kind==='ETF').reduce((n,p)=>n+p.reportedValueCents,0):null;
 const funds=validSnapshot?positions.filter(p=>p.kind==='Fund').reduce((n,p)=>n+p.reportedValueCents,0):null;
 const stocks=validSnapshot?positions.filter(p=>!isFund(p)).reduce((n,p)=>n+p.reportedValueCents,0):null;
 const startingFunds=(etfs??0)+(funds??0);
 const financial=validSnapshot&&!overlap?cash+startingFunds+stocks:null;
 const missing=data.properties.flatMap(p=>[...(!money(p.valueCents)||!validDate(p.asOfDate)?[p.name+': current valuation and date']:[]),...(!money(p.debtCents)||!validDate(p.asOfDate)?[p.name+(p.reportedMortgage&&validDate(p.reportedMortgage.reportedAt)?': exact common balance/value date for the reported mortgage balances':': total mortgage balance and date')]:[])]);
 missing.push('Current kitchen, device, vehicle and other loan balances; confirm whether any further liabilities exist.','Portfolio beneficial ownership, including child-benefit-funded investments; cash/account overlap.');
 if(data.assets.some(a=>a.valueCents===null))missing.push('Unvalued assets are excluded, including any vehicle.');
 // Freeze active prices; respect actual end dates and payment frequencies.
 const recurring=data.recurring.filter(x=>x.include!=='No'&&(!monthOK(x.startMonth)||x.startMonth<=month)&&(!x.endMonth||x.endMonth>=month)).map(x=>({...x,endMonth:data.recurring.some(y=>(y.streamId||y.id)===(x.streamId||x.id)&&y.startMonth>x.startMonth)?null:x.endMonth}));
 const frozen={...data,recurring,exceptions:[]},cycles=[];
 for(let i=0;i<180;i++){
  const p=personalBreakdown(frozen,addMonths(month,i));
  if(!p.ready){issues.push(...p.issues);break;}
  cycles.push({cash:p.available,funding:p.investments});
 }
 const ready=financial!==null&&cycles.length===180&&issues.length===0;
 const scenarios=[0,3,7].map(rate=>{
  let cashBalance=cash,portfolio=startingFunds,contributions=0,saved=0,shortfall=false;
  const milestones=[],monthly=Math.pow(1+rate/100,1/12)-1;
  if(ready)for(let i=0;i<180;i++){
   cashBalance+=cycles[i].cash;saved+=cycles[i].cash;contributions+=cycles[i].funding;
   portfolio=portfolio*(1+monthly)+cycles[i].funding;
   if(cashBalance<0)shortfall=true;
   if([60,120,180].includes(i+1)){
    const total=Math.round(cashBalance+portfolio+stocks);
    milestones.push({years:(i+1)/12,cashCents:cashBalance,etfCents:Math.round(portfolio),fundPortfolioCents:Math.round(portfolio),stockCents:stocks,totalCents:total,contributionsCents:contributions,cashAddedCents:saved,growthCents:Math.round(portfolio)-startingFunds-contributions,realCents:Math.round(total/Math.pow(1.02,(i+1)/12)),cashShortfall:shortfall});
   }
  }
  return {rate,milestones};
 });
 return {ready,issues:[...new Set(issues)],missing,asOfDate,startMonth:month,cashCents:cash,etfCents:etfs,fundCents:funds,stockCents:stocks,financialAssetsCents:financial,netWealthCents:null,portfolioDate:snapshot?.asOfDate||null,positionDates:positions.map(p=>({name:p.name,date:recordDate(p,snapshot),note:p.dateNote||''})),cashDates:recordedAssets.filter(a=>a.type==='Cash').map(a=>({name:a.name,date:a.asOfDate})),firstCycle:cycles[0]||null,scenarios,
  planningCycles:ready?cycles:[],
  propertyBridge:data.properties.map(p=>({id:p.id,name:p.name,ownershipPercent:p.ownershipPercent,valueCents:money(p.valueCents)&&validDate(p.asOfDate)?p.valueCents:null,debtCents:money(p.debtCents)&&validDate(p.asOfDate)?p.debtCents:null,planningEstimate:p.planningEstimate&&validDate(p.planningEstimate.asOfDate)?p.planningEstimate:null,reportedMortgage:p.reportedMortgage&&validDate(p.reportedMortgage.reportedAt)?p.reportedMortgage:null}))};
}
module.exports={assessedState,wealthAssessment,reportedMortgage};
