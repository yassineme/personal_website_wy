(() => {
  const share = document.querySelector('.article-share');
  if (!share) return;
  const summary = share.querySelector('summary');
  const status = share.querySelector('.article-share-status');
  const fallback = share.querySelector('.article-share-fallback');
  const device = share.querySelector('[data-share-device]');
  const url = new URL(document.querySelector('link[rel="canonical"]')?.href || location.href);
  url.hash = '';
  const data = { title:document.querySelector('h1').textContent.trim(), url:url.href };
  const local = ['localhost','127.0.0.1','[::1]'].includes(url.hostname);

  share.querySelector('[data-copy-article]').addEventListener('click', async () => {
    fallback.hidden = true;
    status.textContent = '';
    try {
      await navigator.clipboard.writeText(data.url);
      status.textContent = local ? 'Local preview link copied.' : 'Article link copied.';
    } catch {
      fallback.hidden = false;
      const field = fallback.querySelector('input');
      field.value = data.url;
      field.focus();
      field.select();
      status.textContent = 'Select the link and copy it.';
    }
  });

  if (typeof navigator.share === 'function') {
    device.hidden = false;
    device.addEventListener('click', async () => {
      status.textContent = '';
      try {
        await navigator.share(data);
        share.open = false;
      } catch (error) {
        if (error.name !== 'AbortError') status.textContent = 'Device sharing is unavailable. Use Copy link instead.';
      }
    });
  }
  document.addEventListener('click', event => {
    if (share.open && !share.contains(event.target)) share.open = false;
  });
  share.addEventListener('keydown', event => {
    if (event.key === 'Escape') {
      share.open = false;
      summary.focus();
    }
  });
})();
