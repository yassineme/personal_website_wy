(function(root,factory){
 'use strict';
 const api=factory();
 if(typeof module==='object'&&module.exports)module.exports=api;
 else root.HouseholdWealth=api;
})(typeof window==='undefined'?globalThis:window,function(){
 'use strict';
 const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
 const money=v=>new Intl.NumberFormat('en-IE',{style:'currency',currency:'EUR',maximumFractionDigits:0}).format(v/100);
 const validMoney=n=>Number.isSafeInteger(n)&&n>=0;
 function calendarMonth(start,months,format='short'){
  if(!/^\d{4}-(0[1-9]|1[0-2])$/.test(start??''))return '';
  const date=new Date(Date.UTC(Number(start.slice(0,4)),Number(start.slice(5))-1+months,1));
  return new Intl.DateTimeFormat('en-GB',{...(format==='year'?{}:{month:format}),year:'numeric',timeZone:'UTC'}).format(date);
 }
 const horizonLabel=(start,years)=>years+' years'+(calendarMonth(start,years*12,'year')?' · '+calendarMonth(start,years*12,'year'):'');
 const defaults={propertyRate:'source',surplusPercent:0,fundRate:5,inflation:2,display:'nominal',scope:'combined',horizon:180,inspect:180,debtOverrides:{}};
 function properties(w,options){
  return w.propertyBridge.map(p=>{
   const m=p.reportedMortgage,estimate=p.planningEstimate;
   const value=validMoney(p.valueCents)?p.valueCents:validMoney(estimate?.valueCents)?estimate.valueCents:m?.valueProjection?.currentCents??m?.modelledValuation?.valueCents??null;
   const override=options.debtOverrides?.[p.id];
   const runRate=m?.monthlyEquityAssumption;
   const elapsed=runRate?.baseMonth&&w.startMonth?Math.max(0,(Number(w.startMonth.slice(0,4))-Number(runRate.baseMonth.slice(0,4)))*12+Number(w.startMonth.slice(5))-Number(runRate.baseMonth.slice(5))):0;
   const modelledDebt=m?Math.max(0,m.debtCents-(runRate?.monthlyPrincipalCents??0)*elapsed):null;
   const debt=validMoney(override)?override:validMoney(p.debtCents)?p.debtCents:modelledDebt;
   return {id:p.id,name:p.name,share:p.ownershipPercent/100,value,debt,annualRate:Number.isFinite(estimate?.annualRate)?estimate.annualRate*100:m?.modelledValuation?.annualRate!==undefined?m.modelledValuation.annualRate*100:2,principal:m?.monthlyEquityAssumption?.monthlyPrincipalCents??0,unknownDebt:debt===null,unknownValue:value===null};
  });
 }
 function project(w,input={}){
  const options={...defaults,...input},props=properties(w,options);
  if(!w.ready||w.planningCycles?.length!==180)return {ready:false,scenarios:[],properties:props};
  for(const [key,min,max]of[['propertyRate',-10,10],['surplusPercent',0,100],['fundRate',-10,20],['inflation',0,10]])if(!(key==='propertyRate'&&options[key]==='source')&&(!Number.isFinite(options[key])||options[key]<min||options[key]>max))throw Error('Invalid scenario assumption.');
  if(props.some(p=>!Number.isFinite(p.share)||p.share<0||p.share>1))throw Error('Review property ownership before projecting.');
  const incomplete=props.some(p=>p.unknownDebt||p.unknownValue);
  const scenarios=[7,9,11].map(rate=>{
   let cash=w.cashCents,etf=w.etfCents,fund=w.fundCents,added=0,contributed=0,shortfall=false;
   const points=[],monthlyETF=Math.pow(1+rate/100,1/12),monthlyFund=Math.pow(1+options.fundRate/100,1/12);
   function point(months){
    const years=months/12;
    const propertyRows=props.map(p=>{
     const value=p.value===null?null:p.value*Math.pow(1+(options.propertyRate==='source'?p.annualRate:options.propertyRate)/100,years),debt=p.debt===null?null:Math.max(0,p.debt-p.principal*months);
     // Unknown debt is never presented as zero equity: retain the gross share
     // separately and label the combined series as an incomplete subtotal.
     return {id:p.id,name:p.name,valueCents:value,debtCents:debt,equityCents:value===null||debt===null?null:(value-debt)*p.share,subtotalCents:value===null?0:(value-(debt??0))*p.share};
    });
    const property=propertyRows.reduce((sum,p)=>sum+p.subtotalCents,0),financial=cash+etf+fund+w.stockCents;
    points.push({months,years,cashCents:cash,etfCents:etf,fundCents:fund,stockCents:w.stockCents,financialCents:financial,propertyCents:property,totalCents:financial+property,deflator:Math.pow(1+options.inflation/100,years),cashAddedCents:added,contributionsCents:contributed,cashShortfall:shortfall,properties:propertyRows});
   }
   point(0);
   w.planningCycles.forEach((cycle,i)=>{
    // A negative cash cycle is funded from cash; it is never a negative ETF buy.
    const extra=Math.max(0,cycle.cash)*options.surplusPercent/100;
    cash+=cycle.cash-extra;added+=cycle.cash-extra;contributed+=cycle.funding+extra;
    etf=etf*monthlyETF+cycle.funding+extra;fund*=monthlyFund;
    if(cash<0)shortfall=true;
    point(i+1);
   });
   return {rate,points};
  });
  return {ready:true,incomplete,properties:props,scenarios,options,startMonth:w.startMonth};
 }
 function value(point,options){return point[options.scope==='financial'?'financialCents':options.scope==='property'?'propertyCents':'totalCents']/(options.display==='real'?point.deflator:1);}
 function chart(model,width){
  const o=model.options,h=300,left=66,right=16,top=22,bottom=40,plot=width-left-right;
  const all=model.scenarios.flatMap(s=>s.points.slice(0,o.horizon+1).map(p=>value(p,o)));
  const low=Math.min(0,...all),high=Math.max(1,...all),padding=(high-low)*.06,min=low<0?low-padding:0,max=high+padding;
  const x=n=>left+n/o.horizon*plot,y=v=>top+(max-v)/(max-min)*(h-top-bottom);
  const ticks=Array.from({length:5},(_,i)=>min+(max-min)*i/4);
  const compact=v=>new Intl.NumberFormat('en-IE',{notation:'compact',maximumFractionDigits:1}).format(v/100);
  const grid=ticks.map(v=>`<line x1="${left}" x2="${width-right}" y1="${y(v)}" y2="${y(v)}" class="ws-grid"/><text x="${left-10}" y="${y(v)+4}" text-anchor="end">€${esc(compact(v))}</text>`).join('');
  const times=width<450?[0,o.horizon/2,o.horizon]:[0,o.horizon/3,o.horizon*2/3,o.horizon];
  const axes=times.map(n=>{const anchor=n===o.horizon?'end':n===0?'start':'middle',year=calendarMonth(model.startMonth,n,'year');return `${year?`<text x="${x(n)}" y="${h-25}" text-anchor="${anchor}">${esc(year)}</text>`:''}<text x="${x(n)}" y="${h-10}" text-anchor="${anchor}">${+(n/12).toFixed(1)} yr</text>`;}).join('');
  const lines=model.scenarios.map((s,i)=>`<path class="ws-line ws-series-${i}" d="${s.points.slice(0,o.horizon+1).map((p,n)=>(n?'L':'M')+x(n).toFixed(2)+','+y(value(p,o)).toFixed(2)).join(' ')}"/>`).join('');
  const at=Math.min(o.inspect,o.horizon),marks=model.scenarios.map((s,i)=>`<circle class="ws-point ws-series-${i}" cx="${x(at)}" cy="${y(value(s.points[at],o))}" r="4"/>`).join('');
  const dates=calendarMonth(model.startMonth,0)?' · '+calendarMonth(model.startMonth,0)+'–'+calendarMonth(model.startMonth,o.horizon):'';
  return `<svg width="${width}" height="${h}" viewBox="0 0 ${width} ${h}" role="img" aria-labelledby="ws-chart-title ws-chart-desc"><title id="ws-chart-title">Wealth scenarios over ${o.horizon/12} years${esc(dates)}</title><desc id="ws-chart-desc">Three monthly projections at 7, 9 and 11 percent ETF returns. Use the inspection slider or the values table for exact figures. ${model.incomplete?'Property totals are incomplete; missing mortgage debts are not deducted.':''}</desc>${grid}${axes}${lines}<line class="ws-guide" x1="${x(at)}" x2="${x(at)}" y1="${top}" y2="${h-bottom}"/>${marks}</svg>`;
 }
 function render(w){
  if(!w.ready)return `<section class="section-card"><h2>Wealth <em>scenarios.</em></h2><p class="side-note">Complete the assessment inputs to enable projections.</p><ul>${w.issues.map(x=>`<li>${esc(x)}</li>`).join('')}</ul></section>`;
  return `<section class="section-card wealth-simulator" id="wealth-simulator"><div class="section-header"><h2>Your next <em>fifteen years.</em></h2><span class="badge">Interactive scenarios</span></div><p class="side-note">Compare 7%, 9% and 11% ETF returns, including your recorded property shares. Returns are assumptions, not guaranteed minimums.</p>
   <div class="ws-controls"><label class="field">Property growth / year<select data-ws="propertyRate"><option value="source" selected>Per-property assessment</option><option value="0">0% · flat values</option><option value="1.5">1.5%</option><option value="2">2%</option><option value="3">3% · higher growth</option></select></label><label class="field">Surplus invested into ETFs<select data-ws="surplusPercent"><option value="0">0% · retain as cash</option><option value="50">50% of positive surplus</option><option value="100">100% of positive surplus</option></select></label><label class="field">Mutual-fund return / year<select data-ws="fundRate"><option value="0">0%</option><option value="3">3%</option><option value="5" selected>5%</option><option value="7">7%</option></select></label><label class="field">Purchasing power<select data-ws="display"><option value="nominal">Future euros</option><option value="real">Today's euros · 2% inflation</option></select></label><label class="field">Graph includes<select data-ws="scope"><option value="combined">Financial assets + property</option><option value="financial">Financial assets only</option><option value="property">Property shares only</option></select></label><label class="field">Time horizon<select data-ws="horizon"><option value="60">${esc(horizonLabel(w.startMonth,5))}</option><option value="120">${esc(horizonLabel(w.startMonth,10))}</option><option value="180" selected>${esc(horizonLabel(w.startMonth,15))}</option></select></label></div>
   <p class="notice" data-ws-warning></p><div class="ws-legend" aria-label="ETF return scenarios"><span><i class="ws-swatch ws-series-0"></i>7% ETFs</span><span><i class="ws-swatch ws-series-1"></i>9% ETFs</span><span><i class="ws-swatch ws-series-2"></i>11% ETFs</span></div><div class="ws-chart" data-ws-chart></div>
   <label class="ws-inspect">Inspect projection · <span data-ws-year>15 years</span><input type="range" data-ws="inspect" min="0" max="180" step="1" value="180" aria-label="Inspect projection month"></label><div class="ws-readout" data-ws-readout aria-live="polite"></div>
   <div class="table-wrap"><table><caption data-ws-caption></caption><thead><tr><th>ETF scenario</th>${[5,10,15].map(years=>`<th class="amount">${esc(horizonLabel(w.startMonth,years))}</th>`).join('')}</tr></thead><tbody data-ws-table></tbody></table></div>
   <details class="property-notes"><summary>7% scenario · assets and property breakdown</summary><div class="table-wrap"><table><thead><tr><th>Component</th>${[5,10,15].map(years=>`<th class="amount">${esc(horizonLabel(w.startMonth,years))}</th>`).join('')}</tr></thead><tbody data-ws-breakdown></tbody></table></div></details>
   <details class="property-notes"><summary>Property baselines and mortgage assumptions</summary><div data-ws-properties></div><p class="side-note">Mortgage inputs below are temporary scenario overrides. They do not update property records or Google Sheets. Blank means unknown. Rental debt is held constant until a principal schedule is supplied.</p><div class="ws-controls">${w.propertyBridge.filter(p=>p.debtCents===null&&!p.reportedMortgage).map(p=>`<label class="field">${esc(p.name)} · total mortgage (EUR)<input type="number" min="0" max="1000000000" step="0.01" inputmode="decimal" placeholder="Unknown" data-ws-debt="${esc(p.id)}"></label>`).join('')}</div><p class="side-note">Home principal uses the recorded monthly run rate and is capped at the remaining balance. Extending it beyond the 2033 fixed-rate expiries is hypothetical; refinancing could change both payments and principal repayment. Property values are estimates; sale costs and other liabilities are excluded.</p></details>
   <p class="side-note">Planned ETF funding is invested at month end, once. Mutual funds compound separately; individual stocks stay flat and cash earns 0%. The existing budget and known final payments drive savings. Positive surplus can be redirected into ETFs; negative cycles draw down cash. Taxes, fees, future spending increases, repairs and exceptional costs are not modelled. The €259 child-benefit funding continues wherever present in the budget; beneficial ownership and entitlement duration remain unconfirmed.</p></section>`;
 }
 function mount(host,w,state={}){
  if(!host||!w.ready)return ()=>{};
  let options={...defaults,...state,debtOverrides:{...state.debtOverrides}},model,pointerFrame=0;
  const q=s=>host.querySelector(s);
  for(const el of host.querySelectorAll('[data-ws]'))el.value=options[el.dataset.ws];
  for(const el of host.querySelectorAll('[data-ws-debt]'))el.value=validMoney(options.debtOverrides[el.dataset.wsDebt])?options.debtOverrides[el.dataset.wsDebt]/100:'';
  const row=(label,values)=>`<tr><th scope="row">${esc(label)}</th>${values.map(v=>`<td class="amount">${esc(v)}</td>`).join('')}</tr>`;
  function draw(){
   model=project(w,options);options.inspect=Math.min(options.inspect,options.horizon);
   const plot=q('[data-ws-chart]'),width=Math.max(240,Math.round(plot.getBoundingClientRect().width));
   plot.innerHTML=chart(model,width);
   const real=options.display==='real',scaled=(p,v)=>money(v/(real?p.deflator:1));
   const scopeName=options.scope==='financial'?'Financial assets':options.scope==='property'?'Property shares':'Financial assets + property shares';
   const missing=model.properties.filter(p=>p.unknownDebt||p.unknownValue).map(p=>p.name+': '+[p.unknownValue?'value missing':'',p.unknownDebt?'mortgage missing':''].filter(Boolean).join(', '));
   q('[data-ws-warning]').textContent=options.scope==='financial'?'Gross financial assets, before all liabilities.':missing.length?'Incomplete subtotal — '+missing.join('; ')+'. Unknown mortgage debts are not deducted. This is not net wealth.':'Modelled subtotal after property mortgages, before other liabilities and selling costs. This is not confirmed net wealth.';
   q('[data-ws-caption]').textContent=scopeName+' · '+(real?'today’s euros':'future euros')+(model.incomplete&&options.scope!=='financial'?' · before missing mortgage debt':'');
   q('[data-ws-table]').innerHTML=model.scenarios.map(s=>row(s.rate+'% ETFs',[60,120,180].map(n=>money(value(s.points[n],options))))).join('');
   const base=model.scenarios[0].points;
   const fields=[['Cash','cashCents'],['ETFs','etfCents'],['Mutual funds · '+options.fundRate+'%','fundCents'],['Stocks · flat value','stockCents'],['Financial assets','financialCents']];
   q('[data-ws-breakdown]').innerHTML=fields.map(([label,key])=>row(label,[60,120,180].map(n=>scaled(base[n],base[n][key])))).join('')+model.properties.map(p=>row(p.name+' · '+(p.share*100)+'%'+(p.unknownDebt?' · before mortgage debt':''),[60,120,180].map(n=>p.unknownValue?'Value missing':scaled(base[n],base[n].properties.find(x=>x.id===p.id).subtotalCents)))).join('');
   q('[data-ws-properties]').innerHTML=model.properties.map(p=>`<p class="side-note"><strong>${esc(p.name)}</strong> · ${esc(p.share*100)}% ownership · starting value ${p.value===null?'unknown':esc(money(p.value))} (whole property) · debt ${p.debt===null?'unknown':esc(money(p.debt))} · assumed principal ${esc(money(p.principal))}/month · growth ${esc(options.propertyRate==='source'?p.annualRate:options.propertyRate)}%/year.${p.id&&w.propertyBridge.find(x=>x.id===p.id)?.planningEstimate?' Owner valuation estimate.':''}</p>`).join('');
   inspect();
  }
  function inspect(){
   const n=Math.min(options.inspect,options.horizon),years=Math.floor(n/12),months=n%12;
   const elapsed=years+' years'+(months?' '+months+' months':''),date=calendarMonth(w.startMonth,n,'long');
   q('[data-ws-year]').textContent=(date?date+' · ':'')+elapsed;
   const slider=q('[data-ws="inspect"]');slider.max=options.horizon;slider.value=n;slider.setAttribute('aria-valuetext',(date?date+' · ':'')+elapsed);
   q('[data-ws-readout]').innerHTML=model.scenarios.map(s=>`<span><small>${s.rate}% ETFs</small><strong>${esc(money(value(s.points[n],options)))}</strong>${s.points[n].cashShortfall?'<small>Cash shortfall in projection</small>':''}</span>`).join('');
  }
  function input(event){
   const el=event.target;
   if(el.dataset.wsDebt!==undefined){
    if(!el.checkValidity())return;
    if(el.value==='')delete options.debtOverrides[el.dataset.wsDebt];else options.debtOverrides[el.dataset.wsDebt]=Math.round((el.value==='source'?'source':Number(el.value))*100);
   }else if(el.dataset.ws){options[el.dataset.ws]=['display','scope'].includes(el.dataset.ws)?el.value:(el.value==='source'?'source':Number(el.value));}else return;
   Object.assign(state,options,{debtOverrides:{...options.debtOverrides}});draw();
  }
  function pointer(event){
   const rect=q('[data-ws-chart]').getBoundingClientRect(),plot=rect.width-82;
   const at=Math.max(0,Math.min(options.horizon,Math.round((event.clientX-rect.left-66)/plot*options.horizon)));
   if(options.inspect===at)return;
   options.inspect=at;state.inspect=at;
   if(!pointerFrame)pointerFrame=requestAnimationFrame(()=>{pointerFrame=0;model.options.inspect=options.inspect;q('[data-ws-chart]').innerHTML=chart(model,Math.max(240,Math.round(rect.width)));inspect();});
  }
  host.addEventListener('input',input);q('[data-ws-chart]').addEventListener('pointermove',pointer);
  let observer;
  if(typeof ResizeObserver!=='undefined'){observer=new ResizeObserver(()=>draw());observer.observe(q('[data-ws-chart]'));}
  draw();
  return ()=>{observer?.disconnect();if(pointerFrame)cancelAnimationFrame(pointerFrame);host.removeEventListener('input',input);q('[data-ws-chart]')?.removeEventListener('pointermove',pointer);};
 }
 return {project,properties,value,chart,render,mount};
});
