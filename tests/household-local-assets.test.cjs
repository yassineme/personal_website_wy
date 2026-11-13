'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const {localAssetState,saveLocalAsset}=require('../lib/household/local-assets.cjs');

test('local asset review survives a replaced Sheet snapshot without changing synced assets',()=>{
 const original={id:'vehicle-test',name:'Example vehicle',type:'Vehicle',valueCents:null,asOfDate:'2027-01-01',notes:'Unconfirmed purchase cost.'};
 const state={assets:[original],audit:[]};
 saveLocalAsset(state,{...original,notes:'Confirmed purchase cost; valuation remains unknown.'},new Date('2027-01-02T12:00:00Z'));
 assert.equal(state.assets[0],original);
 assert.equal(state.assets[0].notes,'Unconfirmed purchase cost.');
 assert.equal(state.audit.length,1);
 state.assets=[{...original,notes:'A subsequent Sheet refresh.'},{...original,id:'other',name:'Another vehicle'}];
 const viewed=localAssetState(state);
 assert.equal(viewed.assets[0].notes,'Confirmed purchase cost; valuation remains unknown.');
 assert.equal(viewed.assets[0].valueCents,null);
 assert.equal(viewed.assets[0].localOnly,true);
 assert.equal(viewed.assets[1],state.assets[1]);
 saveLocalAsset(state,{...viewed.assets[0],notes:'Reviewed again.'});
 assert.equal(localAssetState(state).assets[0].notes,'Reviewed again.');
 assert.equal(state.assets[0].notes,'A subsequent Sheet refresh.');
 assert.equal(state.audit.length,2);
});

test('local asset corrections use the regular validation and leave invalid edits unsaved',()=>{
 const state={assets:[{id:'vehicle-test',name:'Example',type:'Vehicle',valueCents:null,asOfDate:'2027-01-01',notes:''}],audit:[]};
 assert.throws(()=>saveLocalAsset(state,{...state.assets[0],valueCents:-1}));
 assert.equal(state.localAssets,undefined);
 assert.equal(state.audit.length,0);
});
