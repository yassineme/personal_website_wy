'use strict';
const crypto=require('node:crypto');
const {dateOK,applyMutation}=require('./model.cjs');
const fail=message=>{throw Object.assign(Error(message),{status:422});};
const RECURRING='Recurring Plan',EXCEPTIONS='Exceptional Costs';
const EXTRA={
 'Dashboard Properties':['Property ID','Name','Address','Use','Your ownership %','Property value EUR','Remaining debt EUR','Figures as of','Notes'],
 'Dashboard Assets':['Asset ID','Name','Type','Value EUR','As of','Notes'],
 'Dashboard Meters':['Reading ID','Meter','Date','Cumulative reading','New meter baseline','Notes','Created at']
};
const REC_HEADERS=['Item ID','Recurring item','Type','Per payment EUR','Frequency (draft)','First payment month','Last active month','Include?','Sharing mode','Wife %','Wife fixed EUR','Wife per payment EUR','Your per payment EUR','Payer / recipient','Property','Observed October EUR','Source ledger ID','Notes / confirmation needed','Payment cents','Period months','Schedule status','Sharing status'];
const EXC_HEADERS=['Event ID','Exceptional item','Type','Payment month/date','Amount EUR','Include?','Sharing mode','Wife %','Wife fixed EUR','Wife share EUR','Your share EUR','Property','Notes','Source ledger ID','Payment cents','Schedule status','Sharing status','Payment evidence'];
const kind={Income:'income',Commitment:'commitment','ETF funding':'investment',Cost:'cost',Refund:'refund','Needs classification':'unclassified'},sharing={Unset:'unset','Not shared':'personal',Percentage:'percentage','Fixed amount':'fixed'},payers={You:'you','Your wife':'wife',Joint:'joint',Review:'unknown'};
const reverse=o=>Object.fromEntries(Object.entries(o).map(([a,b])=>[b,a]));
const epoch=Date.UTC(1899,11,30);
const serial=s=>(Date.parse(s+'T00:00:00Z')-epoch)/86400000;
function day(v,optional=false){if(optional&&(v===null||v===''))return null;let s=typeof v==='number'&&Number.isInteger(v)?new Date(epoch+v*86400000).toISOString().slice(0,10):String(v);if(!dateOK(s))fail('A Sheet date is invalid. Use a date cell or YYYY-MM-DD.');return s;}
function cents(v,optional=false){if(optional&&(v===null||v===''))return null;if(typeof v!=='number'||!Number.isFinite(v)||v<0||Math.abs(v*100-Math.round(v*100))>0.00001||!Number.isSafeInteger(Math.round(v*100)))fail('A Sheet amount needs a non-negative EUR value with at most two decimals.');return Math.round(v*100);}
function str(v){if(v===null||v===undefined)return '';if(typeof v!=='string')fail('A Sheet text field has the wrong type.');return v;}
function choice(map,v,label){if(!Object.hasOwn(map,v))fail('Review the Sheet '+label+' field.');return map[v];}
function cellValue(c){const v=c?.userEnteredValue;if(v?.formulaValue){const x=c.effectiveValue;if(x?.errorValue)fail('A financial input formula has an error.');return x?.numberValue??x?.stringValue??x?.boolValue??null;}return v?.numberValue??v?.stringValue??v?.boolValue??null;}
function rowsOf(sheet){const rows=[];for(const block of sheet?.data||[])for(const[r,row]of (block.rowData||[]).entries()){const n=(block.startRow||0)+r;rows[n]??=[];for(const[c,value]of (row?.values||[]).entries())rows[n][(block.startColumn||0)+c]=value;}return rows;}
function inspect(raw,{extended=false}={}){
 const sheets=new Map((raw.sheets||[]).map(s=>[s.properties.title,{...s,rows:rowsOf(s)}]));
 for(const[title,headers]of [[RECURRING,REC_HEADERS],[EXCEPTIONS,EXC_HEADERS],...Object.entries(extended?EXTRA:{})]){
  const s=sheets.get(title);if(!s)fail('Required Sheet tab is missing: '+title);const row=s.rows[title in EXTRA?0:4]||[];
  if(headers.some((h,i)=>cellValue(row[i])!==h))fail('Sheet headers changed in '+title+'. No synchronization was applied.');
 }
 if(extended&&(cellValue(sheets.get(RECURRING).rows[4][22])!=='Stream ID'||cellValue(sheets.get(EXCEPTIONS).rows[4][18])!=='Payer / recipient'))fail('The dashboard metadata columns are missing. Run connection setup.');
 return sheets;
}
function fingerprint(raw){return crypto.createHash('sha256').update(JSON.stringify((raw.sheets||[]).map(s=>({properties:s.properties,rows:rowsOf(s).map(row=>row?.map(c=>({value:c?.userEnteredValue||null,validation:c?.dataValidation||null})))})))).digest('hex');}
function unique(rows,label){const ids=new Set();for(const x of rows){if(!x.id||ids.has(x.id))fail('Missing or duplicate ID in '+label+'.');ids.add(x.id);}return rows;}
function decode(raw,local,{extended=false}={}){
 const sheets=inspect(raw,{extended}),data=structuredClone(local);
 const values=title=>(sheets.get(title)?.rows||[]).map(row=>row?.map(cellValue));
 if(extended){
  data.properties=unique(values('Dashboard Properties').slice(1).filter(r=>r?.some(v=>v!==null&&v!=='')).map(r=>({id:str(r[0]),name:str(r[1]),address:str(r[2]),use:str(r[3]),ownershipPercent:cents(r[4])/100,valueCents:cents(r[5],true),debtCents:cents(r[6],true),asOfDate:day(r[7],true),notes:str(r[8])})),'properties');
  data.assets=unique(values('Dashboard Assets').slice(1).filter(r=>r?.some(v=>v!==null&&v!=='')).map(r=>({id:str(r[0]),name:str(r[1]),type:str(r[2]),valueCents:cents(r[3],true),asOfDate:day(r[4]),notes:str(r[5])})),'assets');
  data.readings=unique(values('Dashboard Meters').slice(1).filter(r=>r?.some((v,i)=>v!==null&&v!==''&&(i!==4||v!==false))).map(r=>{if(typeof r[3]!=='number'||r[3]<0||Math.abs(r[3]*1000-Math.round(r[3]*1000))>0.00001||typeof r[4]!=='boolean')fail('Check the meter reading and new-meter checkbox.');return {id:str(r[0]),kind:str(r[1]),date:day(r[2]),valueMilli:Math.round(r[3]*1000),reset:r[4],notes:str(r[5]),createdAt:str(r[6])};}),'meter readings');
  // Reuse the application validators so Sheet edits have the same meaning as form edits.
  const check={properties:[],assets:[],readings:[],recurring:[],exceptions:[],audit:[]};
  for(const p of data.properties)applyMutation(check,'save-property',{...p,id:null,ownershipBps:Math.round(p.ownershipPercent*100)});
  for(const a of data.assets)applyMutation(check,'save-asset',{...a,id:null});
  for(const r of [...data.readings].sort((a,b)=>a.date.localeCompare(b.date))){if(!Number.isFinite(Date.parse(r.createdAt)))fail('A meter creation date is invalid.');applyMutation(check,'add-reading',r);}
 }
 const aliases=new Map([['Unassigned',null],['Not applicable',null],['Home - Osdorfer','property-home'],['Rental - Bremen','property-rental'],...data.properties.map(p=>[p.id,p.id])]);
 const property=v=>{if(!v)return null;if(!aliases.has(v))fail('Unrecognized property reference in the Sheet.');const id=aliases.get(v);if(id&&!data.properties.some(p=>p.id===id))fail('A linked property was removed from the Sheet.');return id;};
 const share=(r,i,amount)=>{const mode=choice(sharing,r[i],'sharing');let bps=null,fixed=null;if(mode==='percentage'){if(typeof r[i+1]!=='number'||r[i+1]<0||r[i+1]>1||Math.abs(r[i+1]*10000-Math.round(r[i+1]*10000))>0.00001||r[i+2]!=null)fail('Use either a percentage or a fixed wife contribution, not both.');bps=Math.round(r[i+1]*10000);}if(mode==='fixed'){fixed=cents(r[i+2]);if(r[i+1]!=null||amount===null||fixed>amount)fail('The fixed wife contribution is invalid.');}return {sharing:mode,wifeBps:bps,wifeFixedCents:fixed};};
 data.recurring=unique(values(RECURRING).slice(5,65).filter(r=>r&&(r[0]||r[1])).map((r)=>{
  const amount=cents(r[3],r[7]!=='Yes'),start=day(r[5],r[7]!=='Yes'),end=day(r[6],true),frequency={Monthly:1,Quarterly:3,Annual:12}[r[4]];
  if(!frequency||start&&start.slice(8)!=='01'||end&&end.slice(8)!=='01'||!['Yes','No','Review'].includes(r[7])||!['Income','Commitment','ETF funding'].includes(r[2]))fail('Check a recurring schedule in the Sheet.');
  return {id:str(r[0]),streamId:str(r[22])||str(r[0]),name:str(r[1]),kind:kind[r[2]],amountCents:amount,frequency,startMonth:start?.slice(0,7)||null,endMonth:end?.slice(0,7)||null,include:r[7],...share(r,8,amount),payer:choice(payers,r[13],'payer'),propertyId:property(r[14]),notes:str(r[17])};
 }),'recurring plan');
 data.exceptions=unique(values(EXCEPTIONS).slice(5,65).filter(r=>r&&(r[0]||r[1])).map(r=>({id:str(r[0]),name:str(r[1]),kind:choice(kind,r[2],'exception type'),date:day(r[3]),amountCents:cents(r[4],r[5]!=='Yes'),include:r[5],...share(r,6,cents(r[4],r[5]!=='Yes')),payer:extended?choice(payers,r[18],'payer'):(local.exceptions.find(x=>x.id===r[0])?.payer||'you'),propertyId:property(r[11]),notes:str(r[12])})),'exceptional costs');
 for(const x of data.exceptions)if(!['cost','refund','unclassified'].includes(x.kind)||!['Yes','No','Review'].includes(x.include))fail('Check the exceptional item type and inclusion.');
 for(const x of data.recurring){if(!x.name||x.startMonth&&x.endMonth&&x.endMonth<x.startMonth)fail('A recurring item has an invalid name or dates.');if(data.recurring.some(y=>y.id!==x.id&&y.streamId===x.streamId&&(x.startMonth||'2000-01')<=(y.endMonth||'2099-12')&&(y.startMonth||'2000-01')<=(x.endMonth||'2099-12')))fail('Versions of a recurring item overlap in the Sheet.');}
 return data;
}
const value=v=>v===null||v===undefined?{}:{userEnteredValue:typeof v==='number'?{numberValue:v}:typeof v==='boolean'?{boolValue:v}:{stringValue:String(v)}};
const formula=v=>({userEnteredValue:{formulaValue:v}});
function updateCell(sheetId,row,col,v){return {updateCells:{range:{sheetId,startRowIndex:row,endRowIndex:row+1,startColumnIndex:col,endColumnIndex:col+1},rows:[{values:[v]}],fields:'userEnteredValue'}};}
function propertyLabel(id){return !id?'Unassigned':id==='property-home'?'Home - Osdorfer':id==='property-rental'?'Rental - Bremen':id;}
function encodeRows(data){return {
 [RECURRING]:data.recurring.map(x=>({id:x.id,cells:{0:x.id,1:x.name,2:reverse(kind)[x.kind],3:x.amountCents===null?null:x.amountCents/100,4:{1:'Monthly',3:'Quarterly',12:'Annual'}[x.frequency],5:x.startMonth?serial(x.startMonth+'-01'):null,6:x.endMonth?serial(x.endMonth+'-01'):null,7:x.include,8:reverse(sharing)[x.sharing],9:x.sharing==='percentage'?x.wifeBps/10000:null,10:x.sharing==='fixed'?x.wifeFixedCents/100:null,13:reverse(payers)[x.payer],14:propertyLabel(x.propertyId),17:x.notes,22:x.streamId}})),
 [EXCEPTIONS]:data.exceptions.map(x=>({id:x.id,cells:{0:x.id,1:x.name,2:reverse(kind)[x.kind],3:serial(x.date),4:x.amountCents===null?null:x.amountCents/100,5:x.include,6:reverse(sharing)[x.sharing],7:x.sharing==='percentage'?x.wifeBps/10000:null,8:x.sharing==='fixed'?x.wifeFixedCents/100:null,11:propertyLabel(x.propertyId),12:x.notes,18:reverse(payers)[x.payer]}})),
 'Dashboard Properties':data.properties.map(x=>({id:x.id,cells:Object.fromEntries([x.id,x.name,x.address,x.use,x.ownershipPercent,x.valueCents===null?null:x.valueCents/100,x.debtCents===null?null:x.debtCents/100,x.asOfDate||null,x.notes].map((v,i)=>[i,v]))})),
 'Dashboard Assets':data.assets.map(x=>({id:x.id,cells:Object.fromEntries([x.id,x.name,x.type,x.valueCents===null?null:x.valueCents/100,x.asOfDate||null,x.notes].map((v,i)=>[i,v]))})),
 'Dashboard Meters':data.readings.map(x=>({id:x.id,cells:Object.fromEntries([x.id,x.kind,x.date,x.valueMilli/1000,x.reset,x.notes,x.createdAt].map((v,i)=>[i,v]))}))
};}
function exceptionWifeFormula(n){return formula(`=IF(B${n}="","",IF(G${n}="Not shared",IF(S${n}="Your wife",E${n},IF(S${n}="You",0,"")),IF(G${n}="Percentage",IF(AND(ISNUMBER(H${n}),I${n}=""),ROUND(O${n}*H${n},0)/100,""),IF(G${n}="Fixed amount",IF(AND(ISNUMBER(I${n}),H${n}=""),ROUND(I${n},2),""),""))))`);}
function changes(raw,before,after){
 const sheets=inspect(raw,{extended:true}),a=encodeRows(before),b=encodeRows(after),requests=[];
 for(const[title,items]of Object.entries(b)){
  const s=sheets.get(title),offset=title in EXTRA?1:5,limit=title in EXTRA?Math.min(s.properties.gridProperties.rowCount,1001):65;
  const positions=new Map();for(let i=offset;i<limit;i++){const id=cellValue(s.rows[i]?.[0]);if(id)positions.set(id,i);}
  const used=new Set(positions.values());
  for(const item of items){const old=a[title].find(x=>x.id===item.id);let row=positions.get(item.id);
   if(row===undefined){row=Array.from({length:limit-offset},(_,i)=>i+offset).find(i=>!used.has(i)&&![...(s.rows[i]||[])].slice(0,2).some(c=>cellValue(c)));if(row===undefined)fail('The '+title+' input area is full. Extend the workbook formulas before adding more records.');used.add(row);}
   const cols=Object.entries(item.cells).filter(([col,v])=>!old||JSON.stringify(old.cells[col]??null)!==JSON.stringify(v??null));
   for(const[col,v]of cols){if(s.rows[row]?.[col]?.userEnteredValue?.formulaValue)fail('A target input cell contains a formula. Edit it in Sheets before saving from the dashboard.');requests.push(updateCell(s.properties.sheetId,row,Number(col),value(v)));}
   if(!old&&(title===RECURRING||title===EXCEPTIONS)){
    // The input areas are already formatted and contain per-row calculations. Keep them.
    const sourceRow=offset;
    for(const col of title===RECURRING?[11,12,18,19,20,21]:[9,10,14,15,16])if(!s.rows[row]?.[col]?.userEnteredValue?.formulaValue)requests.push({copyPaste:{source:{sheetId:s.properties.sheetId,startRowIndex:sourceRow,endRowIndex:sourceRow+1,startColumnIndex:col,endColumnIndex:col+1},destination:{sheetId:s.properties.sheetId,startRowIndex:row,endRowIndex:row+1,startColumnIndex:col,endColumnIndex:col+1},pasteType:'PASTE_FORMULA'}});
   }
   if(title===EXCEPTIONS&&cols.length)requests.push(updateCell(s.properties.sheetId,row,9,exceptionWifeFormula(row+1)));
  }
 }
 // Extend only the property dropdown choices to support newly acquired properties.
 for(const[title,col]of [[RECURRING,14],[EXCEPTIONS,11]]){const s=sheets.get(title),allowed=['Unassigned','Not applicable','Home - Osdorfer','Rental - Bremen',...after.properties.map(p=>p.id)];if(after.properties.some(p=>!before.properties.some(x=>x.id===p.id)))requests.push({setDataValidation:{range:{sheetId:s.properties.sheetId,startRowIndex:5,endRowIndex:65,startColumnIndex:col,endColumnIndex:col+1},rule:{condition:{type:'ONE_OF_LIST',values:[...new Set(allowed)].map(userEnteredValue=>({userEnteredValue}))},strict:true,showCustomUi:true}}});}
 return requests;
}
function ranges(metadata,{extended=true}={}){const titles=new Map(metadata.sheets.map(s=>[s.properties.title,s.properties]));const result=[];for(const[title,col]of [[RECURRING,extended?'W':'V'],[EXCEPTIONS,extended?'S':'R'],...Object.entries(extended?EXTRA:{}).map(([t,h])=>[t,String.fromCharCode(64+h.length)])]){const s=titles.get(title);if(!s)fail('Missing tab '+title);result.push("'"+title+"'!A"+(title in EXTRA?'1:':'5:')+col+(title in EXTRA?Math.min(s.gridProperties.rowCount,1001):65));}return result;}
module.exports={RECURRING,EXCEPTIONS,EXTRA,REC_HEADERS,EXC_HEADERS,inspect,fingerprint,decode,changes,ranges,encodeRows,value,updateCell,cellValue,rowsOf,exceptionWifeFormula};
