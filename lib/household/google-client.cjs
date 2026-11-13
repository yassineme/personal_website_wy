'use strict';
const {JWT}=require('google-auth-library');
const SCOPE='https://www.googleapis.com/auth/spreadsheets';
function validateCredential(c){
 if(c?.type!=='service_account'||typeof c.client_email!=='string'||!c.client_email.endsWith('.iam.gserviceaccount.com')||typeof c.private_key!=='string'||!c.private_key.startsWith('-----BEGIN PRIVATE KEY-----'))throw Error('Choose a Google service-account JSON key, not an API key or OAuth client file.');
 return {type:'service_account',client_email:c.client_email,private_key:c.private_key};
}
function createGoogleClient(config,{authFactory=options=>new JWT(options),fetchImpl=fetch}={}){
 const c=validateCredential(config.credentials),id=config.spreadsheetId;
 if(typeof id!=='string'||! /^[\w-]{20,100}$/.test(id))throw Error('Invalid spreadsheet ID.');
 const auth=authFactory({email:c.client_email,key:c.private_key,scopes:[SCOPE]});
 async function call(suffix='',{query={},body}={}){
  const url=new URL('https://sheets.googleapis.com/v4/spreadsheets/'+id+suffix);
  for(const[k,v]of Object.entries(query))for(const entry of Array.isArray(v)?v:[v])url.searchParams.append(k,String(entry));
  try{
   // Use the library for signing/refresh only. Its request helper may replay a 401;
   // a financial write must have exactly one HTTP attempt, even on authentication errors.
   const headers=new Headers(await auth.getRequestHeaders());if(body)headers.set('Content-Type','application/json');
   const response=await fetchImpl(url,{method:body?'POST':'GET',headers,body:body?JSON.stringify(body):undefined,signal:AbortSignal.timeout(20000),redirect:'error'});
   if(!response.ok)throw {response:{status:response.status}};
   return await response.json();
  }
  catch(error){const code=error.response?.status;throw Object.assign(Error(code===403?'Google denied access. Enable the Sheets API and share this workbook with the service account as Editor.':code===404?'Google could not find the configured workbook or the service account cannot access it.':code===401?'Google authentication failed. Check or replace the service-account key.':code===429?'Google is rate limiting requests. Wait, then refresh; do not repeat an uncertain save.':'Google could not confirm the request. Refresh to check its result before saving again.'),{status:code===403||code===401?403:503,provider:true});}
 }
 return {metadata:()=>call('',{query:{fields:'spreadsheetId,spreadsheetUrl,sheets(properties)'}}),cells:ranges=>call('',{query:{ranges,includeGridData:true,fields:'sheets(properties,data(startRow,startColumn,rowData(values(userEnteredValue,effectiveValue,dataValidation))))'}}),batch:requests=>call(':batchUpdate',{body:{requests,includeSpreadsheetInResponse:false}})};
}
module.exports={createGoogleClient,validateCredential};
