'use strict';
const {applyMutation}=require('./model.cjs');

// Private review drafts survive Sheet refreshes without changing synced records.
function localAssetState(state){
 const drafts=state.localAssets||{};
 return {...state,assets:state.assets.map(asset=>drafts[asset.id]?{...drafts[asset.id],localOnly:true}:asset)};
}
function saveLocalAsset(state,input,now=new Date()){
 const draft=localAssetState(state);
 const asset=applyMutation(draft,'save-asset',input,now);
 state.localAssets={...state.localAssets,[asset.id]:asset};
 return asset;
}
module.exports={localAssetState,saveLocalAsset};
