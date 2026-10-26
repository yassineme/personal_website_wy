
(() => {
      const explorers = [];
      document.querySelectorAll('.explore-item').forEach(item => {
        const trigger = item.querySelector('.books-trigger');
        const panel = item.querySelector('.books-panel');
        let pinned = false, hovered = false, focused = false, dismissed = false;
        let leaveTimer;
        const update = () => {
          const open = !dismissed && (pinned || hovered || focused);
          if (open) explorers.forEach(other => { if (other.item !== item) other.dismiss(); });
          panel.hidden = !open;
          trigger.setAttribute('aria-expanded', String(open));
        };
        const dismiss = (restoreFocus = false) => {
          clearTimeout(leaveTimer);
          if (restoreFocus) trigger.focus();
          pinned = false; hovered = false; focused = false; dismissed = true;
          update();
        };
        explorers.push({ item, dismiss });
        item.addEventListener('pointerenter', event => {
          if (event.pointerType === 'touch') return;
          clearTimeout(leaveTimer);
          hovered = true; dismissed = false; update();
        });
        item.addEventListener('pointerleave', () => {
          leaveTimer = setTimeout(() => { hovered = false; update(); }, 160);
        });
        item.addEventListener('focusin', () => { focused = true; dismissed = false; update(); });
        item.addEventListener('focusout', event => {
          if (!item.contains(event.relatedTarget)) { focused = false; update(); }
        });
        trigger.addEventListener('click', () => {
          if (pinned) dismiss();
          else { pinned = true; dismissed = false; update(); }
        });
        panel.querySelector('.books-close').addEventListener('click', () => dismiss(true));
        document.addEventListener('keydown', event => {
          if (event.key === 'Escape' && !panel.hidden) { event.preventDefault(); dismiss(item.contains(document.activeElement)); }
        });
        document.addEventListener('pointerdown', event => {
          if (!item.contains(event.target)) dismiss();
        });
      });

      const fragmentMenus = {advisory:'value',services:'value',sectors:'value',proof:'value',insights:'beyond',contact:'contact'};
      function revealFragment() {
        const name = fragmentMenus[location.hash.slice(1)];
        if (!name) return;
        const button = document.getElementById(name + '-trigger');
        if (button && button.getAttribute('aria-expanded') !== 'true') button.click();
      }
      revealFragment();
      window.addEventListener('hashchange', revealFragment);
      const copyStatus = document.getElementById('copy-status');
      const manualCopy = document.getElementById('copy-manual');
      const manualValue = document.getElementById('copy-manual-value');
      function copyWithSelection(value) {
        const previousFocus = document.activeElement;
        const field = document.createElement('textarea');
        field.value = value;
        field.readOnly = true;
        field.tabIndex = -1;
        field.style.cssText = 'position:fixed;left:0;top:0;width:1px;height:1px;opacity:0;pointer-events:none;';
        document.getElementById('contact-panel').appendChild(field);
        try {
          field.focus({ preventScroll:true });
          field.select();
          field.setSelectionRange(0, value.length);
          return document.execCommand('copy');
        } finally {
          field.remove();
          if (previousFocus && previousFocus.isConnected) previousFocus.focus({ preventScroll:true });
        }
      }
      document.querySelectorAll('.copy-contact').forEach(button => {
        let resetTimer;
        button.addEventListener('click', async () => {
          const value = button.dataset.copy;
          let copied = false;
          manualCopy.hidden = true;
          copyStatus.textContent = '';
          let clipboardAllowed = true;
          try {
            const policy = document.permissionsPolicy || document.featurePolicy;
            if (policy && typeof policy.allowsFeature === 'function') {
              clipboardAllowed = policy.allowsFeature('clipboard-write');
            }
          } catch (_) { /* Browsers without policy introspection use the normal copy attempts. */ }
          try {
            if (clipboardAllowed && navigator.clipboard && window.isSecureContext) {
              await navigator.clipboard.writeText(value);
              copied = true;
            }
          } catch (_) { /* Try selection-based copying when clipboard permission is unavailable. */ }
          if (!copied && clipboardAllowed) {
            try { copied = copyWithSelection(value); } catch (_) { copied = false; }
          }
          clearTimeout(resetTimer);
          if (copied) {
            button.title = 'Copied';
            button.dataset.copied = 'true';
            copyStatus.textContent = button.dataset.copyLabel + ' copied to clipboard.';
            resetTimer = setTimeout(() => { button.title = button.getAttribute('aria-label'); delete button.dataset.copied; }, 2000);
          } else {
            manualValue.value = value;
            manualCopy.hidden = false;
            manualValue.focus({ preventScroll:true });
            manualValue.select();
            copyStatus.textContent = 'Select the value shown and copy it manually.';
          }
        });
      });

      const canvas = document.getElementById('particles');
      if (!canvas) return;
      const ctx = canvas.getContext('2d');
      const control = document.querySelector('.motion-control');
      if (!ctx) { control.hidden = true; return; }
      const media = matchMedia('(prefers-reduced-motion: reduce)');
      let paused = media.matches;
      let inView = true;
      let frame = null;
      let width = 0, height = 0, rotation = .4, lastTime = 0;
      const points = [];
      // A deterministic point cloud: two crossing, softly irregular orbital ribbons.
      let seed = 1781;
      const random = () => { seed = (seed * 1664525 + 1013904223) >>> 0; return seed / 4294967296; };
      for (let i = 0; i < 3000; i++) {
        const u = random() * Math.PI * 2;
        const v = random() * Math.PI * 2;
        const ring = .68 + Math.sin(u * 3) * .055;
        const tube = .14 + random() * .11;
        let x = (ring + tube * Math.cos(v)) * Math.cos(u);
        let y = tube * Math.sin(v);
        let z = (ring + tube * Math.cos(v)) * Math.sin(u);
        if (i % 3 === 0) { const swap = y; y = z; z = swap; }
        points.push({ x, y, z, size: .55 + random() * 1.05, alpha: .3 + random() * .65 });
      }
      function resize() {
        const bounds = canvas.getBoundingClientRect();
        width = bounds.width; height = bounds.height;
        const ratio = Math.min(devicePixelRatio || 1, 1.5);
        canvas.width = Math.round(width * ratio); canvas.height = Math.round(height * ratio);
        ctx.setTransform(ratio, 0, 0, ratio, 0, 0);
        if (!frame) draw();
      }
      function draw() {
        ctx.clearRect(0, 0, width, height);
        const scale = Math.min(width * .53, height * .44);
        const ca = Math.cos(rotation), sa = Math.sin(rotation);
        const tilt = -.48;
        const ct = Math.cos(tilt), st = Math.sin(tilt);
        for (const p of points) {
          const x = p.x * ca - p.z * sa;
          const z = p.x * sa + p.z * ca;
          const y = p.y * ct - z * st;
          const depth = p.y * st + z * ct;
          const perspective = 2.9 / (2.9 + depth);
          const px = width * .5 + x * scale * perspective;
          const py = height * .49 + y * scale * perspective;
          const alpha = p.alpha * (.52 + (1 - depth) * .24);
          ctx.fillStyle = `rgba(231,233,224,${alpha.toFixed(3)})`;
          const size = p.size * perspective;
          ctx.fillRect(px, py, size, size);
        }
      }
      function tick(time) {
        frame = null;
        if (paused || !inView || document.hidden) { lastTime = 0; return; }
        if (time - lastTime > 31) {
          rotation += Math.min(lastTime ? time - lastTime : 16, 60) * .0001;
          draw(); lastTime = time;
        }
        frame = requestAnimationFrame(tick);
      }
      function synchronize() {
        control.textContent = paused ? 'Resume motion' : 'Pause motion';
        control.setAttribute('aria-pressed', String(paused));
        if (frame !== null) { cancelAnimationFrame(frame); frame = null; }
        lastTime = 0;
        if (!paused && inView && !document.hidden) frame = requestAnimationFrame(tick);
      }
      control.addEventListener('click', () => { paused = !paused; synchronize(); });
      media.addEventListener('change', () => { paused = media.matches; synchronize(); });
      document.addEventListener('visibilitychange', synchronize);
      new IntersectionObserver(entries => {
        inView = entries[0].isIntersecting; synchronize();
      }).observe(canvas);
      new ResizeObserver(resize).observe(canvas);
      resize(); synchronize();
    })();
    