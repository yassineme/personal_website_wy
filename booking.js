(() => {
  'use strict';
  const config=window.YWM_SITE_CONFIG||{};
  const calLink=/^[a-zA-Z0-9_-]+\/[a-zA-Z0-9_-]+$/.test(config.calLink||'')?config.calLink:'yassine-m-zowgc4/15min';
  const bookingURL='https://cal.com/'+calLink;
  const make=(tag,cls,text)=>{const el=document.createElement(tag);if(cls)el.className=cls;if(text)el.textContent=text;return el;};
  const dialog=make('dialog','booking-dialog');dialog.setAttribute('aria-labelledby','booking-title');
  const header=make('div','booking-header');const copy=make('div');copy.append(make('span','privacy-eyebrow','A conversation / 15 minutes'));
  const title=make('h2','','Let’s discuss the role.');title.id='booking-title';copy.append(title,make('p','','Choose a time that works for you. The calendar is provided by Cal.com.'));
  const close=make('button','privacy-close','×');close.type='button';close.setAttribute('aria-label','Close booking calendar');header.append(copy,close);
  const status=make('p','booking-status','Loading your calendar…');status.setAttribute('role','status');
  const calendar=make('div','booking-calendar');calendar.id='role-booking-calendar';
  const footer=make('div','booking-footer');const fallback=make('a','','Open directly on Cal.com ↗');fallback.href=bookingURL;fallback.target='_blank';fallback.rel='noopener noreferrer';footer.append(make('span','','Cal.com loads only after you request a booking.'),fallback);
  dialog.append(header,status,calendar,footer);document.body.append(dialog);
  let ready=null,returnFocus=null,attempt=0;
  function loadSDK(){
    if(ready)return ready;
    // The official SDK consumes this command queue; no script is fetched until a click.
    if(!window.Cal){const cal=function(){cal.q.push(Array.from(arguments));};cal.q=[];cal.ns={};window.Cal=cal;}
    ready=new Promise((resolve,reject)=>{
      const script=document.createElement('script');script.src='https://app.cal.com/embed/embed.js';script.async=true;script.dataset.calEmbed='true';
      const timeout=setTimeout(()=>{script.remove();ready=null;reject(Error('Calendar timeout'));},12000);
      script.onload=()=>{clearTimeout(timeout);resolve();};script.onerror=()=>{clearTimeout(timeout);script.remove();ready=null;reject(Error('Calendar unavailable'));};document.head.append(script);
    });
    return ready;
  }
  async function open(link){
    const panel=link.closest('.books-panel');
    returnFocus=panel?document.querySelector('[aria-controls="'+panel.id+'"]')||link:link;
    panel?.querySelector('.books-close')?.click();
    const token=++attempt;
    title.textContent=link.textContent.includes('role')?'Let’s discuss the role.':'Let’s start a conversation.';
    status.hidden=false;status.textContent='Loading your calendar…';calendar.replaceChildren();
    dialog.showModal();document.body.classList.add('booking-open');close.focus();
    try{
      await loadSDK();if(!dialog.open||token!==attempt)return;
      window.Cal('init',{origin:'https://cal.com',forwardQueryParams:false});
      window.Cal('on',{action:'linkReady',callback:()=>{if(dialog.open&&token===attempt)status.hidden=true;}});
      window.Cal('on',{action:'linkFailed',callback:()=>{if(dialog.open&&token===attempt){status.hidden=false;status.textContent='The calendar could not load. You can use the direct Cal.com link below.';}}});
      window.Cal('inline',{elementOrSelector:'#role-booking-calendar',calLink,config:{layout:'month_view',theme:'dark'}});
      window.Cal('ui',{theme:'dark',hideEventTypeDetails:false,layout:'month_view',cssVarsPerTheme:{dark:{'cal-brand':'#eeece7','cal-bg':'#18191b','cal-bg-emphasis':'#242529','cal-text':'#eeece7'}}});
    }catch{if(dialog.open&&token===attempt)status.textContent='The calendar could not load. Please use the direct Cal.com link below.';}
  }
  document.querySelectorAll('[data-cal-popup]').forEach(link=>{
    link.href=bookingURL;link.setAttribute('aria-haspopup','dialog');
    link.addEventListener('click',event=>{if(event.metaKey||event.ctrlKey||event.shiftKey||event.altKey)return;event.preventDefault();open(link);});
  });
  close.addEventListener('click',()=>dialog.close());
  dialog.addEventListener('close',()=>{attempt++;calendar.replaceChildren();document.body.classList.remove('booking-open');returnFocus?.focus({preventScroll:true});});
})();
