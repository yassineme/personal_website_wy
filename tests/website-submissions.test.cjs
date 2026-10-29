'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),crypto=require('node:crypto'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const {createSubmissionClient}=require('../lib/website-submissions.cjs');
const {createContactHandler}=require('../lib/contact.cjs');
const scriptRoot=fs.existsSync(path.join(__dirname,'../apps-script/Code.gs')) ? path.join(__dirname,'../apps-script') : path.join(__dirname,'../../website-submissions');
const schema=JSON.parse(fs.readFileSync(path.join(scriptRoot,'schema.json'),'utf8'));
const env={WEBSITE_FORMS_URL:'https://script.google.com/macros/s/test-deployment/exec',WEBSITE_FORMS_SECRET:'a'.repeat(64)};
const submission={id:'b'.repeat(64),kind:'pdf',name:'Local Reviewer',email:'visitor@example.invalid',message:'Please share the PDF.'};

function google() {
  const rows=[schema.headers.slice()],sent=[],props={WEBSITE_FORMS_SECRET:env.WEBSITE_FORMS_SECRET,SPREADSHEET_ID:'private-test-sheet',OWNER_EMAIL:'owner@example.invalid'};
  let opens=0,quota=100,mailFailure=false,failTo='';
  function range(row,col,height=1,width=1){return {
    getValues:()=>Array.from({length:height},(_,i)=>Array.from({length:width},(_,j)=>rows[row-1+i]?.[col-1+j]??'')),
    getValue:()=>rows[row-1]?.[col-1]??'',
    setValues(values){values.forEach((values,i)=>{rows[row-1+i]??=[];values.forEach((value,j)=>rows[row-1+i][col-1+j]=value);});return this;},
    setValue(value){return this.setValues([[value]]);},setNumberFormat(){return this;},
    createTextFinder(text){return {matchEntireCell(){return this;},findNext(){const offset=rows.slice(row-1,row-1+height).findIndex(r=>r[col-1]===text);return offset<0?null:{getRow:()=>row+offset};}};}
  };}
  const sheet={getRange:range,getLastRow:()=>rows.length,getMaxRows:()=>1000,insertRowsAfter(){}};
  const context=vm.createContext({Date,Number,JSON,Object,String,Error,PropertiesService:{getScriptProperties:()=>({getProperties:()=>({...props}),getProperty:key=>props[key]??null,setProperty:(key,value)=>{props[key]=value;},deleteProperty:key=>{delete props[key];}})},
    Utilities:{computeHmacSha256Signature:(value,key)=>[...crypto.createHmac('sha256',key).update(value).digest()],base64Decode:value=>Buffer.from(value,'base64'),newBlob:buffer=>({getDataAsString:()=>buffer.toString('utf8')})},
    LockService:{getScriptLock:()=>({tryLock:()=>true,waitLock(){},releaseLock(){}})},
    SpreadsheetApp:{openById:()=>{opens++;return {getSheetByName:()=>sheet,getUrl:()=> 'https://docs.google.com/spreadsheets/d/private-test-sheet/edit'};},flush(){}},
    ContentService:{MimeType:{JSON:'application/json'},createTextOutput:value=>({setMimeType:()=>JSON.parse(value)})},
    MailApp:{getRemainingDailyQuota:()=>quota,sendEmail:message=>{if(mailFailure || message.to===failTo)throw Error('Mail failed');sent.push(message);}}
  });
  vm.runInContext(fs.readFileSync(path.join(scriptRoot,'Code.gs'),'utf8'),context);
  return {rows,sent,props,context,get opens(){return opens;},set quota(value){quota=value;},set mailFailure(value){mailFailure=value;},set failTo(value){failTo=value;},fetcher:async(url,options)=>({ok:true,json:async()=>context.doPost({postData:{contents:options.body}})})};
}

