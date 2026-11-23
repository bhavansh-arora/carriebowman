/* ==========================================================================
   Carrie Bowman: motion layer (GSAP + ScrollTrigger)
   CBMotion.init(root, mode) builds a page's animations; CBMotion.destroy()
   tears them down so pages can be swapped in place.
   ========================================================================== */
(function () {
  "use strict";

  var reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  var $$ = function (s, c) { return Array.prototype.slice.call((c || document).querySelectorAll(s)); };

  /* ---------- 12-week dial (built in any mode) ---------- */
  var PHASES = ["See it", "See it", "See it", "Feel it", "Feel it", "Feel it", "Shift it", "Shift it", "Shift it", "Live it", "Live it", "Live it"];
  function buildDial(dial) {
    if (dial.dataset.built) return;
    dial.dataset.built = "1";
    var NS = "http://www.w3.org/2000/svg";
    var segs = dial.querySelector(".dial__segs"), ticks = dial.querySelector(".dial__ticks");
    var R = 170, C = 2 * Math.PI * R, gap = 6, seg = C / 12 - gap;
    for (var i = 0; i < 12; i++) {
      var c = document.createElementNS(NS, "circle");
      c.setAttribute("class", "dial__seg"); c.setAttribute("cx", 200); c.setAttribute("cy", 200); c.setAttribute("r", R);
      c.setAttribute("stroke-dasharray", seg + " " + (C - seg));
      c.setAttribute("stroke-dashoffset", String(-(i * C / 12) + C / 4 - gap / 2));
      segs.appendChild(c);
      var a = (i + 0.5) / 12 * Math.PI * 2 - Math.PI / 2;
      var t = document.createElementNS(NS, "text");
      t.setAttribute("class", "dial__tick"); t.setAttribute("text-anchor", "middle"); t.setAttribute("dominant-baseline", "middle");
      t.setAttribute("x", (200 + Math.cos(a) * 200).toFixed(1)); t.setAttribute("y", (200 + Math.sin(a) * 200).toFixed(1));
      t.textContent = "W" + (i + 1);
      ticks.appendChild(t);
    }
  }
  function setDial(dial, week) {
    var segs = $$(".dial__seg", dial);
    segs.forEach(function (s, i) { s.classList.toggle("is-on", i < week); });
    var w = dial.querySelector("[data-dial-week]"), p = dial.querySelector("[data-dial-phase]");
    var wk = Math.max(1, week);
    if (w) w.textContent = wk;
    if (p) p.textContent = PHASES[wk - 1];
  }

  /* ---------- Word splitting (keeps <em>, <br>, rows) ---------- */
  function splitWords(el) {
    if (el.dataset.splitDone) return;
    el.dataset.splitDone = "1";
    var out = document.createDocumentFragment();
    function wrapWord(text, tag, cls) {
      var mask = document.createElement("span");
      mask.className = "split-line"; mask.style.display = "inline-block"; mask.style.verticalAlign = "top";
      var inner = document.createElement("span"); inner.style.display = "inline-block";
      if (tag) { var w = document.createElement(tag); if (cls) w.className = cls; w.textContent = text; inner.appendChild(w); }
      else inner.textContent = text;
      mask.appendChild(inner);
      return mask;
    }
    function walk(node, target, tag, cls) {
      Array.prototype.slice.call(node.childNodes).forEach(function (child) {
        if (child.nodeType === 3) {
          child.textContent.split(/(\s+)/).forEach(function (p) {
            if (!p) return;
            if (/^\s+$/.test(p)) target.appendChild(document.createTextNode(" "));
            else target.appendChild(wrapWord(p, tag, cls));
          });
        } else if (child.nodeType === 1) {
          if (child.tagName === "BR") { target.appendChild(child.cloneNode()); return; }
          if (child.classList.contains("row") || child.classList.contains("tm")) {
            var row = child.cloneNode(false);
            if (child.classList.contains("tm")) { row.textContent = child.textContent; target.appendChild(row); return; }
            walk(child, row, tag, cls);
            target.appendChild(row);
            return;
          }
          walk(child, target, child.tagName.toLowerCase(), child.className);
        }
      });
    }
    walk(el, out, null, null);
    el.innerHTML = "";
    el.appendChild(out);
  }
  function splitStatement(el) {
    if (el.dataset.wordsDone) return;
    el.dataset.wordsDone = "1";
    (function walk(node) {
      Array.prototype.slice.call(node.childNodes).forEach(function (child) {
        if (child.nodeType === 3) {
          var frag = document.createDocumentFragment();
          child.textContent.split(/(\s+)/).forEach(function (p) {
            if (!p) return;
            if (/^\s+$/.test(p)) frag.appendChild(document.createTextNode(p));
            else { var s = document.createElement("span"); s.className = "w"; s.textContent = p; frag.appendChild(s); }
          });
          node.replaceChild(frag, child);
        } else if (child.nodeType === 1 && child.tagName !== "BR") walk(child);
      });
    })(el);
  }

  /* ---------- Static fallback (no GSAP / reduced motion) ---------- */
  if (!window.gsap || !window.ScrollTrigger || reduced) {
    window.CBMotion = {
      init: function (root) {
        root = root || document;
        $$("[data-reveal]", root).forEach(function (el) { el.classList.add("is-in"); });
        $$("[data-dial]", root).forEach(function (d) { buildDial(d); setDial(d, 12); });
      },
      destroy: function () {}
    };
    window.CBMotion.init(document.querySelector("main"));
    return;
  }

  var gsap = window.gsap;
  var ST = window.ScrollTrigger;
  gsap.registerPlugin(ST);
  ST.config({ ignoreMobileResize: true });

  if (window.lenis) {
    window.lenis.on("scroll", ST.update);
    gsap.ticker.add(function (t) { window.lenis.raf(t * 1000); });
    gsap.ticker.lagSmoothing(0);
  }

  var ctx = null, mm = null;
  var heroBusy = false, refreshPending = false, extraCleanups = [];

  /* Layout recalculation is a long task; never run it while the entrance is playing */
  function safeRefresh() { if (heroBusy) refreshPending = true; else ST.refresh(); }

  /* Start the entrance only once fonts and the hero photo are ready (max 1s), after
     doing the layout work up front, so the first frames of motion are clean. */
  function whenReady(heroEl, swashPath, fn) {
    var fired = false;
    var go = function () {
      if (fired) return;
      fired = true;
      ST.refresh();
      if (swashPath && swashPath.__place) swashPath.__place();
      requestAnimationFrame(function () { requestAnimationFrame(fn); });
    };
    var waits = [];
    if (document.fonts && document.fonts.ready) waits.push(document.fonts.ready);
    var img = heroEl && heroEl.querySelector(".hero__figure img");
    if (img && img.decode) waits.push(img.decode().catch(function () {}));
    Promise.all(waits).then(go, go);
    setTimeout(go, 1000);
  }

  /* A hand-drawn sunrise underline beneath "really" in the home headline */
  function buildSwash(hero) {
    var h1 = hero.querySelector("h1"), em = h1 && h1.querySelector("em.glow");
    if (!em) return null;
    var NS = "http://www.w3.org/2000/svg";
    var svg = document.createElementNS(NS, "svg");
    svg.setAttribute("class", "hero__swash");
    svg.setAttribute("viewBox", "0 0 300 24");
    svg.setAttribute("preserveAspectRatio", "none");
    svg.setAttribute("aria-hidden", "true");
    svg.innerHTML = '<defs><linearGradient id="cb-swash-g" x1="0" x2="1" y1="0" y2="0"><stop offset="0" stop-color="#ee6a2c"/><stop offset=".55" stop-color="#f5a524"/><stop offset="1" stop-color="#ffc34d"/></linearGradient></defs>' +
      '<path d="M4 15 C 48 6, 104 4, 156 10 S 248 19, 296 8" stroke="url(#cb-swash-g)" pathLength="1" stroke-dasharray="1" stroke-dashoffset="1"/>';
    h1.appendChild(svg);
    var path = svg.querySelector("path");
    var place = function () {
      var mask = em.closest(".split-line") || em;
      var hr = h1.getBoundingClientRect(), er = mask.getBoundingClientRect();
      var h = Math.max(10, er.height * 0.2);
      svg.style.left = (er.left - hr.left + er.width * 0.02) + "px";
      svg.style.width = (er.width * 0.92) + "px";
      svg.style.top = (er.bottom - hr.top - h * 1.15) + "px";
      svg.style.height = h + "px";
    };
    path.__place = place;
    place();
    window.addEventListener("resize", place);
    extraCleanups.push(function () { window.removeEventListener("resize", place); });
    return path;
  }

  /* The hero label "types" itself in: characters resolve left to right */
  function scramble(el) {
    var target = el.getAttribute("data-text") || el.textContent;
    el.setAttribute("data-text", target);
    var glyphs = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789+/";
    var n = target.length, t0 = performance.now(), D = 1000;
    (function step(now) {
      var p = Math.min(1, (now - t0) / D), shown = Math.floor(p * n), out = "";
      for (var i = 0; i < n; i++) {
        var ch = target.charAt(i);
        /* same word lengths throughout (mono font), so the line never re-wraps */
        if (i < shown || ch === " ") out += ch;
        else out += glyphs.charAt((Math.random() * glyphs.length) | 0);
      }
      el.textContent = out;
      if (p < 1 && el.isConnected) requestAnimationFrame(step); else el.textContent = target;
    })(t0);
  }

  function init(root, mode) {
    root = root || document.querySelector("main") || document;
    destroy();
    mm = gsap.matchMedia();
    ctx = gsap.context(function () {

      $$("[data-split]", root).forEach(splitWords);
      function words(el) { return $$(".split-line > span", el); }
      function doneLines(el) { $$(".split-line", el).forEach(function (l) { l.classList.add("is-done"); }); }

      /* ---------- Hero / first screen ----------
         Everything is prepared first (hidden), then the entrance plays only once fonts
         and the hero photo are ready, so nothing re-flows or pops in mid-animation.
         Only transform and opacity are animated, which the browser can do smoothly. */
      var heroScope = root.querySelector(".hero, .page-hero, .smhero, .notfound");
      var heroSplits = heroScope ? $$("[data-split]", heroScope) : [];
      var heroBits = $$("[data-hero]", root);
      var pops = $$("[data-pop]", root);
      var sunwrap = root.querySelector("[data-hero-sun]");
      var rise = root.querySelector("[data-hero-rise]");
      var heroMedia = $$("[data-hero-media]", root);
      var heroEl = root.querySelector(".hero");            /* Home gets the full choreography */
      var finePtr = window.matchMedia("(hover: hover) and (pointer: fine)").matches;

      /* Home-only pieces */
      var hLabel = heroEl ? heroEl.querySelector("[data-hero-label]") : null;
      var hScramble = heroEl ? heroEl.querySelector("[data-scramble]") : null;
      var hLead = heroEl ? heroEl.querySelector("[data-lead]") : null;
      var hBtns = heroEl ? $$(".hero__copy .actions .btn", heroEl) : [];
      var hFoot = heroEl ? heroEl.querySelector("[data-hero-foot]") : null;
      var hFaces = hFoot ? $$(".faces img", hFoot) : [];
      var hCount = heroEl ? heroEl.querySelector("[data-hero-count]") : null;
      var hProg = heroEl ? heroEl.querySelector(".hero__float--prog") : null;
      var hChip = heroEl ? heroEl.querySelector(".hero__float--cred") : null;
      var hRingsSvg = sunwrap ? sunwrap.querySelector(".rings") : null;
      var hRings = hRingsSvg ? $$("circle", hRingsSvg) : [];
      var hRays = sunwrap ? sunwrap.querySelector(".rays") : null;
      var hFigImg = rise ? rise.querySelector("img") : null;
      if (hLead) splitWords(hLead);
      var hSwash = heroEl ? buildSwash(heroEl) : null;

      /* Initial (hidden) states. The hero sun itself never moves, fades or scales. */
      heroSplits.forEach(function (el) { gsap.set(words(el), heroEl ? { yPercent: 120, rotate: 5, transformOrigin: "0% 100%" } : { yPercent: 120 }); });
      if (heroBits.length) gsap.set(heroBits, { autoAlpha: 0, y: 30 });
      if (heroEl) {
        if (hLabel) gsap.set(hLabel, { autoAlpha: 0, y: 12 });
        if (hLead) gsap.set(words(hLead), { yPercent: 120 });
        if (hBtns.length) gsap.set(hBtns, { autoAlpha: 0, y: 26 });
        if (hFoot) gsap.set(hFoot, { autoAlpha: 0, y: 18 });
        if (hFaces.length) gsap.set(hFaces, { autoAlpha: 0, scale: .4 });
        if (hProg) gsap.set(hProg, { autoAlpha: 0, x: 70, y: 24, rotate: 6 });
        if (hChip) gsap.set(hChip, { autoAlpha: 0, x: -50, y: 10, rotate: -5 });
        if (hRings.length) gsap.set(hRings, { strokeDasharray: 1, strokeDashoffset: 1 });
        if (hRays) gsap.set(hRays, { autoAlpha: 0 });
      } else if (pops.length) gsap.set(pops, { autoAlpha: 0, y: 36, scale: .92 });
      /* Carrie never fades (a see-through figure over the sun looks ghostly).
         On Home she rises up from below the frame; elsewhere she's revealed head-first. */
      var riseFromEdge = !!(rise && heroEl);
      if (rise) gsap.set(rise, riseFromEdge ? { yPercent: 100 } : { yPercent: 12, clipPath: "inset(0% 0% 100% 0%)" });
      if (heroMedia.length) gsap.set(heroMedia, { clipPath: "inset(100% 0% 0% 0% round 28px)" });


      heroBusy = true;
      function heroDone() {
        heroBusy = false;
        if (refreshPending) { refreshPending = false; ST.refresh(); }
        if (!heroEl) return;
        ctx && ctx.add(function () {
          /* gentle, endless float on the two cards (yPercent, so it never fights x/y) */
          if (hProg) gsap.to(hProg, { yPercent: -4, duration: 3.4, ease: "sine.inOut", yoyo: true, repeat: -1 });
          if (hChip) gsap.to(hChip, { yPercent: 14, duration: 2.8, ease: "sine.inOut", yoyo: true, repeat: -1, delay: .5 });
          /* depth on pointer move: each layer travels a different distance */
          if (finePtr && window.matchMedia("(min-width: 901px)").matches) {
            var layers = [[hFigImg, 16], [hProg, 30], [hChip, 22], [hRingsSvg, 12]].filter(function (l) { return l[0]; });
            var qs = layers.map(function (l) {
              return [gsap.quickTo(l[0], "x", { duration: 1.3, ease: "power3.out" }), gsap.quickTo(l[0], "y", { duration: 1.3, ease: "power3.out" }), l[1]];
            });
            heroEl.addEventListener("mousemove", function (e) {
              var r = heroEl.getBoundingClientRect();
              var nx = (e.clientX - r.left) / r.width - 0.5, ny = (e.clientY - r.top) / r.height - 0.5;
              qs.forEach(function (q) { q[0](nx * q[2]); q[1](ny * q[2]); });
            });
          }
        });
      }

      function playHero() {
        var tl = gsap.timeline({ defaults: { ease: "expo.out" }, onComplete: heroDone });
        heroSplits.forEach(function (el, i) {
          tl.to(words(el), { yPercent: 0, rotate: 0, duration: 1.45, stagger: 0.07, onComplete: function () { doneLines(el); } }, 0.08 + i * 0.1);
        });
        if (rise) tl.to(rise, riseFromEdge ? { yPercent: 0, duration: 1.9 } : { yPercent: 0, clipPath: "inset(0% 0% 0% 0%)", duration: 1.8, ease: "expo.inOut" }, 0.3);
        if (heroMedia.length) tl.to(heroMedia, { clipPath: "inset(0% 0% 0% 0% round 28px)", duration: 1.6, ease: "expo.inOut", stagger: 0.1 }, 0.2);
        if (heroBits.length) tl.to(heroBits, { autoAlpha: 1, y: 0, duration: 1.3, stagger: 0.09 }, 0.65);
        if (!heroEl) { if (pops.length) tl.to(pops, { autoAlpha: 1, y: 0, scale: 1, duration: 1.2, stagger: 0.12 }, 1.0); return; }

        /* Home: a layered sequence, each element arriving on its own beat */
        if (hLabel) tl.to(hLabel, { autoAlpha: 1, y: 0, duration: 1 }, 0);
        if (hScramble) tl.call(function () { scramble(hScramble); }, null, 0.05);
        if (hRings.length) tl.to(hRings, { strokeDashoffset: 0, duration: 2.4, ease: "power3.inOut", stagger: 0.14 }, 0.2);
        if (hRays) tl.to(hRays, { autoAlpha: 1, duration: 2.2, ease: "power2.out" }, 0.6);
        if (hLead) tl.to(words(hLead), { yPercent: 0, duration: 1.1, stagger: 0.012, onComplete: function () { doneLines(hLead); } }, 0.62);
        if (hSwash) tl.to(hSwash, { strokeDashoffset: 0, duration: 1.1, ease: "power2.inOut" }, 0.95);
        if (hBtns.length) tl.to(hBtns, { autoAlpha: 1, y: 0, duration: 1.1, stagger: 0.09 }, 0.92);
        if (hBtns[0]) tl.call(function () { hBtns[0].classList.add("is-shine"); }, null, 1.75);
        if (hProg) tl.to(hProg, { autoAlpha: 1, x: 0, y: 0, rotate: 0, duration: 1.5 }, 1.0);
        if (hChip) tl.to(hChip, { autoAlpha: 1, x: 0, y: 0, rotate: 0, duration: 1.4 }, 1.15);
        if (hFoot) tl.to(hFoot, { autoAlpha: 1, y: 0, duration: 1.1 }, 1.1);
        if (hFaces.length) tl.to(hFaces, { autoAlpha: 1, scale: 1, duration: .8, ease: "back.out(2.2)", stagger: .07 }, 1.2);
        if (hCount) {
          var end = parseInt(hCount.textContent, 10) || 0, c = { v: 0 };
          hCount.textContent = "0";
          tl.to(c, { v: end, duration: 1.4, ease: "power3.out", onUpdate: function () { hCount.textContent = Math.round(c.v); } }, 1.2);
        }
      }
      if (mode === "loader") document.addEventListener("site:loaded", function () { whenReady(heroEl, hSwash, playHero); }, { once: true });
      else if (mode === "enter") gsap.delayedCall(0.55, function () { whenReady(heroEl, hSwash, playHero); });
      else whenReady(heroEl, hSwash, playHero);

      /* Depth on scroll (desktop). The sun stays put; Carrie and the copy drift. */
      if (heroEl) mm.add("(min-width: 901px)", function () {
        var o = { trigger: heroEl, start: "top top", end: "bottom top", scrub: true };
        if (hFigImg) gsap.to(hFigImg, { yPercent: 6, ease: "none", scrollTrigger: o });
        gsap.to(heroEl.querySelector(".hero__copy"), { y: -80, autoAlpha: .2, ease: "none", scrollTrigger: Object.assign({}, o) });
      });

      /* ---------- Split headings on scroll ---------- */
      $$("[data-split]", root).forEach(function (el) {
        if (heroSplits.indexOf(el) > -1) return;
        gsap.set(words(el), { yPercent: 120 });
        ST.create({ trigger: el, start: "top 92%", once: true, onEnter: function () {
          gsap.to(words(el), { yPercent: 0, duration: 1.4, ease: "expo.out", stagger: 0.05, onComplete: function () { doneLines(el); } });
        } });
      });

      /* ---------- Generic reveals ---------- */
      var reveals = $$("[data-reveal]", root);
      if (reveals.length) ST.batch(reveals, {
        start: "top 94%", once: true,
        onEnter: function (batch) {
          batch.forEach(function (el, i) {
            var d = parseFloat(el.getAttribute("data-delay") || 0);
            setTimeout(function () { el.classList.add("is-in"); }, (d + i * 0.06) * 1000);
          });
        }
      });
      $$("[data-stagger]", root).forEach(function (group) {
        gsap.fromTo(Array.prototype.slice.call(group.children), { y: 50, autoAlpha: 0 }, {
          y: 0, autoAlpha: 1, duration: 1.2, ease: "expo.out", stagger: 0.08,
          scrollTrigger: { trigger: group, start: "top 92%", once: true }
        });
      });
      $$(".sec-head__top .label, .sec-head > .label", root).forEach(function (el) {
        gsap.fromTo(el, { autoAlpha: 0, x: -20 }, { autoAlpha: 1, x: 0, duration: 1.2, ease: "expo.out", scrollTrigger: { trigger: el, start: "top 92%", once: true } });
      });

      /* Image clip reveals */
      $$("[data-clip]", root).forEach(function (el) {
        var img = el.querySelector("img");
        gsap.fromTo(el, { clipPath: "inset(100% 0% 0% 0%)" }, {
          clipPath: "inset(0% 0% 0% 0%)", duration: 1.7, ease: "expo.inOut",
          scrollTrigger: { trigger: el, start: "top 88%", once: true },
          onComplete: function () { el.style.clipPath = ""; }
        });
        if (img) gsap.fromTo(img, { scale: 1.22 }, { scale: 1, duration: 2.2, ease: "expo.out", scrollTrigger: { trigger: el, start: "top 88%", once: true } });
      });

      /* Parallax */
      $$("[data-speed]", root).forEach(function (el) {
        var s = parseFloat(el.getAttribute("data-speed"));
        gsap.fromTo(el, { yPercent: -s * 10 }, { yPercent: s * 10, ease: "none", scrollTrigger: { trigger: el.parentElement, start: "top bottom", end: "bottom top", scrub: true } });
      });

      /* Statement: words light up as you read */
      $$("[data-words]", root).forEach(function (el) {
        splitStatement(el);
        gsap.to($$(".w", el), { opacity: 1, ease: "none", stagger: 0.1, scrollTrigger: { trigger: el, start: "top 82%", end: "bottom 50%", scrub: 0.6 } });
      });

      /* Counters */
      $$("[data-count]", root).forEach(function (el) {
        var end = parseFloat(el.getAttribute("data-count"));
        var obj = { v: 0 };
        el.textContent = "0";
        ST.create({ trigger: el, start: "top 92%", once: true, onEnter: function () {
          gsap.to(obj, { v: end, duration: 2, ease: "power3.out", onUpdate: function () { el.textContent = Math.round(obj.v); } });
        } });
      });

      /* Stacking pillars recede */
      var pillars = $$(".pillar", root);
      if (pillars.length) mm.add("(min-width: 1025px)", function () {
        pillars.forEach(function (card, i) {
          var nxt = pillars[i + 1];
          if (!nxt) return;
          gsap.fromTo(card, { scale: 1, filter: "brightness(1)" }, { scale: 0.93, filter: "brightness(.82)", ease: "none", scrollTrigger: { trigger: nxt, start: "top 90%", end: "top 25%", scrub: true } });
        });
      });

      /* 12-week dial: scrubbed with scroll */
      $$("[data-dial]", root).forEach(function (dial) {
        buildDial(dial);
        setDial(dial, 1);
        ST.create({ trigger: dial, start: "top 75%", end: "bottom 35%", scrub: true,
          onUpdate: function (self) { setDial(dial, Math.max(1, Math.ceil(self.progress * 12))); } });
      });

      /* Horizontal "other side" scroll (desktop), native swipe below */
      $$("[data-hscroll]", root).forEach(function (sec) {
        var pin = sec.querySelector(".hscroll__pin");
        var track = sec.querySelector(".hscroll__track");
        var bar = sec.querySelector(".hscroll__bar i");
        mm.add("(min-width: 1025px)", function () {
          var dist = function () { return Math.max(0, track.scrollWidth - window.innerWidth + 40); };
          gsap.to(track, {
            x: function () { return -dist(); }, ease: "none",
            scrollTrigger: { trigger: pin, start: "center center", end: function () { return "+=" + dist(); }, pin: true, scrub: 0.8, invalidateOnRefresh: true, anticipatePin: 1,
              onUpdate: function (self) { if (bar) bar.style.transform = "scaleX(" + self.progress + ")"; } }
          });
        });
        mm.add("(max-width: 1024px)", function () {
          var onS = function () { var m = pin.scrollWidth - pin.clientWidth; if (bar && m > 0) bar.style.transform = "scaleX(" + (pin.scrollLeft / m) + ")"; };
          pin.addEventListener("scroll", onS, { passive: true });
          return function () { pin.removeEventListener("scroll", onS); };
        });
      });

      /* Final CTA sun rises */
      $$("[data-sunrise]", root).forEach(function (s) {
        gsap.fromTo(s, { y: 120 }, { y: 0, ease: "none", scrollTrigger: { trigger: s.closest("section"), start: "top bottom", end: "bottom bottom", scrub: true } });
      });

      /* About journey line */
      $$(".journey", root).forEach(function (j) {
        var fill = j.querySelector(".journey__fill");
        if (fill) gsap.to(fill, { scaleY: 1, ease: "none", scrollTrigger: { trigger: j, start: "top 70%", end: "bottom 60%", scrub: true } });
      });

      /* 3D tilt */
      if (window.matchMedia("(hover: hover) and (pointer: fine)").matches) {
        $$("[data-tilt]", root).forEach(function (el) {
          el.addEventListener("mousemove", function (e) {
            var r = el.getBoundingClientRect();
            var x = (e.clientX - r.left) / r.width - 0.5, y = (e.clientY - r.top) / r.height - 0.5;
            gsap.to(el, { rotateY: x * 14, rotateX: -y * 14, rotate: -6, transformPerspective: 900, duration: 0.6, ease: "power3.out" });
          });
          el.addEventListener("mouseleave", function () { gsap.to(el, { rotateY: 0, rotateX: 0, rotate: -6, duration: 1, ease: "expo.out" }); });
        });
      }
    }, root);

    ST.refresh();
  }

  function destroy() {
    extraCleanups.splice(0).forEach(function (fn) { fn(); });
    heroBusy = false;
    if (mm) { mm.revert(); mm = null; }
    if (ctx) { ctx.revert(); ctx = null; }
  }

  /* Footer wordmark (outside <main>, once) */
  var word = document.querySelector(".footer__word");
  if (word) gsap.fromTo(word, { yPercent: 50, autoAlpha: 0 }, { yPercent: 0, autoAlpha: 1, ease: "expo.out", duration: 1.6, scrollTrigger: { trigger: word, start: "top 98%", once: true } });

  window.CBMotion = { init: init, destroy: destroy, refresh: function () { ST.refresh(); } };

  var html = document.documentElement;
  var firstMode = html.classList.contains("is-loading") ? "loader" : html.classList.contains("pt-enter") ? "enter" : "now";
  init(document.querySelector("main"), firstMode);

  window.addEventListener("load", safeRefresh);
  if (document.fonts && document.fonts.ready) document.fonts.ready.then(safeRefresh);
})();
