(function(root,factory){const api=factory();if(typeof module==='object'&&module.exports)module.exports=api;else root.YWMPrivacyCore=api;})(typeof window!=='undefined'?window:globalThis,function(){
  'use strict';
  const KEY='ywm-privacy-consent-v2', TTL=180*24*60*60*1000;
  const denied=()=>({vercel:false,google:false});
  const gaID=config=>/^G-[A-Z0-9]{6,15}$/.test(config.gaMeasurementId||'')&&!/X{5,}/.test(config.gaMeasurementId)?config.gaMeasurementId:null;
  function vercelPath(config){const value=config.vercelAnalyticsScriptPath||'';return /^\/(?!\/)[a-zA-Z0-9_/-]+\/script\.js$/.test(value)?value:null;}
  function signature(config){return JSON.stringify([config.consentVersion,config.analyticsEnabled===true,config.privacyReviewed===true,config.vercelAnalyticsEnabled===true,vercelPath(config),gaID(config)]);}
  function read(storage,config,now=Date.now()){
    try{const entry=JSON.parse(storage.getItem(KEY));if(entry?.version!==2||entry.signature!==signature(config)||!Number.isFinite(entry.decidedAt)||!Number.isFinite(entry.expiresAt)||entry.decidedAt>now+300000||entry.expiresAt<=now||entry.expiresAt-entry.decidedAt>TTL||!entry.choices||typeof entry.choices.vercel!=='boolean'||typeof entry.choices.google!=='boolean')return null;return entry;}catch{return null;}
  }
  function createRecord(choices,config,now=Date.now()){return{version:2,signature:signature(config),decidedAt:now,expiresAt:now+TTL,choices:{vercel:choices.vercel===true,google:choices.google===true}};}
  function cleanURL(value,base){try{const url=new URL(value,base);return /^https?:$/.test(url.protocol)?url.origin+url.pathname:'';}catch{return '';}}
  function createAnalytics({win,doc,config,location}){
    let choices=denied(),started={google:false,vercel:false},loaded=false;
    const live=()=>location.protocol==='https:'&&(config.productionHosts||[]).includes(location.hostname)&&config.analyticsEnabled===true;
    function appendScript(src,provider,onload){const el=doc.createElement('script');el.async=true;el.src=src;el.dataset.analyticsProvider=provider;if(onload)el.onload=onload;doc.head.appendChild(el);}
    function apply(next){
      choices={vercel:next.vercel===true,google:next.google===true};
      const id=gaID(config);if(id)win['ga-disable-'+id]=!(choices.google&&live());
      if(!live())return;
      if(choices.vercel&&config.vercelAnalyticsEnabled&&vercelPath(config)&&!started.vercel){
        started.vercel=true;loaded=true;
        win.va=win.va||function(){(win.vaq=win.vaq||[]).push(arguments);};
        win.va('beforeSend',event=>choices.vercel?{...event,url:cleanURL(event.url,location.href)}:null);
        appendScript(new URL(vercelPath(config),location.origin).href,'vercel');
      }
      if(choices.google&&id&&!started.google){
        started.google=true;loaded=true;
        win.dataLayer=win.dataLayer||[];win.gtag=win.gtag||function(){win.dataLayer.push(arguments);};
        win.gtag('consent','default',{analytics_storage:'denied',ad_storage:'denied',ad_user_data:'denied',ad_personalization:'denied'});
        win.gtag('set','ads_data_redaction',true);
        appendScript('https://www.googletagmanager.com/gtag/js?id='+encodeURIComponent(id),'google',()=>{
          // A late SDK response must never enable tracking after consent was withdrawn.
          if(!choices.google||win['ga-disable-'+id])return;
          win.gtag('consent','update',{analytics_storage:'granted',ad_storage:'denied',ad_user_data:'denied',ad_personalization:'denied'});
          win.gtag('js',new Date());
          win.gtag('config',id,{send_page_view:false,allow_google_signals:false,allow_ad_personalization_signals:false,cookie_expires:180*86400,cookie_update:false,page_location:cleanURL(location.href,location.href),page_referrer:doc.referrer?cleanURL(doc.referrer,location.href):''});
          win.gtag('event','page_view',{page_title:doc.title,page_location:cleanURL(location.href,location.href),page_referrer:doc.referrer?cleanURL(doc.referrer,location.href):''});
        });
      }
    }
    function revoke(){const id=gaID(config);choices=denied();if(id)win['ga-disable-'+id]=true;doc.querySelectorAll('script[data-analytics-provider]').forEach(el=>el.remove());return loaded;}
    return{apply,revoke,hasLoaded:()=>loaded};
  }
  return{KEY,TTL,denied,gaID,vercelPath,signature,read,createRecord,cleanURL,createAnalytics};
});