test('signed relay persists CV/PIN/enquiry requests and returns a real storage acknowledgement',async()=>{
  const g=google(),client=createSubmissionClient(env,g.fetcher);
  for(const [index,kind] of ['pin','pdf','enquiry'].entries())assert.equal((await client({...submission,id:String(index+1).repeat(64),kind})).stored,true);
  assert.equal(g.rows.length,4);assert.deepEqual(g.rows.slice(1).map(row=>row[1]),['PIN request','PDF request','Enquiry']);assert.equal(g.sent.length,0);
  assert.equal(JSON.stringify(Array.from(g.context.SUBMISSION_HEADERS)),JSON.stringify(schema.headers));
});
test('server relay whitelists fields and never forwards credentials, IP addresses or attachments',async()=>{
  let payload;const g=google(),client=createSubmissionClient(env,async(url,options)=>{payload=JSON.parse(Buffer.from(JSON.parse(options.body).payload,'base64'));return g.fetcher(url,options);});
  await client({...submission,pin:'never-share-pin',cookie:'session',ip:'sensitive-ip',attachments:['resume.pdf']});
  assert.deepEqual(Object.keys(payload).sort(),['version','timestamp','id','kind','name','email','message','source'].sort());
});
test('missing configuration, foreign endpoints, HTTP errors, login pages and false acknowledgements fail honestly',async()=>{
  let calls=0;for(const configuration of [{},{...env,WEBSITE_FORMS_URL:'https://evil.example/exec'},{...env,WEBSITE_FORMS_SECRET:'short'}])await assert.rejects(createSubmissionClient(configuration,async()=>{calls++;})(submission));assert.equal(calls,0);
  for(const response of [{ok:false},{ok:true,json:async()=>{throw Error('HTML login');}},{ok:true,json:async()=>({ok:false})},{ok:true,json:async()=>({ok:true,stored:true,id:'wrong-id'})}])await assert.rejects(createSubmissionClient(env,async()=>response)(submission));
});
test('unauthenticated, forged, expired, future and invalid payloads never open the private spreadsheet',async()=>{
  const g=google(),payload=Buffer.from(JSON.stringify({version:1,timestamp:0,...submission,source:'/digital-cv'})).toString('base64');
  for(const raw of ['{}',JSON.stringify({payload,signature:'0'.repeat(64)}),JSON.stringify({payload,signature:crypto.createHmac('sha256',env.WEBSITE_FORMS_SECRET).update(payload).digest('hex')})])assert.equal(g.context.doPost({postData:{contents:raw}}).ok,false);
  await assert.rejects(createSubmissionClient(env,g.fetcher,()=>Date.now()+600000)(submission));
  assert.equal(g.opens,0);assert.equal(g.rows.length,1);
});
test('persistent request IDs prevent duplicates even across different server client instances',async()=>{
  const g=google();await createSubmissionClient(env,g.fetcher)(submission);await createSubmissionClient(env,g.fetcher)(submission);assert.equal(g.rows.length,2);
});
test('untrusted text cannot create spreadsheet formulas and tampered headers stop writes',async()=>{
  const g=google();await createSubmissionClient(env,g.fetcher)({...submission,name:'=HYPERLINK("evil")',message:'+SUM(1,2)'});
  assert.ok(g.rows[1][2].startsWith("'="));assert.ok(g.rows[1][4].startsWith("'+"));
  g.rows[0][0]='Unexpected header';await assert.rejects(createSubmissionClient(env,g.fetcher)({...submission,id:'c'.repeat(64)}));assert.equal(g.rows.length,2);
});
test('Google quota exhaustion keeps submissions queued, without losing the row or claiming delivery',async()=>{
  const g=google();await createSubmissionClient(env,g.fetcher)(submission);g.quota=0;g.context.sendPendingNotifications();assert.equal(g.rows[1][7],'Pending');assert.equal(g.sent.length,0);
});
test('timer independently notifies the owner and acknowledges the visitor without sharing the CV',async()=>{
  const g=google();await createSubmissionClient(env,g.fetcher)(submission);g.context.sendPendingNotifications();g.context.sendPendingNotifications();
  assert.equal(g.sent.length,2);assert.equal(g.sent[0].to,'owner@example.invalid');assert.equal(g.sent[0].replyTo,submission.email);assert.equal(g.sent[0].attachments,undefined);assert.equal(g.rows[1][7],'Sent');assert.ok(g.rows[1][8] instanceof Date);
  assert.equal(g.sent[1].to,submission.email);assert.equal(g.sent[1].replyTo,'owner@example.invalid');assert.equal(g.sent[1].attachments,undefined);assert.equal(g.rows[1][13],'Sent');
  g.rows[1][5]='Approved';g.context.sendPendingNotifications();assert.equal(g.sent.length,2);
});
test('uncertain mail failures and stale Sending states require manual review instead of duplicate sends',async()=>{
  const g=google();await createSubmissionClient(env,g.fetcher)(submission);g.mailFailure=true;g.context.sendPendingNotifications();assert.equal(g.rows[1][7],'Needs review');g.mailFailure=false;g.context.sendPendingNotifications();assert.equal(g.sent.length,1);assert.equal(g.sent[0].to,submission.email);
  g.rows[1][7]='Sending';g.rows[1][12]=new Date(Date.now()-11*60*1000);g.context.sendPendingNotifications();assert.equal(g.rows[1][7],'Needs review');assert.equal(g.sent.length,1);
});
test('persistent daily submission cap rejects new rows while allowing safe duplicate acknowledgements',async()=>{
  const g=google();await createSubmissionClient(env,g.fetcher)(submission);g.props.DAILY_SUBMISSIONS=JSON.stringify({day:new Date().toISOString().slice(0,10),count:200});
  assert.equal((await createSubmissionClient(env,g.fetcher)(submission)).stored,true);
  await assert.rejects(createSubmissionClient(env,g.fetcher)({...submission,id:'c'.repeat(64)}));assert.equal(g.rows.length,2);
});

