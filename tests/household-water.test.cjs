'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const {waterState,saveLocalReading,waterView}=require('../lib/household/water.cjs');
const row=(kind,date,valueMilli,reset=false)=>({kind,date,valueMilli,reset,createdAt:date});
test('uneven intervals use cumulative differences and actual calendar days, including missing months',()=>{
 const readings=[row('cold-water','2026-03-06',100000),row('hot-water','2026-03-06',20000),row('cold-water','2026-05-04',104000),row('hot-water','2026-05-04',22000)];
 const v=waterView(readings,'2026');assert.deepEqual(v.intervals,[{from:'2026-03-06',to:'2026-05-04',days:59,cold:4,hot:2,total:6}]);assert.equal(v.tariff.water+v.tariff.waste,4.68);assert.equal(waterView(readings,'2025').intervals.length,0);
});
test('replacement baselines and unmatched intervening resets do not produce invented consumption',()=>{
 const rows=[row('cold-water','2026-03-06',100000),row('hot-water','2026-03-06',20000),row('cold-water','2026-04-01',0,true),row('cold-water','2026-05-04',104000),row('hot-water','2026-05-04',22000)];
 assert.equal(waterView(rows,'2026').intervals.length,0);
});
test('local readings survive Sheet snapshot replacement, validate against merged history and preserve synced rows',()=>{
 const s={readings:[],audit:[]};const now=new Date('2026-11-07T12:00:00Z');
 saveLocalReading(s,{kind:'cold-water',date:'2026-03-06',valueMilli:100000,reset:false,notes:''},now);
 assert.equal(s.readings.length,0);s.readings=[row('hot-water','2026-03-06',20000)];
 assert.equal(waterState(s).readings.length,2);
 assert.throws(()=>saveLocalReading(s,{kind:'cold-water',date:'2026-04-02',valueMilli:99000,reset:false,notes:''},now),/below/);
 assert.throws(()=>saveLocalReading(s,{kind:'cold-water',date:'2026-03-06',valueMilli:100000,reset:false,notes:''},now),/already exists/);
 assert.equal(s.localReadings.length,1);
});

const {monthlyRows}=require('../lib/household/ui/water.js');
test('monthly allocation uses actual calendar overlap, preserves totals and marks partial coverage',()=>{
 const rows=monthlyRows({year:'2026',intervals:[{from:'2026-03-06',to:'2026-05-04',days:59,cold:59,hot:118}]});
 assert.equal(rows.length,5);assert.equal(rows[0].total,null);assert.equal(rows[1].total,null);
 assert.deepEqual(rows.slice(2).map(r=>[r.coveredDays,r.days,r.cold,r.hot,r.complete]),[[26,31,26,52,false],[30,30,30,60,true],[3,31,3,6,false]]);
 assert.equal(rows.reduce((s,r)=>s+(r.total||0),0),177);
});
test('multiple readings in one month combine once and reset gaps remain uncovered',()=>{
 const rows=monthlyRows({year:'2026',intervals:[{from:'2026-07-01',to:'2026-07-16',days:15,cold:3,hot:1.5},{from:'2026-07-16',to:'2026-08-01',days:16,cold:1.6,hot:.8},{from:'2026-08-10',to:'2026-09-01',days:22,cold:2.2,hot:1.1}]});
 assert.equal(rows[6].coveredDays,31);assert.equal(rows[6].complete,true);assert.ok(Math.abs(rows[6].total-6.9)<1e-12);
 assert.equal(rows[7].coveredDays,22);assert.equal(rows[7].complete,false);assert.equal(rows[8].total,null);
});
test('leap February is allocated over 29 days, with no extrapolation past the last reading',()=>{
 const rows=monthlyRows({year:'2028',intervals:[{from:'2028-02-01',to:'2028-03-01',days:29,cold:29,hot:0}]});
 assert.equal(rows[1].total,29);assert.equal(rows[1].complete,true);assert.equal(rows[2].total,null);assert.deepEqual(monthlyRows(),[]);
});
