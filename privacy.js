(() => {
  'use strict';
  const setCopy = (el, text) => {
    el.replaceChildren();
    String(text).split('\u2197').forEach((part, index) => {
      if (index) {
        const icon = document.createElement('span');
        icon.innerHTML = '<svg class="ui-arrow-icon" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="1em" height="1em" style="display:inline-block;vertical-align:-.125em;flex:none" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false"><path d="M7 17 17 7M7 7h10v10"/></svg>';
        el.append(icon.firstChild);
      }
      el.append(document.createTextNode(part));
    });
  };

  const rootURL=new URL('.',document.currentScript.src),config=window.YWM_SITE_CONFIG||{},core=window.YWMPrivacyCore;
  if(!core)return;
  const make=(tag,cls,text)=>{const el=document.createElement(tag);if(cls)el.className=cls;if(text)setCopy(el,text);return el;};
  const button=(cls,text)=>{const el=make('button',cls,text);el.type='button';return el;};
  let record=core.read(localStorageSafe(),config),choices=record?.choices||core.denied(),returnFocus=null,expiryTimer=null;
  const analytics=core.createAnalytics({win:window,doc:document,config,location});
  function localStorageSafe(){try{return localStorage;}catch{return{getItem(){return null;},setItem(){}};}}
  const storage=localStorageSafe();
  const banner=make('section','cookie-banner');banner.setAttribute('aria-labelledby','cookie-title');banner.setAttribute('aria-label','Cookie choices');
  const copy=make('div','cookie-copy');copy.append(make('span','privacy-eyebrow','A considered choice'));
  const title=make('h2','','Cookies & privacy.');title.id='cookie-title';
  const providerNames=[];if(config.vercelAnalyticsEnabled)providerNames.push('Vercel Web Analytics');if(core.gaID(config))providerNames.push('Google Analytics');
  const audienceTools=providerNames.length?providerNames.join(' and '):'audience analytics';
  copy.append(title,make('p','','Only essential storage is used by default. Optional '+audienceTools+' helps me understand which pages are useful, if you allow it. You can change or withdraw your choice anytime.'));
  const policy=make('a','cookie-policy','Privacy information ↗');policy.href=new URL(config.privacyNoticeUrl||'privacy',rootURL);copy.append(policy);
  const actions=make('div','cookie-actions');
  const essential=button('privacy-choice','Only essential'),allow=button('privacy-choice','Allow analytics'),manage=button('privacy-manage','Manage choices');actions.append(essential,allow,manage);
  banner.append(copy,actions);document.body.append(banner);
  const dialog=make('dialog','privacy-dialog');dialog.setAttribute('aria-labelledby','privacy-settings-title');
  const top=make('div','privacy-dialog-top');top.append(make('span','privacy-eyebrow','Your data / Your decision'));
  const close=button('privacy-close','×');close.setAttribute('aria-label','Close cookie settings');top.append(close);
  const heading=make('h2','','Cookie settings.');heading.id='privacy-settings-title';
  dialog.append(top,heading,make('p','privacy-intro','Choose each provider separately. Optional tools stay off until you opt in. Closing this window does not grant consent.'));
  const fields={};
  const essentialRow=make('div','privacy-provider');const essentialText=make('div');essentialText.append(make('h3','','Essential storage'),make('p','','Remembers this choice and preferences you request, such as pausing AI Signals. No advertising profile.'));essentialRow.append(essentialText,make('span','privacy-always','Always on'));dialog.append(essentialRow);
  for(const [key,name,text] of [['vercel','Vercel Web Analytics','Page views and aggregated usage, without analytics cookies. Vercel processes technical visit data.'],['google','Google Analytics 4','Page views, referrer and device/browser information. Uses _ga cookies and may involve processing outside the EU. No advertising personalization.']]){
    const row=make('label','privacy-provider');const info=make('div');info.append(make('h3','',name),make('p','',text));
    if((key==='vercel'&&!config.vercelAnalyticsEnabled)||(key==='google'&&!core.gaID(config)))info.append(make('small','privacy-provider-status','Not active'));
    const input=document.createElement('input');input.type='checkbox';input.name=key;input.setAttribute('aria-label','Allow '+name);fields[key]=input;row.append(info,input);dialog.append(row);
  }
  const note=make('p','privacy-retention','Your choice is saved on this device for 180 days. Analytics are currently inactive while the setup and privacy notice are being completed. Cal.com loads only when you request a booking.');
  if(config.analyticsEnabled&&(config.vercelAnalyticsEnabled||core.gaID(config)))note.textContent='Your choice is saved on this device for 180 days. Change or withdraw it here anytime. Cal.com loads only when you request a booking.';
  dialog.append(note);
  const settingsActions=make('div','privacy-settings-actions');const settingsEssential=button('privacy-choice','Only essential'),settingsAll=button('privacy-choice','Allow analytics'),save=button('privacy-save','Save my choices');settingsActions.append(settingsEssential,settingsAll,save);dialog.append(settingsActions);
  const detailLink=policy.cloneNode(true);dialog.append(detailLink);document.body.append(dialog);
  const controls=make('div','privacy-controls');const settings=button('','Cookie settings');controls.append(settings,policy.cloneNode(true));
  if(config.legalNoticeUrl){const legal=make('a','','Impressum');legal.href=new URL(config.legalNoticeUrl,rootURL);controls.append(legal);}
  const footer=document.querySelector('.closing-row,.document-footer,.journal-footer');(footer||document.body).append(controls);
  const feedback=make('span','privacy-feedback');feedback.setAttribute('role','status');document.body.append(feedback);
  function refreshUI(){scheduleExpiry();banner.hidden=!!record;document.body.classList.toggle('cookie-banner-open',!record);fields.vercel.checked=choices.vercel;fields.google.checked=choices.google;}
  function openSettings(){returnFocus=document.activeElement;refreshUI();dialog.showModal();document.body.classList.add('privacy-settings-open');close.focus();}
  function clearGoogleCookies(){
    for(const raw of document.cookie.split(';')){
      const name=raw.trim().split('=')[0];if(!/^(_ga(?:_|$)|_gid$|_gat(?:_|$))/.test(name))continue;
      const parts=location.hostname.split('.');const domains=[''];for(let i=0;i<parts.length-1;i++)domains.push(parts.slice(i).join('.'),'.'+parts.slice(i).join('.'));
      const paths=new Set(['/']);const segments=location.pathname.split('/').filter(Boolean);let current='';for(const segment of segments){current+='/'+segment;paths.add(current);paths.add(current+'/');}
      for(const domain of domains)for(const path of paths)document.cookie=name+'=; Max-Age=0; path='+path+(domain?'; domain='+domain:'')+'; SameSite=Lax'+(location.protocol==='https:'?'; Secure':'');
    }
  }
  function commit(next){
    const revoked=(choices.google&&!next.google)||(choices.vercel&&!next.vercel);
    choices={vercel:next.vercel===true,google:next.google===true};record=core.createRecord(choices,config);
    let remembered=false;try{const serialized=JSON.stringify(record);storage.setItem(core.KEY,serialized);remembered=storage.getItem(core.KEY)===serialized;}catch{}
    let reload=false;
    if(revoked){reload=analytics.revoke();clearGoogleCookies();}
    if(dialog.open)dialog.close();refreshUI();feedback.textContent=remembered?'Your cookie choices have been saved.':'Your choices apply to this page. This browser could not remember them.';
    if(reload){location.reload();return;}
    analytics.apply(choices);
  }
  essential.addEventListener('click',()=>commit(core.denied()));settingsEssential.addEventListener('click',()=>commit(core.denied()));
  allow.addEventListener('click',()=>commit({vercel:true,google:true}));settingsAll.addEventListener('click',()=>commit({vercel:true,google:true}));
  manage.addEventListener('click',openSettings);settings.addEventListener('click',openSettings);close.addEventListener('click',()=>dialog.close());
  save.addEventListener('click',()=>commit({vercel:fields.vercel.checked,google:fields.google.checked}));
  dialog.addEventListener('close',()=>{document.body.classList.remove('privacy-settings-open');(returnFocus?.getClientRects().length?returnFocus:settings).focus({preventScroll:true});});
  window.addEventListener('storage',event=>{if(event.key!==core.KEY&&event.key!==null)return;record=core.read(storage,config);choices=record?.choices||core.denied();const loaded=analytics.revoke();clearGoogleCookies();refreshUI();if(loaded)location.reload();else analytics.apply(choices);});
  window.addEventListener('pageshow',()=>{
    const current=core.read(storage,config);
    if(JSON.stringify(current)===JSON.stringify(record))return;
    record=current;choices=record?.choices||core.denied();
    const loaded=analytics.revoke();clearGoogleCookies();refreshUI();
    if(loaded)location.reload();else analytics.apply(choices);
  });
  function scheduleExpiry(){
    clearTimeout(expiryTimer);if(!record)return;
    expiryTimer=setTimeout(()=>{
      if(record&&record.expiresAt<=Date.now()){
        record=null;choices=core.denied();const loaded=analytics.revoke();clearGoogleCookies();refreshUI();if(loaded)location.reload();
      }else scheduleExpiry();
    },Math.min(Math.max(0,record.expiresAt-Date.now()),2147483647));
  }
  document.addEventListener('visibilitychange',()=>{if(!document.hidden)scheduleExpiry();});
  window.YWMPrivacy=Object.freeze({openSettings,getChoices:()=>({...choices}),hasAnalyticsLoaded:analytics.hasLoaded});
  document.addEventListener('click',event=>{if(event.target.closest('[data-cookie-settings]')){event.preventDefault();openSettings();}});
  refreshUI();analytics.apply(choices);
})();
