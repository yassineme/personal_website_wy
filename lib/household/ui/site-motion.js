(() => {
  'use strict';
  const root = document.documentElement;
  // CSS failure must never delay navigation or change native scrolling.
  if (getComputedStyle(root).getPropertyValue('--site-motion-ready').trim() !== '1') return;
  // Private workspaces share the glide without public-page navigation curtains.
  const scrollOnly = !!document.currentScript?.hasAttribute('data-scroll-only');
  const reduced = matchMedia('(prefers-reduced-motion: reduce)');
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
    if (!scrollOnly && !nativeTransitions && !reduced.matches && arrival?.url === location.href && Date.now() - arrival.time < 10000) {
      makeCurtain('is-opening');
      navigationTimer = setTimeout(resetCurtain, 650);
    }
  } catch (_) { /* Storage is optional. */ }
  if (!scrollOnly && !nativeTransitions) document.addEventListener('click', event => {
    if (event.defaultPrevented || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey || reduced.matches) return;
    const link = event.target.closest?.('a[href]');
    if (!link || link.hasAttribute('download') || (link.target && link.target !== '_self') || link.relList.contains('external') || link.hasAttribute('data-no-transition')) return;
    const url = new URL(link.href, location.href);
    // Keep anchors, files, API routes, and external destinations entirely native.
    if (url.origin !== location.origin || !/^https?:$/.test(url.protocol) || url.pathname.startsWith('/api/') || /\.(?!html?$)[^/]+$/i.test(url.pathname) || (url.pathname === location.pathname && url.search === location.search)) return;
    event.preventDefault();
    if (destination) return;
    destination = url.href;
    stopScroll();
    makeCurtain('is-closing');
    navigationTimer = setTimeout(() => {
      const next = destination;
      try { sessionStorage.setItem(KEY, JSON.stringify({url:next, time:Date.now()})); } catch (_) { /* Navigate without a remembered arrival. */ }
      location.assign(next);
      // Recover if a browser extension or cancelled beforeunload keeps this page open.
      navigationTimer = setTimeout(resetCurtain, 1500);
    }, 360);
  });

  // Exact solution of a critically damped spring: stable across refresh rates.
  let frame = 0, previousTime = 0, position = window.scrollY, target = position, velocity = 0, written = position;
  const limit = () => Math.max(0, document.documentElement.scrollHeight - window.innerHeight);
  const clamp = value => Math.max(0, Math.min(limit(), value));
  function stopScroll() {
    cancelAnimationFrame(frame);
    frame = 0;
    velocity = 0;
    position = target = written = window.scrollY;
    root.classList.remove('physics-scrolling');
  }
  function locked() {
    return [root, document.body].some(element => /hidden|clip/.test(getComputedStyle(element).overflowY));
  }
  function pixelStep() { return 1 / Math.max(1, window.devicePixelRatio || 1); }
  function writeScroll(value, step) {
    // Browsers expose pixel-rounded scroll offsets. Repeated fractional writes
    // make the end of the spring tick between stationary rendered frames.
    const next = clamp(Math.round(value / step) * step);
    if (Math.abs(next - written) < step / 2) return;
    window.scrollTo({top:next, behavior:'instant'});
    written = window.scrollY;
  }
  function tick(now) {
    if (reduced.matches || document.hidden || locked()) return stopScroll();
    const dt = Math.min((now - previousTime) / 1000, .05);
    previousTime = now;
    target = clamp(target);
    // A lower spring frequency gives the glide a long, gentle settling tail.
    const omega = 8, displacement = position - target;
    const coefficient = velocity + omega * displacement;
    const decay = Math.exp(-omega * dt);
    position = target + (displacement + coefficient * dt) * decay;
    velocity = (velocity - omega * coefficient * dt) * decay;
    const step = pixelStep();
    // Keep the gentle glide, but finish once the remaining motion fits inside
    // one device pixel instead of animating an imperceptible asymptotic tail.
    if (Math.abs(position - target) <= step && Math.abs(velocity) <= 8 * step) {
      writeScroll(target, step);
      return stopScroll();
    }
    writeScroll(position, step);
    frame = requestAnimationFrame(tick);
  }
  let nativeWheelUntil = 0;
  window.addEventListener('wheel', event => {
    if (!event.deltaX && !event.deltaY) return;
    const now = performance.now();
    // Keep a mixed-cancelability trackpad burst under one scroll owner until
    // input becomes idle, rather than switching between native and spring frames.
    if (!event.cancelable || now < nativeWheelUntil) {
      nativeWheelUntil = now + 180;
      stopScroll();
      return;
    }
    if (event.defaultPrevented || reduced.matches || destination || event.ctrlKey || event.metaKey || event.shiftKey || Math.abs(event.deltaX) >= Math.abs(event.deltaY) || locked()) {
      // A wheel sequence can switch to native/noncancelable input mid-glide.
      // Release the spring before the browser or another control moves the page.
      stopScroll();
      return;
    }
    // Scrollable panels, dialogs, form controls and galleries own their input.
    for (let node = event.target; node instanceof Element && node !== document.body && node !== root; node = node.parentElement) {
      if (node.matches('input,textarea,select,[contenteditable]:not([contenteditable="false"]),dialog[open],[data-native-scroll]') || (/auto|scroll|overlay/.test(getComputedStyle(node).overflowY) && node.scrollHeight > node.clientHeight + 1)) {
        stopScroll();
        return;
      }
    }
    const delta = event.deltaY * (event.deltaMode === 1 ? 16 : event.deltaMode === 2 ? window.innerHeight : 1);
    if (!frame) position = target = written = window.scrollY;
    const next = clamp(target + delta);
    if (next === target) {
      // At a page boundary the target can be clamped while the visible page
      // is still gliding toward it. Do not let another wheel jump ahead.
      if (frame) event.preventDefault();
      return;
    }
    event.preventDefault();
    target = next;
    if (!frame) {
      root.classList.add('physics-scrolling');
      previousTime = performance.now();
      frame = requestAnimationFrame(tick);
    }
  }, {passive:false});
  // Explicit input and native/programmatic jumps immediately take control from the spring.
  window.addEventListener('scroll', () => {
    if (frame && Math.abs(window.scrollY - written) > 2) stopScroll();
  }, {passive:true});
  window.addEventListener('pointerdown', stopScroll, {passive:true});
  window.addEventListener('touchstart', stopScroll, {passive:true});
  window.addEventListener('keydown', event => {
    if (['ArrowUp','ArrowDown','PageUp','PageDown','Home','End',' ','Tab','Escape'].includes(event.key)) stopScroll();
  });
  window.addEventListener('resize', stopScroll);
  // App views can replace content without a document navigation or scroll event.
  window.addEventListener('site-motion:reset-scroll', stopScroll);
  window.addEventListener('pagehide', () => { stopScroll(); resetCurtain(); });
  window.addEventListener('pageshow', event => { if (event.persisted) { stopScroll(); resetCurtain(); } });
  document.addEventListener('visibilitychange', () => { if (document.hidden) stopScroll(); });
  reduced.addEventListener('change', () => {
    stopScroll();
    if (reduced.matches) {
      const next = destination;
      resetCurtain();
      if (next) location.assign(next);
    }
  });
})();
