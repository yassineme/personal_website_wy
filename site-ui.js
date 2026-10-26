(() => {
  // Instrument Sans + Newsreader is the chosen default; query overrides retain the comparison.
  const proposal = new URLSearchParams(location.search).get('font');
  const proposals = ['manrope-newsreader','instrument-newsreader','sora-source-serif'];
  document.documentElement.dataset.typography = proposals.includes(proposal) ? proposal : 'instrument-newsreader';
  if (proposals.includes(proposal)) {
    document.querySelectorAll('a[href]').forEach(link => {
      const href = link.getAttribute('href');
      if (!href || href.startsWith('#') || /^[a-z][a-z\d+.-]*:/i.test(href) || href.startsWith('//')) return;
      const url = new URL(href,location.href);
      if (!url.pathname.endsWith('.html') || url.pathname.endsWith('typography-preview.html')) return;
      url.searchParams.set('font',proposal);
      link.href = url.href;
    });
  }
  const veil = document.createElement('div');
  veil.className = 'scroll-veil';
  veil.setAttribute('aria-hidden','true');
  document.body.prepend(veil);
  let pending = false;
  const update = () => {
    const offset = Math.max(0,window.scrollY);
    const opacity = Math.min(offset / 80,1);
    document.documentElement.style.setProperty('--scroll-veil-opacity',opacity.toFixed(3));
    pending = false;
  };
  const requestUpdate = () => {
    if (!pending) { pending = true; requestAnimationFrame(update); }
  };
  addEventListener('scroll',requestUpdate,{passive:true});
  addEventListener('resize',requestUpdate);
  addEventListener('pageshow',requestUpdate);
  update();
})();
