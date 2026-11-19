/* ==========================================================================
   Une petite Malou Tattoo — animations & interactions
   GSAP + ScrollTrigger + Lenis (smooth scroll), site 100 % statique.
   Règles : on n'anime que transform / opacity (+ clip-path pour les masques),
   courbes douces (expo / power3), prefers-reduced-motion respecté.
   ========================================================================== */
(function () {
  'use strict';

  var $ = function (s, c) { return (c || document).querySelector(s); };
  var $$ = function (s, c) { return Array.prototype.slice.call((c || document).querySelectorAll(s)); };
  var root = document.documentElement;
  var reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  var finePointer = window.matchMedia('(hover: hover) and (pointer: fine)').matches;
  var saveData = !!(navigator.connection && navigator.connection.saveData);
  var hasLibs = typeof window.gsap !== 'undefined' && typeof window.ScrollTrigger !== 'undefined';
  var lenis = null;

  root.classList.add('js');
  if (reduce) root.classList.add('is-reduced');

  /* ---------- Utilitaire : découpe de texte (mots / lettres) ---------- */
  function split(el, mode) {
    var clone = el.cloneNode(true);
    $$('br', clone).forEach(function (b) { b.replaceWith(' '); });
    el.setAttribute('aria-label', clone.textContent.replace(/\s+/g, ' ').trim());
    var out = [];
    (function walk(node) {
      Array.prototype.slice.call(node.childNodes).forEach(function (n) {
        if (n.nodeType === 3) {
          var frag = document.createDocumentFragment();
          n.textContent.split(/(\s+)/).forEach(function (p) {
            if (!p) return;
            if (/^\s+$/.test(p)) { frag.appendChild(document.createTextNode(' ')); return; }
            var w = document.createElement('span');
            w.className = 'w'; w.setAttribute('aria-hidden', 'true');
            if (mode === 'chars') {
              Array.from(p).forEach(function (c) {
                var s = document.createElement('span'); s.className = 'ch'; s.textContent = c; w.appendChild(s); out.push(s);
              });
            } else {
              var s2 = document.createElement('span'); s2.className = 'wi'; s2.textContent = p; w.appendChild(s2); out.push(s2);
            }
            frag.appendChild(w);
          });
          n.replaceWith(frag);
        } else if (n.nodeType === 1 && !n.classList.contains('sr-only') && n.tagName !== 'BR') {
          walk(n);
        }
      });
    })(el);
    return out;
  }

  /* ---------- Lenis (défilement doux) ---------- */
  function setupLenis() {
    if (reduce || typeof window.Lenis === 'undefined' || !hasLibs) return;
    lenis = new window.Lenis({ lerp: 0.09, smoothWheel: true, wheelMultiplier: 1 });
    lenis.on('scroll', ScrollTrigger.update);
    gsap.ticker.add(function (t) { lenis.raf(t * 1000); });
    gsap.ticker.lagSmoothing(0);
  }
  function stopScroll() { if (lenis) lenis.stop(); }
  function startScroll() { if (lenis) lenis.start(); }

  /* ---------- Ancres internes ---------- */
  function initAnchors(closeMenu) {
    $$('a[href^="#"]').forEach(function (a) {
      a.addEventListener('click', function (e) {
        var id = a.getAttribute('href');
        if (!id || id.length < 2) return;
        var target = $(id);
        if (!target) return;
        e.preventDefault();
        if (closeMenu) closeMenu(true);
        if (lenis) {
          lenis.start();
          lenis.scrollTo(target, { offset: 0, duration: 1.7, easing: function (t) { return 1 - Math.pow(1 - t, 4); } });
        } else {
          target.scrollIntoView({ behavior: reduce ? 'auto' : 'smooth' });
        }
        target.setAttribute('tabindex', '-1');
        try { target.focus({ preventScroll: true }); } catch (err) { /* noop */ }
      });
    });
  }

  /* ---------- Menu mobile plein écran ---------- */
  function initMenu() {
    var burger = $('#burger'), menu = $('#menu'), nav = $('#nav');
    if (!burger || !menu) return function () {};
    var isOpen = false;
    function geo() {
      var r = burger.getBoundingClientRect();
      return { x: r.left + r.width / 2, y: Math.max(r.top + r.height / 2, 38), R: Math.hypot(window.innerWidth, window.innerHeight) };
    }
    function open() {
      if (isOpen) return; isOpen = true;
      var g = geo();
      menu.hidden = false;
      burger.setAttribute('aria-expanded', 'true');
      burger.setAttribute('aria-label', 'Fermer le menu');
      nav.classList.remove('is-hidden');
      stopScroll();
      if (hasLibs && !reduce) {
        gsap.fromTo(menu, { clipPath: 'circle(0px at ' + g.x + 'px ' + g.y + 'px)' }, { clipPath: 'circle(' + g.R + 'px at ' + g.x + 'px ' + g.y + 'px)', duration: 1, ease: 'expo.inOut' });
        gsap.fromTo('.menu__nav a', { yPercent: 110 }, { yPercent: 0, duration: 1.1, stagger: 0.06, ease: 'expo.out', delay: 0.35 });
        gsap.fromTo('.menu__foot', { opacity: 0 }, { opacity: 1, duration: 0.8, delay: 0.8 });
      } else { menu.style.clipPath = 'none'; }
      var first = $('.menu__nav a', menu); if (first) setTimeout(function () { first.focus({ preventScroll: true }); }, 400);
    }
    function close(instant) {
      if (!isOpen) return; isOpen = false;
      burger.setAttribute('aria-expanded', 'false');
      burger.setAttribute('aria-label', 'Ouvrir le menu');
      var done = function () { menu.hidden = true; startScroll(); };
      if (hasLibs && !reduce && !instant) {
        var g = geo();
        gsap.to(menu, { clipPath: 'circle(0px at ' + g.x + 'px ' + g.y + 'px)', duration: 0.8, ease: 'expo.inOut', onComplete: done });
      } else {
        if (hasLibs) gsap.killTweensOf(menu);
        done();
      }
    }
    burger.addEventListener('click', function () { isOpen ? close() : open(); });
    document.addEventListener('keydown', function (e) { if (e.key === 'Escape' && isOpen) { close(); burger.focus(); } });
    window.addEventListener('resize', function () { if (isOpen && window.innerWidth > 900) close(true); });
    return close;
  }

  /* ---------- Barre de navigation (se cache en descendant) ---------- */
  function initNav() {
    var nav = $('#nav');
    if (!nav || !hasLibs) return;
    ScrollTrigger.create({
      start: 0, end: 'max',
      onUpdate: function (self) {
        var y = self.scroll();
        nav.classList.toggle('is-solid', y > 60);
        var burger = $('#burger');
        if (burger && burger.getAttribute('aria-expanded') === 'true') return;
        if (y > 220 && self.direction === 1) nav.classList.add('is-hidden');
        else if (self.direction === -1 || y <= 220) nav.classList.remove('is-hidden');
      }
    });
    nav.addEventListener('focusin', function () { nav.classList.remove('is-hidden'); });
  }

  /* ---------- Barre de progression de lecture ---------- */
  function initProgress() {
    if (!hasLibs || reduce) { var p = $('.progress'); if (p) p.style.display = 'none'; return; }
    gsap.to('.progress i', { scaleX: 1, ease: 'none', scrollTrigger: { start: 0, end: 'max', scrub: 0.3 } });
    gsap.to('.progress__star', { x: function () { return window.innerWidth - 12; }, ease: 'none', scrollTrigger: { start: 0, end: 'max', scrub: 0.3, invalidateOnRefresh: true } });
  }

  /* ---------- Curseur personnalisé ---------- */
  function initCursor() {
    if (!hasLibs || reduce || !finePointer) return;
    var cur = $('.cursor'), label = $('.cursor__label');
    if (!cur) return;
    gsap.set(cur, { x: -200, y: -200 });
    var xTo = gsap.quickTo(cur, 'x', { duration: 0.35, ease: 'power3' });
    var yTo = gsap.quickTo(cur, 'y', { duration: 0.35, ease: 'power3' });
    window.addEventListener('pointermove', function (e) { xTo(e.clientX); yTo(e.clientY); }, { passive: true });
    document.addEventListener('pointerover', function (e) {
      var t = e.target.closest ? e.target.closest('[data-cursor], a, button, .chip, .check, summary, .bm-z') : null;
      var txt = t && t.getAttribute('data-cursor');
      cur.classList.toggle('is-native', !!(e.target.closest && e.target.closest('.resa__card, input, textarea, select')));
      cur.classList.toggle('is-label', !!txt);
      cur.classList.toggle('is-hover', !!t && !txt);
      label.textContent = txt || '';
    });
    document.documentElement.addEventListener('pointerleave', function () { gsap.to(cur, { opacity: 0, duration: 0.3 }); });
    document.documentElement.addEventListener('pointerenter', function () { gsap.to(cur, { opacity: 1, duration: 0.3 }); });
    root.classList.add('has-cursor');
  }

  /* ---------- Boutons magnétiques + remplissage ---------- */
  function initMagnetic() {
    if (!hasLibs || reduce || !finePointer) return;
    $$('[data-magnetic]').forEach(function (btn) {
      function origin(e) {
        var r = btn.getBoundingClientRect();
        btn.style.setProperty('--x', (e.clientX - r.left) + 'px');
        btn.style.setProperty('--y', (e.clientY - r.top) + 'px');
      }
      btn.addEventListener('pointerenter', origin);
      btn.addEventListener('pointermove', function (e) {
        var r = btn.getBoundingClientRect();
        var dx = e.clientX - (r.left + r.width / 2), dy = e.clientY - (r.top + r.height / 2);
        gsap.to(btn, { x: dx * 0.28, y: dy * 0.34, duration: 0.5, ease: 'power3.out', overwrite: 'auto' });
      });
      btn.addEventListener('pointerleave', function (e) {
        origin(e);
        gsap.to(btn, { x: 0, y: 0, duration: 1, ease: 'elastic.out(1, 0.45)', overwrite: 'auto' });
      });
    });
  }

  /* ---------- Inclinaison 3D + reflet ---------- */
  function initTilt() {
    if (!hasLibs || reduce || !finePointer) return;
    $$('[data-tilt], .g-frame').forEach(function (el) {
      var max = el.classList.contains('g-frame') ? 5 : 8;
      el.addEventListener('pointermove', function (e) {
        var r = el.getBoundingClientRect();
        var px = (e.clientX - r.left) / r.width, py = (e.clientY - r.top) / r.height;
        el.style.setProperty('--mx', (px * 100) + '%');
        el.style.setProperty('--my', (py * 100) + '%');
        gsap.to(el, { rotateY: (px - 0.5) * max * 2, rotateX: -(py - 0.5) * max * 2, transformPerspective: 900, duration: 0.6, ease: 'power3.out', overwrite: 'auto' });
      });
      el.addEventListener('pointerleave', function () {
        gsap.to(el, { rotateX: 0, rotateY: 0, duration: 1, ease: 'elastic.out(1, 0.6)', overwrite: 'auto' });
      });
    });
  }

  /* ---------- Vidéo d'ouverture ---------- */
  function initVideo() {
    var v = $('.hero__video');
    if (!v || reduce || saveData) return;
    v.muted = true;
    v.src = v.getAttribute('data-src');
    var p = v.play();
    if (p && p.catch) p.catch(function () { /* autoplay refusé : l'image de secours reste affichée */ });
    v.addEventListener('error', function () { v.removeAttribute('src'); v.load(); });
    if (hasLibs) {
      ScrollTrigger.create({
        trigger: '.hero', start: 'top top', end: 'bottom top',
        onToggle: function (self) { if (self.isActive) { var q = v.play(); if (q && q.catch) q.catch(function () {}); } else { v.pause(); } }
      });
    }
  }

  /* ---------- Préchargeur ---------- */
  function runLoader() {
    return new Promise(function (resolve) {
      var loader = $('#loader');
      if (!loader) { resolve(); return; }
      if (!hasLibs || reduce) {
        loader.style.transition = 'opacity .4s';
        loader.style.opacity = '0';
        setTimeout(function () { loader.remove(); resolve(); }, 450);
        return;
      }
      root.style.overflow = 'hidden';
      stopScroll();
      var count = $('#loaderCount'), bar = $('.loader__line span', loader);
      var ready = new Promise(function (r) {
        if (document.readyState === 'complete') r(); else window.addEventListener('load', r, { once: true });
        setTimeout(r, 6500);
      });
      var state = { v: 0 };
      var tl = gsap.timeline({
        onComplete: function () { ready.then(exit); }
      });
      tl.from('.loader__logo', { yPercent: 35, opacity: 0, duration: 1.2, ease: 'expo.out' }, 0)
        .from('.loader__tag', { opacity: 0, y: 20, duration: 1, ease: 'expo.out' }, 0.4)
        .to(state, {
          v: 100, duration: 2.2, ease: 'power2.inOut',
          onUpdate: function () { count.textContent = Math.round(state.v); gsap.set(bar, { scaleX: state.v / 100 }); }
        }, 0.1);

      function exit() {
        var out = gsap.timeline({
          onComplete: function () { loader.remove(); root.style.overflow = ''; startScroll(); ScrollTrigger.refresh(); }
        });
        out.to(['.loader__inner', '.loader__count', '.loader__tag'], { opacity: 0, y: -30, duration: 0.6, ease: 'power3.in', stagger: 0.05 })
           .to(loader, { yPercent: -100, duration: 1.15, ease: 'expo.inOut' }, '>-0.1')
           .call(resolve, null, '<+0.3');
      }
    });
  }

  /* ---------- Hero : état initial + intro ---------- */
  var heroChars = [];
  var archState = { p: 0 };
  function applyArch(p) {
    var media = $('.hero__media');
    if (!media) return;
    var k = 1 - p;
    var side = (window.innerWidth < 700 ? 20 : 34) * k;
    var top = 14 * k, bottom = 9 * k;
    var w = window.innerWidth * (1 - 2 * side / 100);
    var r = (w / 2) * k;
    media.style.clipPath = 'inset(' + top + '% ' + side + '% ' + bottom + '% ' + side + '% round ' + r + 'px ' + r + 'px 0px 0px)';
  }
  function heroSetup() {
    if (!hasLibs || reduce) return;
    var title = $('.hero__title');
    if (title) { heroChars = split(title, 'chars'); gsap.set(heroChars, { yPercent: 118 }); }
    applyArch(0);
    gsap.set('.hero__video', { scale: 1.35 });
    gsap.set('[data-hero-in]', { opacity: 0, y: 36 });
    gsap.set('.hero__card', { opacity: 0, y: 60, scale: 0.9 });
    gsap.set('.fl', { opacity: 0, scale: 0.4 });
    gsap.set('#nav', { opacity: 0 });
  }
  function heroIntro() {
    if (!hasLibs || reduce) return;
    var tl = gsap.timeline();
    tl.to(archState, { p: 1, duration: 1.9, ease: 'expo.inOut', onUpdate: function () { applyArch(archState.p); }, onComplete: function () { var m = $('.hero__media'); if (m) m.style.clipPath = 'none'; } }, 0)
      .to('.hero__video', { scale: 1.06, duration: 2.6, ease: 'expo.out' }, 0)
      .to(heroChars, { yPercent: 0, duration: 1.4, stagger: 0.028, ease: 'expo.out' }, 0.75)
      .to('[data-hero-in]', { opacity: 1, y: 0, duration: 1.1, stagger: 0.12, ease: 'expo.out' }, 1.25)
      .to('.hero__card', { opacity: 1, y: 0, scale: 1, duration: 1.3, ease: 'expo.out' }, 1.5)
      .to('.fl', { opacity: function (i, el) { return parseFloat(getComputedStyle(el).getPropertyValue('--o')) || 0.5; }, scale: 1, duration: 1.4, stagger: 0.08, ease: 'expo.out' }, 1.4)
      .to('#nav', { opacity: 1, duration: 1.2, ease: 'power2.out', clearProps: 'opacity' }, 1.6);
  }
  function heroScroll() {
    if (!hasLibs || reduce) return;
    gsap.to('.hero__video', { yPercent: 10, ease: 'none', scrollTrigger: { trigger: '.hero', start: 'top top', end: 'bottom top', scrub: true } });
    gsap.to('.hero__inner', { yPercent: -16, opacity: 0.05, ease: 'none', scrollTrigger: { trigger: '.hero', start: '12% top', end: 'bottom top', scrub: true } });
    gsap.to('.hero__card', { yPercent: -45, ease: 'none', scrollTrigger: { trigger: '.hero', start: 'top top', end: 'bottom top', scrub: true } });
    $$('.fl').forEach(function (el) {
      var d = parseFloat(el.getAttribute('data-depth')) || 0.5;
      gsap.to(el, { yPercent: -60 * d, ease: 'none', scrollTrigger: { trigger: '.hero', start: 'top top', end: 'bottom top', scrub: true } });
    });
    if (finePointer) {
      var fl = $$('.fl').map(function (el) {
        return { x: gsap.quickTo(el, 'x', { duration: 1.2, ease: 'power3' }), y: gsap.quickTo(el, 'y', { duration: 1.2, ease: 'power3' }), d: parseFloat(el.getAttribute('data-depth')) || 0.5 };
      });
      $('.hero').addEventListener('pointermove', function (e) {
        var nx = e.clientX / window.innerWidth - 0.5, ny = e.clientY / window.innerHeight - 0.5;
        fl.forEach(function (f) { f.x(nx * 60 * f.d); f.y(ny * 50 * f.d); });
      });
    }
  }

  /* ---------- Marquee (vitesse et sens liés au défilement) ---------- */
  function initMarquee() {
    if (!hasLibs || reduce) return;
    var rows = $$('.marquee__row').map(function (row) {
      return { track: $('.marquee__track', row), group: $('.marquee__group', row), dir: parseFloat(row.getAttribute('data-dir')) || -1, x: 0, w: 1 };
    });
    function measure() { rows.forEach(function (r) { r.w = r.group.offsetWidth || 1; }); }
    measure();
    window.addEventListener('resize', measure);
    window.addEventListener('load', measure);
    var last = window.scrollY, vel = 0, dirSm = 1;
    gsap.ticker.add(function (time, dt) {
      var sy = lenis ? lenis.scroll : window.scrollY;
      var d = sy - last; last = sy;
      vel += (Math.min(Math.abs(d), 120) - vel) * 0.08;
      if (Math.abs(d) > 0.4) dirSm += ((d > 0 ? 1 : -1) - dirSm) * 0.06;
      var f = dt / 16.67;
      rows.forEach(function (r) {
        r.x += (0.7 + vel * 0.35) * r.dir * dirSm * f;
        if (r.x <= -r.w) r.x += r.w;
        if (r.x > 0) r.x -= r.w;
        r.track.style.transform = 'translate3d(' + r.x.toFixed(2) + 'px,0,0)';
      });
    });
  }

  /* ---------- Titres révélés par masque + manifeste ---------- */
  function initTextReveals() {
    if (!hasLibs || reduce) return;
    $$('[data-split]').forEach(function (el) {
      if (el.classList.contains('hero__title')) return;
      var words = split(el, 'words');
      gsap.set(words, { yPercent: 118 });
      ScrollTrigger.create({
        trigger: el, start: 'top 88%', once: true,
        onEnter: function () { gsap.to(words, { yPercent: 0, duration: 1.3, stagger: 0.07, ease: 'expo.out' }); }
      });
    });
    var big = $('[data-scrub-words]');
    if (big) {
      var words = split(big, 'words');
      gsap.set(words, { opacity: 0.14 });
      gsap.to(words, { opacity: 1, stagger: 0.12, ease: 'none', scrollTrigger: { trigger: big, start: 'top 82%', end: 'bottom 52%', scrub: true } });
    }
    var sign = $('.manif__sign');
    if (sign) gsap.from(sign, { opacity: 0, x: -30, rotate: -8, duration: 1.2, ease: 'expo.out', scrollTrigger: { trigger: sign, start: 'top 92%', once: true } });
  }

  /* ---------- Images : masques, Ken Burns, parallaxe interne ---------- */
  function initImages() {
    if (!hasLibs || reduce) return;
    $$('[data-arch-reveal]').forEach(function (fig) {
      var arch = $('.arch', fig);
      gsap.fromTo(arch, { clipPath: 'inset(100% 0% 0% 0%)' }, { clipPath: 'inset(0% 0% 0% 0%)', duration: 1.8, ease: 'expo.inOut', clearProps: 'clipPath', scrollTrigger: { trigger: fig, start: 'top 82%', once: true } });
      gsap.from($('figcaption', fig), { opacity: 0, y: 20, duration: 1, delay: 0.5, ease: 'expo.out', scrollTrigger: { trigger: fig, start: 'top 80%', once: true } });
    });
    $$('[data-kenburns]').forEach(function (img) {
      var holder = img.closest('.arch, figure') || img;
      gsap.set(img, { scale: 1.1 });
      var kb = gsap.fromTo(img, { scale: 1.1 }, { scale: 1.2, duration: 14, ease: 'sine.inOut', yoyo: true, repeat: -1, paused: true });
      ScrollTrigger.create({ trigger: holder, start: 'top bottom', end: 'bottom top', onToggle: function (s) { s.isActive ? kb.play() : kb.pause(); } });
      gsap.fromTo(img, { yPercent: -4 }, { yPercent: 4, ease: 'none', scrollTrigger: { trigger: holder, start: 'top bottom', end: 'bottom top', scrub: true } });
    });
    gsap.from('.fact', { y: 80, rotate: function (i) { return i % 2 ? 4 : -4; }, opacity: 0, duration: 1.3, stagger: 0.12, ease: 'expo.out', scrollTrigger: { trigger: '.facts', start: 'top 85%', once: true } });
    // Galerie : révélation par rideau
    $$('.g-item').forEach(function (item) {
      var frame = $('.g-frame', item), img = $('img', item);
      /* clearProps : on retire masque et transformation une fois l'entrée terminée
         (un clip-path laissé en place alourdit chaque image du défilement et bloquait le zoom au survol) */
      gsap.from(frame, { clipPath: 'inset(0% 0% 100% 0%)', duration: 1.5, ease: 'expo.inOut', clearProps: 'clipPath', scrollTrigger: { trigger: item, start: 'top 92%', once: true } });
      gsap.from(img, { scale: 1.35, duration: 1.8, ease: 'expo.out', clearProps: 'transform', scrollTrigger: { trigger: item, start: 'top 92%', once: true } });
    });
    // Chiffres
    gsap.from('.stat', { y: 70, opacity: 0, duration: 1.2, stagger: 0.12, ease: 'expo.out', scrollTrigger: { trigger: '.chiffres__grid', start: 'top 85%', once: true } });
    gsap.fromTo('.chiffres__bg', { yPercent: -8 }, { yPercent: 8, ease: 'none', scrollTrigger: { trigger: '.chiffres', start: 'top bottom', end: 'bottom top', scrub: true } });
    // Avis, soins, FAQ, pied de page
    gsap.from('.review', { y: 70, opacity: 0, duration: 1.2, stagger: 0.07, ease: 'expo.out', scrollTrigger: { trigger: '#avisRail', start: 'top 88%', once: true } });
    $$('.soins__col').forEach(function (col) {
      gsap.from($$('li', col), { x: -40, opacity: 0, duration: 1.1, stagger: 0.14, ease: 'expo.out', scrollTrigger: { trigger: col, start: 'top 80%', once: true } });
    });
    $$('.draw-ico').forEach(function (svg) {
      var shapes = $$('path, circle', svg);
      gsap.set(shapes, { strokeDashoffset: 1 });
      ScrollTrigger.create({ trigger: svg, start: 'top 88%', once: true, onEnter: function () { gsap.to(shapes, { strokeDashoffset: 0, duration: 1.8, ease: 'power2.inOut', stagger: 0.18 }); } });
    });
    $$('.qa').forEach(function (qa, i) {
      gsap.from(qa, { opacity: 0, y: 30, duration: 1, delay: i * 0.05, ease: 'expo.out', scrollTrigger: { trigger: qa, start: 'top 92%', once: true } });
    });
    var giant = $('#footGiant');
    if (giant) {
      var chars = split(giant, 'chars');
      gsap.set(chars, { yPercent: 115 });
      ScrollTrigger.create({ trigger: giant, start: 'top 98%', once: true, onEnter: function () { gsap.to(chars, { yPercent: 0, duration: 1.5, stagger: 0.04, ease: 'expo.out' }); } });
    }
    gsap.from('.polaroid', { y: 80, opacity: 0, duration: 1.2, stagger: 0.1, ease: 'expo.out', scrollTrigger: { trigger: '.atelier__strip', start: 'top 85%', once: true } });
    gsap.from('.acces__map .arch', { clipPath: 'inset(100% 0% 0% 0%)', duration: 1.8, ease: 'expo.inOut', clearProps: 'clipPath', scrollTrigger: { trigger: '.acces__map', start: 'top 80%', once: true } });
  }

  /* ---------- Compteurs ---------- */
  function initCounters() {
    if (!hasLibs || reduce) return;
    $$('[data-count]').forEach(function (el) {
      var target = parseFloat(el.getAttribute('data-count'));
      var dec = parseInt(el.getAttribute('data-decimals') || '0', 10);
      var fmt = function (v) { return v.toLocaleString('fr-FR', { minimumFractionDigits: dec, maximumFractionDigits: dec }); };
      el.textContent = fmt(0);
      var o = { v: 0 };
      ScrollTrigger.create({
        trigger: el, start: 'top 90%', once: true,
        onEnter: function () { gsap.to(o, { v: target, duration: 2.6, ease: 'expo.out', onUpdate: function () { el.textContent = fmt(o.v); } }); }
      });
    });
  }

  /* ---------- Sections qui changent de comportement selon l'écran ---------- */
  function initResponsiveScenes() {
    if (!hasLibs) return;
    var mm = gsap.matchMedia();

    /* A) Grand écran : « Le chemin d'un tatouage » (section pinnée) */
    mm.add('(min-width: 900px) and (prefers-reduced-motion: no-preference)', function () {
      root.classList.add('pin-on');
      var steps = $$('.chemin .step'), imgs = $$('.chemin__stack img'), n = steps.length;
      var num = $('.chemin__num'), bar = $('.chemin__bar i');
      gsap.set(steps.slice(1), { autoAlpha: 0, y: 40 });
      gsap.set(imgs.slice(1), { clipPath: 'inset(100% 0% 0% 0%)', scale: 1.18 });
      var shown = 0;
      var tl = gsap.timeline({
        defaults: { ease: 'power2.inOut' },
        scrollTrigger: {
          trigger: '.chemin', start: 'top top', end: function () { return '+=' + Math.round(window.innerHeight * n * 0.85); },
          pin: true, scrub: 0.6, anticipatePin: 1, invalidateOnRefresh: true,
          onUpdate: function (self) {
            var idx = Math.min(n - 1, Math.floor(self.progress * n + 0.18));
            if (idx !== shown) {
              shown = idx;
              num.textContent = '0' + (idx + 1);
              gsap.fromTo(num, { yPercent: 40, opacity: 0 }, { yPercent: 0, opacity: 1, duration: 0.7, ease: 'expo.out', overwrite: true });
            }
          }
        }
      });
      steps.forEach(function (s, i) {
        if (i === 0) return;
        tl.to(steps[i - 1], { autoAlpha: 0, y: -40, duration: 0.45 }, i - 0.05)
          .to(s, { autoAlpha: 1, y: 0, duration: 0.55 }, i + 0.12)
          .to(imgs[i], { clipPath: 'inset(0% 0% 0% 0%)', scale: 1, duration: 0.9 }, i - 0.05)
          .to(bar, { scaleX: (i + 1) / n, duration: 0.9 }, i - 0.05);
      });
      tl.to({}, { duration: 0.2 }, n - 0.2);
      return function () { root.classList.remove('pin-on'); };
    });

    /* B) Petit écran : les étapes apparaissent simplement */
    mm.add('(max-width: 899px) and (prefers-reduced-motion: no-preference)', function () {
      $$('.chemin .step').forEach(function (s) {
        gsap.from(s, { y: 50, opacity: 0, duration: 1.1, ease: 'expo.out', scrollTrigger: { trigger: s, start: 'top 85%', once: true } });
      });
    });

    /* C) Grand écran : prestations en défilement horizontal piloté par le scroll vertical */
    mm.add('(min-width: 900px) and (prefers-reduced-motion: no-preference)', function () {
      var track = $('#prestaTrack'), vp = $('.presta__viewport');
      if (!track || !vp) return;
      var dist = function () { return Math.max(0, track.scrollWidth - vp.clientWidth); };
      var tw = gsap.to(track, {
        x: function () { return -dist(); }, ease: 'none',
        scrollTrigger: {
          trigger: '.presta', start: 'top top', end: function () { return '+=' + dist(); },
          pin: true, scrub: 0.7, anticipatePin: 1, invalidateOnRefresh: true,
          onUpdate: function (self) { gsap.set('.presta__progress i', { scaleX: self.progress }); }
        }
      });
      $$('.card:not(.card--end) .arch img').forEach(function (img) {
        gsap.set(img, { scale: 1.22 });
        gsap.fromTo(img, { xPercent: -7 }, { xPercent: 7, ease: 'none', scrollTrigger: { trigger: img.closest('.card'), containerAnimation: tw, start: 'left right', end: 'right left', scrub: true } });
      });
    });

    /* D) Galerie : colonnes à vitesses différentes (grand écran) */
    mm.add('(min-width: 1101px) and (prefers-reduced-motion: no-preference)', function () {
      var from = [70, -20, 100, 0], to = [-70, 70, -60, 80];
      $$('[data-col]').forEach(function (col, i) {
        gsap.fromTo(col, { y: from[i % 4] }, { y: to[i % 4], ease: 'none', scrollTrigger: { trigger: '#galerieGrid', start: 'top bottom', end: 'bottom top', scrub: true } });
      });
    });

    /* E) Atelier : le cercle s'agrandit (pinné sur grand écran, simple sur mobile) */
    mm.add('(min-width: 900px) and (prefers-reduced-motion: no-preference)', function () {
      gsap.set('.atelier__big', { clipPath: 'circle(8% at 50% 50%)' });
      var tl = gsap.timeline({ scrollTrigger: { trigger: '.atelier__pin', start: 'top top', end: '+=130%', pin: true, scrub: 0.6, anticipatePin: 1 } });
      tl.to('.atelier__big', { clipPath: 'circle(80% at 50% 50%)', ease: 'power2.inOut', duration: 1 }, 0)
        .fromTo('.atelier__big img', { scale: 1.5 }, { scale: 1.04, ease: 'none', duration: 1.3 }, 0)
        .fromTo('.atelier__title', { scale: 0.92 }, { scale: 1, ease: 'none', duration: 1.3 }, 0);
    });
    mm.add('(max-width: 899px) and (prefers-reduced-motion: no-preference)', function () {
      gsap.fromTo('.atelier__big', { clipPath: 'circle(18% at 50% 50%)' }, { clipPath: 'circle(80% at 50% 50%)', ease: 'none', scrollTrigger: { trigger: '.atelier__pin', start: 'top 75%', end: 'top 5%', scrub: true } });
    });

    /* F) Bande de polaroïds qui glisse latéralement */
    mm.add('(prefers-reduced-motion: no-preference)', function () {
      var row = $('[data-strip]');
      if (!row) return;
      gsap.to(row, {
        x: function () { return -Math.max(0, row.scrollWidth - window.innerWidth); }, ease: 'none',
        scrollTrigger: { trigger: '.atelier__strip', start: 'top bottom', end: 'bottom top', scrub: 0.8, invalidateOnRefresh: true }
      });
    });
  }

  /* ---------- Bouton flottant mobile ---------- */
  function initFab() {
    var fab = $('#fab');
    if (!fab || !hasLibs) return;
    fab.classList.toggle('is-hidden', window.scrollY < window.innerHeight * 0.5);
    ['#reservation', '#acces', '.foot'].forEach(function (sel) {
      var el = $(sel); if (!el) return;
      ScrollTrigger.create({ trigger: el, start: 'top 70%', end: 'bottom top', onToggle: function (s) { fab.classList.toggle('is-hidden', s.isActive); } });
    });
    ScrollTrigger.create({ trigger: '.hero', start: 'top top', end: 'bottom 60%', onToggle: function (s) { fab.classList.toggle('is-hidden', s.isActive); } });
  }

  /* ==========================================================================
     Fonctions indépendantes de GSAP (marchent même sans animation)
     ========================================================================== */

  /* FAQ */
  function initFaq() {
    $$('.qa button').forEach(function (btn) {
      btn.addEventListener('click', function () {
        var qa = btn.closest('.qa');
        var open = qa.classList.toggle('is-open');
        btn.setAttribute('aria-expanded', open ? 'true' : 'false');
        if (hasLibs) setTimeout(function () { ScrollTrigger.refresh(); }, 650);
      });
    });
  }

  /* Carrousel d'avis : défilement natif + glisser à la souris + boutons */
  function initReviews() {
    var rail = $('#avisRail');
    if (!rail) return;
    var step = function () { return Math.max(280, rail.clientWidth * 0.7); };
    $('#avisNext').addEventListener('click', function () { rail.scrollBy({ left: step(), behavior: 'smooth' }); });
    $('#avisPrev').addEventListener('click', function () { rail.scrollBy({ left: -step(), behavior: 'smooth' }); });
    var down = false, sx = 0, sl = 0, settle = null;
    /* Position (scrollLeft) de la carte la plus proche, en gardant la marge gauche */
    function nearest() {
      var base = rail.getBoundingClientRect().left, pad = parseFloat(getComputedStyle(rail).paddingLeft) || 0;
      var best = 0, bd = Infinity;
      $$('.review', rail).forEach(function (c) {
        var left = c.getBoundingClientRect().left - base + rail.scrollLeft - pad;
        var d = Math.abs(left - rail.scrollLeft);
        if (d < bd) { bd = d; best = left; }
      });
      return Math.max(0, Math.min(best, rail.scrollWidth - rail.clientWidth));
    }
    rail.addEventListener('pointerdown', function (e) {
      if (e.pointerType !== 'mouse' || e.button !== 0) return;
      clearTimeout(settle);
      down = true; sx = e.clientX; sl = rail.scrollLeft;
    });
    window.addEventListener('pointermove', function (e) {
      if (!down) return;
      var dx = e.clientX - sx;
      if (Math.abs(dx) > 4) rail.classList.add('is-dragging');
      rail.scrollLeft = sl - dx;
    });
    function release() {
      if (!down) return;
      down = false;
      if (!rail.classList.contains('is-dragging')) return;
      /* on garde le « snap » désactivé le temps de glisser en douceur vers la carte la plus proche */
      rail.scrollTo({ left: nearest(), behavior: reduce ? 'auto' : 'smooth' });
      settle = setTimeout(function () { rail.classList.remove('is-dragging'); }, reduce ? 0 : 700);
    }
    window.addEventListener('pointerup', release);
    window.addEventListener('pointercancel', release);
    rail.addEventListener('dragstart', function (e) { e.preventDefault(); });
    /* Pas de data-lenis-prevent : Lenis continue de lisser la molette verticale au-dessus du carrousel
       (sinon le défilement devenait saccadé dès que le curseur passait sur les avis). */
  }

  /* Lightbox de la galerie */
  function initLightbox() {
    var dlg = $('#lightbox');
    var items = $$('.g-item');
    if (!dlg || !items.length || typeof dlg.showModal !== 'function') return;
    var img = $('#lbImg'), cap = $('#lbCap'), idx = 0;
    function show() {
      var it = items[idx];
      img.src = it.getAttribute('data-full');
      img.alt = ($('img', it) || {}).alt || '';
      cap.textContent = it.getAttribute('data-cap') || '';
    }
    function open(i) { idx = i; show(); if (!dlg.open) dlg.showModal(); root.classList.add('lb-open'); stopScroll(); }
    items.forEach(function (it, i) { it.addEventListener('click', function () { open(i); }); });
    function go(d) { idx = (idx + d + items.length) % items.length; show(); }
    $('.lightbox__nav--prev', dlg).addEventListener('click', function () { go(-1); });
    $('.lightbox__nav--next', dlg).addEventListener('click', function () { go(1); });
    $('.lightbox__close', dlg).addEventListener('click', function () { dlg.close(); });
    dlg.addEventListener('click', function (e) { if (e.target === dlg) dlg.close(); });
    dlg.addEventListener('close', function () { root.classList.remove('lb-open'); startScroll(); });
    dlg.addEventListener('keydown', function (e) { if (e.key === 'ArrowLeft') go(-1); if (e.key === 'ArrowRight') go(1); });
  }

  /* Statut « ouvert / fermé » en direct (heure de Paris) + ligne du jour */
  function initOpenStatus() {
    var el = $('#openStatus');
    if (!el) return;
    var parts = {};
    try {
      new Intl.DateTimeFormat('en-US', { timeZone: 'Europe/Paris', weekday: 'short', hour: 'numeric', minute: 'numeric', hourCycle: 'h23' })
        .formatToParts(new Date()).forEach(function (p) { parts[p.type] = p.value; });
    } catch (e) { return; }
    var map = { Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6 };
    var day = map[parts.weekday], h = parseInt(parts.hour, 10) + parseInt(parts.minute, 10) / 60;
    var row = $('#hours tr[data-day="' + day + '"]');
    if (row) row.classList.add('is-today');
    var openNow = day >= 3 && day <= 6 && h >= 10 && h < 18;
    if (openNow) { el.className = 'hours__status is-open'; el.textContent = 'Ouvert maintenant · ferme à 18h'; }
    else {
      el.className = 'hours__status is-closed';
      var next = 'mercredi à 10h';
      if (day >= 3 && day <= 6 && h < 10) next = "aujourd'hui à 10h";
      else if (day >= 3 && day <= 5 && h >= 18) next = 'demain à 10h';
      el.textContent = 'Fermé actuellement · ouvre ' + next;
    }
  }

  /* ==========================================================================
     Réservation : assistant en 4 étapes → e-mail pré-rempli (sans serveur)
     ========================================================================== */
  function initBooking() {
    var form = $('#resaForm');
    if (!form) return;
    var TO = 'unepetitemaloutattoo@gmail.com';
    var panels = $$('.rstep', form), stepper = $$('#stepper li');
    var nextBtn = $('#nextBtn'), prevBtn = $('#prevBtn'), nav = $('.resa__nav');
    var dates = [];
    var cur = 1, total = panels.length;

    var fr = function (d, opt) { return d.toLocaleDateString('fr-FR', opt); };
    var iso = function (d) { return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0'); };
    function val(name) {
      var el = form.elements[name];
      if (!el) return '';
      if (typeof el.length === 'number' && !el.tagName) return el.value || '';  // RadioNodeList
      if (el.type === 'checkbox') return el.checked ? el.value || 'oui' : '';
      return (el.value || '').trim();
    }
    function vals(name) {
      return $$('input[name="' + name + '"]:checked', form).map(function (i) { return i.value; });
    }
    function setErr(name, msg) {
      var p = $('[data-err="' + name + '"]', form);
      if (p) p.textContent = msg || '';
      var field = p && p.closest('.field');
      if (field) field.classList.toggle('has-error', !!msg);
      var input = form.elements[name];
      if (input && input.setAttribute && input.tagName) { msg ? input.setAttribute('aria-invalid', 'true') : input.removeAttribute('aria-invalid'); }
    }

    /* Calendrier : 8 semaines, du mercredi au samedi */
    function renderCal() {
      var cal = $('#cal');
      cal.innerHTML = '';
      var today = new Date(); today.setHours(0, 0, 0, 0);
      var min = new Date(today); min.setDate(min.getDate() + 1);
      var monday = new Date(today); monday.setDate(today.getDate() - ((today.getDay() + 6) % 7));
      for (var w = 0; w < 9; w++) {
        var m = new Date(monday); m.setDate(monday.getDate() + 7 * w);
        var wk = document.createElement('div'); wk.className = 'cal__week';
        var any = false;
        var lab = document.createElement('div'); lab.className = 'cal__lab';
        lab.textContent = 'Sem. du ' + fr(m, { day: 'numeric', month: 'short' });
        wk.appendChild(lab);
        for (var k = 2; k <= 5; k++) {
          var d = new Date(m); d.setDate(m.getDate() + k);
          var b = document.createElement('button');
          b.type = 'button'; b.className = 'cal__day'; b.setAttribute('aria-pressed', 'false');
          b.setAttribute('data-iso', iso(d));
          b.setAttribute('aria-label', fr(d, { weekday: 'long', day: 'numeric', month: 'long' }));
          var s = document.createElement('span'); s.textContent = fr(d, { weekday: 'short' }).replace('.', '');
          var n = document.createElement('b'); n.textContent = d.getDate();
          b.appendChild(s); b.appendChild(n);
          if (d < min) b.disabled = true; else any = true;
          wk.appendChild(b);
        }
        if (any) cal.appendChild(wk);
        if (cal.children.length >= 8) break;
      }
      cal.addEventListener('click', function (e) {
        var b = e.target.closest('.cal__day');
        if (!b || b.disabled) return;
        var key = b.getAttribute('data-iso'), i = dates.indexOf(key);
        if (i > -1) { dates.splice(i, 1); b.setAttribute('aria-pressed', 'false'); setErr('dispos', ''); }
        else if (dates.length >= 5) { setErr('dispos', 'Cinq dates au maximum : retire-en une pour en choisir une autre.'); return; }
        else { dates.push(key); b.setAttribute('aria-pressed', 'true'); setErr('dispos', ''); }
        dates.sort();
        updateSel();
      });
    }
    function dateLabel(key) { var p = key.split('-'); return fr(new Date(+p[0], +p[1] - 1, +p[2]), { weekday: 'long', day: 'numeric', month: 'long' }); }
    function updateSel() {
      $('#calSel').textContent = dates.length ? dates.length + ' date' + (dates.length > 1 ? 's' : '') + ' choisie' + (dates.length > 1 ? 's' : '') + ' : ' + dates.map(dateLabel).join(' · ') : 'Aucune date choisie pour le moment.';
    }

    /* Validation par étape */
    function validate(n) {
      var firstBad = null;
      function bad(name, msg, focusEl) { setErr(name, msg); if (!firstBad) firstBad = focusEl || form.elements[name]; }
      if (n === 1) {
        ['taille', 'emplacement', 'sujet'].forEach(function (k) { setErr(k, ''); });
        if (!val('taille')) bad('taille', 'Choisis une taille pour ton projet.', $('input[name="taille"]', form));
        if (!vals('emplacement').length) bad('emplacement', 'Touche au moins une zone du corps (ou choisis dans la liste).', $('.bm-z', form) || $('input[name="emplacement"]', form));
        if (!vals('sujet').length) bad('sujet', 'Choisis au moins un univers (ou « Autre »).', $('input[name="sujet"]', form));
      }
      if (n === 2) {
        setErr('dispos', '');
        if (!dates.length && !val('dispos')) bad('dispos', 'Choisis au moins une date, ou précise tes disponibilités.', $('.cal__day:not([disabled])', form) || form.elements.dispos);
      }
      if (n === 3) {
        ['nom', 'age', 'ville', 'adresse', 'email'].forEach(function (k) { setErr(k, ''); });
        if (val('nom').length < 3) bad('nom', 'Indique ton nom et ton prénom.');
        var age = parseInt(val('age'), 10);
        if (!age) bad('age', 'Indique ton âge.'); else if (age < 18) bad('age', 'Il faut être majeur(e) pour se faire tatouer.');
        if (val('ville').length < 2) bad('ville', 'Indique ta ville.');
        if (val('adresse').length < 8) bad('adresse', 'Indique ton adresse postale complète.');
        if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(val('email'))) bad('email', 'Indique une adresse e-mail valide.');
      }
      if (n === 4) {
        setErr('conds', '');
        var c = ['c_majeur', 'c_enceinte', 'c_sante'].every(function (k) { return form.elements[k].checked; });
        if (!c) bad('conds', 'Merci de cocher les trois conditions pour continuer.', form.elements.c_majeur);
      }
      if (firstBad && firstBad.focus) firstBad.focus({ preventScroll: false });
      return !firstBad;
    }

    /* Message e-mail */
    function buildMessage() {
      var L = [];
      L.push('Bonjour Malou,', '', "Je souhaite demander un rendez-vous pour un tatouage. Voici ma demande :", '');
      L.push('— MON PROJET —');
      L.push('Taille : ' + val('taille'));
      L.push('Emplacement : ' + vals('emplacement').join(', ') + (val('cote') ? ' (' + val('cote').toLowerCase() + ')' : ''));
      L.push('Univers : ' + vals('sujet').join(', '));
      if (vals('sens').length) L.push('Ce que ça représente : ' + vals('sens').join(', '));
      if (val('couleurs')) L.push('Couleurs : ' + val('couleurs'));
      if (val('premier')) L.push('Premier tatouage : ' + val('premier').toLowerCase());
      if (val('note')) L.push('Précision : ' + val('note'));
      if (val('session_dessin')) L.push("Je souhaite d'abord une session dessin d'1 h (50 €).");
      L.push('', '— MES DISPONIBILITÉS —');
      if (dates.length) L.push('Dates possibles : ' + dates.map(dateLabel).join(' ; '));
      if (val('moment')) L.push('Moment : ' + val('moment'));
      if (val('dispos')) L.push('Précisions : ' + val('dispos'));
      if (val('budget')) L.push('Budget : ' + val('budget').replace(/[^\d.,\-– ]/g, '') + ' €');
      L.push('', '— MES COORDONNÉES —');
      L.push('Nom et prénom : ' + val('nom'));
      L.push('Âge : ' + val('age') + ' ans');
      L.push('Ville : ' + val('ville'));
      L.push('Adresse postale : ' + val('adresse'));
      L.push('E-mail : ' + val('email'));
      if (val('tel')) L.push('Téléphone : ' + val('tel'));
      L.push('', 'Je confirme être majeur(e), ne pas être enceinte ni allaitante, et être en bonne santé le jour du rendez-vous.');
      L.push("Mes inspirations sont jointes à ce message, ou je te les envoie par Instagram.", '', 'Merci et à bientôt !', val('nom'));
      return L.join('\n');
    }
    var subject = function () { return 'Demande de rendez-vous tatouage – ' + val('nom'); };

    function buildRecap() {
      var dl = $('#recap'); dl.innerHTML = '';
      var rows = [
        ['Taille', val('taille')], ['Emplacement', vals('emplacement').join(' · ')], ['Côté', val('cote')],
        ['Univers', vals('sujet').join(' · ')], ['Signification', vals('sens').join(' · ')], ['Couleurs', val('couleurs')],
        ['Premier tatouage', val('premier')],
        ['Précision', val('note').length > 160 ? val('note').slice(0, 157) + '…' : val('note')],
        ['Session dessin', val('session_dessin') ? 'Oui, d\'abord (1 h · 50 €)' : ''],
        ['Dates', dates.map(dateLabel).join(' · ')], ['Moment', val('moment')], ['Précisions', val('dispos')], ['Budget', val('budget') ? val('budget') + ' €' : ''],
        ['Nom', val('nom')], ['Âge', val('age') ? val('age') + ' ans' : ''], ['Ville', val('ville')], ['Adresse', val('adresse')], ['E-mail', val('email')], ['Téléphone', val('tel')]
      ];
      rows.forEach(function (r) {
        if (!r[1]) return;
        var div = document.createElement('div'), dt = document.createElement('dt'), dd = document.createElement('dd');
        dt.textContent = r[0]; dd.textContent = r[1]; div.appendChild(dt); div.appendChild(dd); dl.appendChild(div);
      });
      refreshLinks();
    }
    function refreshLinks() {
      var msg = buildMessage(), sub = subject();
      $('#sendMail').setAttribute('href', 'mailto:' + TO + '?subject=' + encodeURIComponent(sub) + '&body=' + encodeURIComponent(msg.replace(/\n/g, '\r\n')));
      $('#sendGmail').setAttribute('href', 'https://mail.google.com/mail/?view=cm&fs=1&to=' + encodeURIComponent(TO) + '&su=' + encodeURIComponent(sub) + '&body=' + encodeURIComponent(msg));
    }

    /* Navigation entre étapes */
    function go(n, dir) {
      var from = panels[cur - 1], to = panels[n - 1];
      cur = n;
      stepper.forEach(function (li, i) { li.classList.toggle('is-active', i === n - 1); li.classList.toggle('is-done', i < n - 1); });
      prevBtn.hidden = n === 1;
      if (n === total) nav.setAttribute('data-last', ''); else nav.removeAttribute('data-last');
      nextBtn.querySelector('span').textContent = n === 3 ? 'Vérifier ma demande' : 'Continuer';
      from.hidden = true; to.hidden = false;
      if (n === total) buildRecap();
      if (hasLibs && !reduce) gsap.fromTo(to, { opacity: 0, x: 36 * dir }, { opacity: 1, x: 0, duration: 0.7, ease: 'expo.out', clearProps: 'transform' });
      var card = $('#resaCard'), top = card.getBoundingClientRect().top;
      if (top < 60 || top > window.innerHeight * 0.5) {
        if (lenis) lenis.scrollTo(card, { offset: -90, duration: 1.1 }); else card.scrollIntoView({ behavior: reduce ? 'auto' : 'smooth', block: 'start' });
      }
      var lg = $('legend', to); if (lg) { lg.setAttribute('tabindex', '-1'); lg.focus({ preventScroll: true }); }
    }
    nextBtn.addEventListener('click', function () { if (validate(cur) && cur < total) go(cur + 1, 1); });
    prevBtn.addEventListener('click', function () { if (cur > 1) go(cur - 1, -1); });
    form.addEventListener('keydown', function (e) {
      if (e.key === 'Enter' && e.target.tagName === 'INPUT' && e.target.type !== 'checkbox' && e.target.type !== 'radio') {
        e.preventDefault(); nextBtn.click();
      }
    });
    form.addEventListener('submit', function (e) { e.preventDefault(); });
    form.addEventListener('input', function (e) { if (e.target.name) setErr(e.target.name, ''); });
    form.addEventListener('change', function () { if (cur === total) refreshLinks(); });

    /* Envoi */
    $('#sendMail').addEventListener('click', function (e) {
      if (!validate(4)) { e.preventDefault(); return; }
      refreshLinks();
      var sent = $('#sent'); sent.hidden = false;
      if (hasLibs && !reduce) gsap.from(sent, { opacity: 0, y: 20, duration: 0.8, ease: 'expo.out' });
    });
    $('#sendGmail').addEventListener('click', function (e) {
      if (!validate(4)) { e.preventDefault(); return; }
      refreshLinks(); $('#sent').hidden = false;
    });
    $('#copyMsg').addEventListener('click', function () {
      if (!validate(4)) return;
      var msg = 'À : ' + TO + '\nObjet : ' + subject() + '\n\n' + buildMessage();
      var btn = $('#copyMsg span'), old = btn.textContent;
      var done = function () { btn.textContent = 'Message copié ✓'; $('#sent').hidden = false; setTimeout(function () { btn.textContent = old; }, 2400); };
      if (navigator.clipboard && navigator.clipboard.writeText) { navigator.clipboard.writeText(msg).then(done, fallback); } else { fallback(); }
      function fallback() {
        var ta = document.createElement('textarea'); ta.value = msg; ta.setAttribute('readonly', ''); ta.style.position = 'fixed'; ta.style.opacity = '0';
        document.body.appendChild(ta); ta.select();
        try { document.execCommand('copy'); done(); } catch (err) { btn.textContent = 'Copie impossible'; }
        document.body.removeChild(ta);
      }
    });
    /* Rappel .ics : réponse attendue le prochain mardi */
    $('#icsBtn').addEventListener('click', function () {
      var d = new Date(); d.setHours(12, 0, 0, 0);
      var add = (2 - d.getDay() + 7) % 7; if (add === 0) add = 7;
      d.setDate(d.getDate() + add);
      var e2 = new Date(d); e2.setDate(e2.getDate() + 1);
      var ymd = function (x) { return x.getFullYear() + String(x.getMonth() + 1).padStart(2, '0') + String(x.getDate()).padStart(2, '0'); };
      var stamp = new Date().toISOString().replace(/[-:]/g, '').split('.')[0] + 'Z';
      var ics = ['BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//Une petite Malou Tattoo//Rappel//FR', 'BEGIN:VEVENT',
        'UID:' + Date.now() + '@une-petite-malou-tattoo', 'DTSTAMP:' + stamp,
        'DTSTART;VALUE=DATE:' + ymd(d), 'DTEND;VALUE=DATE:' + ymd(e2),
        'SUMMARY:Réponse attendue – Une petite Malou Tattoo',
        'DESCRIPTION:Les demandes de rendez-vous sont lues chaque mardi. Pense à vérifier ta boîte mail (et les spams).',
        'END:VEVENT', 'END:VCALENDAR'].join('\r\n');
      var blob = new Blob([ics], { type: 'text/calendar;charset=utf-8' });
      var a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = 'rappel-reponse-malou.ics';
      document.body.appendChild(a); a.click(); document.body.removeChild(a);
      setTimeout(function () { URL.revokeObjectURL(a.href); }, 1000);
    });

    /* Silhouette cliquable : synchronisée avec les cases à cocher de la liste */
    (function initBodyMap() {
      var map = $('#bodymap'), out = $('#bodySel');
      if (!map) return;
      var boxes = $$('input[name="emplacement"]', form);
      function sync() {
        var on = boxes.filter(function (b) { return b.checked; }).map(function (b) { return b.value; });
        $$('[data-zone]', map).forEach(function (z) {
          var is = on.indexOf(z.getAttribute('data-zone')) > -1;
          z.classList.toggle('is-on', is);
          z.setAttribute('aria-checked', is ? 'true' : 'false');
        });
        out.textContent = on.length ? 'Sélection : ' + on.join(' · ') : "Touche les zones du corps qui t'intéressent.";
      }
      function toggle(z) {
        var b = boxes.filter(function (x) { return x.value === z.getAttribute('data-zone'); })[0];
        if (!b) return;
        b.checked = !b.checked;
        setErr('emplacement', '');
        sync();
      }
      map.addEventListener('click', function (e) { var z = e.target.closest('[data-zone]'); if (z) toggle(z); });
      map.addEventListener('keydown', function (e) {
        if ((e.key === 'Enter' || e.key === ' ') && e.target.getAttribute && e.target.getAttribute('data-zone')) { e.preventDefault(); toggle(e.target); }
      });
      boxes.forEach(function (b) { b.addEventListener('change', sync); });
      $$('.bodymap__tab', map).forEach(function (t) {
        t.addEventListener('click', function () {
          var v = t.getAttribute('data-view');
          $$('.bodymap__tab', map).forEach(function (x) { x.setAttribute('aria-pressed', x === t ? 'true' : 'false'); });
          $$('.bodymap__figwrap', map).forEach(function (f) { f.classList.toggle('is-active', f.getAttribute('data-view') === v); });
        });
      });
      sync();
    })();

    /* Précision facultative : champ texte masqué tant qu'on n'en a pas besoin */
    var noteBtn = $('#noteToggle'), noteField = $('#noteField');
    if (noteBtn && noteField) {
      noteBtn.addEventListener('click', function () {
        var open = noteField.hidden;
        noteField.hidden = !open;
        noteBtn.setAttribute('aria-expanded', open ? 'true' : 'false');
        $('span', noteBtn).textContent = open ? 'Masquer la précision' : 'Ajouter une précision (facultatif)';
        if (open) $('#f-note').focus();
      });
    }

    renderCal();
    prevBtn.hidden = true;
  }

  /* ---------- Qualité adaptative : allège les effets si l'appareil n'arrive pas à suivre ---------- */
  function enableLite() {
    root.classList.add('lite');
    root.classList.remove('has-cursor');   // on rend le curseur natif quand le curseur personnalisé est désactivé
    var v = $('.hero__video');
    if (v) { try { v.pause(); v.removeAttribute('src'); v.load(); } catch (e) { /* noop */ } }
    $$('[data-tilt], .g-frame').forEach(function (el) { gsap.killTweensOf(el); gsap.set(el, { clearProps: 'transform' }); });
  }
  function initAdaptiveQuality() {
    if (!hasLibs || reduce) return;
    var samples = [], last = 0, bad = 0, until = 0;
    window.addEventListener('scroll', function () { until = performance.now() + 250; }, { passive: true });
    function loop(ts) {
      if (last && ts < until && ts - last < 250) samples.push(ts - last);
      last = ts;
      if (samples.length >= 90) {
        samples.sort(function (a, b) { return a - b; });
        var p75 = samples[Math.floor(samples.length * 0.75)];
        samples = [];
        bad = p75 > 34 ? bad + 1 : 0;   // > 34 ms entre deux images = moins de 30 images/s
        if (bad >= 2) { enableLite(); return; }
      }
      requestAnimationFrame(loop);
    }
    requestAnimationFrame(loop);
  }

  /* ==========================================================================
     Démarrage
     ========================================================================== */
  function boot() {
    try {
      if (hasLibs) { gsap.registerPlugin(ScrollTrigger); ScrollTrigger.config({ limitCallbacks: true, ignoreMobileResize: true }); }
      setupLenis();
      var closeMenu = initMenu();
      initAnchors(closeMenu);
      initFaq(); initReviews(); initLightbox(); initOpenStatus(); initBooking();
      initVideo();
      heroSetup();
      initNav(); initProgress(); heroScroll(); initMarquee();
      initTextReveals(); initImages(); initCounters(); initResponsiveScenes(); initFab();
      initTilt(); initMagnetic();
      if (hasLibs) {
        window.addEventListener('load', function () { ScrollTrigger.refresh(); });
        if (document.fonts && document.fonts.ready) document.fonts.ready.then(function () { ScrollTrigger.refresh(); });
      }
    } catch (err) {
      if (window.console) console.error('[malou] initialisation partielle :', err);
    }
    runLoader().then(function () {
      heroIntro();
      initCursor();
      setTimeout(initAdaptiveQuality, 4000);
      window.__malouReady = true;
    });
    // Sécurité : jamais de préchargeur coincé
    window.__malouReady = window.__malouReady || false;
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot); else boot();
})();
