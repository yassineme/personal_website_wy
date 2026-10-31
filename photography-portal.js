(() => {
  'use strict';
  const arrival = document.documentElement.hasAttribute('data-photo-arrival');
  const reduced = matchMedia('(prefers-reduced-motion: reduce)');
  const photos = window.PHOTOGRAPHY || [];
  const door = document.querySelector('.photo-door');
  let active = false;
  const animate = (element, frames, options) => element.animate(frames, {fill:'both',...options});
  const make = (tag, className) => { const node = document.createElement(tag); node.className = className; return node; };
  function overlay() {
    const layer = make('div','photo-crossing');
    const photo = make('img','photo-crossing-photo');
    photo.src = photos[0].src; photo.alt = ''; photo.setAttribute('aria-hidden','true');
    layer.append(photo); document.body.append(layer);
    return {layer,photo};
  }
  async function arrive() {
    document.documentElement.removeAttribute('data-photo-arrival');
    if (location.hash === '#through-the-lens') history.replaceState(null,'',location.pathname+location.search);
    if (reduced.matches || !photos.length) return;
    const {layer,photo} = overlay();
    const destination = document.querySelector('.photograph img');
    if (!destination) { layer.remove(); return; }
    const bounds = destination.getBoundingClientRect();
    // The frame falls into its real place in the gallery, completing one journey.
    const frame = make('img','photo-crossing-photo');
    frame.src = photos[0].src; frame.alt = ''; frame.setAttribute('aria-hidden','true');
    layer.append(frame);
    const heading = document.querySelector('.gallery-heading');
    const tiles = [...document.querySelectorAll('.photograph')];
    layer.style.background = 'transparent';
    photo.style.filter = 'brightness(.7)';
    const animations = [];
    animations.push(animate(photo,[{opacity:1,transform:'scale(1.08)'},{opacity:0,transform:'scale(1.24)'}],{duration:1000,easing:'ease-out'}));
    animations.push(animate(frame,[
      {left:'0px',top:'0px',width:`${innerWidth}px`,height:`${innerHeight}px`,transform:'rotate(0deg)',filter:'brightness(.7)'},
      {left:`${bounds.left}px`,top:`${bounds.top}px`,width:`${bounds.width}px`,height:`${bounds.height}px`,transform:'rotate(0deg)',filter:'brightness(1)'}
    ],{duration:1300,easing:'cubic-bezier(.76,0,.16,1)'}));
    tiles.forEach((tile,i) => animations.push(animate(tile,[
      {opacity:0,transform:`translate(${i%2 ? 70:-70}px,90px) scale(.8) rotate(${i%2 ? 8:-8}deg)`},
      {opacity:1,transform:'translate(0,0) scale(1) rotate(0deg)'}
    ],{duration:1100,delay:180+i*55,easing:'cubic-bezier(.16,1,.3,1)'})));
    if (heading) animations.push(animate(heading,[{opacity:0,filter:'blur(12px)'},{opacity:1,filter:'blur(0px)'}],{duration:1000,delay:400}));
    // An animation failure must never leave an overlay over the portfolio.
    const safety = setTimeout(() => layer.remove(),2200);
    await Promise.allSettled(animations.map(animation=>animation.finished));
    clearTimeout(safety); layer.remove();
    animations.forEach(animation=>animation.cancel());
  }
  if (arrival) arrive().catch(() => {
    document.documentElement.removeAttribute('data-photo-arrival');
    document.querySelectorAll('.photo-crossing').forEach(node=>node.remove());
  });
  if (!door || !photos.length) return;
  let warm;
  function preload() { if (!warm) { warm = new Image(); warm.src = photos[0].src; } }
  door.addEventListener('pointerenter',preload,{once:true});
  door.addEventListener('focus',preload,{once:true});
  door.addEventListener('click',async event => {
    if (event.button !== 0 || event.metaKey || event.ctrlKey || event.altKey || event.shiftKey || door.target === '_blank' || reduced.matches) return;
    if (active) { event.preventDefault(); return; }
    const url = new URL(door.href);
    if (url.origin !== location.origin || !Element.prototype.animate) return;
    event.preventDefault(); active = true; preload();
    if (warm.decode) await Promise.race([warm.decode().catch(()=>{}),new Promise(resolve=>setTimeout(resolve,500))]);
    const page = document.querySelector('main.page');
    const buttonBounds = door.getBoundingClientRect();
    const x = buttonBounds.left+buttonBounds.width/2, y = buttonBounds.top+buttonBounds.height/2;
    const {layer,photo} = overlay();
    layer.style.background = 'transparent';
    layer.setAttribute('role','status'); layer.setAttribute('aria-label','Entering the photography portfolio');
    layer.style.setProperty('--door-x',`${x}px`); layer.style.setProperty('--door-y',`${y}px`);
    const shade = make('div','photo-crossing-shade'); layer.append(shade);
    const copy = make('div','photo-crossing-copy');
    const small = document.createElement('small'); small.textContent = 'Argus Panoptes';
    const line = document.createElement('p');
    ['A different way','of seeing.'].forEach(text=>{ const span = document.createElement('span');span.textContent=text;line.append(span); });
    copy.append(small,line); layer.append(copy);
    const cancel = make('button','photo-crossing-cancel');cancel.type='button';cancel.textContent='Cancel · Esc';layer.append(cancel);
    const rings = [0,1].map(()=>{const ring=make('div','photo-crossing-ring');layer.append(ring);return ring;});
    const animations = [];
    const originalOverflow = document.body.style.overflow;
    document.body.style.overflow='hidden';
    let timer;
    function restore() {
      clearTimeout(timer); active=false; animations.forEach(animation=>animation.cancel());
      layer.remove(); if (page) page.inert=false;
      document.body.style.overflow=originalOverflow;
      document.removeEventListener('keydown',onKey); window.removeEventListener('pageshow',restore); door.focus({preventScroll:true});
    }
    function onKey(event) { if(event.key==='Escape'){event.preventDefault();restore();} }
    cancel.addEventListener('click',restore);
    document.addEventListener('keydown',onKey);
    cancel.focus({preventScroll:true});
    if(page){page.inert=true;animations.push(animate(page,[{transform:'scale(1)',filter:'blur(0px)',opacity:1},{transform:'scale(.86)',filter:'blur(14px)',opacity:0}],{duration:1100,easing:'cubic-bezier(.4,0,.2,1)'}));}
    const radius = Math.ceil(Math.hypot(Math.max(x,innerWidth-x),Math.max(y,innerHeight-y)));
    animations.push(animate(photo,[
      {clipPath:`circle(0px at ${x}px ${y}px)`,transform:'scale(1.18)',filter:'brightness(.7)'},
      {clipPath:`circle(${radius}px at ${x}px ${y}px)`,transform:'scale(1.04)',filter:'brightness(.7)'}
    ],{duration:1250,easing:'cubic-bezier(.76,0,.16,1)'}));
    animations.push(animate(shade,[{opacity:0},{opacity:1}],{duration:1000}));
    animations.push(animate(copy,[{opacity:0,transform:'translateY(28px)',filter:'blur(10px)'},{opacity:1,transform:'translateY(0)',filter:'blur(0px)',offset:.6},{opacity:0,transform:'translateY(-12px)',filter:'blur(2px)'}],{duration:1200,delay:350,easing:'ease-out'}));
    rings.forEach((ring,i)=>animations.push(animate(ring,[{opacity:.6,transform:'scale(.6)'},{opacity:0,transform:'scale(24)'}],{duration:1100,delay:i*120,easing:'cubic-bezier(.2,.7,.2,1)'})));
    timer=setTimeout(()=>{url.hash='through-the-lens';location.assign(url.href);},1550);
    // Back/forward cache restores an ordinary, interactive homepage.
    window.addEventListener('pageshow',restore,{once:true});
  });
})();