test('each request type receives the appropriate plain-text acknowledgement without echoing submitted links',async()=>{
  for(const [index,kind] of ['pin','pdf','enquiry'].entries()){
    const g=google();await createSubmissionClient(env,g.fetcher)({...submission,id:String(index+1).repeat(64),kind,message:'Untrusted https://untrusted.example/ text'});
    g.context.sendPendingNotifications();const reply=g.sent.find(mail=>mail.to===submission.email);
    assert.ok(reply);assert.doesNotMatch(reply.body,/untrusted.example/);assert.equal(reply.htmlBody,undefined);assert.equal(reply.attachments,undefined);
    assert.match(reply.subject,kind==='pin'?/access request/:kind==='pdf'?/PDF request/:/getting in touch/);
    assert.ok(g.rows[1][14] instanceof Date);assert.equal(g.rows[1][15],1);
  }
});
test('a failed visitor acknowledgement never repeats a successful owner notification',async()=>{
  const g=google();await createSubmissionClient(env,g.fetcher)(submission);g.failTo=submission.email;g.context.sendPendingNotifications();
  assert.equal(g.rows[1][7],'Sent');assert.equal(g.rows[1][13],'Needs review');assert.equal(g.sent.length,1);
  g.failTo='';g.context.sendPendingNotifications();assert.equal(g.sent.length,1);
  g.rows[1][13]='Pending';g.context.sendPendingNotifications();assert.equal(g.sent.length,2);assert.equal(g.sent[1].to,submission.email);assert.equal(g.rows[1][15],2);
});
test('a single remaining quota slot sends one email and leaves the other queued',async()=>{
  const g=google();await createSubmissionClient(env,g.fetcher)(submission);g.quota=1;g.context.sendPendingNotifications();
  assert.equal(g.sent.length,1);assert.equal(g.rows[1][7],'Sent');assert.equal(g.rows[1][13],'Pending');
  g.quota=1;g.context.sendPendingNotifications();assert.equal(g.sent.length,2);assert.equal(g.rows[1][13],'Sent');
});
test('stale visitor Sending state is held for review while duplicate requests remain deduplicated',async()=>{
  const g=google(),client=createSubmissionClient(env,g.fetcher);await client(submission);
  g.rows[1][13]='Sending';g.rows[1][16]=new Date(Date.now()-11*60*1000);g.context.sendPendingNotifications();
  assert.equal(g.rows[1][13],'Needs review');await client(submission);g.context.sendPendingNotifications();assert.equal(g.sent.length,1);assert.equal(g.rows.length,2);
});

