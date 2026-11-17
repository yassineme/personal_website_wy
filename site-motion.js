(() => {
  'use strict';
  const root = document.documentElement;
  // CSS failure must never delay navigation or change native scrolling.
  if (getComputedStyle(root).getPropertyValue('--site-motion-ready').trim() !== '1') return;
  const reduced = matchMedia('(prefers-reduced-motion: reduce)');
  const motionControl = document.querySelector('.motion-control');
  const motionPaused = () => motionControl?.getAttribute('aria-pressed') === 'true';
  const nativeTransitions = 'onpagereveal' in window && 'CSSViewTransitionRule' in window;
  let curtain, navigationTimer, destination;
  const KEY = 'ywm-page-arrival';
  function resetCurtain() {
    clearTimeout(navigationTimer);
    destination = null;
    curtain?.remove();
    curtain = null;
  }
  function makeCurtain(state) {
    curtain?.remove();
    curtain = document.createElement('div');
    curtain.className = `page-curtain ${state}`;
    curtain.setAttribute('aria-hidden', 'true');
    document.body.append(curtain);
  }
  // A short-lived destination marker avoids replaying arrivals on reload or another tab.
  try {
    const arrival = JSON.parse(sessionStorage.getItem(KEY) || 'null');
    sessionStorage.removeItem(KEY);
    if (!nativeTransitions && !reduced.matches && arrival?.url === location.href && Date.now() - arrival.time < 10000) {
      makeCurtain('is-opening');
      navigationTimer = setTimeout(resetCurtain, 650);
    }
  } catch (_) { /* Storage is optional. */ }
  if (!nativeTransitions) document.addEventListener('click', event => {
    if (event.defaultPrevented || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey || reduced.matches) return;
    const link = event.target.closest?.('a[href]');
    if (!link || link.hasAttribute('download') || (link.target && link.target !== '_self') || link.relList.contains('external') || link.hasAttribute('data-no-transition')) return;
    const url = new URL(link.href, location.href);
    // Keep anchors, files, API routes, and external destinations entirely native.
    if (url.origin !== location.origin || !/^https?:$/.test(url.protocol) || url.pathname.startsWith('/api/') || /\.(?!html?$)[^/]+$/i.test(url.pathname) || (url.pathname === location.pathname && url.search === location.search)) return;
    event.preventDefault();
    if (destination) return;
    destination = url.href;
    destroyScroll();
    makeCurtain('is-closing');
    navigationTimer = setTimeout(() => {
      const next = destination;
      try { sessionStorage.setItem(KEY, JSON.stringify({url:next, time:Date.now()})); } catch (_) { /* Navigate without a remembered arrival. */ }
      location.assign(next);
      // Recover if a browser extension or cancelled beforeunload keeps this page open.
      navigationTimer = setTimeout(() => { resetCurtain(); synchronizeScroll(); }, 1500);
    }, 360);
  });

  // Match leon-blakk-web: Lenis 1.1.18, identical duration, easing and input settings.
  const coarse = matchMedia('(pointer: coarse)');
  const compact = matchMedia('(max-width: 1099px)');
  const easing = t => Math.min(1, 1.001 - Math.pow(2, -10 * t));
  let lenis = null, frame = 0, pageActive = true;
  const locked = () => [root, document.body].some(element =>
    /hidden|clip/.test(getComputedStyle(element).overflowY));
  function stopScroll() {
    if (lenis) lenis.scrollTo(window.scrollY, {immediate:true, force:true});
  }
  function destroyScroll() {
    cancelAnimationFrame(frame);
    frame = 0;
    lenis?.destroy();
    lenis = null;
  }
  function synchronizeScroll() {
    if (!pageActive || reduced.matches || motionPaused() || document.hidden || destination || locked() ||
        (compact.matches && coarse.matches) || typeof window.Lenis !== 'function') {
      destroyScroll();
      return;
    }
    if (lenis) return;
    lenis = new window.Lenis({
      duration: 1.5,
      easing,
      orientation: 'vertical',
      gestureOrientation: 'vertical',
      smoothWheel: true,
      wheelMultiplier: 1,
      smoothTouch: false,
      touchMultiplier: 2,
      // Preserve the personal site's independently scrollable panels and controls.
      prevent: node => node instanceof Element && (
        node.matches('input,textarea,select,[contenteditable]:not([contenteditable="false"]),dialog[open],[data-native-scroll]') ||
        (/auto|scroll|overlay/.test(getComputedStyle(node).overflowY) && node.scrollHeight > node.clientHeight + 1)
      ),
    });
    function raf(time) {
      if (!lenis) return;
      lenis.raf(time);
      frame = requestAnimationFrame(raf);
    }
    frame = requestAnimationFrame(raf);
  }
  function scrollTo(target, options = {}) {
    if (lenis) {
      lenis.scrollTo(target, {duration:compact.matches ? 0.65 : 1.5, easing, ...options});
    } else if (typeof target === 'number') {
      window.scrollTo({top:target + (options.offset || 0), behavior:reduced.matches || motionPaused() ? 'instant' : 'smooth'});
    } else {
      const top = target.getBoundingClientRect().top + window.scrollY + (options.offset || 0);
      window.scrollTo({top, behavior:reduced.matches || motionPaused() ? 'instant' : 'smooth'});
    }
  }
  window.siteScroll = {scrollTo};
  document.addEventListener('click', event => {
    if (event.defaultPrevented || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
    const link = event.target.closest?.('a[href]');
    if (!link || link.hasAttribute('download') || (link.target && link.target !== '_self')) return;
    const url = new URL(link.href, location.href);
    if (url.origin !== location.origin || url.pathname !== location.pathname || url.search !== location.search || !url.hash) return;
    let target;
    try { target = document.getElementById(decodeURIComponent(url.hash.slice(1))); } catch (_) { return; }
    if (!target) return;
    event.preventDefault();
    scrollTo(target, {offset:-(parseFloat(getComputedStyle(target).scrollMarginTop) || 0)});
    if (location.hash !== url.hash) history.pushState(null, '', url.hash);
  });
  // Explicit input interrupts an anchor glide; ordinary wheel gestures stay with Lenis.
  window.addEventListener('pointerdown', stopScroll, {passive:true});
  window.addEventListener('touchstart', stopScroll, {passive:true});
  window.addEventListener('keydown', event => {
    if (['ArrowUp','ArrowDown','PageUp','PageDown','Home','End',' ','Tab','Escape'].includes(event.key)) stopScroll();
  });
  const observer = new MutationObserver(synchronizeScroll);
  observer.observe(root, {attributes:true, attributeFilter:['class','style']});
  observer.observe(document.body, {attributes:true, attributeFilter:['class','style']});
  if (motionControl) observer.observe(motionControl, {attributes:true, attributeFilter:['aria-pressed']});
  window.addEventListener('pagehide', () => { pageActive = false; destroyScroll(); resetCurtain(); });
  window.addEventListener('pageshow', () => { pageActive = true; resetCurtain(); synchronizeScroll(); });
  window.addEventListener('resize', synchronizeScroll);
  window.addEventListener('popstate', stopScroll);
  document.addEventListener('visibilitychange', synchronizeScroll);
  for (const query of [reduced, coarse, compact]) query.addEventListener('change', synchronizeScroll);
  reduced.addEventListener('change', () => {
    if (reduced.matches) {
      const next = destination;
      resetCurtain();
      if (next) location.assign(next);
    }
  });
  synchronizeScroll();
})();
