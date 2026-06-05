(function () {
  const STORAGE_KEY = 'nuonuo:motion';
  const PAGE_KEYS = ['photo', 'days', 'message', 'game', 'pet', 'drink', 'video'];
  const PATH_TO_KEY = {
    'photo.html': 'photo',
    'days.html': 'days',
    'message.html': 'message',
    'game.html': 'game',
    'pet.html': 'pet',
    'drinkgame.html': 'drink',
    'video.html': 'video'
  };

  const prefersReduced = () => window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const hasGsap = () => Boolean(window.gsap);

  function normalizeHref(href) {
    try {
      return new URL(href, window.location.href).href;
    } catch {
      return href;
    }
  }

  function getFilename(href = window.location.href) {
    try {
      const url = new URL(href, window.location.href);
      return url.pathname.split('/').pop() || 'index.html';
    } catch {
      return String(href).split('/').pop() || 'index.html';
    }
  }

  function inferPageKey() {
    const explicit = document.body?.dataset?.pageKey;
    if (explicit) return explicit;
    return PATH_TO_KEY[getFilename()] || 'home';
  }

  function readState() {
    try {
      const raw = sessionStorage.getItem(STORAGE_KEY);
      return raw ? JSON.parse(raw) : null;
    } catch {
      return null;
    }
  }

  function writeState(state) {
    try {
      sessionStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    } catch {}
  }

  function clearState() {
    try {
      sessionStorage.removeItem(STORAGE_KEY);
    } catch {}
  }

  function makeOverlay() {
    const columnCount = window.matchMedia('(max-width: 720px)').matches ? 8 : 16;
    const columns = Array.from({ length: columnCount }, () => '<span class="nuonuo-transition-column"></span>').join('');
    const overlay = document.createElement('div');
    overlay.className = 'nuonuo-transition';
    overlay.setAttribute('aria-hidden', 'true');
    overlay.innerHTML = `
      <div class="nuonuo-transition-columns">${columns}</div>
      <div class="nuonuo-transition-card">
        <span class="nuonuo-transition-shard"></span>
        <span class="nuonuo-transition-shard"></span>
        <span class="nuonuo-transition-shard"></span>
      </div>
    `;
    document.body.appendChild(overlay);
    return overlay;
  }

  function playExit(callback) {
    if (prefersReduced() || !hasGsap()) {
      document.body.classList.add('nuonuo-page-enter');
      setTimeout(callback, 120);
      return;
    }

    const overlay = makeOverlay();
    const card = overlay.querySelector('.nuonuo-transition-card');
    const shards = overlay.querySelectorAll('.nuonuo-transition-shard');
    const columns = overlay.querySelectorAll('.nuonuo-transition-column');
    const page = document.querySelector('.site-shell, .page') || document.body;
    const tl = gsap.timeline({
      defaults: { ease: 'power3.inOut' },
      onComplete: callback
    });

    tl.fromTo(overlay, { autoAlpha: 0 }, { autoAlpha: 1, duration: 0.2 }, 0)
      .fromTo(columns,
        { scaleY: 0, autoAlpha: 0.2 },
        {
          scaleY: 1,
          autoAlpha: 1,
          duration: 0.58,
          stagger: {
            each: window.matchMedia('(max-width: 720px)').matches ? 0.018 : 0.012,
            from: 'edges'
          }
        },
        0.02
      )
      .fromTo(card, { autoAlpha: 0, y: 34, scale: 0.76 }, { autoAlpha: 1, y: 0, scale: 1, duration: 0.46 }, 0.02)
      .to(card, { scale: 1.22, duration: 0.32 }, 0.48)
      .to(shards, {
        x: (index) => [-120, 118, 12][index] || 0,
        y: (index) => [84, 68, -72][index] || 0,
        rotation: (index) => [-10, 9, 5][index] || 0,
        autoAlpha: 0.86,
        duration: 0.38,
        stagger: 0.025
      }, 0.22)
      .to(page, { autoAlpha: 0.28, scale: 0.985, y: -10, duration: 0.36 }, 0.08)
      .to(overlay, { backgroundColor: 'rgba(250, 252, 255, .96)', duration: 0.2 }, 0.64);
  }

  function playPageEnter(pageKey = inferPageKey()) {
    document.body.classList.add('nuonuo-subpage', 'nuonuo-motion-ready');
    if (prefersReduced()) {
      document.body.classList.remove('nuonuo-page-enter');
      return;
    }

    const state = readState();
    clearState();
    if (!hasGsap()) {
      document.body.classList.remove('nuonuo-page-enter');
      return;
    }

    const overlay = state ? makeOverlay() : null;
    const page = document.querySelector('.page') || document.body;
    const top = document.querySelector('.topbar, .toolbar');
    const reveal = Array.from(document.querySelectorAll([
      '.card',
      '.content',
      '.gallery',
      '.upload-panel',
      '.empty-state',
      '.message-card',
      '.message-form',
      '.game-card',
      '.pet-card',
      '.video-card',
      '.controls',
      '.drink-card'
    ].join(','))).filter((element, index, list) => list.indexOf(element) === index);

    const tl = gsap.timeline({
      defaults: { ease: 'power3.out' },
      onComplete: () => {
        document.body.classList.remove('nuonuo-page-enter');
        if (overlay) overlay.remove();
      }
    });

    if (overlay) {
      const card = overlay.querySelector('.nuonuo-transition-card');
      const shards = overlay.querySelectorAll('.nuonuo-transition-shard');
      const columns = overlay.querySelectorAll('.nuonuo-transition-column');
      gsap.set(overlay, { autoAlpha: 1 });
      gsap.set(card, { scale: 1.18 });
      gsap.set(columns, { scaleY: 1, autoAlpha: 1 });
      tl.to(shards, {
        x: (index) => [-70, 70, 0][index] || 0,
        y: (index) => [42, 36, -42][index] || 0,
        rotation: 0,
        duration: 0.36,
        stagger: 0.02
      }, 0)
        .to(card, { scale: 0.84, y: -20, autoAlpha: 0, duration: 0.44 }, 0.08)
        .to(columns, {
          scaleY: 0,
          autoAlpha: 0.18,
          transformOrigin: 'top center',
          duration: 0.48,
          stagger: {
            each: window.matchMedia('(max-width: 720px)').matches ? 0.016 : 0.01,
            from: 'center'
          }
        }, 0.12)
        .to(overlay, { autoAlpha: 0, duration: 0.24 }, 0.5);
    }

    tl.fromTo(page, { autoAlpha: 0, y: 34, scale: 0.985 }, { autoAlpha: 1, y: 0, scale: 1, duration: 0.62 }, overlay ? 0.18 : 0)
      .fromTo(top, { autoAlpha: 0, y: -16 }, { autoAlpha: 1, y: 0, duration: 0.42 }, overlay ? 0.24 : 0.06);

    if (reveal.length) {
      tl.fromTo(reveal.slice(0, 10), { autoAlpha: 0, y: 24 }, {
        autoAlpha: 1,
        y: 0,
        duration: 0.42,
        stagger: 0.055
      }, overlay ? 0.32 : 0.16);
    }
  }

  function navigateToPage(href, options = {}) {
    const target = normalizeHref(href);
    writeState({
      type: 'enter',
      from: inferPageKey(),
      to: options.sectionKey || PATH_TO_KEY[getFilename(href)] || null,
      at: Date.now()
    });
    playExit(() => {
      window.location.href = target;
    });
  }

  function returnHome(sectionKey = inferPageKey()) {
    writeState({
      type: 'return',
      from: sectionKey,
      to: 'home',
      sectionKey,
      at: Date.now()
    });
    playExit(() => {
      window.location.href = './index.html';
    });
  }

  function getReturnSection() {
    const state = readState();
    if (!state || state.type !== 'return') return null;
    return PAGE_KEYS.includes(state.sectionKey) ? state.sectionKey : null;
  }

  function consumeReturnSection() {
    const key = getReturnSection();
    if (key) clearState();
    return key;
  }

  function bindBackLinks(sectionKey = inferPageKey()) {
    document.addEventListener('click', (event) => {
      const link = event.target.closest('a[href]');
      if (!link) return;
      const href = link.getAttribute('href') || '';
      if (!/index\.html(?:$|[#?])/.test(href)) return;
      if (link.target && link.target !== '_self') return;
      event.preventDefault();
      returnHome(sectionKey);
    });
  }

  window.NuonuoMotion = {
    navigateToPage,
    returnHome,
    playPageEnter,
    bindBackLinks,
    getReturnSection,
    consumeReturnSection,
    inferPageKey
  };

  document.addEventListener('DOMContentLoaded', () => {
    if (inferPageKey() !== 'home') {
      bindBackLinks(inferPageKey());
      playPageEnter(inferPageKey());
    }
  });
}());