// Small in-memory SpreadsheetApp implementation for setup/migration verification.
function setupGoogle(initial={}) {
  const g=google(),tabs=new Map(),formulas=new Map();
  function tab(name,values=[]){
    const rows=values.map(row=>row.slice());let maxRows=1000,filter=null;
    function range(row,col,height=1,width=1){
      const r={getValues:()=>Array.from({length:height},(_,i)=>Array.from({length:width},(_,j)=>rows[row-1+i]?.[col-1+j]??'')),
        getValue:()=>rows[row-1]?.[col-1]??'',getFormula:()=>formulas.get(name+':'+row+':'+col)||'',
        setValues(data){data.forEach((line,i)=>{rows[row-1+i]??=[];line.forEach((value,j)=>rows[row-1+i][col-1+j]=value);});return r;},
        setFormula(value){formulas.set(name+':'+row+':'+col,value);return r.setValues([[value]]);},
        createFilter(){filter={remove(){filter=null;}};return filter;}};
      for(const method of ['setFontFamily','setFontWeight','setFontColor','setBackground','setWrap','setVerticalAlignment','setNumberFormat','setDataValidation'])r[method]=()=>r;
      return r;
    }
    const sheet={rows,getRange:range,getLastRow:()=>rows.length,getMaxRows:()=>maxRows,getFilter:()=>filter,
      insertRowsAfter:(after,count)=>{maxRows+=count;}};
    for(const method of ['setFrozenRows','setFrozenColumns','setRowHeight','setColumnWidth','setRowHeights'])sheet[method]=()=>sheet;
    tabs.set(name,sheet);return sheet;
  }
  Object.entries(initial).forEach(([name,values])=>tab(name,values));
  const book={getSheetByName:name=>tabs.get(name),insertSheet:name=>tab(name),getUrl:()=> 'private-sheet',setSpreadsheetTimeZone(){}};
  g.context.SpreadsheetApp={openById:()=>book,flush(){},newDataValidation:()=>({requireValueInList(){return this;},setAllowInvalid(){return this;},build(){return {};}})};
  return {...g,tabs,formulas};
}
test('manual setup creates all five tabs, preserves Sheet1 and can run twice without credentials or emails',()=>{
  const g=setupGoogle({Sheet1:[['Keep this existing cell']]});delete g.props.WEBSITE_FORMS_SECRET;delete g.props.OWNER_EMAIL;
  g.context.setupSheet();g.context.setupSheet();
  assert.deepEqual([...g.tabs.keys()],['Sheet1','Submissions','Enquiries','PIN requests','PDF requests','Guide']);assert.equal(g.tabs.get('Sheet1').rows[0][0],'Keep this existing cell');
  assert.deepEqual(g.tabs.get('Submissions').rows[0],schema.headers);assert.equal(g.sent.length,0);
  for(const [name,type] of Object.entries(schema.views))assert.equal(g.formulas.get(name+':2:1'),'=IFNA(FILTER(Submissions!A2:Q,Submissions!B2:B="'+type+'"),"")');
});
test('upgrading the earlier 13-column log preserves existing data and skips historical auto-replies',()=>{
  const old=['date','PIN request','Visitor','visitor@example.invalid','Message','Approved','Owner notes','Sent','date','id','source',1,'date'];
  const g=setupGoogle({Submissions:[schema.headers.slice(0,13),old]});g.context.setupSheet();g.context.setupSheet();
  assert.deepEqual(g.tabs.get('Submissions').rows[1].slice(0,13),old);assert.equal(g.tabs.get('Submissions').rows[1][13],'Skipped');assert.equal(g.sent.length,0);
});
test('setup refuses conflicting named tabs before modifying the master log',()=>{
  const g=setupGoogle({Submissions:[schema.headers.slice(0,13)],Enquiries:[['Unrelated data']]});
  assert.throws(()=>g.context.setupSheet(),/differs/);assert.equal(g.tabs.get('Submissions').rows[0].length,13);assert.equal(g.tabs.get('Enquiries').rows[0][0],'Unrelated data');
});

