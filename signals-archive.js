(() => {
 'use strict';
 const rootURL=new URL('.',document.currentScript.src),endpoint=new URL('api/ai-signals?view=archive',rootURL);
 const status=document.querySelector('#archive-status'),refresh=document.querySelector('#archive-refresh');
 const reader=window.YWM_SIGNALS_READER.createReader({rootURL,archive:true});document.querySelector('#signals-archive-reader').append(reader.element);
 let busy=false,lastAttempt=0;
 reader.setData(window.YWM_AI_SIGNALS_BOOTSTRAP||{items:[]});
 async function load(){
  if(busy||document.hidden)return;busy=true;lastAttempt=Date.now();refresh.disabled=true;refresh.textContent='Checking…';
  try{
   if(location.protocol==='file:')throw Error();
   const response=await fetch(endpoint,{cache:'no-cache',headers:{Accept:'application/json'},signal:AbortSignal.timeout(28000)});
   if(!response.ok)throw Error();const data=await response.json();if(data.version!==1||!Array.isArray(data.items))throw Error();
   reader.setData(data,{verified:data.status!=='stale'});
   const stamp=Number.isFinite(Date.parse(data.updatedAt))?new Date(data.updatedAt).toLocaleString('en',{day:'numeric',month:'short',hour:'2-digit',minute:'2-digit'}):'unavailable';
   status.textContent=(data.status==='stale'?'Saved collection · Last verified ':'Last successful check · ')+stamp+(data.status==='partial'?' · Some sources delayed':'')+(['unavailable','unconfigured'].includes(data.storage)?' · Shared history is temporarily unavailable.':'');
  }catch{status.textContent='Showing the saved collection. Live news is temporarily unavailable.';}
  finally{busy=false;refresh.disabled=false;refresh.textContent='Refresh news';}
 }
 refresh.addEventListener('click',load);setInterval(load,300000);document.addEventListener('visibilitychange',()=>{if(!document.hidden&&Date.now()-lastAttempt>=300000)load();});
 document.querySelector('#signals-forget').addEventListener('click',()=>{try{localStorage.removeItem('ywm-signals-visit');}catch{}location.reload();});
 load();
})();
