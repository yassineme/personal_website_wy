'use strict';
const {randomInt,randomUUID}=require('node:crypto');
const {createGoogleClient}=require('./google-client.cjs');
const schema=require('./sheets-schema.cjs');
const {applyMutation}=require('./model.cjs');
const conflict=message=>{throw Object.assign(Error(message),{status:409});};
function adopt(target,remote){for(const key of ['recurring','exceptions','properties','assets','readings'])target[key]=remote[key];}
function createSync({store,clientFactory=createGoogleClient,now=()=>new Date()}={}){
 async function connection(){const cfg=await store.secret('google');return cfg?.enabled?cfg:null;}
 async function status(){const cfg=await connection(),pending=await store.secret('google-pending');return {configured:!!cfg,pending:!!pending,mode:cfg?'google':'local'};}
 async function fetchRemote(client,local){const metadata=await client.metadata();return client.cells(schema.ranges(metadata));}
 async function refresh(revision){const cfg=await connection();if(!cfg)throw Object.assign(Error('Google Sheets is not connected. Complete the local connection setup first.'),{status:400});
  return store.mutate(revision,async state=>{
   const raw=await fetchRemote(clientFactory(cfg),state),remote=schema.decode(raw,state,{extended:true});adopt(state,remote);
   state.source={...state.source,mode:'google',liveSync:true,syncedAt:now().toISOString(),fingerprint:schema.fingerprint(raw)};
   state.audit.push({id:randomUUID(),at:now().toISOString(),label:'Refreshed from Google Sheets',kind:'Synchronization',before:null,after:null});
   await store.secret('google-pending',null);
  });
 }
 async function save(revision,action,input){const cfg=await connection();if(!cfg)return store.mutate(revision,state=>{if(state.source.liveSync)conflict('The Google connection is unavailable. Restore it before saving; this edit was not saved locally.');return applyMutation(state,action,input,now());});
  if(await store.secret('google-pending'))conflict('A previous Google save has an uncertain result. Refresh from Google before editing again.');
  return store.mutate(revision,async state=>{
   if(await store.secret('google-pending'))conflict('A previous Google save has an uncertain result. Refresh from Google before editing again.');
   const client=clientFactory(cfg),raw=await fetchRemote(client,state);
   if(state.source.fingerprint!==schema.fingerprint(raw))conflict('The Google Sheet changed. Close this editor and refresh from Google before saving. Your draft has not overwritten it.');
   const remote=schema.decode(raw,state,{extended:true}),candidate=structuredClone(remote);applyMutation(candidate,action,input,now());
   const requests=schema.changes(raw,remote,candidate);
   if(requests.length){
    await store.secret('google-pending',{id:randomUUID(),startedAt:now().toISOString(),action});
    // Never replay a write after a timeout, authentication failure or ambiguous provider result.
    await client.batch(requests);
    const checked=await fetchRemote(client,candidate),result=schema.decode(checked,candidate,{extended:true});
    const expected=schema.encodeRows(candidate),observed=schema.encodeRows(result);
    if(JSON.stringify(expected)!==JSON.stringify(observed))conflict('Google returned different values after saving. Refresh from Google and review the result; do not repeat this save.');
    adopt(candidate,result);candidate.source={...candidate.source,mode:'google',liveSync:true,syncedAt:now().toISOString(),fingerprint:schema.fingerprint(checked)};
   }
   Object.assign(state,candidate);await store.secret('google-pending',null);
  });
 }
 return {status,refresh,save};
}
async function connect({store,credentials,clientFactory=createGoogleClient,now=()=>new Date()}={}){
 const local=await store.read(),id=local.source.spreadsheetId;if(!id)throw Error('The local snapshot does not identify its source workbook.');
 const cfg={enabled:true,spreadsheetId:id,credentials},client=clientFactory(cfg),metadata=await client.metadata();
 if(metadata.spreadsheetId!==id)throw Error('Google returned a different workbook. Setup stopped.');
 const existing=new Map(metadata.sheets.map(s=>[s.properties.title,s.properties]));
 const extras=Object.keys(schema.EXTRA),present=extras.filter(t=>existing.has(t));
 if(present.length&&present.length!==extras.length)throw Error('Only part of the dashboard register exists. Setup stopped to avoid overwriting workbook content.');
 const extended=present.length===extras.length;
 const raw=await client.cells(schema.ranges(metadata,{extended})),remote=schema.decode(raw,local,{extended});
 const encode=s=>schema.encodeRows(s),a=encode(local),b=encode(remote);
 // Initial setup does not silently choose between unsynced local edits and the source Sheet.
 const titles=extended?Object.keys(a):[schema.RECURRING,schema.EXCEPTIONS],differences=[];for(const title of titles)for(const item of a[title]){const other=b[title].find(x=>x.id===item.id);if(JSON.stringify(item)!==JSON.stringify(other))differences.push(item.id);}
 if(titles.some(title=>a[title].length!==b[title].length)||differences.length)throw Error('Local plan and Sheet differ ('+differences.length+' differing existing items). Reconcile these before connecting; neither copy was overwritten.');
 if(!extended){
  const requests=[],taken=new Set(metadata.sheets.map(s=>s.properties.sheetId));
  for(const[title,headers]of Object.entries(schema.EXTRA)){
   let sheetId;do{sheetId=randomInt(1,2000000000);}while(taken.has(sheetId));taken.add(sheetId);
   requests.push({addSheet:{properties:{sheetId,title,gridProperties:{rowCount:1001,columnCount:headers.length,frozenRowCount:1,hideGridlines:true}}}});
   const records=encode(local)[title];requests.push({updateCells:{start:{sheetId,rowIndex:0,columnIndex:0},rows:[{values:headers.map(schema.value)},...records.map(r=>({values:Object.values(r.cells).map(schema.value)}))],fields:'userEnteredValue'}});
   requests.push({repeatCell:{range:{sheetId,startRowIndex:0,endRowIndex:1},cell:{userEnteredFormat:{backgroundColor:{red:.043,green:.047,blue:.047},textFormat:{bold:true,foregroundColor:{red:.933,green:.925,blue:.906}}}},fields:'userEnteredFormat'}});
   requests.push({updateDimensionProperties:{range:{sheetId,dimension:'COLUMNS',startIndex:0,endIndex:headers.length},properties:{pixelSize:175},fields:'pixelSize'}});
   const formats=title==='Dashboard Properties'?[[4,5,'0.00'],[5,7,'#,##0.00 "EUR"']]:title==='Dashboard Assets'?[[3,4,'#,##0.00 "EUR"']]:[[3,4,'0.000']];
   for(const[startColumnIndex,endColumnIndex,pattern]of formats)requests.push({repeatCell:{range:{sheetId,startRowIndex:1,endRowIndex:1001,startColumnIndex,endColumnIndex},cell:{userEnteredFormat:{numberFormat:{type:'NUMBER',pattern}}},fields:'userEnteredFormat.numberFormat'}});
   if(title==='Dashboard Meters')requests.push({setDataValidation:{range:{sheetId,startRowIndex:1,endRowIndex:1001,startColumnIndex:4,endColumnIndex:5},rule:{condition:{type:'BOOLEAN'},strict:true}}});
  }
  for(const[title,col,header]of [[schema.RECURRING,22,'Stream ID'],[schema.EXCEPTIONS,18,'Payer / recipient']]){
   const p=existing.get(title);if(p.gridProperties.columnCount!==col)throw Error('Unexpected extra columns in '+title+'. Review them before setup.');
   requests.push({appendDimension:{sheetId:p.sheetId,dimension:'COLUMNS',length:1}});
   requests.push(schema.updateCell(p.sheetId,4,col,schema.value(header)));
   const records=remote[title===schema.RECURRING?'recurring':'exceptions'],rows=schema.rowsOf(raw.sheets.find(s=>s.properties.title===title));
   for(let row=5;row<65;row++){const rid=schema.cellValue(rows[row]?.[0]),record=records.find(x=>x.id===rid);if(record)requests.push(schema.updateCell(p.sheetId,row,col,schema.value(title===schema.RECURRING?record.streamId:{you:'You',wife:'Your wife',joint:'Joint',unknown:'Review'}[record.payer])));}
   if(title===schema.EXCEPTIONS){
    requests.push({setDataValidation:{range:{sheetId:p.sheetId,startRowIndex:5,endRowIndex:65,startColumnIndex:col,endColumnIndex:col+1},rule:{condition:{type:'ONE_OF_LIST',values:['You','Your wife','Joint','Review'].map(userEnteredValue=>({userEnteredValue}))},strict:true,showCustomUi:true}}});
    for(let row=5;row<65;row++)requests.push(schema.updateCell(p.sheetId,row,9,schema.exceptionWifeFormula(row+1)));
   }
  }
  // All additions belong to one atomic batch; financial inputs and unrelated formulas remain intact.
  await client.batch(requests);
 }else{
  // An existing schema alone proves read access, not Editor access. Write the
  // already-verified metadata label back unchanged, then verify it below.
  await client.batch([schema.updateCell(existing.get(schema.RECURRING).sheetId,4,22,schema.value('Stream ID'))]);
 }
 const verified=await client.cells(schema.ranges(await client.metadata())),decoded=schema.decode(verified,local,{extended:true});
 await store.mutate(local.revision,state=>{adopt(state,decoded);state.source={...state.source,mode:'google',liveSync:true,syncedAt:now().toISOString(),fingerprint:schema.fingerprint(verified)};state.audit.push({id:randomUUID(),at:now().toISOString(),label:'Connected private Google Sheets read/write',kind:'Synchronization',before:null,after:null});});
 await store.secret('google',cfg);await store.secret('google-pending',null);
}
module.exports={createSync,connect};
