'use strict';
const fs=require('node:fs/promises'),path=require('node:path');
const {createEtfLeaders}=require('./etf-leaders.cjs');
const REFRESH=15000,MAX_AGE=15*60000;
const ETF_REFERENCES=Object.freeze({'IE00BK5BQT80':'XETR:VWCE','IE00B4L5Y983':'XETR:EUNL'});
const LIVE_ETF_REFERENCES=Object.freeze({'IE00BK5BQT80':'LSE:VWRA','IE00B4L5Y983':'LSE:IWDA'});
const ETF_SYMBOLS=[...Object.values(ETF_REFERENCES),...Object.values(LIVE_ETF_REFERENCES)];
const ETF_COLUMNS=['close','change','change_abs','currency','update_mode','description','isin'];
function feedError(error){return error.feedStatus||(['ENOTFOUND','EAI_AGAIN','ENETUNREACH','ECONNREFUSED'].includes(error.cause?.code)?'network_unavailable':['TimeoutError','AbortError'].includes(error.name)?'timeout':'provider_unavailable');}
function httpError(status){return Object.assign(Error('Provider unavailable'),{feedStatus:status===401||status===403?'access_denied':status===429?'rate_limited':'provider_unavailable'});}
async function localMarketKey(){
 if(process.env.FINNHUB_API_KEY)return process.env.FINNHUB_API_KEY;
 try{const file=await fs.readFile(path.resolve(__dirname,'../../.env.local'),'utf8'),v=file.match(/^\s*FINNHUB_API_KEY\s*=\s*([^\r\n]*)/m)?.[1]?.trim()||'';return v.startsWith('"')||v.startsWith("'")?v.slice(1,v.indexOf(v[0],1)):v.split(/\s+#/)[0].trim();}catch{return '';}
}
function normalizeEtf(row,now){
 if(!Array.isArray(row?.d)||row.d.length!==ETF_COLUMNS.length)return null;
 const[price,changePercent,change,currency,mode,,isin]=row.d;
 const london=LIVE_ETF_REFERENCES[isin]===row.s;
 if((!london&&ETF_REFERENCES[isin]!==row.s)||currency!==(london?'USD':'EUR')||!Number.isFinite(price)||price<=0||!Number.isFinite(change)||!Number.isFinite(changePercent))return null;
 const match=typeof mode==='string'?mode.match(/^delayed_streaming_(\d+)$/):null;
 const delaySeconds=match?Number(match[1]):mode==='streaming'?0:null;
 if(delaySeconds===null||delaySeconds>86400)return null;
 return {symbol:row.s,isin,exchange:london?'London Stock Exchange':'Xetra',currency,price,change,changePercent,provider:'TradingView reference',quoteTime:null,receivedAt:new Date(now).toISOString(),delaySeconds,timestampKind:'retrieved'};
}
function positionPerformance(p,q){
 if(!q)return {status:'quote_unavailable'};
 if(!Number.isSafeInteger(p.unitsMicros)||p.unitsMicros<=0||!Number.isSafeInteger(p.costBasisCents)||p.costBasisCents<=0)return {status:'holdings_required'};
 if(q.currency!=='EUR')return {status:'currency_conversion_required'};
 // Multiply decimal shares and the provider's decimal unit price before rounding
 // once to cents. Neither a rounded average price nor a screenshot value is a quote.
 const raw=String(q.price);if(!/^\d+(?:\.\d{1,8})?$/.test(raw))return {status:'price_precision_unavailable'};
 const[a,b='']=raw.split('.'),priceAtoms=BigInt(a)*100000000n+BigInt(b.padEnd(8,'0'));
 const value=Number((BigInt(p.unitsMicros)*priceAtoms+500000000000n)/1000000000000n);
 if(!Number.isSafeInteger(value)||value>1000000000000)return {status:'valuation_unavailable'};
 const gain=value-p.costBasisCents;
 return {status:p.costBasisStatus==='estimated'?'estimated_cost_basis':'reference',valueCents:value,costBasisCents:p.costBasisCents,gainCents:gain,gainPercent:gain/p.costBasisCents*100,stale:q.stale};
}
function createInvestmentService({store,fetcher=fetch,clock=Date.now,key=localMarketKey}={}){
 const leaders=createEtfLeaders({fetcher,clock});
 const cache=new Map();let pending=null,next=0,failed=new Set(),feedStatus={finnhub:'pending',etfs:'pending'};
 async function nvidia(){
  const token=await key();if(!token)throw Object.assign(Error('No provider credential'),{feedStatus:'configuration_required'});
  const r=await fetcher('https://finnhub.io/api/v1/quote?symbol=NVDA',{headers:{'X-Finnhub-Token':token,Accept:'application/json'},signal:AbortSignal.timeout(5000),redirect:'error'});
  if(!r.ok){if(r.status===429)next=clock()+120000;throw httpError(r.status);}
  const q=await r.json();if(!Number.isFinite(q.c)||q.c<=0||!Number.isFinite(q.pc)||q.pc<=0||!Number.isFinite(q.t)||q.t<=0||q.t*1000>clock()+300000)throw Error('Invalid quote');
  cache.set('NVDA',{symbol:'NVDA',exchange:'US market reference',currency:'USD',price:q.c,previousClose:q.pc,change:q.c-q.pc,changePercent:(q.c-q.pc)/q.pc*100,quoteTime:new Date(q.t*1000).toISOString(),receivedAt:new Date(clock()).toISOString(),provider:'Finnhub',delaySeconds:null,timestampKind:'trade'});
 }
 async function etfs(){
  const r=await fetcher('https://scanner.tradingview.com/global/scan',{method:'POST',headers:{'Content-Type':'application/json',Accept:'application/json'},body:JSON.stringify({symbols:{tickers:ETF_SYMBOLS,query:{types:[]}},columns:ETF_COLUMNS,range:[0,4]}),signal:AbortSignal.timeout(7000),redirect:'error'});
  if(!r.ok){if(r.status===429)next=clock()+120000;throw httpError(r.status);}
  const body=await r.json(),found=new Set();for(const row of Array.isArray(body.data)?body.data:[]){const q=normalizeEtf(row,clock());if(q){cache.set(q.symbol,q);found.add(q.symbol);}}
  for(const symbol of ETF_SYMBOLS)if(!found.has(symbol))failed.add(symbol);
  const eur=Object.values(ETF_REFERENCES).filter(s=>found.has(s)).length,usd=Object.values(LIVE_ETF_REFERENCES).filter(s=>found.has(s)).length;
  feedStatus.etfs=eur===2?'available':eur?'partial':'invalid_response';
  feedStatus.london=usd===2?'available':usd?'partial':'invalid_response';
 }
 async function refresh(){
  failed=new Set();next=clock()+REFRESH;
  await Promise.all([nvidia().then(()=>{feedStatus.finnhub='available';}).catch(error=>{failed.add('NVDA');feedStatus.finnhub=feedError(error);}),etfs().catch(error=>{ETF_SYMBOLS.forEach(s=>failed.add(s));feedStatus.etfs=feedStatus.london=feedError(error);})]);
 }
 const get=async()=>{
  const ranking=leaders();
  if(pending)await pending;else if(clock()>=next){pending=refresh().finally(()=>{pending=null;});await pending;}
  const snapshot=await store.secret('investments');
  return {feedStatus:{...feedStatus},leaders:await ranking,refreshAfterMs:Math.max(REFRESH,next-clock()),checkedAt:new Date(clock()).toISOString(),snapshotDate:snapshot?.asOfDate||null,positions:(snapshot?.positions||[]).map(p=>{
   const symbol=p.symbol==='NVDA'?'NVDA':ETF_REFERENCES[p.isin];
   const validQuote=s=>{const value=cache.get(s);return value&&clock()-Date.parse(value.receivedAt)<=MAX_AGE?{...value,stale:failed.has(s)||(value.quoteTime&&clock()-Date.parse(value.quoteTime)>7*86400000)||false}:null;};
   const q=validQuote(symbol),liveQuote=validQuote(LIVE_ETF_REFERENCES[p.isin]);
   const performance=positionPerformance(p,q);
   return {...p,quote:q,liveQuote,quoteStatus:q?(q.stale?'stale':q.delaySeconds?'delayed':'available'):symbol?'unavailable':p.isin?'snapshot_only':'identity_required',performance,performanceStatus:performance.status};
  })};
 };
 get.subscribeEtfQuotes=leaders.subscribe;get.close=leaders.close;return get;
}
module.exports={createInvestmentService,REFRESH,ETF_REFERENCES,LIVE_ETF_REFERENCES,normalizeEtf,positionPerformance};
