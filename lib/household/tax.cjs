'use strict';
const crypto=require('node:crypto');
const sources=[
 ['2025 income-tax tariff (§32a)', 'https://lsth.bundesfinanzministerium.de/esth/2025/A-Einkommensteuergesetz/IV-Tarif-31-34b/Paragraf-32a/inhalt.html'],
 ['2025 allowances and child benefit','https://www.bundesfinanzministerium.de/Content/DE/Standardartikel/Themen/Steuern/das-aendert-sich-2025.html'],
 ['2025 allowances table','https://lsth.bundesfinanzministerium.de/esth/2025/tabellarische-Uebersicht/inhalt.html'],
 ['Household services and trades (§35a)','https://www.gesetze-im-internet.de/estg/__35a.html'],
 ['Progression income (§32b)','https://www.gesetze-im-internet.de/estg/__32b.html'],
 ['Solidarity surcharge','https://www.gesetze-im-internet.de/solzg_1995/__4.html'],
 ['ELSTER 2025 return guidance','https://www.faq.elster.de/elsterweb/helpGlobal?themaGlobal=help_est_ufa_10_2025']
];
const categories=[
 ['work-you','Your employment expenses','Anlage N · you','Commuting days and one-way distance, home-working days, equipment/business share, training, professional memberships, applications, unreimbursed business travel, work-related moving or double household. Keep a day log; no commuting and home-office allowance for the same day without checking the conditions. Enter the final eligible annual amounts, not automatic flat claims.'],
 ['work-wife','Wife’s employment expenses','Anlage N · wife','Keep a separate work-day calendar and receipts for your wife. Exclude employer reimbursements; distinguish maternity/parental leave and actual days worked.'],
 ['rental-income','Rental receipts','Anlage V','Rent, tenant operating-cost advances, settlement receipts and other taxable rental receipts. Reconcile to bank statements and the lease; no duplicate rent from the budget.'],
 ['rental-cost','Rental deductions / depreciation','Anlage V','Mortgage interest (not principal), rental insurance, property tax, management, maintenance, tenant operating costs, and advisor-reviewed building depreciation. WEG reserve contributions are not automatically deductions: collect actual reserve expenditure. Separate acquisition/production costs, improvements and immediately deductible repairs; check the 15% / three-year rule.'],
 ['insurance','Deductible pension / health / care','Anlage Vorsorgeaufwand','Use certified deductible amounts, after employer subsidies and reimbursements, with pension limits and health-insurance adjustments reviewed. Do not enter the total insurance premium indiscriminately.'],
 ['special','Donations / other special expenses','Anlage Sonderausgaben','Donation receipts, eligible religious/community contributions if any, and other confirmed special expenses. No church tax in this profile. Not every private insurance or advisor fee is deductible.'],
 ['childcare','Childcare fees','Anlage Kind','Invoice/contract plus bank transfer; eligible care only, excluding meals, tuition, recreation and tax-free reimbursements. One child under 14: the estimate applies 80%, capped at €4,800 for 2025.'],
 ['services','Home household services · labour','Haushaltsnahe Aufwendungen','Own apartment: eligible cleaning, gardening, caretaker and service labour from the annual WEG/landlord certificate. Invoice and bank payment required. Exclude materials, rental deductions and childcare. Estimate credit: 20%, up to €4,000 per household.'],
 ['trades','Home trades / repairs · labour','Haushaltsnahe Aufwendungen','Own apartment: eligible repair labour, machine/travel costs shown separately; no materials or subsidised work claimed twice. Invoice and bank payment required. Estimate credit: 20%, up to €1,200 per household.'],
 ['extraordinary','Extraordinary deductions · reviewed net','Außergewöhnliche Belastungen','Medical, dental, care or disability costs with prescriptions and reimbursement statements. Enter only the deductible amount after the reasonable-burden threshold, allowances and any adviser adjustments; this tool does not calculate that threshold.'],
 ['other-income','Other ordinary taxable income','Advisor review','Only income subject to the ordinary tariff not already in salaries/rent. Capital income and gains need their separate tax review and are not automatically ordinary income.'],
 ['reference','Reference only / advisor question','Not in estimate','Private loan principal, own-home mortgage interest, acquisition documents, WEG reserves, disputed costs, investments and items not yet classified. Keep the evidence without assuming a deduction.']
];
const checklist=[
 ['identity','Joint return','Both spouses’ tax IDs, marriage details, address, Finanzamt/Steuernummer, refund IBAN, advisor mandate and prior-year assessment. Confirm eligibility for joint assessment throughout the relevant period.'],
 ['salary-you','Your employment','Every 2025 Lohnsteuerbescheinigung, including former employers; gross wages, wage tax and Soli withheld, benefits and reimbursements.'],
 ['salary-wife','Wife’s employment','Every 2025 Lohnsteuerbescheinigung, including former employers; gross wages, wage tax and Soli withheld. Class IV with factor affects withholding, not final joint tax.'],
 ['days-you','Your work calendar','Office/commuting days, distance, home-working days, holidays, sickness, business travel and reimbursements; keep daily evidence.'],
 ['days-wife','Wife’s work calendar','Separate commuting and home-working calendar, maternity/parental leave dates, equipment and training receipts.'],
 ['benefits','Parental / replacement benefits','Elterngeld, Mutterschaftsgeld, employer maternity supplement, Krankengeld, unemployment or Kurzarbeitergeld certificates for BOTH spouses. Tax-free benefits can increase the tax rate. Explicitly confirm none if absent.'],
 ['pension','Pension contributions','Both annual pension certificates and payroll pension contributions; separate employee and employer shares and applicable deductible limits.'],
 ['health','Health and care insurance','Both annual tax certificates, basic cover, care contributions, subsidies, refunds and bonuses; avoid duplicating payroll data.'],
 ['child','Child details and benefit','Child tax ID, birth date, household/residency dates, eligible months and Kindergeld entitlement (not merely cash received), health insurance and any special circumstances.'],
 ['childcare','Childcare evidence','Kita/childminder contract, itemised annual invoices, bank payments, meal exclusion and employer reimbursements.'],
 ['rental-contract','Rental contract and receipts','Property identity, ownership shares, lease, letting dates, rent ledger, operating-cost advances and settlement, vacancy/use changes and tenant arrears.'],
 ['rental-bank','Rental reconciliation','Full-year rental bank statements with income/expense reconciliation and outstanding questions. Keep cash-flow principal separate.'],
 ['rental-interest','Rental loan interest','Annual loan statement showing INTEREST separately from principal and fees; loan purpose and acquisition link.'],
 ['rental-afa','Rental acquisition and AfA','Purchase deed, land/building allocation, land transfer tax, notary/registration/acquisition invoices, construction year, purchase/letting dates and prior depreciation schedule. Advisor checks AfA rate and capitalisation.'],
 ['rental-repairs','Rental repairs / improvement','Itemised invoices, payment evidence, subsidies and dates; flag major works and costs within three years of acquisition for the 15% rule.'],
 ['rental-weg','Rental WEG / operating costs','Jahresabrechnung, Wirtschaftsplan, management fees, property tax, insurance, settlement and actual reserve expenditure. Do not claim reserve contributions automatically.'],
 ['home-weg','Own-apartment WEG certificate','Annual §35a labour/service certificate, allocation statement and bank payments; exclude materials and costs already claimed elsewhere.'],
 ['home-trades','Own-apartment repairs','Invoices separating labour, travel/machine costs and materials, bank proof, subsidy details. Own-home interest/principal is not an ordinary rental deduction.'],
 ['donations','Donations / memberships','Donation confirmations and eligible membership certificates, amounts and bank statements. Mark not applicable if none.'],
 ['medical','Medical / care / disability','Invoices, prescriptions, reimbursements, disability decisions and care evidence; reasonable-burden review required.'],
 ['investments','Investment tax certificates','All bank/broker annual tax certificates, exemption orders, realised gains/losses, loss certificates, distributions and advance lump-sum taxation. Domestic investments still need review; no foreign income reported.'],
 ['other-income','Other income and losses','Confirm pensions, side work, private sales/crypto, business activity, loss carryforwards and other income are absent or provide schedules.'],
 ['prepayments','Tax payments and notices','2025 income-tax and Soli prepayment notices/payments; distinguish 2025 advances from another year’s assessment or refund.'],
 ['review','Advisor review and filing','Resolve questions; reconcile to source certificates, confirm no duplicate claims, review joint vs separate assessment, agree filing date and delivery method, retain final filed return and assessment.']
].map(([id,title,evidence])=>({id,title,evidence}));
const profileFields=['grossYou','grossWife','wageTaxYou','wageTaxWife','soliYou','soliWife','incomePrepayments','soliPrepayments','progressionNet'];
const checks=['incomeComplete','deductionsComplete','rentalComplete','progressionReviewed','investmentReviewed','jointEligible'];
function empty(){return {version:1,year:2025,revision:0,profile:{childMonths:null,...Object.fromEntries(profileFields.map(k=>[k,null])),...Object.fromEntries(checks.map(k=>[k,false])),notes:''},entries:[],checklist:{},documents:[],updatedAt:null};}
const fail=message=>{throw Object.assign(Error(message),{status:400});};
function str(v,max=1500){if(typeof v!=='string'||v.length>max)fail('Invalid text field.');return v.trim();}
function cents(v,nullable=true){if(v===null&&nullable)return null;if(!Number.isSafeInteger(v)||v<0||v>100000000000)fail('Enter a non-negative EUR amount within the supported range.');return v;}
function date(v){if(typeof v!=='string'||!/^2025-\d{2}-\d{2}$/.test(v)||!Number.isFinite(Date.parse(v+'T12:00:00Z'))||new Date(v+'T12:00:00Z').toISOString().slice(0,10)!==v)fail('Choose a valid payment date in 2025.');return v;}
function mutate(state,action,input,at){
 if(!input||typeof input!=='object'||Array.isArray(input))fail('Invalid tax input.');
 const p=state.profile;
 if(action==='profile'){
  for(const k of profileFields)p[k]=cents(input[k]);
  if(!Number.isInteger(input.childMonths)||input.childMonths<0||input.childMonths>12)fail('Confirm 0–12 child-entitlement months for 2025.');
  p.childMonths=input.childMonths;for(const k of checks){if(typeof input[k]!=='boolean')fail('Confirm the review checkboxes.');p[k]=input[k];}p.notes=str(input.notes);
 }else if(action==='entry'){
  const id=input.id||crypto.randomUUID(),existing=state.entries.find(x=>x.id===id);
  if(input.id&&!existing)fail('Tax record not found.');
  if(input.category==='work-you'&&input.owner!=='you'||input.category==='work-wife'&&input.owner!=='wife')fail('Employment expenses must belong to the spouse named in the category.');
  if(!categories.some(c=>c[0]===input.category)||!['you','wife','joint'].includes(input.owner)||!['draft','reviewed','excluded'].includes(input.status))fail('Choose a category, person and review state.');
  const amount=cents(input.amountCents,false),refund=cents(input.reimbursedCents,false),eligible=cents(input.eligibleCents);
  if(refund>amount||eligible!==null&&eligible>amount-refund)fail('Eligible amount cannot exceed the recorded amount less reimbursements.');
  const name=str(input.name,160);if(!name)fail('Add a record description.');
  const item={id,name,category:input.category,owner:input.owner,status:input.status,date:date(input.date),amountCents:amount,reimbursedCents:refund,eligibleCents:eligible,reference:str(input.reference,500),notes:str(input.notes),updatedAt:at};
  if(state.entries.some(x=>x.id!==id&&x.name===name&&x.date===item.date&&x.amountCents===amount))fail('A matching date, description and amount already exist. Review the existing record.');
  if(existing)Object.assign(existing,item);else{if(state.entries.length>=1000)fail('The 1,000-record limit is reached.');state.entries.push(item);}
 }else if(action==='checklist'){
  if(!checklist.some(x=>x.id===input.id)||!['missing','requested','ready','na'].includes(input.status))fail('Invalid checklist item.');
  state.checklist[input.id]={status:input.status,notes:str(input.notes),updatedAt:at};
 }else if(action==='document'){
  if(state.documents.length>=100)fail('The 100-document limit is reached.');
  const name=str(input.name,160),content=str(input.content,7000000),type=input.type;
  const bytes=Buffer.from(content,'base64');
  if(!name||!['application/pdf','image/png','image/jpeg','text/plain'].includes(type)||!bytes.length||bytes.length>5*1024*1024||bytes.toString('base64')!==content)fail('Upload a PDF, PNG, JPEG or text file up to 5 MB.');
  if(type==='application/pdf'&&bytes.subarray(0,5).toString()!=='%PDF-'||type==='image/png'&&bytes.subarray(0,8).toString('hex')!=='89504e470d0a1a0a'||type==='image/jpeg'&&bytes.subarray(0,3).toString('hex')!=='ffd8ff')fail('The file content does not match its type.');
  if(state.documents.reduce((n,d)=>n+d.bytes,0)+bytes.length>25*1024*1024)fail('The 25 MB dossier attachment limit is reached.');
  const link=str(input.link,100);
  if(link&&!state.entries.some(x=>x.id===link)&&!checklist.some(x=>x.id===link))fail('Choose an existing record or checklist item.');
  const hash=crypto.createHash('sha256').update(bytes).digest('hex');if(state.documents.some(d=>d.hash===hash))fail('This document is already in the dossier.');
  state.documents.push({id:crypto.randomUUID(),name,type,bytes:bytes.length,hash,link,content,uploadedAt:at});
 }else fail('Unknown tax action.');
 state.revision++;state.updatedAt=at;return state;
}
function tariff(euros){const x=Math.floor(Math.max(0,euros));if(x<=12096)return 0;if(x<=17443){const y=(x-12096)/10000;return Math.floor((932.3*y+1400)*y);}if(x<=68480){const z=(x-17443)/10000;return Math.floor((176.64*z+2397)*z+1015.13);}return Math.floor(x<=277825?.42*x-10911.92:.45*x-19246.67);}
const jointTax=c=>2*tariff(c/200)*100;
function estimate(s){
 const p=s.profile,sum=category=>s.entries.filter(x=>x.category===category&&x.status==='reviewed').reduce((n,x)=>n+(x.eligibleCents??0),0);
 const missing=profileFields.filter(k=>p[k]===null).map(k=>'Confirm '+k);
 for(const k of checks)if(!p[k])missing.push('Review '+k);
 if(p.childMonths===null)missing.push('Confirm child entitlement months');
 const pending=s.entries.filter(x=>x.status==='draft'||x.status==='reviewed'&&x.eligibleCents===null);
 if(pending.length)missing.push('Resolve '+pending.length+' draft / unvalued records');
 const workYou=Math.max(Math.min(123000,p.grossYou??0),sum('work-you')),workWife=Math.max(Math.min(123000,p.grossWife??0),sum('work-wife'));
 const rental=sum('rental-income')-sum('rental-cost'),insurance=sum('insurance'),special=Math.max(7200,sum('special')),childcare=Math.min(480000,Math.round(sum('childcare')*.8)),extraordinary=sum('extraordinary');
 const taxable=Math.max(0,(p.grossYou??0)+(p.grossWife??0)-workYou-workWife+rental+sum('other-income')-insurance-special-childcare-extraordinary);
 const allowance=(p.childMonths??0)*80000,benefit=(p.childMonths??0)*25500;
 // Progression input must already be the advisor-reviewed net §32b amount.
 const withProgression=base=>{const additional=p.progressionNet??0;if(!additional)return jointTax(base);const expanded=base+additional;const rate=expanded?Math.floor(jointTax(expanded)/expanded*1e6)/1e6:0;return Math.floor(rate*Math.floor(base/100))*100;};
 const beforeChild=withProgression(taxable),afterChild=withProgression(Math.max(0,taxable-allowance));
 const childAdvantage=beforeChild-afterChild>benefit;
 const serviceCredit=Math.min(400000,Math.round(sum('services')*.2)),tradeCredit=Math.min(120000,Math.round(sum('trades')*.2));
 const incomeTax=Math.max(0,(childAdvantage?afterChild:beforeChild)-serviceCredit-tradeCredit)+(childAdvantage?benefit:0);
 // SolZG §3: child allowances are considered even when Kindergeld is preferable.
 const soliBase=Math.max(0,afterChild-serviceCredit-tradeCredit),soli=Math.floor(Math.max(0,Math.min(soliBase*.055,(soliBase-3990000)*.119)));
 const paidIncome=(p.wageTaxYou??0)+(p.wageTaxWife??0)+(p.incomePrepayments??0),paidSoli=(p.soliYou??0)+(p.soliWife??0)+(p.soliPrepayments??0);
 return {ready:!missing.length,missing,pendingCount:pending.length,workYou,workWife,rental,insurance,special,childcare,extraordinary,taxable,allowance,benefit,childAdvantage,serviceCredit,tradeCredit,incomeTax,soli,paidIncome,paidSoli,balance:paidIncome+paidSoli-incomeTax-soli};
}
function view(state){const s=state||empty();return {...s,documents:s.documents.map(({content,...d})=>d),categories,checklistGuide:checklist,sources,estimate:estimate(s)};}
module.exports={empty,mutate,estimate,view,tariff,jointTax,profileFields,checks,categories,checklist,sources};
