(() => {
  'use strict';
  // Publication dates, rather than edit dates, determine the 14-day New label.
  // Refresh on return to the page so an open tab does not keep an expired tag.
  function refreshNewLabels() {
    const now = new Date();
    const today = Date.UTC(now.getFullYear(), now.getMonth(), now.getDate());
    document.querySelectorAll('.journal-new[data-published]').forEach(label => {
      const value = label.dataset.published;
      const published = /^\d{4}-\d{2}-\d{2}$/.test(value)
        ? Date.parse(`${value}T00:00:00Z`) : NaN;
      const age = today - published;
      label.hidden = !(Number.isFinite(published) &&
        new Date(published).toISOString().slice(0, 10) === value &&
        age >= 0 && age < 14 * 24 * 60 * 60 * 1000);
    });
  }
  refreshNewLabels();
  window.addEventListener('pageshow', refreshNewLabels);
  document.addEventListener('visibilitychange', () => {
    if (!document.hidden) refreshNewLabels();
  });
})();
