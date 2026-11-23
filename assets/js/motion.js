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

  function init(root, mode) {
    root = root || document.querySelector("main") || document;
    destroy();
    mm = gsap.matchMedia();
    ctx = gsap.context(function () {

      $$("[data-split]", root).forEach(splitWords);
      function words(el) { return $$(".split-line > span", el); }
      function doneLines(el) { $$(".split-line", el).forEach(function (l) { l.classList.add("is-done"); }); }

      /* ---------- Hero / first screen ---------- */
      var heroScope = root.querySelector(".hero, .page-hero, .smhero, .notfound");
      var heroSplits = heroScope ? $$("[data-split]", heroScope) : [];
      var heroBits = $$("[data-hero]", root);
      var pops = $$("[data-pop]", root);
      var sunwrap = root.querySelector("[data-hero-sun]");
      var rise = root.querySelector("[data-hero-rise]");
      var heroMedia = $$("[data-hero-media]", root);

      heroSplits.forEach(function (el) { gsap.set(words(el), { yPercent: 120 }); });
      if (heroBits.length) gsap.set(heroBits, { autoAlpha: 0, y: 30 });
      if (pops.length) gsap.set(pops, { autoAlpha: 0, y: 36, scale: .92 });
      /* Sun discs never fade or scale (a translucent sun over navy looks muddy,
         a swelling one looks cheap). The full-size hero sun just rises gently into place. */
      var sunLines = sunwrap ? $$(".rings, .rays", sunwrap) : [];
      if (sunLines.length) gsap.set(sunLines, { autoAlpha: 0 });
      if (sunwrap) gsap.set(sunwrap, { y: 90 });
      /* Carrie never fades either (a see-through figure over the sun looks ghostly).
         On Home she rises up from below the frame; elsewhere she's revealed head-first. */
      var riseFromEdge = !!(rise && rise.closest(".hero"));
      if (rise) gsap.set(rise, riseFromEdge ? { yPercent: 100 } : { yPercent: 12, clipPath: "inset(0% 0% 100% 0%)" });
      if (heroMedia.length) gsap.set(heroMedia, { clipPath: "inset(100% 0% 0% 0% round 28px)" });

      function playHero() {
        var tl = gsap.timeline({ defaults: { ease: "expo.out" } });
        if (sunwrap) tl.to(sunwrap, { y: 0, duration: 2.4 }, 0);
        if (sunLines.length) tl.to(sunLines, { autoAlpha: 1, duration: 2, ease: "power2.out" }, 0.3);
        if (rise) tl.to(rise, riseFromEdge ? { yPercent: 0, duration: 2 } : { yPercent: 0, clipPath: "inset(0% 0% 0% 0%)", duration: 1.8, ease: "expo.inOut" }, 0.2);
        heroSplits.forEach(function (el, i) {
          tl.to(words(el), { yPercent: 0, duration: 1.5, stagger: 0.06, onComplete: function () { doneLines(el); } }, 0.15 + i * 0.1);
        });
        if (heroBits.length) tl.to(heroBits, { autoAlpha: 1, y: 0, duration: 1.3, stagger: 0.09 }, 0.65);
        if (heroMedia.length) tl.to(heroMedia, { clipPath: "inset(0% 0% 0% 0% round 28px)", duration: 1.6, ease: "expo.inOut", stagger: 0.1 }, 0.2);
        if (pops.length) tl.to(pops, { autoAlpha: 1, y: 0, scale: 1, duration: 1.2, stagger: 0.12 }, 1.0);
      }
      if (mode === "loader") document.addEventListener("site:loaded", playHero, { once: true });
      else if (mode === "enter") gsap.delayedCall(0.55, playHero);
      else playHero();

      /* Hero depth on scroll */
      var heroEl = root.querySelector(".hero");
      if (heroEl) mm.add("(min-width: 901px)", function () {
        var o = { trigger: heroEl, start: "top top", end: "bottom top", scrub: true };
        if (sunwrap) gsap.to(sunwrap.querySelector(".sun"), { yPercent: 34, scale: .86, ease: "none", scrollTrigger: o });
        if (rise) gsap.to(rise, { yPercent: 6, ease: "none", scrollTrigger: Object.assign({}, o) });
        gsap.to(heroEl.querySelector(".hero__copy"), { y: -80, autoAlpha: .2, ease: "none", scrollTrigger: Object.assign({}, o) });
        gsap.to(pops, { y: -120, ease: "none", scrollTrigger: Object.assign({}, o) });
      });

      /* Pointer parallax on the hero sun (desktop) */
      if (heroEl && sunwrap && window.matchMedia("(hover: hover) and (pointer: fine)").matches) {
        var sun = sunwrap.querySelector(".sun");
        var qx = gsap.quickTo(sun, "x", { duration: 1.4, ease: "expo.out" });
        var qy = gsap.quickTo(sun, "y", { duration: 1.4, ease: "expo.out" });
        heroEl.addEventListener("mousemove", function (e) {
          var r = heroEl.getBoundingClientRect();
          qx((e.clientX - r.left - r.width / 2) * 0.03); qy((e.clientY - r.top - r.height / 2) * 0.03);
        });
      }

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

  window.addEventListener("load", function () { ST.refresh(); });
  if (document.fonts && document.fonts.ready) document.fonts.ready.then(function () { ST.refresh(); });
})();
