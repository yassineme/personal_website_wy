(() => {
  const presets = {
    'manrope-newsreader': {title:'Manrope + Newsreader',sans:'Manrope',serif:'Newsreader',description:'An alternative with a firmer geometric headline structure and the same warm Newsreader reading face.'},
    'instrument-newsreader': {title:'Instrument Sans + Newsreader',sans:'Instrument Sans',serif:'Newsreader',description:'Your selected pairing. Instrument Sans keeps the headings and interface calm, clear and assured; Newsreader adds the warm editorial reading experience and expressive accents.'},
    'sora-source-serif': {title:'Sora + Source Serif 4',sans:'Sora',serif:'Source Serif 4',description:'The most architectural option. Sora creates a precise, technical headline voice, while Source Serif 4 gives articles a more grounded reading rhythm.'}
  };
  const views = {home:{url:'index.html',name:'Homepage'},blog:{url:'blog.html',name:'Blog'},article:{url:'blog/ai-roadmap-prioritisation.html',name:'Article'}};
  let selected = 'instrument-newsreader';
  let view = 'home';
  const frame = document.getElementById('type-frame');
  const update = () => {
    const preset = presets[selected];
    const page = views[view];
    const url = page.url + '?font=' + selected;
    document.getElementById('direction-title').textContent = preset.title;
    document.getElementById('direction-rationale').textContent = preset.description;
    document.getElementById('heading-choice').textContent = preset.sans + ' / 600';
    document.getElementById('body-choice').textContent = preset.serif + ' / 20–21 px';
    document.getElementById('ui-choice').textContent = preset.sans + ' / 500–600';
    document.getElementById('accent-choice').textContent = preset.serif + ' italic / 500';
    document.querySelectorAll('[data-font]').forEach(button => button.setAttribute('aria-pressed',String(button.dataset.font === selected)));
    document.querySelectorAll('[data-view]').forEach(button => button.setAttribute('aria-pressed',String(button.dataset.view === view)));
    frame.src = url;
    frame.title = page.name + ' preview — ' + preset.title;
    document.getElementById('open-type-preview').href = url;
    document.getElementById('preview-caption').textContent = page.name + ' · ' + preset.title;
  };
  document.querySelectorAll('[data-font]').forEach(button => button.addEventListener('click', () => { selected = button.dataset.font; update(); }));
  document.querySelectorAll('[data-view]').forEach(button => button.addEventListener('click', () => { view = button.dataset.view; update(); }));
})();
