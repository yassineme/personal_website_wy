(() => {
  'use strict';
  const header = document.querySelector('.page > .masthead .header-right');
  if (!header) return;

  const groups = [
    { key: 'leaders', label: 'AI leaders', companies: [
      ['NASDAQ:MSFT', 'Microsoft Corporation'], ['NASDAQ:GOOGL', 'Alphabet Inc. (Google)'],
      ['NASDAQ:AMZN', 'Amazon.com, Inc.'], ['NASDAQ:META', 'Meta Platforms, Inc.'],
      ['NASDAQ:AAPL', 'Apple Inc.'], ['NASDAQ:TSLA', 'Tesla, Inc.'],
      ['NYSE:BABA', 'Alibaba Group Holding Limited'], ['NASDAQ:BIDU', 'Baidu, Inc.'], ['NYSE:IBM', 'International Business Machines Corporation']
    ] },
    { key: 'chips', label: 'Chips', companies: [
      ['NASDAQ:NVDA', 'NVIDIA Corporation'], ['NASDAQ:AMD', 'Advanced Micro Devices, Inc.'],
      ['NASDAQ:AVGO', 'Broadcom Inc.'], ['NYSE:TSM', 'Taiwan Semiconductor Manufacturing Company'],
      ['NASDAQ:ASML', 'ASML Holding N.V.'], ['NASDAQ:ARM', 'Arm Holdings plc'],
      ['NASDAQ:MU', 'Micron Technology, Inc.'], ['NASDAQ:INTC', 'Intel Corporation'],
      ['NASDAQ:QCOM', 'Qualcomm Incorporated'], ['NASDAQ:MRVL', 'Marvell Technology, Inc.'],
      ['NASDAQ:AMAT', 'Applied Materials, Inc.'], ['NASDAQ:LRCX', 'Lam Research Corporation'],
      ['NASDAQ:KLAC', 'KLA Corporation'], ['NASDAQ:SNPS', 'Synopsys, Inc.'],
      ['NASDAQ:CDNS', 'Cadence Design Systems, Inc.']
    ] },
    { key: 'infrastructure', label: 'Infrastructure', companies: [
      ['NYSE:ORCL', 'Oracle Corporation'], ['NASDAQ:PLTR', 'Palantir Technologies Inc.'],
      ['NASDAQ:CRWV', 'CoreWeave, Inc.'], ['NYSE:DELL', 'Dell Technologies Inc.'],
      ['NYSE:HPE', 'Hewlett Packard Enterprise Company'], ['NYSE:ANET', 'Arista Networks, Inc.'],
      ['NYSE:VRT', 'Vertiv Holdings Co'], ['NASDAQ:EQIX', 'Equinix, Inc.'],
      ['NASDAQ:SMCI', 'Super Micro Computer, Inc.']
    ] }
  ];
  const groupsWithQuotes = groups.map(group => ({ ...group, companies: group.companies.map(([id, name]) => ({
    id, symbol:id.split(':')[1], name, price:null, changePercent:null, currency:'USD', quoteTime:null, receivedAt:null, stale:false
  })) }));
  const all = groupsWithQuotes.flatMap(group => group.companies);
  const rotation = [all.find(quote => quote.symbol === 'NVDA'), ...all.filter(quote => quote.symbol !== 'NVDA')];
  const money = new Intl.NumberFormat('en-US', { style:'currency', currency:'USD', minimumFractionDigits:2, maximumFractionDigits:2 });
  const make = (tag, className, text) => {
    const node = document.createElement(tag);
    if (className) node.className = className;
    if (text) node.textContent = text;
    return node;
  };
  const root = make('details', 'ai-markets');
  const trigger = make('summary', 'markets-pill');
  trigger.title = 'Connecting to Finnhub · Click to expand';
  const symbol = make('span', 'markets-symbol');
  const price = make('span', 'markets-price');
  const change = make('span', 'markets-change');
  const quoteContent = make('span', 'markets-quote');
  quoteContent.append(symbol, price, change);
  trigger.append(quoteContent);
  const panel = make('section', 'markets-panel');
  panel.id = 'ai-markets-panel';
  panel.setAttribute('aria-labelledby', 'markets-title');
  trigger.setAttribute('aria-controls', panel.id);
  const top = make('div', 'markets-panel-heading');
  const heading = make('div');
  const title = make('h2', 'markets-title', 'AI markets');
  title.id = 'markets-title';
  heading.append(title, make('p', 'markets-caption', '33 companies · USD'));
  const close = make('button', 'markets-close');
  close.type = 'button'; close.setAttribute('aria-label', 'Close stock watchlist');
  const cross = make('span', '', '×'); cross.setAttribute('aria-hidden', 'true'); close.append(cross);
  top.append(heading, close);
  const list = make('div', 'markets-list');
  list.tabIndex = 0; list.setAttribute('aria-label', 'All 33 companies; scroll to explore');
  const rows = new Map();
  const tooltip = make('span', 'markets-tooltip');
  tooltip.id = 'markets-company-tooltip';
  tooltip.setAttribute('role', 'tooltip');
  tooltip.hidden = true;
  let tooltipRow, showTooltipTimer, hideTooltipTimer;
  function hideTooltip() {
    clearTimeout(showTooltipTimer);
    clearTimeout(hideTooltipTimer);
    tooltipRow?.removeAttribute('aria-describedby');
    tooltipRow = null;
    tooltip.hidden = true;
  }
  function positionTooltip() {
    if (!tooltipRow || tooltip.hidden) return;
    const anchor = tooltipRow.querySelector('.markets-symbol').getBoundingClientRect();
    const bounds = tooltip.getBoundingClientRect();
    tooltip.style.left = Math.max(8, Math.min(anchor.left, window.innerWidth - bounds.width - 8)) + 'px';
    tooltip.style.top = (anchor.top - bounds.height - 8 >= 8 ? anchor.top - bounds.height - 8 : anchor.bottom + 8) + 'px';
  }
  function showTooltip(row, name, immediate = false) {
    hideTooltip();
    tooltipRow = row;
    showTooltipTimer = setTimeout(() => {
      if (!root.open || tooltipRow !== row) return;
      tooltip.textContent = name;
      tooltip.hidden = false;
      row.setAttribute('aria-describedby', tooltip.id);
      positionTooltip();
    }, immediate ? 0 : 260);
  }
  function leaveTooltip() {
    clearTimeout(showTooltipTimer);
    clearTimeout(hideTooltipTimer);
    if (tooltipRow?.matches(':focus-visible')) return;
    hideTooltipTimer = setTimeout(hideTooltip, 120);
  }
  tooltip.addEventListener('pointerenter', () => clearTimeout(hideTooltipTimer));
  tooltip.addEventListener('pointerleave', leaveTooltip);
  function repositionTooltip() {
    if (!tooltipRow || tooltip.hidden) return;
    const rowBounds = tooltipRow.getBoundingClientRect();
    const listBounds = list.getBoundingClientRect();
    if (rowBounds.bottom <= listBounds.top || rowBounds.top >= listBounds.bottom) hideTooltip();
    else positionTooltip();
  }
  list.addEventListener('scroll', () => {
    if (tooltipRow?.matches(':focus-visible')) repositionTooltip();
    else hideTooltip();
  }, { passive:true });
  window.addEventListener('resize', repositionTooltip);
  window.addEventListener('scroll', repositionTooltip, { passive:true });
  function hasQuote(quote) { return Number.isFinite(quote.price) && Number.isFinite(quote.changePercent); }
  function paintChange(node, quote) {
    if (!hasQuote(quote)) {
      node.dataset.direction = 'missing';
      node.textContent = '—';
      node.setAttribute('aria-label', 'Quote unavailable');
      return;
    }
    const direction = quote.changePercent > 0 ? 'up' : quote.changePercent < 0 ? 'down' : 'flat';
    node.dataset.direction = direction;
    node.replaceChildren();
    const marker = make('span', 'markets-direction');
    marker.setAttribute('aria-hidden', 'true');
    node.append(marker, make('span', '', Math.abs(quote.changePercent).toFixed(2) + '%'));
    node.setAttribute('aria-label', (direction === 'flat' ? 'Unchanged, ' : direction + ' ') + Math.abs(quote.changePercent).toFixed(2) + ' percent');
  }
  groupsWithQuotes.forEach(group => {
    const section = make('section', 'markets-group');
    const groupTitle = make('h3', '', group.key === 'chips' ? 'Semiconductors' : group.label);
    section.append(groupTitle);
    group.companies.forEach(quote => {
      const row = make('button', 'markets-row');
      row.type = 'button';
      row.dataset.symbol = quote.symbol;
      const rowChange = make('span', 'markets-change'); paintChange(rowChange, quote);
      row.setAttribute('aria-label', 'Show ' + quote.name + ' in the ticker. Quote unavailable.');
      row.append(make('span', 'markets-symbol', quote.symbol), make('span', 'markets-price', '—'), rowChange);
      row.addEventListener('pointerenter', event => { if (event.pointerType !== 'touch') showTooltip(row, quote.name); });
      row.addEventListener('pointerleave', leaveTooltip);
      row.addEventListener('focus', () => { if (row.matches(':focus-visible')) showTooltip(row, quote.name, true); });
      row.addEventListener('blur', hideTooltip);
      row.addEventListener('click', () => {
        index = rotation.indexOf(quote);
        paused = true;
        renderQuote();
        dismiss(true);
      });
      rows.set(quote.symbol, row); section.append(row);
    });
    list.append(section);
  });
  const footer = make('div', 'markets-panel-footer');
  const notice = make('span', 'markets-feed-status', 'Connecting to Finnhub…');
  const pause = make('button', 'markets-pause');
  pause.type = 'button';
  footer.append(notice, pause);
  panel.append(top, list, footer);
  root.append(trigger, panel, tooltip);
  const holder = make('div', 'markets-header-control');
  holder.append(root);
  header.append(holder); header.classList.add('has-markets');

  const reduced = matchMedia('(prefers-reduced-motion: reduce)');
  let index = 0, timer, hovered = false, rotationEffect, transitionID = 0;
  let feedStatus = 'loading', checkedAt = null, fetching = false, refreshTimer, refreshMs = 75000;
  let paused = reduced.matches || document.querySelector('.motion-control')?.getAttribute('aria-pressed') === 'true';
  function renderQuote() {
    const quote = rotation[index];
    symbol.textContent = quote.symbol;
    price.textContent = hasQuote(quote) ? money.format(quote.price) : '—';
    price.dataset.stale = String(quote.stale);
    paintChange(change, quote);
    trigger.setAttribute('aria-label', quote.name + ', ' + (hasQuote(quote) ? money.format(quote.price) + ', ' + change.getAttribute('aria-label') + (quote.stale ? ', older quote' : '') : 'quote unavailable') + '. Expand all AI stocks.');
    trigger.title = quote.name + ' · ' + (quote.quoteTime ? 'Quote as of ' + new Date(quote.quoteTime).toLocaleString() + (quote.stale ? ' · Older data' : '') : 'Quote unavailable') + ' · Finnhub';
    rows.forEach((row, key) => row.setAttribute('aria-pressed', String(key === quote.symbol)));
  }
  function cancelQuoteTransition() {
    transitionID++;
    rotationEffect?.cancel();
    rotationEffect = null;
  }
  async function switchQuote(nextIndex) {
    cancelQuoteTransition();
    const current = transitionID;
    if (reduced.matches || typeof quoteContent.animate !== 'function') {
      index = nextIndex;
      renderQuote();
      return;
    }
    try {
      const exit = quoteContent.animate([
        {opacity:1, transform:'translateY(0)'},
        {opacity:0, transform:'translateY(-2px)'}
      ], {duration:140, easing:'ease-in', fill:'forwards'});
      rotationEffect = exit;
      await exit.finished;
      if (current !== transitionID) return;
      index = nextIndex;
      renderQuote();
      const enter = quoteContent.animate([
        {opacity:0, transform:'translateY(2px)'},
        {opacity:1, transform:'translateY(0)'}
      ], {duration:220, easing:'cubic-bezier(.2,.65,.3,1)'});
      rotationEffect = enter;
      exit.cancel();
      await enter.finished;
    } catch {
      // Hover, focus, selection and motion preferences may cancel a transition.
    } finally {
      if (current === transitionID) {
        rotationEffect?.cancel();
        rotationEffect = null;
      }
    }
  }
  function schedule() {
    clearTimeout(timer);
    pause.textContent = paused ? 'Resume rotation' : 'Pause rotation';
    pause.setAttribute('aria-pressed', String(paused));
    if (paused || root.open || hovered || root.matches(':focus-within') || document.hidden || all.filter(hasQuote).length < 2) {
      cancelQuoteTransition();
      return;
    }
    timer = setTimeout(async () => {
      let next = index;
      do { next = (next + 1) % rotation.length; } while (!hasQuote(rotation[next]));
      await switchQuote(next);
      schedule();
    }, 5000);
  }
  function dismiss(restoreFocus = false) {
    hideTooltip();
    root.open = false;
    trigger.setAttribute('aria-expanded', 'false');
    if (restoreFocus) trigger.focus({ preventScroll:true });
    schedule();
  }
  root.addEventListener('toggle', () => {
    if (!root.open) hideTooltip();
    trigger.setAttribute('aria-expanded', String(root.open));
    schedule();
  });
  close.addEventListener('click', () => dismiss(true));
  pause.addEventListener('click', () => { paused = !paused; schedule(); });
  root.addEventListener('pointerenter', () => { hovered = true; schedule(); });
  root.addEventListener('pointerleave', () => { hovered = false; schedule(); });
  root.addEventListener('focusin', schedule);
  root.addEventListener('focusout', event => { if (!root.contains(event.relatedTarget)) dismiss(); });
  document.addEventListener('pointerdown', event => { if (!root.contains(event.target)) dismiss(); });
  document.addEventListener('keydown', event => {
    if (event.key === 'Escape' && root.open) { event.preventDefault(); dismiss(true); }
  });
  document.addEventListener('visibilitychange', () => { schedule(); clearTimeout(refreshTimer); if (!document.hidden) refreshQuotes(); });
  reduced.addEventListener('change', () => { paused = reduced.matches; schedule(); });
  document.querySelector('.motion-control')?.addEventListener('click', () => {
    queueMicrotask(() => { paused = document.querySelector('.motion-control').getAttribute('aria-pressed') === 'true'; schedule(); });
  });
  trigger.setAttribute('aria-expanded', 'false');
  function renderRows() {
    all.forEach(quote => {
      const row = rows.get(quote.symbol);
      row.querySelector('.markets-price').textContent = hasQuote(quote) ? money.format(quote.price) : '—';
      row.dataset.stale = String(quote.stale);
      paintChange(row.querySelector('.markets-change'), quote);
      row.setAttribute('aria-label', 'Show ' + quote.name + ' in the ticker. ' + (hasQuote(quote) ? money.format(quote.price) + ', ' + row.querySelector('.markets-change').getAttribute('aria-label') + (quote.stale ? ', older quote' : '') : 'Quote unavailable.'));
    });
  }
  function renderFeedStatus() {
    const labels = {
      loading:'Connecting to Finnhub…', configuration_required:'Feed not connected',
      authentication_failed:'Feed unavailable', rate_limited:'Feed paused · retrying',
      unavailable:'Quotes unavailable', stale:'Finnhub · older quotes', partial:'Finnhub · some quotes unavailable'
    };
    notice.textContent = labels[feedStatus] || 'Finnhub · checked ' + (checkedAt ? new Date(checkedAt).toLocaleTimeString([], {hour:'2-digit',minute:'2-digit'}) : 'just now');
    notice.title = checkedAt ? 'Last checked ' + new Date(checkedAt).toLocaleString() + '. Individual quote times are available on the ticker. Market sessions and provider entitlements affect freshness.' : 'Market data has not connected yet.';
    root.dataset.feedStatus = feedStatus;
  }
  async function refreshQuotes() {
    if (fetching || document.hidden) return;
    fetching = true;
    clearTimeout(refreshTimer);
    try {
      const response = await fetch('/api/ai-markets', {cache:'no-store', credentials:'same-origin', signal:AbortSignal.timeout(30000)});
      const data = await response.json();
      const statuses = ['ok','partial','stale','configuration_required','authentication_failed','rate_limited','unavailable'];
      if (data.provider !== 'Finnhub' || !Array.isArray(data.quotes) || !statuses.includes(data.status)) throw Error('Invalid market feed');
      const incoming = new Map(data.quotes.filter(quote =>
        typeof quote.symbol === 'string' && quote.currency === 'USD' && Number.isFinite(quote.price) && quote.price > 0 && Number.isFinite(quote.changePercent) && Number.isFinite(Date.parse(quote.quoteTime)) && Number.isFinite(Date.parse(quote.receivedAt))
      ).map(quote => [quote.symbol, quote]));
      all.forEach(quote => {
        const next = incoming.get(quote.symbol);
        Object.assign(quote, next ? {price:next.price, changePercent:next.changePercent, quoteTime:next.quoteTime, receivedAt:next.receivedAt, stale:next.stale === true} : {price:null, changePercent:null, quoteTime:null, receivedAt:null, stale:false});
      });
      feedStatus = data.status;
      checkedAt = data.checkedAt;
      refreshMs = Math.max(75000, Math.min(Number(data.refreshAfterMs) || 75000, 300000));
    } catch {
      all.forEach(quote => {
        if (quote.receivedAt && Date.now() - Date.parse(quote.receivedAt) <= 900000) quote.stale = true;
        else Object.assign(quote, {price:null, changePercent:null, quoteTime:null, receivedAt:null, stale:false});
      });
      feedStatus = all.some(hasQuote) ? 'stale' : 'unavailable';
    } finally {
      fetching = false;
      renderRows(); renderQuote(); renderFeedStatus(); schedule();
      if (!document.hidden) refreshTimer = setTimeout(refreshQuotes, refreshMs);
    }
  }
  renderRows(); renderQuote(); renderFeedStatus(); schedule();
  refreshQuotes();
})();
