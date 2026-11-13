(() => {
  const desk = document.createElement('a');
  // The private store stays on this computer, including when opened from the public homepage.
  desk.href = 'http://127.0.0.1:8790/private-desk';
  desk.rel = 'noreferrer';
  desk.hidden = true;
  desk.tabIndex = -1;
  desk.setAttribute('aria-label', 'Open private workspace');
  desk.setAttribute('aria-hidden', 'true');
  desk.setAttribute('data-no-transition', '');
  document.body.append(desk);
  const brand = document.querySelector('.masthead .brand-link');
  if (!brand) return;
  let holdTimer, holdOrigin, held = false;
  function cancelHold() { clearTimeout(holdTimer); holdTimer = null; holdOrigin = null; }
  brand.addEventListener('pointerdown', event => {
    if (event.button !== 0 || event.isPrimary === false) return;
    cancelHold(); held = false;
    holdOrigin = {x:event.clientX, y:event.clientY};
    holdTimer = setTimeout(() => { cancelHold(); held = true; desk.click(); }, 1200);
  });
  brand.addEventListener('pointermove', event => {
    if (holdOrigin && Math.hypot(event.clientX - holdOrigin.x, event.clientY - holdOrigin.y) > 10) cancelHold();
  });
  brand.addEventListener('pointerleave', cancelHold);
  brand.addEventListener('contextmenu', event => { if (holdTimer || held) event.preventDefault(); });
  document.addEventListener('pointerup', cancelHold);
  document.addEventListener('pointercancel', cancelHold);
  window.addEventListener('pagehide', cancelHold);
  document.addEventListener('visibilitychange', () => { if (document.hidden) cancelHold(); });
  const button = document.createElement('a');
  button.href = '/api/owner-events';
  button.textContent = 'Open fieldnotes ↗';
  button.className = 'mono';
  button.hidden = true;
  document.querySelector('.header-right')?.append(button);
  let taps = [];
  brand.addEventListener('click', event => {
    event.preventDefault();
    if (held) { held = false; return; }
    const now = Date.now();
    taps = taps.filter(time => now - time < 3000);
    taps.push(now);
    if (taps.length >= 5) { button.hidden = false; button.focus(); taps = []; }
  });
  document.addEventListener('keydown', event => {
    if (event.defaultPrevented || event.repeat || event.target.closest?.('input,textarea,select,[contenteditable]:not([contenteditable="false"])')) return;
    if (event.altKey && event.shiftKey && !event.ctrlKey && !event.metaKey && event.code === 'KeyD') {
      event.preventDefault(); cancelHold(); desk.click(); return;
    }
    if (event.altKey && event.shiftKey && event.code === 'KeyE') {
      event.preventDefault(); button.hidden = !button.hidden;
      if (!button.hidden) button.focus();
    }
  });
})();
