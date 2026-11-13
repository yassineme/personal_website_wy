'use strict';
const {randomUUID}=require('node:crypto');
const fail=message=>{throw Object.assign(new Error(message),{status:400});};
const integer=(n,min=0,max=1000000000000)=>Number.isSafeInteger(n)&&n>=min&&n<=max;
const monthOK=s=>typeof s==='string'&&/^20\d{2}-(0[1-9]|1[0-2])$/.test(s);
function dateOK(s){return typeof s==='string'&&/^20\d{2}-\d{2}-\d{2}$/.test(s)&&!Number.isNaN(Date.parse(s+'T12:00:00Z'))&&new Date(s+'T12:00:00Z').toISOString().slice(0,10)===s;}
function monthIndex(s){if(!monthOK(s))fail('Choose a valid month.');return Number(s.slice(0,4))*12+Number(s.slice(5))-1;}
function addMonths(s,n){let i=monthIndex(s)+n;return Math.floor(i/12)+'-'+String(i%12+1).padStart(2,'0');}
function today(now=new Date()){return new Intl.DateTimeFormat('sv-SE',{timeZone:'Europe/Berlin',year:'numeric',month:'2-digit',day:'2-digit'}).format(now);}
function text(v,max=160){if(typeof v!=='string'||v.length>max||/[\x00-\x08\x0b\x0c\x0e-\x1f]/.test(v))fail('Invalid text field.');return v.trim();}
function money(v,optional=false){if(optional&&v===null)return null;if(!integer(v))fail('Enter a valid amount, in whole cents.');return v;}
function allocation(item){
 if(item.kind==='income')return null;
 const total=item.amountCents;if(!integer(total))return null;
 if(item.sharing==='personal')return item.payer==='you'?0:item.payer==='wife'?total:null;
 if(item.sharing==='percentage'&&integer(item.wifeBps,0,10000))return Math.round(total*item.wifeBps/10000);
 if(item.sharing==='fixed'&&integer(item.wifeFixedCents,0,total))return item.wifeFixedCents;
 return null;
}
function active(item,month){return item.include==='Yes'&&monthOK(item.startMonth)&&month>=item.startMonth&&(!item.endMonth||month<=item.endMonth);}
function due(item,month){return active(item,month)&&(monthIndex(month)-monthIndex(item.startMonth))%item.frequency===0;}
function validSchedule(x){return integer(x.amountCents)&&[1,3,12].includes(x.frequency)&&monthOK(x.startMonth)&&(!x.endMonth||monthOK(x.endMonth)&&x.endMonth>=x.startMonth);}
function summary(data,month){
 monthIndex(month);const result={month,income:0,commitments:0,investments:0,exceptions:0,wifeShare:0,yourShare:0,provision:0,issues:[],allocationIssues:[]};
 if(!data.settings.scopeConfirmed||month<data.settings.startMonth)result.issues.push('This month is outside the confirmed planning scope.');
 for(const x of data.recurring){
  if(x.include==='No')continue;
  if(x.include!=='Yes'||!validSchedule(x)){result.issues.push(x.name+': schedule needs review.');continue;}
  if(!active(x,month))continue;
  if(x.kind==='commitment'){const phase=(monthIndex(month)-monthIndex(x.startMonth))%x.frequency;result.provision+=Math.round(x.amountCents*(phase+1)/x.frequency)-Math.round(x.amountCents*phase/x.frequency);}
  if(!due(x,month))continue;
  if(x.kind==='income')result.income+=x.amountCents;
  else {result[x.kind==='investment'?'investments':'commitments']+=x.amountCents;const wife=allocation(x);if(wife===null)result.allocationIssues.push(x.name);else {result.wifeShare+=wife;result.yourShare+=x.amountCents-wife;}}
 }
 for(const x of data.exceptions){
  if(!x.date||x.date.slice(0,7)!==month||x.include==='No')continue;
  if(x.include!=='Yes'||!integer(x.amountCents)||!['cost','refund'].includes(x.kind)){result.issues.push(x.name+': exceptional item needs review.');continue;}
  const sign=x.kind==='refund'?-1:1;result.exceptions+=sign*x.amountCents;const wife=allocation(x);if(wife===null)result.allocationIssues.push(x.name);else {result.wifeShare+=wife*sign;result.yourShare+=(x.amountCents-wife)*sign;}
 }
 result.beforeInvesting=result.income-result.commitments-result.exceptions;result.available=result.beforeInvesting-result.investments;result.provisionMargin=result.income-result.provision-result.exceptions;result.ready=result.issues.length===0;return result;
}
function recurringTotals(data,month){
 const s=summary({...data,exceptions:[]},month),split={yourCommitments:0,wifeCommitments:0,yourInvestments:0,wifeInvestments:0};
 for(const x of data.recurring){if(!validSchedule(x)||!due(x,month)||x.kind==='income')continue;const wife=allocation(x);if(wife===null)continue;const type=x.kind==='investment'?'Investments':'Commitments';split['wife'+type]+=wife;split['your'+type]+=x.amountCents-wife;}
 return {...split,total:s.commitments+s.investments,you:s.yourShare,wife:s.wifeShare,issues:s.issues,allocationIssues:s.allocationIssues,ready:s.ready&&s.allocationIssues.length===0};
}
function personalBreakdown(data,month){
 const totals=recurringTotals(data,month),incomeLines=[],commitmentLines=[],investmentLines=[],exceptionLines=[],issues=[...totals.issues,...totals.allocationIssues.map(name=>name+': sharing needs allocation.')];
 for(const x of data.recurring){
  if(!validSchedule(x)||!due(x,month))continue;
  if(x.kind==='income'){
   if(x.payer==='you'||x.payer==='joint')incomeLines.push({id:x.id,name:x.name,amount:x.amountCents,recipient:x.payer,frequency:x.frequency});
   else if(x.payer!=='wife'&&x.amountCents>0)issues.push(x.name+': income recipient needs confirmation.');
  }else{
   const wife=allocation(x);if(wife===null)continue;const amount=x.amountCents-wife;
   if(amount>0)(x.kind==='investment'?investmentLines:commitmentLines).push({id:x.id,name:x.name,amount,fullAmount:x.amountCents,frequency:x.frequency,sharing:x.sharing});
  }
 }
 for(const x of data.exceptions){
  if(x.include==='No'||x.date?.slice(0,7)!==month)continue;
  if(x.include!=='Yes'||!integer(x.amountCents)||!['cost','refund'].includes(x.kind)){issues.push(x.name+': exceptional item needs review.');continue;}
  const wife=allocation(x);if(wife===null){issues.push(x.name+': sharing needs allocation.');continue;}
  const amount=(x.amountCents-wife)*(x.kind==='refund'?-1:1);
  if(amount!==0)exceptionLines.push({id:x.id,name:x.name,date:x.date,kind:x.kind,amount,fullAmount:x.amountCents,sharing:x.sharing});
 }
 const income=incomeLines.reduce((sum,x)=>sum+x.amount,0),commitments=totals.yourCommitments,investments=totals.yourInvestments,exceptions=exceptionLines.reduce((sum,x)=>sum+x.amount,0),groceries=50000,miscellaneous=30000;
 const beforeLiving=income-commitments-investments-exceptions,outgoing=commitments+investments+exceptions+groceries+miscellaneous;
 return {month,incomeLines,commitmentLines,investmentLines,exceptionLines,income,commitments,investments,exceptions,groceries,miscellaneous,outgoing,beforeLiving,available:income-outgoing,ready:issues.length===0,issues:[...new Set(issues)]};
}
function personalForecast(data,month){
 // Freeze the versions active in the selected month. Future price changes and
 // exceptional invoices are intentionally outside this specific scenario.
 const recurring=data.recurring.filter(x=>x.include!=='No'&&(!monthOK(x.startMonth)||x.startMonth<=month)&&(!x.endMonth||x.endMonth>=month)).map(x=>({...x,endMonth:data.recurring.some(y=>(y.streamId||y.id)===(x.streamId||x.id)&&y.startMonth>x.startMonth)?null:x.endMonth}));
 const frozen={...data,recurring,exceptions:[]},rows=[];let cumulative=0;
 for(let i=0;i<6;i++){
  const current=addMonths(month,i),p=personalBreakdown(frozen,current),added=p.available;cumulative+=added;
  rows.push({month:current,income:p.income,commitments:p.commitments,investments:p.investments,groceries:p.groceries,miscellaneous:p.miscellaneous,added:p.ready?added:null,cumulative:p.ready?cumulative:null,ready:p.ready,issues:p.issues});
 }
 const ready=rows.every(r=>r.ready);
 // A later complete row cannot repair an unknown earlier cash movement.
 if(!ready)for(const row of rows)row.cumulative=null;
 const opening=data.assets.filter(x=>x.type==='Cash'&&integer(x.valueCents)).sort((a,b)=>(b.asOfDate||'').localeCompare(a.asOfDate||''))[0]||null;
 const result={startMonth:month,months:6,groceries:50000,miscellaneous:30000,budgetOwner:'you',includesJointIncome:true,opening:opening?{id:opening.id,name:opening.name,amount:opening.valueCents,asOfDate:opening.asOfDate}:null,ready,rows,totalGrowth:ready?rows.at(-1).cumulative:null};
 result.status=forecastStatus(result);return result;
}
// Status describes this scenario's cash movements, not investment performance.
function forecastStatus(f){
 if(!f.ready)return {tone:'neutral',label:'Needs review',detail:'Complete the missing inputs to assess this scenario.'};
 if(f.opening&&f.rows.some(r=>f.opening.amount+r.cumulative<0))return {tone:'negative',label:'Projected cash shortfall',detail:'At least one monthly closing balance falls below zero.'};
 if(f.totalGrowth<0)return {tone:'negative',label:'Cash drawdown',detail:'Planned outgoings exceed income over these six cycles.'};
 if(f.rows.some(r=>r.added<0))return {tone:'negative',label:'Some months draw down cash',detail:'The total recovers, but at least one cycle spends more than it receives.'};
 if(f.totalGrowth===0)return {tone:'neutral',label:'Break-even forecast',detail:'Income covers planned outgoings with no additional cash.'};
 return {tone:'positive',label:'Positive cash flow',detail:'Every cycle covers planned outgoings; cash grows over six cycles.'};
}
function purchasePriceFromNotes(notes){
 const match=String(notes||'').match(/(?:^|\n)Purchase price:\s*€\s*(\d{1,3}(?:,\d{3})+|\d+)(?:\.(\d{1,2}))?(?=\s|[.;]|$)/i);
 if(!match)return null;
 const result=Number(match[1].replace(/,/g,''))*100+Number((match[2]||'').padEnd(2,'0'));
 return Number.isSafeInteger(result)?result:null;
}
function reminders(data,now=new Date()){
 const day=today(now),month=day.slice(0,7),quarter=data.settings.quarterMonths||[1,4,7,10];
 return ['cold-water','hot-water','electricity'].map(kind=>{
  let dueMonth=month;
  if(kind==='electricity'){
   const candidates=Array.from({length:24},(_,i)=>addMonths(month,i-12)).filter(m=>quarter.includes(Number(m.slice(5)))&&m+'-01'>=data.settings.scheduleStart);
   const past=candidates.filter(m=>m<=month);dueMonth=past.at(-1)||candidates[0];
  }
  const readings=data.readings.filter(r=>r.kind===kind).sort((a,b)=>a.date.localeCompare(b.date)||a.createdAt.localeCompare(b.createdAt));
  const finish=kind==='electricity'?addMonths(dueMonth,3):addMonths(dueMonth,1);
  const completed=readings.some(r=>r.date>=dueMonth+'-01'&&r.date<finish+'-01');
  if(completed)dueMonth=finish;
  const latest=readings.at(-1)||null,previous=readings.length>1?readings.at(-2):null;
  return {kind,title:{'cold-water':'Cold water','hot-water':'Hot water',electricity:'Electricity'}[kind],unit:kind==='electricity'?'kWh':'m³',frequency:kind==='electricity'?'Quarterly':'Monthly',dueDate:dueMonth+'-01',status:dueMonth+'-01'<=day?'due':'upcoming',latest,consumption:latest&&previous&&!latest.reset&&latest.valueMilli>=previous.valueMilli?latest.valueMilli-previous.valueMilli:null};
 });
}
function propertySummary(data,property,month){
 const items=data.recurring.filter(x=>x.propertyId===property.id&&due(x,month));
 const income=items.filter(x=>x.kind==='income').reduce((n,x)=>n+x.amountCents,0),payments=items.filter(x=>x.kind!=='income').reduce((n,x)=>n+x.amountCents,0);
 return {...property,purchasePriceCents:purchasePriceFromNotes(property.notes),income,payments,cashFlow:income-payments,linkedItems:items.length,equity:integer(property.valueCents)&&integer(property.debtCents)?property.valueCents-property.debtCents:null};
}
function validateSharing(input){
 if(!['unset','personal','percentage','fixed'].includes(input.sharing))fail('Choose a sharing rule.');
 if(input.sharing==='percentage'&&!integer(input.wifeBps,0,10000))fail('Wife percentage must be between 0% and 100%.');
 if(input.sharing==='fixed'&&!integer(input.wifeFixedCents,0,input.amountCents))fail('The fixed contribution cannot exceed this payment.');
 return {sharing:input.sharing,wifeBps:input.sharing==='percentage'?input.wifeBps:null,wifeFixedCents:input.sharing==='fixed'?input.wifeFixedCents:null};
}
function validateRecurring(input,data){
 const name=text(input.name);if(!name)fail('Give this item a name.');
 if(!['income','commitment','investment'].includes(input.kind))fail('Choose a payment type.');
 if(![1,3,12].includes(input.frequency)||!monthOK(input.startMonth)||input.endMonth&&(!monthOK(input.endMonth)||input.endMonth<input.startMonth))fail('Check the frequency and effective months.');
 if(!['Yes','No','Review'].includes(input.include)||!['you','wife','joint','unknown'].includes(input.payer))fail('Choose an inclusion status and payer.');
 if(input.propertyId&&!data.properties.some(p=>p.id===input.propertyId))fail('Property not found.');
 const amountCents=money(input.amountCents);
 return {name,kind:input.kind,amountCents,frequency:input.frequency,startMonth:input.startMonth,endMonth:input.endMonth||null,include:input.include,...validateSharing({...input,amountCents}),payer:input.payer,propertyId:input.propertyId||null,notes:text(input.notes||'',1500)};
}
function applyMutation(data,action,input,now=new Date()){
 const stamp=now.toISOString();let before=null,after,label,kind;
 if(action==='save-recurring'){
  const value=validateRecurring(input,data);const existing=input.id?data.recurring.find(x=>x.id===input.id):null;if(input.id&&!existing)fail('Item not found.');
  if(existing&&value.startMonth<existing.startMonth)fail('A change cannot precede this version.');
  const streamId=existing?.streamId||'rec-'+randomUUID();
  const otherVersions=data.recurring.filter(x=>x.streamId===streamId&&x.id!==existing?.id);
  if(otherVersions.some(x=>value.startMonth<=(x.endMonth||'2099-12')&&x.startMonth<=(value.endMonth||'2099-12')))fail('This change overlaps another version of the same item.');
  before=existing?structuredClone(existing):null;
  if(existing&&value.startMonth>existing.startMonth){if(existing.endMonth&&value.startMonth>addMonths(existing.endMonth,1))fail('Choose an effective month within this item’s schedule.');existing.endMonth=addMonths(value.startMonth,-1);after={...value,id:'rec-'+randomUUID(),streamId};data.recurring.push(after);}
  else if(existing){after={...existing,...value};data.recurring[data.recurring.indexOf(existing)]=after;}
  else {after={...value,id:streamId,streamId};data.recurring.push(after);}
  label=(before?'Updated ':'Added ')+value.name;kind='Recurring plan';
 } else if(action==='save-exception'){
  const name=text(input.name);if(!name||!dateOK(input.date)||!['cost','refund','unclassified'].includes(input.kind)||!['Yes','No','Review'].includes(input.include)||!['you','wife','joint','unknown'].includes(input.payer))fail('Check the exceptional item fields.');
  if(input.propertyId&&!data.properties.some(p=>p.id===input.propertyId))fail('Property not found.');
  const existing=input.id?data.exceptions.find(x=>x.id===input.id):null;if(input.id&&!existing)fail('Item not found.');before=existing?structuredClone(existing):null;
  const amountCents=money(input.amountCents);after={id:existing?.id||'exc-'+randomUUID(),name,kind:input.kind,date:input.date,amountCents,include:input.include,...validateSharing({...input,amountCents}),payer:input.payer,propertyId:input.propertyId||null,notes:text(input.notes||'',1500)};
  if(existing)data.exceptions[data.exceptions.indexOf(existing)]=after;else data.exceptions.push(after);label=(before?'Updated ':'Added ')+name;kind='Exceptional cost';
 } else if(action==='save-property'){
  const existing=input.id?data.properties.find(x=>x.id===input.id):null;if(input.id&&!existing)fail('Property not found.');before=existing?structuredClone(existing):null;
  if(!['Home','Rental','Other'].includes(input.use)||!integer(input.ownershipBps,0,10000))fail('Check property use and ownership.');
  const name=text(input.name),address=text(input.address,300);if(!name)fail('Enter a property name.');
  if((input.valueCents!==null||input.debtCents!==null)&&!dateOK(input.asOfDate))fail('Add the date of these property figures.');
  after={id:existing?.id||'property-'+randomUUID(),name,address,use:input.use,ownershipPercent:input.ownershipBps/100,valueCents:money(input.valueCents,true),debtCents:money(input.debtCents,true),asOfDate:input.asOfDate||null,notes:text(input.notes||'',1500)};
  if(existing)data.properties[data.properties.indexOf(existing)]=after;else data.properties.push(after);label=(before?'Updated ':'Added ')+name;kind='Property';
 } else if(action==='save-asset'){
  const existing=input.id?data.assets.find(x=>x.id===input.id):null;if(input.id&&!existing)fail('Asset not found.');before=existing?structuredClone(existing):null;
  const name=text(input.name);if(!name||!['Cash','Investments','Vehicle','Other'].includes(input.type)||!dateOK(input.asOfDate))fail('Enter an asset name, type and valuation date.');
  const valueCents=money(input.valueCents,['Vehicle','Other'].includes(input.type));
  after={id:existing?.id||'asset-'+randomUUID(),name,type:input.type,valueCents,asOfDate:input.asOfDate,notes:text(input.notes||'',1500)};
  if(existing)data.assets[data.assets.indexOf(existing)]=after;else data.assets.push(after);label=(before?'Updated ':'Added ')+name;kind='Asset';
 } else if(action==='add-reading'){
  if(!['cold-water','hot-water','electricity'].includes(input.kind)||!dateOK(input.date)||input.date>today(now)||!integer(input.valueMilli,0,1000000000000)||typeof input.reset!=='boolean')fail('Enter a valid dated meter reading.');
  if(data.readings.some(x=>x.kind===input.kind&&x.date===input.date))fail('A reading already exists for that meter and date.');
  const ordered=data.readings.filter(x=>x.kind===input.kind).sort((a,b)=>a.date.localeCompare(b.date));
  const previous=ordered.filter(x=>x.date<input.date).at(-1),next=ordered.find(x=>x.date>input.date);
  if(!input.reset&&previous&&input.valueMilli<previous.valueMilli)fail('This reading is below the previous one. Select a new-meter baseline if the meter was replaced.');
  if(next&&!next.reset&&next.valueMilli<input.valueMilli)fail('This value exceeds the next reading. Check the date or meter replacement.');
  after={id:'reading-'+randomUUID(),kind:input.kind,date:input.date,valueMilli:input.valueMilli,reset:input.reset,notes:text(input.notes||'',1000),createdAt:stamp};data.readings.push(after);label='Recorded '+input.kind+' reading';kind='Meter reading';
 } else fail('Unknown operation.');
 data.audit.push({id:randomUUID(),at:stamp,label,kind,before,after:structuredClone(after)});return after;
}
function view(data,month,now=new Date()){
 const result=summary(data,month);
 return {revision:data.revision,source:data.source,settings:data.settings,today:today(now),month,summary:result,recurringTotals:recurringTotals(data,month),personalBreakdown:personalBreakdown(data,month),personalForecast:personalForecast(data,month),projection:Array.from({length:12},(_,i)=>summary(data,addMonths(month,i))),recurring:data.recurring,exceptions:data.exceptions,properties:data.properties.map(p=>propertySummary(data,p,month)),assets:data.assets,reminders:reminders(data,now),readings:data.readings,audit:data.audit.slice(-50).reverse().map(({id,at,label,kind})=>({id,at,label,kind})),localSaveCount:data.audit.length};
}
module.exports={forecastStatus,purchasePriceFromNotes,summary,allocation,active,due,addMonths,monthOK,dateOK,today,reminders,applyMutation,view,recurringTotals,personalForecast,personalBreakdown};
