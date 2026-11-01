(() => {
  'use strict';
  const photos = window.PHOTOGRAPHY || [];
  const gallery = document.querySelector('#photographs');
  const viewer = document.querySelector('#photo-viewer');
  const image = document.querySelector('#viewer-image');
  const caption = document.querySelector('#viewer-caption');
  const counter = document.querySelector('#viewer-counter');
  const about = document.querySelector('#about-photography');
  const aboutToggle = document.querySelector('.about-toggle');
  const credits = document.querySelector('#photo-credits');
  const stage = document.querySelector('#viewer-stage');
  const wings = document.querySelector('#viewer-wings');
  const context = wings.getContext('2d');
  const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
  const cache = new Map();
  const blurredWings = new WeakMap();
  const wingSurface = document.createElement('canvas');
  const wingPaint = wingSurface.getContext('2d');
  let current = 0;
  let displayed = 0;
  let generation = 0;
  let edgeFrame = 0;
  let drag = null;
  let wingWidth = 0;
  let wheelTotal = 0;
  let lastWheel = 0;
  let lastWheelNavigation = 0;
  let transition = null;

  const wrap = index => (index + photos.length) % photos.length;
  function load(index) {
    const photo = photos[wrap(index)];
    if (!cache.has(photo.src)) {
      const asset = new Image();
      asset.decoding = 'async';
      asset.src = photo.src;
      asset.addEventListener('load', () => { if (viewer.open) drawWings(); });
      cache.set(photo.src, asset);
    }
    return cache.get(photo.src);
  }
  function fitSize(asset) {
    const mobile = innerWidth <= 700;
    const width = Math.max(1, mobile ? stage.clientWidth - 64 : stage.clientWidth * .66);
    const height = Math.max(1, stage.clientHeight * (mobile ? 1 : .70));
    const scale = Math.min(width / asset.naturalWidth, height / asset.naturalHeight);
    return {width: asset.naturalWidth * scale, height: asset.naturalHeight * scale};
  }
  // Two cached textures let blur grow around the bend and settle again on
  // the smaller inner face, matching the reference's directional streaking.
  function wingSource(asset, spread) {
    let textures = blurredWings.get(asset);
    if (!textures) { textures = new Map(); blurredWings.set(asset, textures); }
    if (textures.has(spread)) return textures.get(spread);
    const surface = document.createElement('canvas');
    surface.width = Math.min(640, asset.naturalWidth);
    surface.height = Math.max(1, Math.round(surface.width * asset.naturalHeight / asset.naturalWidth));
    const paint = surface.getContext('2d');
    if (!paint) return asset;
    const weights = Array.from({length:25}, (_, i) => Math.exp(-.5 * Math.pow((i - 12) / 5, 2)));
    const total = weights.reduce((sum, weight) => sum + weight, 0);
    paint.filter = 'blur(.7px)';
    paint.globalCompositeOperation = 'lighter';
    weights.forEach((weight, index) => {
      paint.globalAlpha = weight / total;
      paint.drawImage(asset, (index - 12) / 12 * spread - 88, -2, surface.width + 176, surface.height + 4);
    });
    textures.set(spread, surface);
    return surface;
  }
  function wingTexture(asset, side) {
    const soft = wingSource(asset, 8), streaked = wingSource(asset, 86);
    const textures = blurredWings.get(asset), key = side < 0 ? 'left' : 'right';
    if (textures?.has(key)) return textures.get(key);
    const mixed = document.createElement('canvas'), mask = document.createElement('canvas');
    mixed.width = mask.width = soft.width;
    mixed.height = mask.height = soft.height;
    const paint = mixed.getContext('2d'), maskPaint = mask.getContext('2d');
    if (!paint || !maskPaint) return soft;
    maskPaint.drawImage(streaked, 0, 0);
    maskPaint.globalCompositeOperation = 'destination-in';
    const gradient = maskPaint.createLinearGradient(side < 0 ? 0 : mask.width, 0, side < 0 ? mask.width : 0, 0);
    [[0,.22],[.25,.35],[.4,.8],[.57,1],[.75,.8],[.86,.45],[1,.24]].forEach(([stop, alpha]) => gradient.addColorStop(stop, `rgba(255,255,255,${alpha})`));
    maskPaint.fillStyle = gradient;
    maskPaint.fillRect(0, 0, mask.width, mask.height);
    paint.drawImage(soft, 0, 0);
    paint.drawImage(mask, 0, 0);
    textures?.set(key, mixed);
    return mixed;
  }
  function paintWing(asset, side, width, height, pulse, opacity = 1) {
    if (!context || !wingPaint || !asset.complete || !asset.naturalWidth) return;
    const texture = wingTexture(asset, side);
    const sourceWidth = texture.width || texture.naturalWidth;
    const sourceHeight = texture.height || texture.naturalHeight;
    const ratio = Math.min(window.devicePixelRatio || 1, 1.5);
    const bufferWidth = Math.ceil(wingWidth * ratio), bufferHeight = Math.ceil(height * ratio);
    if (wingSurface.width !== bufferWidth || wingSurface.height !== bufferHeight) {
      wingSurface.width = bufferWidth; wingSurface.height = bufferHeight;
    }
    wingPaint.setTransform(ratio, 0, 0, ratio, 0, 0);
    wingPaint.clearRect(0, 0, wingWidth, height);
    const currentAsset = load(current);
    const mainHeight = currentAsset.naturalWidth ? fitSize(currentAsset).height : height;
    const faceHeight = Math.min(height * .64, Math.max(height * .26, mainHeight * .66));
    const centerY = height / 2;
    // The last third is a flat, recessed face. A smooth shoulder expands from
    // that face to the oversized outer plane; it is not a continuous bowl.
    // The reference's shoulder is an S curve, meeting the inner face with a
    // horizontal tangent. Extrapolate the outer plane beyond the viewport.
    const curveHeight = u => {
      const t = Math.min(1, u / .75);
      const shoulder = 1 - t * t * (3 - 2 * t);
      return faceHeight + (height * (1.38 + pulse * .15) - faceHeight) * shoulder;
    };
    const radius = Math.min(9, wingWidth * .07);
    const faceTop = centerY - faceHeight / 2, faceBottom = centerY + faceHeight / 2;
    const shape = new Path2D();
    shape.moveTo(0, centerY - curveHeight(0) / 2);
    for (let x = 1; x <= Math.max(0, wingWidth - radius); x++) shape.lineTo(x, centerY - curveHeight(x / wingWidth) / 2);
    shape.lineTo(wingWidth - radius, faceTop);
    shape.quadraticCurveTo(wingWidth, faceTop, wingWidth, faceTop + radius);
    shape.lineTo(wingWidth, faceBottom - radius);
    shape.quadraticCurveTo(wingWidth, faceBottom, wingWidth - radius, faceBottom);
    for (let x = Math.floor(wingWidth - radius); x >= 0; x--) shape.lineTo(x, centerY + curveHeight(x / wingWidth) / 2);
    shape.closePath();
    wingPaint.save();
    wingPaint.clip(shape);
    // Composite the finished surface once, avoiding the striped transparency
    // artefacts produced by overlapping translucent image strips.
    const strips = Math.max(64, Math.ceil(wingWidth * ratio));
    for (let i = 0; i < strips; i++) {
      const u = i / strips, next = (i + 1) / strips;
      const x = u * wingWidth;
      const stripHeight = curveHeight((u + next) / 2);
      // Projective UV compression moves the subject onto the smaller inner
      // face instead of stretching the entire photograph uniformly like fabric.
      const project = t => t * t;
      const leftU = project(u), rightU = project(next);
      const sourceU = side < 0 ? leftU : 1 - rightU;
      const args = [sourceU * sourceWidth, 0, Math.max(.05, (rightU - leftU) * sourceWidth), sourceHeight,
        x, centerY - stripHeight / 2, wingWidth / strips + .6, stripHeight];
      wingPaint.globalAlpha = 1;
      wingPaint.drawImage(texture, ...args);
    }
    wingPaint.globalAlpha = 1;
    const shade = wingPaint.createLinearGradient(0, 0, wingWidth, 0);
    shade.addColorStop(0, '#0b0c0c18');
    shade.addColorStop(.62, '#0b0c0c00');
    shade.addColorStop(1, '#0b0c0c10');
    wingPaint.fillStyle = shade;
    wingPaint.fillRect(0, 0, wingWidth, height);
    wingPaint.restore();
    context.save();
    if (side > 0) { context.translate(width, 0); context.scale(-1, 1); }
    // A narrow halo uses the photograph's own edge colors. UI remains neutral.
    context.globalAlpha = opacity * .5;
    context.filter = 'blur(2px)';
    context.drawImage(wingSurface, 0, 0, bufferWidth, bufferHeight, 0, 0, wingWidth, height);
    context.filter = 'none';
    context.globalAlpha = opacity;
    context.drawImage(wingSurface, 0, 0, bufferWidth, bufferHeight, 0, 0, wingWidth, height);
    context.restore();
  }
  // Phone previews are cropped flat cards, never stretched canvas wings.
  function paintMobilePreview(asset, side, width, height, mainHeight, opacity = 1) {
    if (!asset.complete || !asset.naturalWidth) return;
    const cardWidth = width - 64;
    const cardHeight = Math.min(height * .8, mainHeight * .88);
    const scale = Math.max(cardWidth / asset.naturalWidth, cardHeight / asset.naturalHeight);
    const sourceWidth = cardWidth / scale, sourceHeight = cardHeight / scale;
    const x = side < 0 ? 20 - cardWidth : width - 20;
    context.save();
    context.globalAlpha = opacity * .55;
    context.drawImage(asset, (asset.naturalWidth - sourceWidth) / 2, (asset.naturalHeight - sourceHeight) / 2,
      sourceWidth, sourceHeight, x, (height - cardHeight) / 2, cardWidth, cardHeight);
    context.restore();
  }
  function drawWings(time = performance.now()) {
    cancelAnimationFrame(edgeFrame);
    if (!viewer.open || !context) return;
    const width = stage.clientWidth, height = stage.clientHeight;
    const ratio = Math.min(window.devicePixelRatio || 1, 1.5);
    if (wings.width !== Math.round(width * ratio) || wings.height !== Math.round(height * ratio)) {
      wings.width = Math.round(width * ratio);
      wings.height = Math.round(height * ratio);
    }
    context.setTransform(ratio, 0, 0, ratio, 0, 0);
    context.clearRect(0, 0, width, height);
    const asset = load(current);
    const size = asset.naturalWidth ? fitSize(asset) : {width:width * .65};
    if (width <= 700) {
      wingWidth = 20;
      stage.style.setProperty('--wing-width', '20px');
      if (photos.length > 1) {
        paintMobilePreview(load(current - 1), -1, width, height, size.height || height);
        paintMobilePreview(load(current + 1), 1, width, height, size.height || height);
      }
      return;
    }
    const gap = Math.max(36, width * .055);
    const targetWidth = Math.max(0, Math.min(width * .315, (width - size.width) / 2 - gap));
    let pulse = drag ? Math.min(Math.abs(drag.dx) / 180, 1) : 0;
    let mix = 1;
    wingWidth = targetWidth;
    if (transition && !reducedMotion.matches) {
      const progress = Math.min((time - transition.start) / transition.duration, 1);
      mix = 1 - Math.pow(1 - progress, 3);
      pulse = Math.sin(progress * Math.PI);
      wingWidth = transition.fromWidth + (targetWidth - transition.fromWidth) * mix;
      if (progress < 1) edgeFrame = requestAnimationFrame(drawWings);
      else transition = null;
    }
    stage.style.setProperty('--wing-width', `${Math.max(0, wingWidth)}px`);
    if (photos.length > 1 && wingWidth > 2) {
      if (transition) {
        paintWing(load(transition.fromIndex - 1), -1, width, height, pulse, 1 - mix);
        paintWing(load(transition.fromIndex + 1), 1, width, height, pulse, 1 - mix);
      }
      paintWing(load(current - 1), -1, width, height, pulse, mix);
      paintWing(load(current + 1), 1, width, height, pulse, mix);
    }
  }
  async function show(index, direction = 0) {
    if (!photos.length) return;
    current = wrap(index);
    const token = ++generation;
    const photo = photos[current];
    const asset = load(current);
    load(current - 1); load(current + 1);
    try { await asset.decode(); } catch (_) {
      if (token === generation && viewer.open) counter.textContent = 'Photograph unavailable. Try the next image.';
      return;
    }
    if (token !== generation || !viewer.open) return;
    const mobile = stage.clientWidth <= 700;
    const dragOffset = parseFloat(image.style.translate) || 0;
    const slideDistance = stage.clientWidth - 52;
    const animate = Boolean(image.getAttribute('src')) && !reducedMotion.matches && direction !== 0;
    // Cancelling prior animations makes quick keyboard or button inputs responsive.
    image.getAnimations().forEach(animation => animation.cancel());
    stage.querySelectorAll('.viewer-outgoing').forEach(node => { node.getAnimations().forEach(animation => animation.cancel()); node.remove(); });
    if (animate) {
      const outgoing = image.cloneNode(false);
      outgoing.removeAttribute('id');
      outgoing.alt = '';
      outgoing.setAttribute('aria-hidden', 'true');
      outgoing.className = 'viewer-outgoing';
      outgoing.style.translate = '';
      image.parentElement.append(outgoing);
      const leaving = outgoing.animate([
        {opacity:1, transform:mobile ? `translateX(${dragOffset}px)` : 'translateX(0) rotateY(0deg) scale(1)'},
        {opacity:mobile ? 1 : 0, transform:mobile ? `translateX(${-direction * slideDistance}px)` : `translateX(${-direction * Math.min(stage.clientWidth * .3, 320)}px) rotateY(${-direction * 24}deg) scale(.78)`}
      ], {duration:mobile ? 360 : 620, easing:'cubic-bezier(.22,.7,.18,1)', fill:'forwards'});
      leaving.finished.then(() => outgoing.remove()).catch(() => outgoing.remove());
    }
    const previousIndex = displayed;
    displayed = current;
    image.src = photo.src;
    image.alt = photo.alt;
    image.style.translate = '';
    caption.textContent = `${photo.caption} — ${photo.credit}`;
    counter.textContent = `${String(current + 1).padStart(2, '0')} / ${String(photos.length).padStart(2, '0')}`;
    if (animate) {
      image.animate([
        {opacity:mobile ? 1 : 0, transform:mobile ? `translateX(${direction * slideDistance + dragOffset}px)` : `translateX(${direction * Math.min(stage.clientWidth * .25, 260)}px) rotateY(${direction * 20}deg) scale(.86)`},
        {opacity:1, transform:'translateX(0) rotateY(0deg) scale(1)'}
      ], {duration:mobile ? 360 : 720, easing:'cubic-bezier(.2,.75,.2,1)'});
      transition = mobile ? null : {start:performance.now(), duration:720, fromIndex:previousIndex, fromWidth:wingWidth};
      if (!reducedMotion.matches) caption.animate([{opacity:0},{opacity:1}], {duration:500});
    }
    drawWings();
  }
  function navigate(direction) { if (viewer.open && photos.length > 1) show(current + direction, direction); }
  photos.forEach((photo, index) => {
    const button = document.createElement('button');
    button.className = 'photograph';
    button.dataset.depth = [1,2,4,6,8].includes(index) ? 'front' : 'back';
    button.type = 'button';
    button.setAttribute('aria-label', `Open photograph ${index + 1}: ${photo.alt}`);
    const thumbnail = document.createElement('img');
    thumbnail.src = photo.src;
    thumbnail.alt = photo.alt;
    thumbnail.decoding = 'async';
    thumbnail.loading = index < 2 ? 'eager' : 'lazy';
    if (index === 0) thumbnail.fetchPriority = 'high';
    const number = document.createElement('span');
    number.className = 'image-number';
    number.textContent = `${String(index + 1).padStart(2, '0')} / View photograph `;
    const arrow = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    arrow.setAttribute('class', 'ui-arrow-icon');
    arrow.setAttribute('viewBox', '0 0 24 24');
    arrow.setAttribute('width', '1em');
    arrow.setAttribute('height', '1em');
    arrow.setAttribute('fill', 'none');
    arrow.setAttribute('stroke', 'currentColor');
    arrow.setAttribute('stroke-width', '1.5');
    arrow.setAttribute('stroke-linecap', 'round');
    arrow.setAttribute('stroke-linejoin', 'round');
    arrow.setAttribute('aria-hidden', 'true');
    arrow.setAttribute('focusable', 'false');
    const arrowPath = document.createElementNS('http://www.w3.org/2000/svg', 'path');
    arrowPath.setAttribute('d', 'M7 17 17 7M7 7h10v10');
    arrow.append(arrowPath);
    number.append(arrow);
    number.setAttribute('aria-hidden', 'true');
    button.append(thumbnail, number);
    button.addEventListener('click', () => { viewer.showModal(); show(index); });
    gallery.append(button);
    const item = document.createElement('li');
    const link = document.createElement('a');
    link.href = photo.creditUrl;
    link.target = '_blank';
    link.rel = 'noopener noreferrer';
    link.textContent = `${String(index + 1).padStart(2, '0')} — ${photo.credit}${photo.source ? ` / ${photo.source}` : ''}`;
    item.append(link);
    credits.append(item);
  });
  // One passive scroll listener and at most one queued frame. CSS controls
  // the three stacking planes; no animation loop runs when scrolling stops.
  let galleryFrame = 0;
  function updateGalleryScroll() {
    galleryFrame = 0;
    document.documentElement.style.setProperty('--gallery-scroll', `${reducedMotion.matches ? 0 : window.scrollY}px`);
    document.documentElement.style.setProperty('--gallery-haze', String(Math.min(1, window.scrollY / 110)));
  }
  function queueGalleryScroll() {
    if (!galleryFrame) galleryFrame = requestAnimationFrame(updateGalleryScroll);
  }
  window.addEventListener('scroll', queueGalleryScroll, {passive:true});
  window.addEventListener('resize', queueGalleryScroll);
  window.addEventListener('pageshow', queueGalleryScroll);
  reducedMotion.addEventListener('change', queueGalleryScroll);
  updateGalleryScroll();
  document.querySelector('#previous-photo').addEventListener('click', () => navigate(-1));
  document.querySelector('#next-photo').addEventListener('click', () => navigate(1));
  document.querySelector('#wing-previous').addEventListener('click', () => navigate(-1));
  document.querySelector('#wing-next').addEventListener('click', () => navigate(1));
  viewer.addEventListener('keydown', event => {
    if (event.key === 'ArrowRight') { event.preventDefault(); navigate(1); }
    if (event.key === 'ArrowLeft') { event.preventDefault(); navigate(-1); }
    if (event.key === 'Home') { event.preventDefault(); show(0, -1); }
    if (event.key === 'End') { event.preventDefault(); show(photos.length - 1, 1); }
  });
  stage.addEventListener('pointerdown', event => {
    if (!event.isPrimary || (event.pointerType === 'mouse' && event.button !== 0) || event.target.closest('button')) return;
    drag = {id:event.pointerId, x:event.clientX, y:event.clientY, dx:0};
    stage.setPointerCapture(event.pointerId);
  });
  stage.addEventListener('pointermove', event => {
    if (!drag || drag.id !== event.pointerId) return;
    drag.dx = event.clientX - drag.x;
    if (Math.abs(drag.dx) < 8 || Math.abs(drag.dx) < Math.abs(event.clientY - drag.y)) return;
    stage.classList.add('is-dragging');
    if (!reducedMotion.matches) {
      const mobile = stage.clientWidth <= 700;
      const limit = mobile ? stage.clientWidth * .85 : 100;
      image.style.translate = `${Math.max(-limit, Math.min(limit, drag.dx * (mobile ? .85 : .25)))}px 0`;
    }
    drawWings();
  });
  function finishDrag(event, cancel = false) {
    if (!drag || drag.id !== event.pointerId) return;
    const dx = drag.dx;
    const horizontal = Math.abs(dx) > Math.abs(event.clientY - drag.y);
    drag = null;
    stage.classList.remove('is-dragging');
    if (stage.hasPointerCapture(event.pointerId)) stage.releasePointerCapture(event.pointerId);
    if (!cancel && horizontal && Math.abs(dx) > Math.min(65, stage.clientWidth * .12)) navigate(dx < 0 ? 1 : -1);
    else { image.style.translate = ''; drawWings(); }
  }
  stage.addEventListener('pointerup', event => finishDrag(event));
  stage.addEventListener('pointercancel', event => finishDrag(event, true));
  stage.addEventListener('lostpointercapture', event => finishDrag(event, true));
  stage.addEventListener('wheel', event => {
    if (event.ctrlKey) return; // Keep browser pinch-to-zoom available.
    event.preventDefault();
    const now = performance.now();
    if (now - lastWheel > 180) wheelTotal = 0;
    lastWheel = now;
    if (now - lastWheelNavigation < 850) return;
    let delta = Math.abs(event.deltaX) > Math.abs(event.deltaY) ? event.deltaX : event.deltaY;
    if (event.deltaMode === 1) delta *= 16;
    if (event.deltaMode === 2) delta *= stage.clientHeight;
    wheelTotal += delta;
    if (Math.abs(wheelTotal) > 65) {
      navigate(wheelTotal > 0 ? 1 : -1);
      wheelTotal = 0;
      lastWheelNavigation = now;
    }
  }, {passive:false});
  new ResizeObserver(() => { if (viewer.open) drawWings(); }).observe(stage);
  reducedMotion.addEventListener('change', () => {
    if (reducedMotion.matches) {
      image.getAnimations().forEach(animation => animation.cancel());
      stage.querySelectorAll('.viewer-outgoing').forEach(node => node.remove());
      transition = null;
    }
    drawWings();
  });
  viewer.addEventListener('close', () => {
    ++generation;
    cancelAnimationFrame(edgeFrame);
    transition = null; drag = null; wheelTotal = 0;
    stage.classList.remove('is-dragging');
    stage.querySelectorAll('.viewer-outgoing').forEach(node => node.remove());
    image.getAnimations().forEach(animation => animation.cancel());
    image.removeAttribute('src');
    image.style.translate = '';
  });
  aboutToggle.addEventListener('click', () => { about.showModal(); aboutToggle.setAttribute('aria-expanded', 'true'); });
  about.addEventListener('close', () => aboutToggle.setAttribute('aria-expanded', 'false'));
  document.querySelectorAll('[data-close]').forEach(button => {
    button.addEventListener('click', () => document.getElementById(button.dataset.close).close());
  });
  about.addEventListener('click', event => {
    const bounds = about.getBoundingClientRect();
    if (event.target === about && (event.clientX < bounds.left || event.clientX > bounds.right || event.clientY < bounds.top || event.clientY > bounds.bottom)) about.close();
  });
})();
