'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const {createHandler}=require('../lib/private-cv.cjs');
const {createContactHandler}=require('../lib/contact.cjs');
const env={CV_ACCESS_PIN:'08421653',CV_DATA_KEY:Buffer.alloc(32,17).toString('base64'),WEBSITE_FORMS_SECRET:'a'.repeat(64)};
async function request(handler,{method='GET',url='/contact',fields}={}){
 const res={headers:{},setHeader(key,value){this.headers[key.toLowerCase()]=value;},end(body){this.body=body;}};
 await handler({method,url,body:fields?new URLSearchParams(fields).toString():undefined,headers:{host:'www.wyassine.com',origin:'https://www.wyassine.com','content-type':'application/x-www-form-urlencoded'},socket:{remoteAddress:'test'}},res);return res;
}
async function fields(handler,kind,url){const page=await request(handler,{url});return [['action','request'],['kind',kind],['request_token',page.body.match(/name="request_token" value="([^"]+)"/)[1]],['name','Audit fixture'],['email','audit@example.invalid'],['message','A test message']];}
for(const kind of ['enquiry','pdf','pin']){
 const url=kind==='enquiry'?'/contact':'/digital-cv?request='+kind;
 const handler=notify=>kind==='enquiry'?createContactHandler({env,notify}):createHandler({env,notify,failureDelay:async()=>{}});
 test(kind+' rejects duplicate control fields before forwarding a submission',async()=>{
  let forwarded=0;const h=handler(async()=>{forwarded++;});
  for(const name of ['action','kind','request_token','message']){const base=await fields(h,kind,url),value=base.find(row=>row[0]===name)[1];const res=await request(h,{method:'POST',url,fields:[...base,[name,value]]});assert.equal(res.statusCode,400,name);}
  assert.equal(forwarded,0);
 });
 test(kind+' escapes reflected HTML and rejects control characters without exposing provider errors',async()=>{
  const h=handler(async()=>{throw Error('INTERNAL_SECRET_MUST_NOT_APPEAR');}),base=await fields(h,kind,url);
  const attack='</textarea><img src=x onerror=alert(1)>';
  const malicious=base.map(([key,value])=>[key,key==='name'||key==='message'?attack:value]);
  const res=await request(h,{method:'POST',url,fields:malicious});assert.equal(res.statusCode,503);assert.ok(!res.body.includes(attack));assert.match(res.body,/&lt;\/textarea&gt;/);assert.ok(!res.body.includes('INTERNAL_SECRET_MUST_NOT_APPEAR'));
  const invalid=base.map(([key,value])=>[key,key==='message'?'invalid\x00message':value]);assert.equal((await request(h,{method:'POST',url,fields:invalid})).statusCode,400);
 });
}
