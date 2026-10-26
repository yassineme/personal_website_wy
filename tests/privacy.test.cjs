const {test}=require('node:test');const assert=require('node:assert/strict');
const core=require('../privacy-core.js');
const base={analyticsEnabled:true,gaMeasurementId:'G-ABC1234567',vercelAnalyticsEnabled:true,vercelAnalyticsScriptPath:'/_vercel/insights/script.js',privacyReviewed:true,productionHosts:['www.wyassine.com'],consentVersion:'test-1'};
const now=Date.parse('2026-10-25T12:00:00Z');
const store=value=>({getItem(){return typeof value==='string'?value:JSON.stringify(value)}});
function environment(config=base,href='https://www.wyassine.com/blog.html?email=private@example.com#contact'){
 const scripts=[],win={};const loc=new URL(href);
 const doc={title:'Notes on change',referrer:'https://source.example/path?private=secret#x',head:{appendChild(el){scripts.push(el);}},createElement(tag){return{tag,dataset:{},remove(){this.removed=true;}}},querySelectorAll(){return scripts.filter(x=>!x.removed)}};
 const analytics=core.createAnalytics({win,doc,config,location:loc});return{analytics,win,doc,scripts};
}
test('missing, malformed, expired and changed-policy decisions do not grant consent',()=>{
 assert.equal(core.read(store(null),base,now),null);assert.equal(core.read(store('{broken'),base,now),null);
 const record=core.createRecord({google:true,vercel:false},base,now);
 assert.deepEqual(core.read(store(record),base,now).choices,{google:true,vercel:false});
 assert.equal(core.read(store(record),base,now+core.TTL+1),null);
 assert.equal(core.read(store(record),{...base,gaMeasurementId:'G-DEF1234567'},now),null);
 assert.equal(core.read(store(record),{...base,privacyReviewed:false},now),null);
 assert.equal(core.read(store(record),{...base,vercelAnalyticsEnabled:false},now),null);
 assert.equal(core.read(store({...record,choices:{google:'yes',vercel:false}}),base,now),null);
 assert.equal(core.read(store({...record,decidedAt:now+600000}),base,now),null);
});
test('unknown choice and Only essential never append either analytics script',()=>{
 const env=environment();assert.equal(env.scripts.length,0);env.analytics.apply(core.denied());assert.equal(env.scripts.length,0);assert.equal(env.win['ga-disable-'+base.gaMeasurementId],true);
});
test('provider choices are independent and outgoing Vercel URLs are sanitized',()=>{
 const env=environment();env.analytics.apply({vercel:true,google:false});assert.equal(env.scripts.length,1);assert.equal(env.scripts[0].dataset.analyticsProvider,'vercel');
 const beforeSend=env.win.vaq.find(args=>args[0]==='beforeSend')[1];
 assert.equal(beforeSend({url:'https://www.wyassine.com/a?secret=one#two'}).url,'https://www.wyassine.com/a');
 assert.equal(env.analytics.revoke(),true);assert.equal(beforeSend({url:'https://www.wyassine.com/'}),null);
});
test('Google uses basic opt-in, keeps ads denied, and strips query data',()=>{
 const env=environment();env.analytics.apply({google:true,vercel:false});assert.equal(env.scripts.length,1);assert.equal(env.scripts[0].dataset.analyticsProvider,'google');
 assert.equal(env.win.dataLayer.some(args=>args[0]==='config'),false);
 env.scripts[0].onload();const commands=env.win.dataLayer;
 const update=commands.find(args=>args[0]==='consent'&&args[1]==='update')[2];assert.equal(update.analytics_storage,'granted');assert.equal(update.ad_storage,'denied');assert.equal(update.ad_user_data,'denied');assert.equal(update.ad_personalization,'denied');
 const page=commands.find(args=>args[0]==='event'&&args[1]==='page_view')[2];assert.equal(page.page_location,'https://www.wyassine.com/blog.html');assert.equal(page.page_referrer,'https://source.example/path');
 const cfg=commands.find(args=>args[0]==='config')[2];assert.equal(cfg.allow_google_signals,false);assert.equal(cfg.cookie_expires,180*86400);
});
test('late Google script completion cannot start tracking after withdrawal',()=>{
 const env=environment();env.analytics.apply({google:true,vercel:false});env.analytics.revoke();env.scripts[0].onload();assert.equal(env.win.dataLayer.some(args=>args[0]==='config'||args[0]==='event'),false);assert.equal(env.win['ga-disable-'+base.gaMeasurementId],true);
});
test('missing setup, disabled owner switch, localhost and unsafe script URLs stay inactive',()=>{
 for(const [cfg,href] of [[{...base,analyticsEnabled:false},undefined],[{...base,gaMeasurementId:'G-XXXXXXXXXX',vercelAnalyticsEnabled:false},undefined],[base,'http://localhost:4173/'],[base,'file:///tmp/index.html'],[{...base,gaMeasurementId:'',vercelAnalyticsScriptPath:'//evil.example/script.js'},undefined]]){
  const env=environment(cfg,href);env.analytics.apply({google:true,vercel:true});assert.equal(env.scripts.length,0);
 }
});
test('repeat apply does not duplicate scripts or page views',()=>{
 const env=environment();env.analytics.apply({google:true,vercel:true});env.analytics.apply({google:true,vercel:true});assert.equal(env.scripts.length,2);
});

test('actual owner activation preserves visitor consent without claiming a completed privacy review',()=>{
 const fs=require('node:fs'),vm=require('node:vm'),path=require('node:path');
 const context={window:{}};vm.runInNewContext(fs.readFileSync(path.join(__dirname,'../site-config.js'),'utf8'),context);
 const config=context.window.YWM_SITE_CONFIG;
 assert.equal(config.analyticsEnabled,true);assert.equal(config.privacyReviewed,false);assert.equal(config.gaMeasurementId,'G-6J6ZX1XD2N');
 const env=environment(config);env.analytics.apply(core.denied());assert.equal(env.scripts.length,0);
 env.analytics.apply({google:true,vercel:false});assert.equal(env.scripts.length,1);assert.equal(env.scripts[0].src,'https://www.googletagmanager.com/gtag/js?id=G-6J6ZX1XD2N');
 env.scripts[0].onload();assert.equal(env.win.dataLayer.find(args=>args[0]==='config')[1],'G-6J6ZX1XD2N');
 env.analytics.revoke();assert.equal(env.win['ga-disable-G-6J6ZX1XD2N'],true);
});
