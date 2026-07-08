/* Order From Drift — scroll choreography.
   Lenis smooth scroll + GSAP ScrollTrigger drives:
   - reveal-on-scroll for beat copy
   - the fixed 3D Drift Field's visibility + uDrift/uOrder per beat
   - the compliance-gap mono readout in beat 3
   - the command-center dashboard resolving card by card
   ============================================================ */
(function () {
  'use strict';
  var REDUCED = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  var driftEl = document.querySelector('.drift-3d-fixed');

  function setCardReady(card, ready) {
    card.classList.toggle('dash__card--ready', ready);
    var t = card.querySelector('.dash__status-text');
    if (t) t.textContent = ready ? 'Ready' : 'Checking…';
  }

  if (REDUCED) {
    // Autoplay videos still fire from the HTML attribute regardless of JS;
    // stop them explicitly and fall back to their poster/static bg.
    document.querySelectorAll('.beat__loop-video').forEach(function (v) {
      v.pause();
      v.removeAttribute('autoplay');
      v.style.display = 'none';
    });
  }

  if (REDUCED || !window.gsap || !window.ScrollTrigger) {
    document.querySelectorAll('.beat__content').forEach(function (el) { el.style.opacity = 1; });
    document.querySelectorAll('.dash__card').forEach(function (el) { setCardReady(el, true); });
    return;
  }

  gsap.registerPlugin(ScrollTrigger);

  var lenis = null;
  if (window.Lenis) {
    lenis = new Lenis({ lerp: 0.14, smoothTouch: false, syncTouch: false });
    lenis.on('scroll', ScrollTrigger.update);
    gsap.ticker.add(function (time) { lenis.raf(time * 1000); });
    gsap.ticker.lagSmoothing(0);
  }

  // Smooth in-page nav (Lenis owns scroll, so native anchor jump would fight it).
  document.querySelectorAll('.nav__links a[href^="#"]').forEach(function (a) {
    a.addEventListener('click', function (e) {
      var id = a.getAttribute('href');
      var target = document.querySelector(id);
      if (!target || !lenis) return;
      e.preventDefault();
      lenis.scrollTo(target, { offset: -100 });
    });
  });

  // Reveal each beat's copy as it enters.
  gsap.utils.toArray('.beat__content').forEach(function (el) {
    gsap.fromTo(el, { autoAlpha: 0, y: 46 }, {
      autoAlpha: 1, y: 0, duration: 0.9, ease: 'power2.out',
      scrollTrigger: { trigger: el, start: 'top 82%', toggleActions: 'play none none reverse' }
    });
  });

  // 3D Drift Field visibility + drift/order uniforms per beat.
  var beat1 = document.getElementById('beat-1');
  var beat3 = document.getElementById('beat-3');
  var beat5 = document.getElementById('beat-5');
  var beat6 = document.getElementById('beat-6');
  var driftScene = null;
  function scene() { return driftScene || (driftScene = window.__driftScene); }

  function fadeDrift(opacity) {
    if (driftEl) gsap.to(driftEl, { opacity: opacity, duration: 0.6, overwrite: true });
  }

  function isInView(el) {
    if (!el) return false;
    var r = el.getBoundingClientRect();
    return r.top < window.innerHeight && r.bottom > 0;
  }

  if (beat1) {
    ScrollTrigger.create({
      trigger: beat1, start: 'top bottom', end: 'bottom top',
      onEnter: function () { fadeDrift(0.9); },
      onLeave: function () { if (!isInView(beat3) && !isInView(beat5)) fadeDrift(0); },
      onEnterBack: function () { fadeDrift(0.9); }
    });
    ScrollTrigger.create({
      trigger: beat1, start: 'top top', end: 'bottom top', scrub: true,
      onUpdate: function (self) { var s = scene(); if (s) s.setDrift(self.progress * 0.35); }
    });
  }

  if (beat3) {
    ScrollTrigger.create({
      trigger: beat3, start: 'top bottom', end: 'bottom top',
      onEnter: function () { fadeDrift(0.55); },
      onLeave: function () { if (!isInView(beat5)) fadeDrift(0); },
      onEnterBack: function () {
        fadeDrift(0.55);
        // Coming back up from beat 4/5, the order-scrub may have clamped
        // the drivers to its own extremes (full order, zero drift) - reset
        // to beat-3's own baseline so re-entering doesn't visually "pop"
        // straight from a resolved ring to full chaos or vice versa.
        var s = scene(); if (s) { s.setOrder(0); s.setDrift(0.35); }
      },
      onLeaveBack: function () { if (!isInView(beat1)) fadeDrift(0); }
    });
    ScrollTrigger.create({
      trigger: beat3, start: 'top bottom', end: 'bottom top', scrub: true,
      onUpdate: function (self) {
        var s = scene(); var d = 0.35 + self.progress * 0.65;
        if (s) s.setDrift(d);
        // The on-screen number is a separate, more conservative scale than
        // the 3D driver above - "100% compliance gap" reads as apocalyptic
        // to a compliance-literate audience; cap it at a credible "growing
        // risk" ceiling instead.
        var readout = document.getElementById('gap-readout');
        if (readout) readout.textContent = (35 + self.progress * 33).toFixed(1) + '%';
      }
    });
  }

  // The "order" payoff: chaos snaps to the 7-node lattice through beat 5,
  // and the field stays visible (faint) through beat 6 so the resolved
  // copy and the resolved visual land together instead of the field
  // vanishing one beat early.
  if (beat5) {
    ScrollTrigger.create({
      trigger: beat5, start: 'top bottom', end: 'bottom center',
      onEnter: function () { fadeDrift(0.35); },
      onEnterBack: function () { fadeDrift(0.35); }
    });
    ScrollTrigger.create({
      trigger: beat5, start: 'top 70%', end: 'center center', scrub: true,
      onUpdate: function (self) { var s = scene(); if (s) { s.setOrder(self.progress); s.setDrift(1 - self.progress); } }
    });

    // Dashboard cards resolve as the section scrolls through - scrub-linked
    // (not a wall-clock stagger) so it can never be "missed" by a fast
    // scroll and it un-resolves cleanly on scroll-back rather than being a
    // one-shot that can only ever fire once.
    var cards = gsap.utils.toArray('.dash__card');
    ScrollTrigger.create({
      trigger: beat5, start: 'top 75%', end: 'top 30%', scrub: true,
      onUpdate: function (self) {
        var readyCount = Math.round(self.progress * cards.length);
        cards.forEach(function (card, i) { setCardReady(card, i < readyCount); });
      }
    });
  }

  if (beat6) {
    ScrollTrigger.create({
      trigger: beat6, start: 'top bottom', end: 'bottom 40%',
      onLeave: function () { fadeDrift(0); },
      onEnterBack: function () { fadeDrift(0.2); }
    });
  }

  // Ensure loop videos actually autoplay (some mobile browsers need a nudge).
  document.querySelectorAll('video[autoplay]').forEach(function (v) {
    var p = v.play();
    if (p && p.catch) p.catch(function () {});
  });
})();
