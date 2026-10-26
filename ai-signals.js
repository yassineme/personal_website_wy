(() => {
  'use strict';
  const rootURL = new URL('.', document.currentScript.src);
  const endpoint = new URL('api/ai-signals', rootURL);
  const make = (tag, cls, copy) => {
    const el = document.createElement(tag);
    if (cls) el.className = cls;
    if (copy) el.textContent = copy;
    return el;
  };
  const button = (cls, copy, label) => {
    const el = make('button', cls, copy);
    el.type = 'button';
    if (label) el.setAttribute('aria-label', label);
    return el;
  };
  const storage = {
    get(key, fallback) { try { return JSON.parse(localStorage.getItem('ywm-signals-' + key)) ?? fallback; } catch { return fallback; } },
    set(key, value) { try { localStorage.setItem('ywm-signals-' + key, JSON.stringify(value)); } catch {} }
  };
  const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)');
  const savedDismissed = storage.get('dismissed', []);
  let paused = storage.get('paused', false) === true;
  let dismissed = new Set(Array.isArray(savedDismissed) ? savedDismissed : []);
  let data = window.YWM_AI_SIGNALS_BOOTSTRAP;
  let mode = 'snapshot', busy = false, lastAttempt = 0, focused = null;
  let items = [], cursor = 0, hovered = false, touching = false, cycleTimer = null;
  const trusted = {openai: ['openai.com', 'www.openai.com'], deepmind: ['deepmind.google', 'blog.google'], huggingface: ['huggingface.co'], nist: ['nist.gov', 'www.nist.gov']};
  const initials = {openai: 'O', deepmind: 'G', huggingface: 'HF', nist: 'N'};
  const dateLabel = value => new Intl.DateTimeFormat('en', {day: 'numeric', month: 'short'}).format(new Date(value));
  function safeURL(raw, id) {
    try { const u = new URL(raw); return u.protocol === 'https:' && !u.username && !u.password && !u.port && trusted[id]?.includes(u.hostname) ? u.href : null; } catch { return null; }
  }
  function eligible() {
    return (data?.items || []).filter(item => !dismissed.has(item.id) && safeURL(item.url, item.sourceId) && Number.isFinite(Date.parse(item.publishedAt)) && Date.parse(item.publishedAt) <= Date.now() + 300000 && Date.now() - Date.parse(item.publishedAt) < 30 * 86400000);
  }
  function freshness() {
    const age = Date.now() - Date.parse(data?.updatedAt);
    return mode === 'network' && data?.status !== 'stale' && Number.isFinite(age) && age < 3600000;
  }

  // Three real glass layers; the front bubble opens the complete reading view.
  const dock = make('section', 'signals-dock');
  dock.setAttribute('aria-label', 'AI Signals notification stack');
  const dockBar = make('div', 'signals-dock-bar');
  const dockLabel = make('span', 'signals-dock-label', 'AI Signals');
  dockLabel.prepend(make('span', 'signals-dot'));
  const edition = make('span', 'signals-edition');
  const count = make('span', 'signals-count');
  count.setAttribute('aria-hidden', 'true');
  const dockPause = button('signals-dock-control', '', 'Pause AI Signals');
  const next = button('signals-dock-control signals-next', '↓', 'Next headline');
  dockBar.append(dockLabel, edition, count, dockPause, next);
  const stack = make('div', 'signals-stack');
  stack.setAttribute('aria-live', 'off');
  const backs = [1, 2].map(depth => {
    const card = make('div', 'signal-bubble signal-bubble-back');
    card.dataset.depth = depth;
    card.setAttribute('aria-hidden', 'true');
    stack.append(card);
    return card;
  });
  const launch = button('signal-bubble signal-bubble-front', '', 'Open all AI Signals');
  launch.setAttribute('aria-haspopup', 'dialog');
  launch.setAttribute('aria-controls', 'signals-dialog');
  launch.setAttribute('aria-expanded', 'false');
  stack.append(launch);
  const dockHint = make('p', 'signals-dock-hint', 'A little perspective. Tap to explore.');
  dock.append(dockBar, stack, dockHint);
  const introduction = document.querySelector('.page .introduction');
  if (introduction) { introduction.append(dock); dock.classList.add('signals-dock-home'); }
  else { document.body.append(dock); document.body.classList.add('has-floating-signals'); }

  const dialog = make('dialog', 'signals-dialog');
  dialog.id = 'signals-dialog';
  dialog.setAttribute('aria-labelledby', 'signals-title');
  const shell = make('div', 'signals-shell');
  const top = make('div', 'signals-top');
  top.append(make('span', 'signals-kicker', 'AI Signals / Direct from the source'));
  const close = button('signals-icon', '×', 'Close AI Signals');
  top.append(close);
  const title = make('h2', 'signals-title');
  title.id = 'signals-title';
  title.append('AI, ', make('em', '', 'in focus.'));
  const intro = make('p', 'signals-intro', 'The research, releases and ideas moving AI forward. Take a moment. Find what matters.');
  const tools = make('div', 'signals-tools');
  const status = make('p', 'signals-status');
  status.setAttribute('role', 'status');
  const pause = button('signals-pause', '');
  tools.append(status, pause);
  const cards = make('div', 'signals-cards');
  const footer = make('div', 'signals-footer');
  const sources = make('details', 'signals-sources');
  sources.append(make('summary', '', 'The source standard'), make('p', '', 'Headlines loop from the current collection; the animation does not mean a new story has just been published. Feeds are checked every 15 minutes while you browse.'), make('p', '', 'Official publisher feeds only. Links are checked against an approved domain list. Hugging Face community posts are excluded. Dates and short publisher excerpts are attributed; inclusion is not an endorsement.'));
  const sourceLinks = make('div', 'signals-source-links');
  sources.append(sourceLinks);
  const reset = button('signals-reset', 'Restore dismissed');
  footer.append(sources, reset);
  const invitation = make('div', 'signals-invitation');
  invitation.append(make('p', '', 'What does this change for your business?'));
  const blog = make('a', '', 'Explore my perspectives ↗');
  blog.href = new URL('blog.html', rootURL);
  invitation.append(blog);
  shell.append(top, title, intro, tools, cards, footer, invitation);
  dialog.append(shell);
  document.body.append(dialog);

  function bubbleContent(item) {
    const fragment = document.createDocumentFragment();
    const meta = make('span', 'signal-bubble-meta');
    const badge = make('span', 'signal-badge', initials[item.sourceId] || 'AI');
    badge.setAttribute('aria-hidden', 'true');
    const publisher = make('span', 'signal-bubble-publisher', item.source);
    const time = make('time', '', dateLabel(item.publishedAt));
    time.dateTime = item.publishedAt;
    meta.append(badge, publisher, time);
    fragment.append(meta, make('span', 'signal-bubble-headline', item.title));
    return fragment;
  }
  function drawStack(animate = false) {
    dock.dataset.fresh = String(freshness());
    edition.textContent = freshness() ? 'Curated feed' : 'Saved edition';
    if (!items.length) {
      dock.dataset.index = '0'; dock.dataset.story = '';
      count.textContent = '00 / 00';
      launch.replaceChildren(make('span', 'signal-bubble-meta', 'AI Signals'), make('span', 'signal-bubble-headline', dismissed.size ? 'You’re all caught up. Tap to revisit the collection.' : 'A quiet moment. Explore the original sources.'), make('span', 'signal-bubble-open', '↗'));
      launch.setAttribute('aria-label', 'Open AI Signals and sources');
      backs.forEach(card => { card.hidden = true; });
      return;
    }
    cursor = ((cursor % items.length) + items.length) % items.length;
    dock.dataset.index = String(cursor);
    dock.dataset.fresh = String(freshness());
    dock.dataset.story = items[cursor].id;
    edition.textContent = freshness() ? 'Curated feed' : 'Saved edition';
    count.textContent = String(cursor + 1).padStart(2, '0') + ' / ' + String(items.length).padStart(2, '0');
    const content = make('span', 'signal-bubble-content');
    content.append(bubbleContent(items[cursor]));
    launch.replaceChildren(content, make('span', 'signal-bubble-open', '↗'));
    launch.setAttribute('aria-label', 'Open all ' + items.length + ' AI Signals');
    backs.forEach((card, index) => {
      card.hidden = items.length <= index + 1;
      card.replaceChildren(bubbleContent(items[(cursor + items.length - index - 1) % items.length]));
    });
    if (animate && !reducedMotion.matches) {
      // Keep the frosted planes stationary: moving backdrop-filter layers can
      // leave stale raster tiles in WebKit. Only the incoming story moves.
      content.animate([{opacity: 0, transform: 'translateY(-18px)'}, {opacity: 1, transform: 'translateY(0)'}], {duration: 650, easing: 'cubic-bezier(.2,.8,.2,1)'});
    }
  }
  function step() { if (items.length > 1) { cursor++; drawStack(true); } }
  function schedule() {
    clearTimeout(cycleTimer);
    const held = paused || reducedMotion.matches || hovered || touching || (dock.contains(document.activeElement) && document.activeElement.matches(':focus-visible')) || document.hidden || dialog.open;
    dock.dataset.paused = String(held);
    if (!held && items.length > 1) cycleTimer = setTimeout(() => { step(); schedule(); }, 5500);
  }
  function syncControls() {
    pause.textContent = paused ? 'Resume stream' : 'Pause stream';
    pause.setAttribute('aria-pressed', String(paused));
    dockPause.setAttribute('aria-pressed', String(paused));
    dockPause.setAttribute('aria-label', paused ? 'Resume AI Signals' : 'Pause AI Signals');
    dockPause.replaceChildren();
    const icon = make('span', paused ? 'signals-play-glyph' : 'signals-pause-glyph');
    icon.setAttribute('aria-hidden', 'true');
    dockPause.append(icon);
    next.disabled = items.length < 2;
    dockHint.textContent = !items.length ? 'Tap to explore the collection and sources.' : items.length === 1 ? 'One story to explore. Tap to read.' : paused ? 'Stream paused. Tap a bubble to explore.' : reducedMotion.matches ? 'Tap to explore. Use ↓ for the next headline.' : 'Headlines in rotation. Tap to explore.';
  }
  function renderCards() {
    const expanded = new Set([...cards.querySelectorAll('details[open]')].map(el => el.dataset.story));
    const active = document.activeElement;
    const activeStory = active?.closest('.signal-card')?.dataset.story;
    const activePart = active?.tagName === 'SUMMARY' ? 'summary' : active?.classList.contains('signal-dismiss') ? '.signal-dismiss' : active?.classList.contains('signal-original') ? '.signal-original' : null;
    const stamp = data?.updatedAt && Number.isFinite(Date.parse(data.updatedAt)) ? dateLabel(data.updatedAt) : 'unavailable';
    status.textContent = paused ? 'Stream paused' : !freshness() ? 'Saved edition · ' + stamp : data.status === 'partial' ? 'Some sources delayed' : 'Checked · ' + new Date(data.checkedAt).toLocaleTimeString('en', {hour: '2-digit', minute: '2-digit'});
    status.title = !freshness() ? 'Showing the last saved collection.' : 'Checks every 15 minutes while this page is visible; publisher feeds can arrive later than the original announcement.';
    sourceLinks.replaceChildren();
    for (const source of data?.sources || []) {
      const href = safeURL(source.home, source.id);
      if (!href) continue;
      const link = make('a', '', source.name + (source.status !== 'ok' ? ' · delayed' : ''));
      link.href = href; link.target = '_blank'; link.rel = 'noopener noreferrer'; sourceLinks.append(link);
    }
    cards.replaceChildren();
    if (!items.length) cards.append(make('p', 'signals-empty', dismissed.size ? 'You’re all caught up. Restore dismissed stories to read them again.' : 'No recent stories are available. Check the publishers below.'));
    const readerItems = [...items.slice(cursor), ...items.slice(0, cursor)];
    readerItems.forEach((item, index) => {
      const card = make('article', 'signal-card'); card.dataset.story = item.id; card.style.setProperty('--signal-delay', Math.min(index, 4) * 45 + 'ms');
      const meta = make('div', 'signal-meta');
      const badge = make('span', 'signal-badge', initials[item.sourceId] || 'AI'); badge.setAttribute('aria-hidden', 'true');
      meta.append(badge, make('span', 'signal-source', item.source + ((data.sources || []).find(source => source.id === item.sourceId)?.status !== 'ok' ? ' · delayed' : '')));
      const time = make('time', '', new Intl.DateTimeFormat('en', {day: 'numeric', month: 'short', year: 'numeric'}).format(new Date(item.publishedAt))); time.dateTime = item.publishedAt; meta.append(time);
      const dismiss = button('signal-dismiss', '×', 'Dismiss: ' + item.title);
      dismiss.addEventListener('click', () => {
        dismissed.add(item.id); storage.set('dismissed', [...dismissed].slice(-200)); render(); (cards.querySelector('summary') || reset).focus();
      });
      meta.append(dismiss);
      const details = make('details', 'signal-story'); details.dataset.story = item.id; details.open = expanded.has(item.id);
      const headline = make('summary'); headline.append(make('h3', '', item.title), make('span', 'signal-expand', '+')); details.append(headline);
      const body = make('div', 'signal-body'); body.append(make('span', 'signal-lens', item.lens), make('p', '', item.excerpt || 'Read the original publisher’s article for the full details.'), make('small', '', 'Publisher excerpt'));
      const link = make('a', 'signal-original', 'Read original article ↗'); link.href = safeURL(item.url, item.sourceId); link.target = '_blank'; link.rel = 'noopener noreferrer'; body.append(link);
      details.append(body); card.append(meta, details); cards.append(card);
    });
    reset.hidden = !dismissed.size;
    if (activeStory && activePart) {
      const target = [...cards.children].find(el => el.dataset.story === activeStory)?.querySelector(activePart);
      (target || pause).focus({preventScroll: true});
    }
  }
  function render() {
    const currentID = items[cursor % (items.length || 1)]?.id;
    items = eligible();
    cursor = Math.max(0, items.findIndex(item => item.id === currentID));
    drawStack(); syncControls();
    if (dialog.open) renderCards();
    schedule();
  }
  async function refresh() {
    if (paused || document.hidden || busy || location.protocol === 'file:') return;
    busy = true; lastAttempt = Date.now();
    try {
      const response = await fetch(endpoint, {headers: {Accept: 'application/json'}, signal: AbortSignal.timeout(12000)});
      if (!response.ok) throw Error();
      const incoming = await response.json();
      if (incoming.version !== 1 || !Array.isArray(incoming.items) || !Array.isArray(incoming.sources)) throw Error();
      if (!paused) { data = incoming; mode = 'network'; }
    } catch { mode = 'snapshot'; }
    finally { busy = false; render(); }
  }
  function open() {
    focused = document.activeElement;
    const storyID = items[cursor]?.id;
    renderCards();
    // Match the bubble the visitor selected, even when it is later in the rotating collection.
    const selected = storyID ? [...cards.children].find(card => card.dataset.story === storyID) : null;
    if (selected) selected.querySelector('details').open = true;
    dialog.showModal(); document.body.classList.add('signals-open'); launch.setAttribute('aria-expanded', 'true'); schedule(); close.focus();
    dialog.scrollTop = 0;
    if (Date.now() - lastAttempt >= 900000) refresh();
  }
  function togglePause() { paused = !paused; storage.set('paused', paused); syncControls(); if (dialog.open) renderCards(); schedule(); if (!paused) refresh(); }
  launch.addEventListener('click', open);
  close.addEventListener('click', () => dialog.close());
  dialog.addEventListener('click', event => {
    if (event.target === dialog) { const rect = dialog.getBoundingClientRect(); if (event.clientX < rect.left || event.clientX > rect.right || event.clientY < rect.top || event.clientY > rect.bottom) dialog.close(); }
  });
  dialog.addEventListener('close', () => {
    document.body.classList.remove('signals-open'); launch.setAttribute('aria-expanded', 'false');
    if (dock.hidden) document.querySelector('.brand-link')?.focus(); else focused?.focus();
    schedule();
  });
  pause.addEventListener('click', togglePause); dockPause.addEventListener('click', togglePause);
  next.addEventListener('click', () => { step(); schedule(); });
  reset.addEventListener('click', () => { dismissed.clear(); storage.set('dismissed', []); render(); pause.focus(); });
  dock.addEventListener('pointerenter', event => { if (event.pointerType !== 'touch') { hovered = true; schedule(); } });
  dock.addEventListener('pointerleave', () => { hovered = false; schedule(); });
  dock.addEventListener('pointerdown', event => { if (event.pointerType === 'touch') { touching = true; schedule(); } });
  const endTouch = () => { if (touching) { touching = false; schedule(); } };
  document.addEventListener('pointerup', endTouch); document.addEventListener('pointercancel', endTouch);
  dock.addEventListener('focusin', schedule); dock.addEventListener('focusout', () => queueMicrotask(schedule));
  reducedMotion.addEventListener('change', () => { syncControls(); schedule(); });
  document.addEventListener('visibilitychange', () => { schedule(); if (!document.hidden && Date.now() - lastAttempt >= 900000) refresh(); });
  // Honor the site's existing motion control as well as the stream's own pause button.
  document.querySelector('.motion-control')?.addEventListener('click', () => {
    queueMicrotask(() => { const control = document.querySelector('.motion-control'); paused = control?.getAttribute('aria-pressed') === 'true'; storage.set('paused', paused); syncControls(); schedule(); });
  });
  setInterval(refresh, 900000);
  render(); refresh();
})();
