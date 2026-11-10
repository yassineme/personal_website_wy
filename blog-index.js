(() => {
  'use strict';
  const canvas = document.getElementById('journal-orbit');
  if (!canvas) return;
  const context = canvas.getContext('2d');
  if (!context) return;
  const field = canvas.parentElement;
  const control = field.querySelector('.field-motion');
  const media = matchMedia('(prefers-reduced-motion: reduce)');
  let paused = media.matches, visible = true, frame = 0, last = 0;
  let width = 0, height = 0, angle = .45, pointer = 0, drift = 0;
  const points = [];
  // A deterministic spherical field, related to the homepage's particle sculpture.
  const count = 920, goldenAngle = Math.PI * (3 - Math.sqrt(5));
  for (let i = 0; i < count; i++) {
    const y = 1 - (i / (count - 1)) * 2;
    const radius = Math.sqrt(1 - y * y), theta = goldenAngle * i;
    points.push([Math.cos(theta) * radius, y, Math.sin(theta) * radius]);
  }
  function project(x, y, z) {
    const ca = Math.cos(angle + drift), sa = Math.sin(angle + drift);
    const xx = x * ca + z * sa, zz = z * ca - x * sa;
    const ct = Math.cos(-.4), st = Math.sin(-.4);
    const yy = y * ct - zz * st, depth = y * st + zz * ct;
    const perspective = 3.8 / (3.8 + depth), scale = Math.min(width * .34, height * .33);
    return [width * .51 + xx * scale * perspective, height * .5 + yy * scale * perspective, depth, perspective];
  }
  function draw() {
    context.clearRect(0, 0, width, height);
    const ink = getComputedStyle(canvas).color;
    context.fillStyle = ink; context.strokeStyle = ink;
    // Fine orbital trajectories pass through the field rather than a boxed illustration.
    for (let orbit = 0; orbit < 3; orbit++) {
      context.beginPath();
      for (let i = 0; i <= 160; i++) {
        const t = i / 160 * Math.PI * 2, tilt = orbit * .85 + .2;
        const [x,y] = project(Math.cos(t) * 1.24, Math.sin(t) * Math.cos(tilt) * 1.24, Math.sin(t) * Math.sin(tilt) * 1.24);
        if (i === 0) context.moveTo(x,y); else context.lineTo(x,y);
      }
      context.globalAlpha = .13; context.lineWidth = .65; context.stroke();
    }
    for (const point of points) {
      const [x,y,depth,perspective] = project(...point);
      context.globalAlpha = .12 + (.9 - depth) * .24;
      const size = (depth < 0 ? 1.35 : .8) * perspective;
      context.fillRect(x,y,size,size);
    }
    // An off-axis satellite is the only solid mark in the field.
    const [x,y] = project(Math.cos(angle * 1.7) * 1.24, Math.sin(angle * 1.7) * 1.24, 0);
    context.globalAlpha = .9; context.beginPath(); context.arc(x,y,3,0,Math.PI * 2); context.fill();
    context.globalAlpha = 1;
  }
  function tick(time) {
    frame = 0;
    if (paused || !visible || document.hidden) { last = 0; return; }
    const dt = Math.min(last ? time - last : 16, 50);
    last = time;
    angle += dt * .000075;
    drift += (pointer - drift) * (1 - Math.exp(-dt / 500));
    draw(); frame = requestAnimationFrame(tick);
  }
  function sync() {
    cancelAnimationFrame(frame); frame = 0; last = 0;
    control.textContent = paused ? 'Resume motion' : 'Pause motion';
    control.setAttribute('aria-pressed', String(paused));
    if (!paused && visible && !document.hidden) frame = requestAnimationFrame(tick);
    else draw();
  }
  function resize() {
    const bounds = field.getBoundingClientRect();
    width = bounds.width; height = bounds.height;
    const ratio = Math.min(devicePixelRatio || 1, 2);
    canvas.width = Math.round(width * ratio); canvas.height = Math.round(height * ratio);
    context.setTransform(ratio,0,0,ratio,0,0); draw();
  }
  field.addEventListener('pointermove', event => {
    if (event.pointerType === 'touch' || paused) return;
    const bounds = field.getBoundingClientRect();
    pointer = ((event.clientX - bounds.left) / Math.max(bounds.width,1) - .5) * .7;
  });
  field.addEventListener('pointerleave', () => { pointer = 0; });
  control.addEventListener('click', () => { paused = !paused; sync(); });
  media.addEventListener('change', () => { paused = media.matches; sync(); });
  document.addEventListener('visibilitychange', sync);
  new IntersectionObserver(entries => { visible = entries[0].isIntersecting; sync(); }).observe(field);
  new ResizeObserver(resize).observe(field);
  window.addEventListener('pagehide', () => { cancelAnimationFrame(frame); frame = 0; });
  window.addEventListener('pageshow', sync);
  control.hidden = false;
  resize(); sync();
})();
