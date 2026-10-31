(() => {
  const brand = document.querySelector('.masthead .brand-link');
  if (!brand) return;
  const button = document.createElement('a');
  button.href = '/api/owner-events';
  button.textContent = 'Open fieldnotes ↗';
  button.className = 'mono';
  button.hidden = true;
  document.querySelector('.header-right')?.append(button);
  let taps = [];
  brand.addEventListener('click', event => {
    event.preventDefault();
    const now = Date.now();
    taps = taps.filter(time => now - time < 3000);
    taps.push(now);
    if (taps.length >= 5) { button.hidden = false; button.focus(); taps = []; }
  });
  document.addEventListener('keydown', event => {
    if (event.altKey && event.shiftKey && event.code === 'KeyE') {
      event.preventDefault(); button.hidden = !button.hidden;
      if (!button.hidden) button.focus();
    }
  });
})();
