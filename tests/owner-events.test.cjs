'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const {createOwnerEventsHandler}=require('../lib/owner-events.cjs');
async function request({method='GET',cookie=''}={}){
 const res={headers:{},setHeader(k,v){this.headers[k.toLowerCase()]=v;},end(body){this.body=body||'';}};
 await createOwnerEventsHandler()({method,url:'/api/owner-events',headers:{cookie}},res);return res;
}
test('the planner opens without a password, environment setup or session cookie',async()=>{
 for(const cookie of ['','__Host-wy-events=obsolete-session']){
  const page=await request({cookie});assert.equal(page.statusCode,200);assert.match(page.body,/Web Summit/);assert.match(page.body,/id="events-data"/);assert.ok(!page.body.includes('__EVENTS_DATA__'));
  assert.ok(!page.body.includes('Owner password'));assert.ok(!page.body.includes('Lock planner'));assert.equal(page.headers['set-cookie'],undefined);
  assert.match(page.headers['x-robots-tag'],/noindex/);assert.match(page.headers['cache-control'],/no-store/);assert.match(page.headers['content-security-policy'],/frame-ancestors 'none'/);
 }
});
test('HEAD has no body and obsolete login or logout submissions are not accepted',async()=>{
 const head=await request({method:'HEAD'});assert.equal(head.statusCode,200);assert.equal(head.body,'');
 for(const method of ['POST','PUT','DELETE']){const res=await request({method});assert.equal(res.statusCode,405);assert.equal(res.headers.allow,'GET, HEAD');assert.equal(res.headers['set-cookie'],undefined);}
});
test('records retain valid dates and official links; the hidden entrance stays out of the sitemap',()=>{
 const data=require('../lib/owner-events-data.json'),ids=new Set();
 for(const event of data.events){assert.ok(!ids.has(event.id));ids.add(event.id);assert.equal(new URL(event.url).protocol,'https:');assert.ok(event.price&&event.priceNote&&event.city&&event.venue);assert.ok(event.start===null&&event.end===null||/^\d{4}-\d{2}-\d{2}$/.test(event.start)&&event.end>=event.start);}
 const {ROOT_FILES}=require('../scripts/build-public.cjs');assert.ok(!ROOT_FILES.includes('lib/owner-events-data.json'));assert.ok(!ROOT_FILES.includes('lib/owner-events-page.html'));
 const source=fs.readFileSync(path.join(__dirname,'../index.html'),'utf8');assert.match(source,/owner-entry\.js/);assert.ok(!source.includes('Open fieldnotes'));assert.ok(!fs.readFileSync(path.join(__dirname,'../sitemap.xml'),'utf8').includes('owner-events'));
});
