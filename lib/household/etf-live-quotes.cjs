'use strict';
const ENDPOINT='wss://api.mobile.stock-data-subscriptions.justetf.com';
function normalizeLiveQuote(input,allowed,now){
 const timestamp=Date.parse(input?.timestamp),price=input?.mid?.raw,bid=input?.bid?.raw,ask=input?.ask?.raw,changePercent=input?.dtdPrc?.raw;
 if(!allowed.has(input?.isin)||input.currency!=='EUR'||input.stockExchange!=='gettex'||input.quoteType!=='R'||!Number.isFinite(timestamp)||timestamp>now+300000||now-timestamp>7*86400000||![price,bid,ask].every(v=>Number.isFinite(v)&&v>0)||bid>ask||price<bid-.000001||price>ask+.000001)return null;
 return {isin:input.isin,currency:'EUR',exchange:'gettex',price,bid,ask,changePercent:Number.isFinite(changePercent)?changePercent:null,quoteTime:new Date(timestamp).toISOString(),receivedAt:new Date(now).toISOString(),delaySeconds:0,priceType:'bid_ask_midpoint'};
}
function createEtfLiveQuotes({socketFactory=url=>new WebSocket(url),clock=Date.now,schedule=setTimeout,cancel=clearTimeout}={}){
 let allowed=new Set(),socket=null,status='idle',retry=null,idle=null,attempt=0,generation=0,closed=false;const quotes=new Map(),listeners=new Set();
 const snapshot=()=>({status,quotes:[...quotes.values()].filter(q=>allowed.has(q.isin)&&clock()-Date.parse(q.quoteTime)<=7*86400000).map(q=>({...q,stale:status!=='connected'}))});
 function emit(){const value=snapshot();for(const listener of listeners)try{listener(value);}catch{}}
 function disconnect(){generation++;cancel(retry);retry=null;if(socket){const old=socket;socket=null;old.close();}}
 function connect(){
  if(closed||!allowed.size||socket)return;
  const current=++generation;status='connecting';emit();
  try{
   socket=socketFactory(ENDPOINT+'?subscription=trend&parameters=isins:'+[...allowed].join(',')+'/currency:EUR/language:en');
   const failed=()=>{if(current!==generation)return;disconnect();status='disconnected';emit();retry=schedule(connect,Math.min(30000,1000*2**Math.min(attempt++,5)));retry?.unref?.();};
   socket.addEventListener('open',()=>{if(current!==generation)return;attempt=0;status='connected';emit();});
   socket.addEventListener('message',event=>{if(current!==generation||typeof event.data!=='string'||event.data.length>16384)return;let raw;try{raw=JSON.parse(event.data);}catch{return;}const q=normalizeLiveQuote(raw,allowed,clock());if(!q)return;const previous=quotes.get(q.isin);if(previous&&Date.parse(previous.quoteTime)>Date.parse(q.quoteTime))return;quotes.set(q.isin,q);emit();});
   socket.addEventListener('error',failed);socket.addEventListener('close',failed);
  }catch{socket=null;status='disconnected';emit();retry=schedule(connect,30000);retry?.unref?.();}
 }
 function touch(){if(closed)return;cancel(idle);idle=schedule(()=>{if(!listeners.size){disconnect();status='idle';}},45000);idle?.unref?.();connect();}
 return {setInstruments(isins){const next=new Set(isins.filter(x=>/^[A-Z]{2}[A-Z0-9]{9}\d$/.test(x)).slice(0,10));if([...next].join(',')!==[...allowed].join(',')){disconnect();allowed=next;for(const isin of quotes.keys())if(!allowed.has(isin))quotes.delete(isin);}touch();},snapshot,subscribe(listener){listeners.add(listener);touch();listener(snapshot());return()=>{listeners.delete(listener);touch();};},touch,close(){closed=true;cancel(idle);disconnect();listeners.clear();}};
}
module.exports={createEtfLiveQuotes,normalizeLiveQuote,ENDPOINT};