test('standalone retries use the exact request ID and only requeue the selected email channel',async()=>{
  const g=google();await createSubmissionClient(env,g.fetcher)(submission);g.rows[1][7]='Sent';g.rows[1][13]='Needs review';
  g.props.RETRY_REQUEST_ID='0'.repeat(64);assert.throws(()=>g.context.retryAutoReplyById(),/not found/);assert.equal(g.rows[1][13],'Needs review');
  g.props.RETRY_REQUEST_ID=submission.id;g.context.retryAutoReplyById();assert.equal(g.rows[1][13],'Pending');assert.equal(g.rows[1][7],'Sent');assert.equal(g.props.RETRY_REQUEST_ID,undefined);assert.equal(g.sent.length,0);
  g.props.RETRY_REQUEST_ID=submission.id;assert.throws(()=>g.context.retryOwnerNotificationById(),/needing review/);assert.equal(g.rows[1][7],'Sent');
});

async function contact(handler,{method='GET',fields,origin='https://www.wyassine.com'}={}){
  const response={headers:{},setHeader(name,value){this.headers[name.toLowerCase()]=value;},end(value){this.body=value;}};
  await handler({method,body:fields?new URLSearchParams(fields).toString():undefined,headers:{host:'www.wyassine.com',origin,'content-type':'application/x-www-form-urlencoded'},socket:{remoteAddress:'test'}},response);return response;
}
async function enquiry(handler,extra={}){
  const page=await contact(handler),token=page.body.match(/name="request_token" value="([^"]+)"/)[1];
  return {action:'request',kind:'enquiry',request_token:token,name:submission.name,email:submission.email,message:submission.message,...extra};
}
test('contact form round-trip saves a Sheet row without requiring CV access',async()=>{
  const g=google(),handler=createContactHandler({env,notify:createSubmissionClient(env,g.fetcher)}),fields=await enquiry(handler);
  const response=await contact(handler,{method:'POST',fields});assert.equal(response.statusCode,200);assert.match(response.body,/Request received/);assert.ok(!response.headers['set-cookie']);assert.equal(g.rows[1][1],'Enquiry');
  assert.equal((await contact(handler,{method:'POST',fields})).statusCode,200);assert.equal(g.rows.length,2);
});
test('contact CSRF, tokens, spam traps and invalid fields cannot reach the Sheet',async()=>{
  let calls=0;const handler=createContactHandler({env,notify:async()=>{calls++;}});
  for(const extra of [{request_token:'forged'},{name:''},{email:'bad\naddress'},{message:''},{message:'x'.repeat(1001)},{website:'spam.invalid'}])assert.equal((await contact(handler,{method:'POST',fields:await enquiry(handler,extra)})).statusCode,400);
  assert.equal((await contact(handler,{method:'POST',fields:await enquiry(handler),origin:'https://other.example'})).statusCode,403);assert.equal(calls,0);
});
test('contact rate limits, missing setup and storage failures remain visible and never report success',async()=>{
  const handler=createContactHandler({env,maxRequests:1,notify:async()=>{throw Error('Storage offline');}});
  const response=await contact(handler,{method:'POST',fields:await enquiry(handler)});assert.equal(response.statusCode,503);assert.match(response.body,/could not be saved/);
  assert.equal((await contact(handler,{method:'POST',fields:await enquiry(handler)})).statusCode,429);assert.equal((await contact(createContactHandler({env:{}}))).statusCode,503);
});
