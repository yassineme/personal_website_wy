'use strict';
const {applyMutation}=require('./model.cjs');
function waterState(state){
 const rows=new Map((state.readings||[]).map(r=>[r.kind+':'+r.date,r]));
 for(const r of state.localReadings||[])rows.set(r.kind+':'+r.date,{...r,localOnly:true});
 return {...state,readings:[...rows.values()]};
}
function saveLocalReading(state,input,now=new Date()){
 const draft=waterState(state),row=applyMutation(draft,'add-reading',input,now);
 state.localReadings=[...(state.localReadings||[]),row];return row;
}
function waterView(readings,year){
 const kinds=['cold-water','hot-water'],all=readings.filter(r=>kinds.includes(r.kind)).sort((a,b)=>a.date.localeCompare(b.date));
 const dates=[...new Set(all.filter(r=>r.date.startsWith(year+'-')).map(r=>r.date))];
 const pairs=dates.map(date=>({date,cold:all.find(r=>r.date===date&&r.kind===kinds[0]),hot:all.find(r=>r.date===date&&r.kind===kinds[1])})).filter(p=>p.cold&&p.hot);
 const intervals=[];
 for(let i=1;i<pairs.length;i++){
  const a=pairs[i-1],b=pairs[i];
  if(all.some(r=>r.date>a.date&&r.date<=b.date&&r.reset))continue;
  const cold=b.cold.valueMilli-a.cold.valueMilli,hot=b.hot.valueMilli-a.hot.valueMilli,days=(Date.parse(b.date)-Date.parse(a.date))/86400000;
  if(cold<0||hot<0||days<=0)continue;
  intervals.push({from:a.date,to:b.date,days,cold:cold/1000,hot:hot/1000,total:(cold+hot)/1000});
 }
 return {year,intervals,pairs:pairs.map(p=>({date:p.date,cold:p.cold.valueMilli/1000,hot:p.hot.valueMilli/1000})),tariff:{water:2.19,waste:2.49,year:2026},benchmark:111};
}
module.exports={waterState,saveLocalReading,waterView};
