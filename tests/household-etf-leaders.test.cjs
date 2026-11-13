'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const {createEtfLeaders,parseRanking,parseUniverse,RANKING_URL,UNIVERSE_URL,REFRESH}=require('../lib/household/etf-leaders.cjs');
const {createEtfLiveQuotes,normalizeLiveQuote}=require('../lib/household/etf-live-quotes.cjs');
const NOW=Date.parse('2026-11-07T12:00:00Z'),A='IE00TEST0001',B='IE00TEST0002',C='IE00TEST0003';
const record=(isin,name,returns)=>`<tr><td><a href="/en-de/etf-profile.html?isin=${isin}">${name}</a></td><td>100</td><td>0,35%</td><td>1.00%</td><td>10.00%</td><td>30.00%</td><td>+${returns}%</td><td>1.00%</td></tr>`;
const page=rows=>`<table><thead><tr><th>TER p.a.</th><th>5 years</th></tr></thead><tbody>${rows.join('')}</tbody></table><p>Performance values are calculated in EUR. By default, ETF returns include dividend payments.</p>`;
const universe=isins=>'TRADING UNIVERSE -\nStocks\n'+C+' Not an ETF\nTRADING UNIVERSE -\nETF\nISIN Name\n'+isins.map(isin=>isin+' Example ETF').join('\n');
const live=(isin=A)=>({isin,currency:'EUR',stockExchange:'gettex',quoteType:'R',timestamp:'2026-11-06T21:59:00Z',bid:{raw:100},ask:{raw:102},mid:{raw:101},dtdPrc:{raw:1.5}});
const fakeStream=()=>({isins:[],setInstruments(isins){this.isins=isins;},snapshot(){return {status:'connected',quotes:this.isins.map(isin=>normalizeLiveQuote(live(isin),new Set(this.isins),NOW))};},touch(){},subscribe(){return()=>{};},close(){}});
const response=(body,ok=true)=>({ok,headers:{get:()=>null},arrayBuffer:async()=>Buffer.from(body)});
test('EUR dividend-inclusive ranking parses decimals and identities; incompatible methodology fails closed',()=>{
 const html=page([record(A,'Example &amp; growth ETF',100),record(B,'Example 2x leveraged ETF',200),record(A,'Duplicate share class',100)]),rows=parseRanking(html);
 assert.equal(rows.length,2);assert.equal(rows[0].isin,B);assert.match(rows[0].productNote,/Leveraged/);assert.equal(rows[1].name,'Example & growth ETF');assert.equal(rows[1].terPercent,.35);
 assert.throws(()=>parseRanking(html.replace('EUR','USD')));assert.throws(()=>parseRanking(html.replace('returns include dividend payments','returns exclude dividend payments')));assert.throws(()=>parseRanking(page([record(A,'Bad', 'NaN')])));
 assert.deepEqual([...parseUniverse(universe([A,B]))],[A,B]);assert.throws(()=>parseUniverse('Stocks only '+A));
});
test('dynamic ranking intersects exact ISINs with the German broker ETF section and changes order when returns change',async()=>{
 let time=NOW,calls=[],html=page([record(A,'Example A',100),record(B,'Example B',200),record(C,'Unavailable ETF',999)]);const stream=fakeStream();
 const service=createEtfLeaders({clock:()=>time,stream,pdfText:async body=>body.toString(),fetcher:async(url,options)=>{calls.push(url);assert.ok(!options.body);return response(url===UNIVERSE_URL?universe([A,B]):html);}});
 const [a,b]=await Promise.all([service(),service()]);assert.equal(a.status,'available');assert.equal(calls.length,2);assert.deepEqual(a.rows.map(r=>r.isin),[B,A]);assert.equal(a.rows[0].currency,'EUR');assert.equal(a.rows[0].quote.delaySeconds,0);assert.equal(a.sourceCount,3);assert.equal(a.matchedCount,2);assert.equal(b.metric,'Five-year EUR return including dividends');
 html=page([record(A,'Example A',300),record(B,'Example B',200)]);time+=REFRESH+1;assert.deepEqual((await service()).rows.map(r=>r.isin),[A,B]);assert.equal(calls.filter(url=>url===UNIVERSE_URL).length,1);
 time+=86400001;await service();assert.equal(calls.filter(url=>url===UNIVERSE_URL).length,2);assert.ok(calls.every(url=>[RANKING_URL,UNIVERSE_URL].includes(url)));
});
test('missing source data cannot turn unverified ETFs into eligible rows, and stale rankings expire',async()=>{
 let time=NOW,fail=false;const service=createEtfLeaders({clock:()=>time,stream:fakeStream(),pdfText:async body=>body.toString(),fetcher:async url=>{if(fail)throw Error('PRIVATE_PROVIDER_ERROR');return response(url===UNIVERSE_URL?universe([A]):page([record(A,'Example',100)]));}});
 assert.equal((await service()).status,'available');fail=true;time+=REFRESH+1;assert.equal((await service()).status,'stale');time+=86400001;const expired=await service();assert.equal(expired.status,'unavailable');assert.deepEqual(expired.rows,[]);assert.ok(!JSON.stringify(expired).includes('PRIVATE_PROVIDER_ERROR'));
 const unavailable=createEtfLeaders({clock:()=>time,stream:fakeStream(),pdfText:async()=>universe([B]),fetcher:async()=>response(page([record(A,'Not listed',100)]))});assert.equal((await unavailable()).status,'unavailable');
});
test('only genuine real-time EUR gettex bid/ask quotes for the eligible identities are accepted',()=>{
 const allowed=new Set([A]);assert.equal(normalizeLiveQuote(live(),allowed,NOW).price,101);
 for(const patch of [{isin:B},{currency:'USD'},{stockExchange:'Xetra'},{quoteType:'D'},{timestamp:'invalid'},{timestamp:'2026-12-01T00:00:00Z'},{bid:{raw:105}},{ask:{raw:0}},{mid:{raw:110}}])assert.equal(normalizeLiveQuote({...live(),...patch},allowed,NOW),null);
 assert.equal(normalizeLiveQuote({...live(),dtdPrc:null},allowed,NOW).changePercent,null);
});
test('stream pushes price changes, rejects older frames, marks disconnection and reconnects without delayed fallback',()=>{
 const sockets=[],timers=[];const factory=url=>{assert.ok(url.startsWith('wss://api.mobile.stock-data-subscriptions.justetf.com?'));const callbacks={};const socket={addEventListener:(event,fn)=>{callbacks[event]=fn;},emit:(event,data)=>callbacks[event]?.(data),close(){}};sockets.push(socket);return socket;};
 const stream=createEtfLiveQuotes({socketFactory:factory,clock:()=>NOW,schedule:(fn,ms)=>{const t={fn,ms,unref(){}};timers.push(t);return t;},cancel:()=>{}}),events=[];
 stream.setInstruments([A]);const unsubscribe=stream.subscribe(event=>events.push(event));sockets[0].emit('open');sockets[0].emit('message',{data:JSON.stringify(live())});assert.equal(events.at(-1).quotes[0].price,101);
 sockets[0].emit('message',{data:JSON.stringify({...live(),timestamp:'2026-11-06T21:59:01Z',bid:{raw:101},ask:{raw:103},mid:{raw:102}})});assert.equal(events.at(-1).quotes[0].price,102);
 sockets[0].emit('message',{data:JSON.stringify(live())});assert.equal(stream.snapshot().quotes[0].price,102);
 sockets[0].emit('error');assert.equal(stream.snapshot().status,'disconnected');assert.equal(stream.snapshot().quotes[0].stale,true);timers.find(t=>t.ms===1000).fn();assert.equal(sockets.length,2);sockets[1].emit('open');assert.equal(stream.snapshot().status,'connected');
 stream.setInstruments([B]);assert.deepEqual(stream.snapshot().quotes,[]);unsubscribe();stream.close();
});
