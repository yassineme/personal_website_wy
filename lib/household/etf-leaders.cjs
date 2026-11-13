'use strict';
const {spawn}=require('node:child_process');
const {createEtfLiveQuotes}=require('./etf-live-quotes.cjs');
const RANKING_URL='https://www.justetf.com/en-de/market-overview/best-etf-last-5-years/';
const UNIVERSE_URL='https://assets.traderepublic.com/assets/files/DE/Instrument_Universe_DE_en.pdf';
const REFRESH=5*60000,MAX_AGE=24*60*60000,UNIVERSE_REFRESH=24*60*60000;
const text=value=>String(value).replace(/<[^>]*>/g,' ').replace(/&amp;/g,'&').replace(/&quot;/g,'"').replace(/&#39;|&apos;/g,"'").replace(/&nbsp;|&#160;/g,' ').replace(/&#(\d+);/g,(_,n)=>String.fromCodePoint(Number(n))).replace(/&#x([0-9a-f]+);/gi,(_,n)=>String.fromCodePoint(parseInt(n,16))).replace(/\s+/g,' ').trim();
function percent(value){const s=text(value);return /^[+−-]?\d+(?:[.,]\d+)?%$/.test(s)?Number(s.replace('−','-').replace('%','').replace(',','.')):null;}
function parseRanking(html){
 if(typeof html!=='string'||html.length>3000000||!/Performance values are calculated in EUR/i.test(html)||!/returns include dividend payments/i.test(html))throw Error('Ranking methodology unavailable');
 const rows=[],seen=new Set();
 for(const table of html.matchAll(/<table\b[^>]*>([\s\S]*?)<\/table>/gi)){
  if(!/5 years/i.test(text(table[1]))||!/TER p.a./i.test(text(table[1])))continue;
  for(const match of table[1].matchAll(/<tr\b[^>]*>([\s\S]*?)<\/tr>/gi)){
   const cells=[...match[1].matchAll(/<td\b[^>]*>([\s\S]*?)<\/td>/gi)].map(m=>m[1]);if(cells.length!==8)continue;
   const isin=cells[0].match(/etf-profile\.html\?isin=([A-Z]{2}[A-Z0-9]{9}\d)/)?.[1],name=text(cells[0]),returnPercent=percent(cells[6]),terPercent=percent(cells[2]);
   if(!isin||seen.has(isin)||!name||name.length>400||returnPercent===null||returnPercent< -100||terPercent===null||terPercent<0||terPercent>10)continue;
   seen.add(isin);rows.push({isin,name,returnPercent,terPercent,currency:'EUR',profileUrl:'https://www.justetf.com/en-de/etf-profile.html?isin='+isin,productNote:/leverag|\b[23]x\b|apalancado|inverse/i.test(name)?'Leveraged / inverse':''});
  }
 }
 if(!rows.length)throw Error('No valid ranking');
 return rows.sort((a,b)=>b.returnPercent-a.returnPercent||a.isin.localeCompare(b.isin));
}
function parseUniverse(pdfText){
 const section=String(pdfText).split(/TRADING UNIVERSE\s*-\s*ETF\b/)[1];if(!section)throw Error('ETF universe unavailable');
 const isins=new Set([...section.matchAll(/\b[A-Z]{2}[A-Z0-9]{9}\d\b/g)].map(m=>m[0]));if(!isins.size)throw Error('No ETF identities');return isins;
}
function extractPdfText(buffer){return new Promise((resolve,reject)=>{
 const child=spawn('pdftotext',['-layout','-','-'],{stdio:['pipe','pipe','ignore']});let output='',settled=false;const timer=setTimeout(()=>{child.kill();finish(Error('PDF extraction timed out'));},10000);
 function finish(error){if(settled)return;settled=true;clearTimeout(timer);error?reject(error):resolve(output);}
 child.on('error',()=>finish(Error('PDF text extractor unavailable')));child.stdout.on('data',chunk=>{output+=chunk;if(output.length>3000000){child.kill();finish(Error('Universe too large'));}});child.on('close',code=>finish(code===0?null:Error('Invalid universe PDF')));child.stdin.on('error',()=>{});child.stdin.end(buffer);
});}
async function boundedBody(response,max,binary=false){
 const size=Number(response.headers?.get?.('content-length'));if(size>max)throw Error('Response too large');
 // The public sources are bounded again after decoding; redirects are rejected.
 const buffer=Buffer.from(await response.arrayBuffer());if(buffer.length>max)throw Error('Response too large');return binary?buffer:buffer.toString('utf8');
}
function createEtfLeaders({fetcher=fetch,clock=Date.now,pdfText=extractPdfText,stream=createEtfLiveQuotes({clock})}={}){
 let cached=null,universe=null,universeAt=0,next=0,pending=null,failed=false;
 async function refresh(){
  next=clock()+REFRESH;
  try{
   const get=async url=>{const response=await fetcher(url,{headers:{Accept:url===UNIVERSE_URL?'application/pdf':'text/html'},signal:AbortSignal.timeout(12000),redirect:'error'});if(!response.ok)throw Error('Public source unavailable');return response;};
   const rankingPromise=get(RANKING_URL).then(r=>boundedBody(r,3000000)).then(parseRanking);
   const universePromise=universe&&clock()-universeAt<UNIVERSE_REFRESH?Promise.resolve({isins:universe,checkedAt:universeAt}):get(UNIVERSE_URL).then(r=>boundedBody(r,12000000,true)).then(pdfText).then(parseUniverse).then(isins=>({isins,checkedAt:clock()}));
   const [ranking,available]=await Promise.all([rankingPromise,universePromise]);
   const eligible=ranking.filter(row=>available.isins.has(row.isin)),rows=eligible.slice(0,10);
   if(!rows.length)throw Error('No verified eligible ETFs');
   universe=available.isins;universeAt=available.checkedAt;
   cached={rows,sourceCount:ranking.length,matchedCount:eligible.length,universeCount:universe.size,receivedAt:new Date(clock()).toISOString(),availabilityCheckedAt:new Date(universeAt).toISOString(),provider:'justETF',rankingUrl:RANKING_URL,availabilityUrl:UNIVERSE_URL,metric:'Five-year EUR return including dividends',scope:'Trade Republic Germany published ETF universe',coverage:rows.length===10?'top10':'partial'};failed=false;stream.setInstruments(rows.map(row=>row.isin));
  }catch{failed=true;}
 }
 function withQuotes(){const live=stream.snapshot(),byIsin=new Map(live.quotes.map(q=>[q.isin,q]));return {...cached,rows:cached.rows.map(row=>({...row,quote:byIsin.get(row.isin)||null})),quoteStreamStatus:live.status,status:failed?'stale':'available',stale:failed};}
 const get=async()=>{
  if(pending)await pending;else if(clock()>=next){pending=refresh().finally(()=>{pending=null;});await pending;}
  if(!cached||clock()-Date.parse(cached.receivedAt)>MAX_AGE)return {status:'unavailable',rows:[],rankingUrl:RANKING_URL,availabilityUrl:UNIVERSE_URL};
  stream.touch();return withQuotes();
 };
 get.subscribe=listener=>stream.subscribe(listener);get.close=()=>stream.close();return get;
}
module.exports={createEtfLeaders,parseRanking,parseUniverse,extractPdfText,RANKING_URL,UNIVERSE_URL,REFRESH};
