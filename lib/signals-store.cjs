'use strict';
const fs=require('node:fs/promises');const path=require('node:path');const {randomUUID}=require('node:crypto');
const CAS="local old=redis.call('GET',KEYS[1]); local rev=''; if old then rev=cjson.decode(old).revision end; if rev~=ARGV[1] then return 0 end; redis.call('SET',KEYS[1],ARGV[2]); return 1";
function createStore({env=process.env,fetcher=fetch,file=path.join(__dirname,'../.signals/archive.json')}={}){
 if(env.UPSTASH_REDIS_REST_URL&&env.UPSTASH_REDIS_REST_TOKEN){
  const endpoint=new URL(env.UPSTASH_REDIS_REST_URL);if(endpoint.protocol!=='https:')throw Error('Archive storage requires HTTPS');
  const command=async body=>{const res=await fetcher(endpoint,{method:'POST',headers:{Authorization:'Bearer '+env.UPSTASH_REDIS_REST_TOKEN,'Content-Type':'application/json'},body:JSON.stringify(body),signal:AbortSignal.timeout(4000)});if(!res.ok)throw Error('Archive storage unavailable');const data=await res.json();if(data.error)throw Error('Archive storage unavailable');return data.result;};
  const key='wyassine:signals:archive:v1';
  return {kind:'shared',async read(){const raw=await command(['GET',key]);return raw?JSON.parse(raw):null;},async save(state,revision=''){return await command(['EVAL',CAS,1,key,revision,JSON.stringify({revision:randomUUID(),state})])===1;}};
 }
 if(env.VERCEL)return {kind:'unconfigured',async read(){return null;},async save(){return false;}};
 return {kind:'local',async read(){try{return JSON.parse(await fs.readFile(file,'utf8'));}catch(error){if(error.code==='ENOENT')return null;throw error;}},async save(state,revision=''){
  await fs.mkdir(path.dirname(file),{recursive:true});let lock;
  try{lock=await fs.open(file+'.lock','wx');}catch(error){if(error.code==='EEXIST')return false;throw error;}
  const temporary=file+'.'+randomUUID()+'.tmp';
  try{const current=await this.read();if((current?.revision||'')!==revision)return false;await fs.writeFile(temporary,JSON.stringify({revision:randomUUID(),state}));await fs.rename(temporary,file);return true;}
  finally{await lock.close();await fs.unlink(file+'.lock');await fs.unlink(temporary).catch(()=>{});}
 }};
}
module.exports={createStore,CAS};
