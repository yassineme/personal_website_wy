(() => {
  'use strict';
  const KEY = 'ywm-intro-seen-v1';
  const root = document.documentElement;
  // A presentation preference, never a visitor ID or a tracking event.
  // If remembering the choice is unavailable, skip rather than replay on every page.
  try {
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    let store;
    const available = [];
    for (const candidate of ['localStorage', 'sessionStorage']) {
      try {
        const storage = window[candidate];
        if (storage.getItem(KEY) === '1') return;
        available.push(storage);
      } catch (_) { /* This store is unavailable in the current browser. */ }
    }
    for (const storage of available) {
      try {
        storage.setItem(KEY, '1');
        if (storage.getItem(KEY) === '1') { store = storage; break; }
      } catch (_) { /* Try the next browser-local preference store. */ }
    }
    if (!store) return;
  } catch (_) { return; }

  let overlay, skip, frame, endTimer, exitTimer, shown = false, leaving = false, done = false;
  const previousFocus = document.activeElement;
  const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
  const onMotion = event => { if (event.matches) finish(true); };
  function cleanup() {
    if (done) return;
    done = true;
    cancelAnimationFrame(frame);
    clearTimeout(endTimer);
    clearTimeout(exitTimer);
    clearTimeout(watchdog);
    document.removeEventListener('DOMContentLoaded', start);
    document.removeEventListener('keydown', onKey, true);
    reducedMotion.removeEventListener?.('change', onMotion);
    overlay?.remove();
    root.classList.remove('site-intro-active', 'site-intro-ready');
    if (previousFocus && previousFocus !== document.body && previousFocus.isConnected) previousFocus.focus({preventScroll:true});
  }
  function finish(immediate = false) {
    if (done) return;
    if (immediate || !overlay) return cleanup();
    if (leaving) return;
    leaving = true;
    cancelAnimationFrame(frame);
    clearTimeout(endTimer);
    overlay.classList.add('is-leaving');
    // A timer completes the exit even when transition events never arrive.
    exitTimer = setTimeout(cleanup, 700);
  }
  function onKey(event) {
    if (event.key === 'Escape') { event.preventDefault(); finish(true); }
    if (event.key === 'Tab' && overlay && !done) { event.preventDefault(); skip.focus({preventScroll:true}); }
  }
  function make(tag, className, text) {
    const element = document.createElement(tag);
    if (className) element.className = className;
    if (text) element.textContent = text;
    return element;
  }
  function start() {
    if (done || shown) return;
    shown = true;
    try {
      // Never cover content if the companion styling failed to load.
      if (!Array.from(document.styleSheets).some(sheet => sheet.href && new URL(sheet.href, location.href).pathname === '/site-intro.css')) return cleanup();
      overlay = make('div', 'site-intro');
      overlay.setAttribute('role', 'dialog');
      overlay.setAttribute('aria-modal', 'true');
      overlay.setAttribute('tabindex', '-1');
      overlay.setAttribute('aria-label', 'Welcome to Yassine W. Medjati’s website');
      const brand = make('div', 'site-intro-brand');
      const logo = make('img'); logo.src = '/assets/brand/logo-ivory.png'; logo.alt = ''; logo.width = 36; logo.height = 36;
      const name = make('p', '', 'Yassine W. Medjati');
      name.append(make('span', '', 'AI · Transformation · People'));
      brand.append(logo, name);
      const caption = make('p', 'site-intro-caption', 'A considered perspective.');
      const meter = make('div', 'site-intro-meter'); meter.setAttribute('aria-hidden', 'true');
      const track = make('div', 'site-intro-track'); track.append(make('div', 'site-intro-fill'));
      const counter = make('div', 'site-intro-counter');
      const number = make('span', '', '0'); counter.append(number, make('small', '', '%'));
      meter.append(track, counter);
      skip = make('button', 'site-intro-skip', 'Skip intro'); skip.type = 'button';
      skip.addEventListener('click', () => finish(true));
      overlay.append(brand, caption, meter, skip);
      document.body.append(overlay);
      root.classList.add('site-intro-ready');
      document.addEventListener('keydown', onKey, true);
      reducedMotion.addEventListener?.('change', onMotion);
      overlay.focus({preventScroll:true});
      const began = performance.now();
      function tick(now) {
        if (done || leaving) return;
        const t = Math.min(1, Math.max(0, (now - began - 100) / 2200));
        const progress = 1 - Math.pow(1 - t, 2.4);
        number.textContent = String(Math.floor(progress * 100));
        overlay.style.setProperty('--intro-progress', progress.toFixed(5));
        if (t < 1) frame = requestAnimationFrame(tick);
        else { number.textContent = '100'; endTimer = setTimeout(() => finish(), 180); }
      }
      frame = requestAnimationFrame(tick);
    } catch (_) { cleanup(); }
  }
  // Register recovery before touching presentation state. Slow resources never hold the site indefinitely.
  const watchdog = setTimeout(() => finish(true), 5000);
  root.classList.add('site-intro-active');
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start, {once:true});
  else start();
})();
