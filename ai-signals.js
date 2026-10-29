(() => {
  'use strict';
  const setCopy = (el, text) => {
    el.replaceChildren();
    String(text).split('\u2197').forEach((part, index) => {
      if (index) {
        const icon = document.createElement('span');
        icon.innerHTML = '<svg class="ui-arrow-icon" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="1em" height="1em" style="display:inline-block;vertical-align:-.125em;flex:none" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false"><path d="M7 17 17 7M7 7h10v10"/></svg>';
        el.append(icon.firstChild);
      }
      el.append(document.createTextNode(part));
    });
  };

  const rootURL = new URL('.', document.currentScript.src);
  const core = window.YWM_SIGNALS;
  const visit = window.YWM_SIGNALS_READER.visit;
  const endpoint = new URL('api/ai-signals', rootURL);
  const refreshInterval = 5 * 60 * 1000;
  const make = (tag, cls, copy) => {
    const el = document.createElement(tag);
    if (cls) el.className = cls;
    if (copy) setCopy(el, copy);
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
  const initials = {openai:'O',deepmind:'G',huggingface:'HF',nist:'N',google:'G',mistral:'M',microsoft:'MS',mit:'MIT',aws:'AWS',nvidia:'NV',arstechnica:'A',decoder:'D',simon:'SW',usefulthing:'UT',snakeoil:'NT',interconnects:'IC',ukaisi:'UK'};
  const dateLabel = value => new Intl.DateTimeFormat('en', {day: 'numeric', month: 'short'}).format(new Date(value));
  const safeURL = core.safeURL;
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
  const dockPause = button('signals-dock-control', '', 'Pause headline rotation');
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
  const updates = button('signals-updates', '', 'Open newly discovered AI signals');
  updates.hidden = true;
  dock.append(dockBar, stack, dockHint, updates);
  const introduction = document.querySelector('.page .introduction');
  if (introduction) { introduction.append(dock); dock.classList.add('signals-dock-home'); }
  else { document.body.append(dock); document.body.classList.add('has-floating-signals'); }

  const dialog = make('dialog', 'signals-dialog');
  dialog.id = 'signals-dialog';
  dialog.setAttribute('aria-labelledby', 'signals-title');
  const shell = make('div', 'signals-shell');
  const top = make('div', 'signals-top');
  top.append(make('span', 'signals-kicker', 'AI Signals / Sources & perspectives'));
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
  const refreshButton = button('signals-pause', 'Refresh news', 'Check for new AI stories');
  tools.append(status, refreshButton, pause);
  const reader = window.YWM_SIGNALS_READER.createReader({rootURL, onChange: syncUpdates, onDismiss: item => { dismissed.add(item.id); storage.set('dismissed', [...dismissed].slice(-200)); render(); }});
  const cards = reader.element;
  const footer = make('div', 'signals-footer');
  const sources = make('details', 'signals-sources');
  sources.append(make('summary', '', 'The source standard'), make('p', '', 'Publisher feeds are checked on arrival and every 5 minutes while you browse, even when motion is paused. New stories move to the front automatically. Headlines rotate between checks; another check may find no new publications.'), make('p', '', 'Company announcements, independent reporting, practitioners and policy institutions. Related reports are grouped conservatively. Dates and publisher excerpts are attributed; topic labels and business prompts are automatic, not Yassine’s commentary. Inclusion is not an endorsement.'));
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
    meta.append(badge, publisher);
    if (visit.isNew(item)) meta.append(make('span', 'signal-new', 'New'));
    meta.append(time);
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
    pause.textContent = paused ? 'Resume motion' : 'Pause motion';
    pause.setAttribute('aria-pressed', String(paused));
    dockPause.setAttribute('aria-pressed', String(paused));
    dockPause.setAttribute('aria-label', paused ? 'Resume headline rotation' : 'Pause headline rotation');
    dockPause.replaceChildren();
    const icon = make('span', paused ? 'signals-play-glyph' : 'signals-pause-glyph');
    icon.setAttribute('aria-hidden', 'true');
    dockPause.append(icon);
    next.disabled = items.length < 2;
    dockHint.textContent = !items.length ? 'Tap to explore the collection and sources.' : items.length === 1 ? 'One story to explore. Tap to read.' : paused ? 'Motion paused. News still updates.' : reducedMotion.matches ? 'Tap to explore. Use ↓ for the next headline.' : 'Headlines in rotation. Tap to explore.';
  }
  function syncUpdates() {
    const total = items.filter(item => visit.isNew(item)).length;
    updates.hidden = !total;
    updates.textContent = total + ' new since your last visit';
  }
  function renderCards(selectedID = null) {
    const stamp = data?.updatedAt && Number.isFinite(Date.parse(data.updatedAt)) ? dateLabel(data.updatedAt) : 'unavailable';
    const checked = Number.isFinite(Date.parse(data?.checkedAt)) ? new Date(data.checkedAt).toLocaleTimeString('en', {hour: '2-digit', minute: '2-digit'}) : 'unavailable';
    status.textContent = !freshness() ? 'Saved edition · ' + stamp : 'Checked · ' + checked + (data.status === 'partial' ? ' · Some sources delayed' : '');
    status.title = 'Checks every 5 minutes while this page is visible, including when motion is paused. The archive grows as visitors browse.';
    sourceLinks.replaceChildren();
    for (const source of data?.sources || []) {
      const href = safeURL(source.home, source.id); if (!href) continue;
      const link = make('a', '', source.name + (source.status !== 'ok' ? ' · delayed' : ''));
      link.href = href; link.target = '_blank'; link.rel = 'noopener noreferrer'; sourceLinks.append(link);
    }
    reader.setData({...data, items}, {selectedID});
    reset.hidden = !dismissed.size;
  }
  function render() {
    const currentID = items[cursor % (items.length || 1)]?.id;
    items = eligible();
    cursor = Math.max(0, items.findIndex(item => item.id === currentID));
    drawStack(); syncControls(); syncUpdates();
    if (dialog.open) renderCards();
    schedule();
  }
  async function refresh() {
    if (document.hidden || busy || location.protocol === 'file:') return;
    busy = true; lastAttempt = Date.now();
    refreshButton.disabled = true;
    refreshButton.textContent = 'Checking…';
    try {
      const response = await fetch(endpoint, {cache: 'no-cache', headers: {Accept: 'application/json'}, signal: AbortSignal.timeout(28000)});
      if (!response.ok) throw Error();
      const incoming = await response.json();
      if (incoming.version !== 1 || !Array.isArray(incoming.items) || !Array.isArray(incoming.sources)) throw Error();
      const known = new Set((data?.items || []).map(item => item.id));
      const hasNew = incoming.items.some(item => !known.has(item.id) && !dismissed.has(item.id) && safeURL(item.url, item.sourceId));
      if (incoming.status !== 'stale') visit.observe(incoming.items);
      data = incoming; mode = 'network';
      // Show a new arrival next instead of keeping the old rotation position.
      if (hasNew) { items = []; cursor = 0; }
    } catch { mode = 'snapshot'; }
    finally { busy = false; refreshButton.disabled = false; refreshButton.textContent = 'Refresh news'; render(); }
  }
  function open() {
    focused = document.activeElement;
    const storyID = items[cursor]?.id;
    renderCards(storyID);
    dialog.showModal(); document.body.classList.add('signals-open'); launch.setAttribute('aria-expanded', 'true'); schedule(); close.focus();
    shell.scrollTop = 0;
    if (Date.now() - lastAttempt >= refreshInterval) refresh();
  }
  function togglePause() { paused = !paused; storage.set('paused', paused); syncControls(); if (dialog.open) renderCards(); schedule(); if (!paused) refresh(); }
  launch.addEventListener('click', open);
  updates.addEventListener('click', open);
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
  refreshButton.addEventListener('click', refresh);
  next.addEventListener('click', () => { step(); schedule(); });
  reset.addEventListener('click', () => { dismissed.clear(); storage.set('dismissed', []); render(); pause.focus(); });
  dock.addEventListener('pointerenter', event => { if (event.pointerType !== 'touch') { hovered = true; schedule(); } });
  dock.addEventListener('pointerleave', () => { hovered = false; schedule(); });
  dock.addEventListener('pointerdown', event => { if (event.pointerType === 'touch') { touching = true; schedule(); } });
  const endTouch = () => { if (touching) { touching = false; schedule(); } };
  document.addEventListener('pointerup', endTouch); document.addEventListener('pointercancel', endTouch);
  dock.addEventListener('focusin', schedule); dock.addEventListener('focusout', () => queueMicrotask(schedule));
  reducedMotion.addEventListener('change', () => { syncControls(); schedule(); });
  document.addEventListener('visibilitychange', () => { schedule(); if (!document.hidden && Date.now() - lastAttempt >= refreshInterval) refresh(); });
  // Honor the site's existing motion control as well as the stream's own pause button.
  document.querySelector('.motion-control')?.addEventListener('click', () => {
    queueMicrotask(() => { const control = document.querySelector('.motion-control'); paused = control?.getAttribute('aria-pressed') === 'true'; storage.set('paused', paused); syncControls(); schedule(); });
  });
  setInterval(refresh, refreshInterval);
  render(); refresh();
})();
