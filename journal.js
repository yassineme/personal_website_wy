(() => {
  const controls = document.querySelector('.journal-controls');
  if (controls) {
    const search = document.querySelector('#journal-search');
    const rows = [...document.querySelectorAll('.journal-row')];
    const buttons = [...document.querySelectorAll('.topic-button')];
    const empty = document.querySelector('.empty-state');
    const count = document.querySelector('#reading-count');
    let topic = 'All';
    const normalise = value => value.normalize('NFKD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
    const filter = () => {
      const words = normalise(search.value.trim()).split(/\s+/).filter(Boolean);
      let visible = 0;
      rows.forEach(row => {
        const matches = (topic === 'All' || row.dataset.category === topic) && words.every(word => normalise((row.dataset.search || '') + ' ' + row.textContent).includes(word));
        row.hidden = !matches;
        if (matches) visible++;
      });
      empty.hidden = visible !== 0;
      count.textContent = `${visible} ${visible === 1 ? 'note' : 'notes'}${topic === 'All' && !words.length ? ' to explore' : ' found'}`;
    };
    buttons.forEach(button => button.addEventListener('click', () => {
      topic = button.dataset.topic;
      buttons.forEach(item => item.setAttribute('aria-pressed', String(item === button)));
      filter();
    }));
    search.addEventListener('input', filter);
    document.querySelector('.clear-filters').addEventListener('click', () => {
      topic = 'All';
      search.value = '';
      buttons.forEach(button => button.setAttribute('aria-pressed', String(button.dataset.topic === 'All')));
      filter();
      search.focus();
    });
    controls.hidden = false;
  }

  const body = document.querySelector('.article-body');
  const progress = document.querySelector('.article-progress');
  if (body && progress) {
    let scheduled = false;
    const update = () => {
      const start = body.getBoundingClientRect().top + window.scrollY;
      const distance = Math.max(1, body.offsetHeight - innerHeight * .65);
      const ratio = Math.max(0, Math.min(1, (scrollY - start + innerHeight * .25) / distance));
      progress.style.width = `${ratio * 100}%`;
      scheduled = false;
    };
    const requestUpdate = () => { if (!scheduled) { scheduled = true; requestAnimationFrame(update); } };
    window.addEventListener('scroll', requestUpdate, {passive:true});
    window.addEventListener('resize', requestUpdate);
    update();
    const links = [...document.querySelectorAll('.article-toc a')];
    const headings = links.map(link => document.getElementById(link.hash.slice(1))).filter(Boolean);
    links.forEach(link => link.addEventListener('click', () => {
      links.forEach(item => { if (item === link) item.setAttribute('aria-current','location'); else item.removeAttribute('aria-current'); });
    }));
    if ('IntersectionObserver' in window) {
      const observer = new IntersectionObserver(entries => {
        const visible = entries.filter(entry => entry.isIntersecting).sort((a,b) => a.boundingClientRect.top - b.boundingClientRect.top);
        if (!visible.length) return;
        const id = visible[0].target.id;
        links.forEach(link => { if (link.hash === '#' + id) link.setAttribute('aria-current','location'); else link.removeAttribute('aria-current'); });
      }, {rootMargin:'-10% 0px -55% 0px'});
      headings.forEach(heading => observer.observe(heading));
    }
  }

  const copy = document.querySelector('.copy-article');
  if (copy) copy.addEventListener('click', async () => {
    const url = document.querySelector('link[rel="canonical"]').href;
    const status = document.querySelector('.article-copy-status');
    const fallback = document.querySelector('.article-copy-fallback');
    fallback.hidden = true;
    try {
      if (!navigator.clipboard || !isSecureContext) throw new Error('Clipboard unavailable');
      await navigator.clipboard.writeText(url);
      status.textContent = 'Article link copied.';
    } catch {
      const field = fallback.querySelector('input');
      field.value = url;
      fallback.hidden = false;
      field.focus();
      field.select();
      status.textContent = 'Select the link and copy it.';
    }
  });
})();
