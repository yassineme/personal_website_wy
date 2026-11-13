(() => {
  // Instrument Sans + Newsreader is the chosen default; query overrides retain the comparison.
  const proposal = new URLSearchParams(location.search).get('font');
  const proposals = ['manrope-newsreader','instrument-newsreader','sora-source-serif'];
  document.documentElement.dataset.typography = proposals.includes(proposal) ? proposal : 'instrument-newsreader';
  const currentPath = location.pathname.replace(/\/$/, '') || '/';
  document.querySelectorAll('.journal-nav a,.subnav a').forEach(link => {
    const path = new URL(link.href, location.href).pathname.replace(/\/$/, '') || '/';
    if (path === currentPath) link.setAttribute('aria-current', 'page');
  });
  if (proposals.includes(proposal)) {
    document.querySelectorAll('a[href]').forEach(link => {
      const href = link.getAttribute('href');
      if (!href || href.startsWith('#') || /^[a-z][a-z\d+.-]*:/i.test(href) || href.startsWith('//')) return;
      const url = new URL(href,location.href);
      if (url.pathname.endsWith('/typography-preview') || /\.[^/]+$/.test(url.pathname)) return;
      url.searchParams.set('font',proposal);
      link.href = url.href;
    });
  }
  const veil = document.createElement('div');
  veil.className = 'scroll-veil';
  veil.setAttribute('aria-hidden','true');
  document.body.prepend(veil);
  let pending = false, previousOpacity;
  const update = () => {
    const offset = Math.max(0,window.scrollY);
    const opacity = Math.min(offset / 80,1);
    // Keep scroll-driven paint local to this overlay. An inherited variable on
    // the root invalidates styles throughout the page on every scroll frame.
    const nextOpacity = opacity.toFixed(3);
    if (nextOpacity !== previousOpacity) {
      veil.style.opacity = nextOpacity;
      previousOpacity = nextOpacity;
    }
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
