'use strict';
const fs=require('node:fs/promises'),path=require('node:path'),crypto=require('node:crypto');
const AAD=Buffer.from('private-household-draft-v1');
const hashPin=(pin,salt)=>crypto.scryptSync(pin,Buffer.from(salt,'base64'),32,{N:32768,r:8,p:1,maxmem:64*1024*1024}).toString('base64');
async function atomic(file,body){const temp=file+'.'+crypto.randomUUID()+'.tmp';try{await fs.writeFile(temp,body,{mode:0o600,flag:'wx'});await fs.rename(temp,file);}finally{await fs.unlink(temp).catch(()=>{});}}
function encrypt(data,key){const iv=crypto.randomBytes(12),cipher=crypto.createCipheriv('aes-256-gcm',key,iv,{authTagLength:16});cipher.setAAD(AAD);const body=Buffer.concat([cipher.update(JSON.stringify(data),'utf8'),cipher.final()]);return JSON.stringify({version:1,iv:iv.toString('base64'),tag:cipher.getAuthTag().toString('base64'),body:body.toString('base64')});}
function decrypt(raw,key){const e=JSON.parse(raw);if(e.version!==1)throw Error('Unsupported private store');const decipher=crypto.createDecipheriv('aes-256-gcm',key,Buffer.from(e.iv,'base64'),{authTagLength:16});decipher.setAAD(AAD);decipher.setAuthTag(Buffer.from(e.tag,'base64'));return JSON.parse(Buffer.concat([decipher.update(Buffer.from(e.body,'base64')),decipher.final()]).toString('utf8'));}
function createStore(directory){
 const configPath=path.join(directory,'access.json'),dataPath=path.join(directory,'state.enc');
 async function config(){const v=JSON.parse(await fs.readFile(configPath,'utf8'));if(v.version!==1||Buffer.from(v.key,'base64').length!==32||Buffer.from(v.pinHash,'base64').length!==32)throw Error('Invalid private configuration');return v;}
 async function read(){const cfg=await config();return decrypt(await fs.readFile(dataPath,'utf8'),Buffer.from(cfg.key,'base64'));}
 async function lock(name,fn){
  const lockPath=path.join(directory,name+'.lock');let handle;
  for(let i=0;i<60;i++){
   try{handle=await fs.open(lockPath,'wx',0o600);await handle.writeFile(JSON.stringify({pid:process.pid}));break;}catch(error){if(error.code!=='EEXIST')throw error;if(i===59)throw Object.assign(new Error('Private store is busy. Please retry.'),{status:503});await new Promise(r=>setTimeout(r,25));}
  }
  try{return await fn();}finally{await handle.close();await fs.unlink(lockPath);}
 }
 async function init(data,pin){
  if(!/^\d{8,16}$/.test(pin))throw Error('Use 8 to 16 digits for the PIN.');
  await fs.mkdir(directory,{recursive:true,mode:0o700});await fs.chmod(directory,0o700);
  const salt=crypto.randomBytes(16).toString('base64'),key=crypto.randomBytes(32),cfg={version:1,salt,pinHash:hashPin(pin,salt),key:key.toString('base64'),epoch:crypto.randomUUID()};
  await fs.writeFile(configPath,JSON.stringify(cfg),{flag:'wx',mode:0o600});
  try{await fs.writeFile(dataPath,encrypt(data,key),{flag:'wx',mode:0o600});}catch(e){await fs.unlink(configPath);throw e;}
 }
 async function mutate(expected,apply){return lock('state',async()=>{const state=await read();if(state.revision!==expected)throw Object.assign(new Error('The plan changed in another tab. Reload before saving.'),{status:409});const oldRaw=await fs.readFile(dataPath,'utf8');const result=await apply(state);state.revision++;const cfg=await config();await fs.mkdir(path.join(directory,'backups'),{recursive:true,mode:0o700});await atomic(path.join(directory,'backups','revision-'+String(expected).padStart(6,'0')+'.enc'),oldRaw);await atomic(dataPath,encrypt(state,Buffer.from(cfg.key,'base64')));return result;});}
 // Server-only named secrets never form part of the state returned to the browser.
 async function secret(name,value){if(!['google','google-pending','investments','assessment','actions','tax-2025'].includes(name))throw Error('Unknown private secret.');const file=path.join(directory,name+'.enc'),key=Buffer.from((await config()).key,'base64');if(arguments.length>1){await atomic(file,encrypt(value,key));return;}try{return decrypt(await fs.readFile(file,'utf8'),key);}catch(error){if(error.code==='ENOENT')return null;throw error;}}
 async function limits(update){return lock('attempts',async()=>{const file=path.join(directory,'attempts.json');let state={};try{state=JSON.parse(await fs.readFile(file,'utf8'));}catch(e){if(e.code!=='ENOENT')throw e;}const result=update(state);await atomic(file,JSON.stringify(state));return result;});}
 async function rotate(pin){if(!/^\d{8,16}$/.test(pin))throw Error('Use 8 to 16 digits.');return lock('state',async()=>{const cfg=await config();cfg.salt=crypto.randomBytes(16).toString('base64');cfg.pinHash=hashPin(pin,cfg.salt);cfg.epoch=crypto.randomUUID();await atomic(configPath,JSON.stringify(cfg));});}
 async function updateAction(expected,id,done,at){return lock('actions',async()=>{
  const plan=await secret('actions');
  if(!plan||plan.revision!==expected)throw Object.assign(Error('Action items changed. Reload before saving.'),{status:409});
  const item=plan.items.find(x=>x.id===id);
  if(!item||typeof done!=='boolean')throw Object.assign(Error('Invalid action item.'),{status:400});
  item.completedAt=done?at:null;plan.revision++;await secret('actions',plan);return plan;
 });}
 async function updateTax(expected,action,input,at){return lock('tax-2025',async()=>{
  const tax=require('./tax.cjs'),state=await secret('tax-2025')||tax.empty();
  if(state.revision!==expected)throw Object.assign(Error('Tax dossier changed in another tab. Reload before saving.'),{status:409});
  const old=JSON.parse(JSON.stringify(state));
  tax.mutate(state,action,input,at);
  const cfg=await config();await fs.mkdir(path.join(directory,'backups'),{recursive:true,mode:0o700});
  await atomic(path.join(directory,'backups','tax-2025-'+String(expected).padStart(6,'0')+'.enc'),encrypt(old,Buffer.from(cfg.key,'base64')));
  await secret('tax-2025',state);return tax.view(state);
 });}
 return {directory,init,config,read,mutate,limits,rotate,secret,updateAction,updateTax};
}
module.exports={createStore,encrypt,decrypt,hashPin};
