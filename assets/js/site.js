/* ==========================================================================
   Carrie Bowman: interface behaviour
   Global (once): smooth scroll, header, menu, loader, cursor, dock and
   in-place page transitions. Per page: initPage(root) wires up <main>; it
   runs on load and again after every in-place page swap.
   ========================================================================== */
(function () {
  "use strict";

  var CFG = window.SITE_CONFIG || {};
  var doc = document.documentElement;
  var body = document.body;
  var reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  var finePointer = window.matchMedia("(hover: hover) and (pointer: fine)").matches;
  if (reduced) doc.classList.add("reduced");

  var $ = function (s, c) { return (c || document).querySelector(s); };
  var $$ = function (s, c) { return Array.prototype.slice.call((c || document).querySelectorAll(s)); };
  var store = {
    get: function (k) { try { return window.sessionStorage.getItem(k); } catch (e) { return null; } },
    set: function (k, v) { try { window.sessionStorage.setItem(k, v); } catch (e) { /* storage unavailable */ } }
  };
  if ("scrollRestoration" in history) history.scrollRestoration = "manual";

  var cleanups = [];
  function onCleanup(fn) { cleanups.push(fn); }
  function runCleanups() { cleanups.splice(0).forEach(function (fn) { try { fn(); } catch (e) { /* ignore */ } }); }

  /* ---------- Smooth scroll ---------- */
  var lenis = null;
  if (!reduced && window.Lenis) {
    lenis = new window.Lenis({ duration: 1.15, easing: function (t) { return Math.min(1, 1.001 - Math.pow(2, -10 * t)); }, smoothWheel: true });
    window.lenis = lenis;
    if (!window.gsap) {
      var raf = function (time) { lenis.raf(time); requestAnimationFrame(raf); };
      requestAnimationFrame(raf);
    }
  }
  function scrollToEl(target, offset) {
    var off = typeof offset === "number" ? offset : -90;
    if (lenis) lenis.scrollTo(target, { offset: off });
    else window.scrollTo({ top: target.getBoundingClientRect().top + window.scrollY + off, behavior: reduced ? "auto" : "smooth" });
  }
  function jumpTop() {
    if (lenis) lenis.scrollTo(0, { immediate: true, force: true });
    window.scrollTo(0, 0);
  }
  $$("[data-year]").forEach(function (el) { el.textContent = new Date().getFullYear(); });

  /* ---------- Header ---------- */
  var header = $(".site-header");
  var dock = $(".dock");
  var lastY = window.scrollY;
  var ticking = false;
  function darkUnderHeader() {
    if (!header || !document.elementsFromPoint) return false;
    /* offsetTop ignores the slide-away transform, so this is the header's resting position */
    var els = document.elementsFromPoint(window.innerWidth / 2, header.offsetTop + header.offsetHeight / 2);
    for (var i = 0; i < els.length; i++) {
      var el = els[i];
      if (header.contains(el) || el.closest(".menu, .subnav, .dock, .cursor")) continue;
      var sec = el.closest("[data-theme]");
      if (sec) return sec.getAttribute("data-theme") === "dark";
    }
    return false;
  }
  var dockBlocked = false;
  function onScroll() {
    var y = window.scrollY;
    if (header) {
      var goingDown = y > lastY && y > 420;
      if (!body.classList.contains("menu-open")) header.classList.toggle("is-hidden", goingDown);
      header.classList.toggle("on-dark", darkUnderHeader());
    }
    if (dock) dock.classList.toggle("is-on", y > window.innerHeight * 0.9 && !dockBlocked && body.getAttribute("data-page") !== "call");
    lastY = y;
    ticking = false;
  }
  window.addEventListener("scroll", function () {
    if (!ticking) { requestAnimationFrame(onScroll); ticking = true; }
  }, { passive: true });
  window.addEventListener("resize", function () { onScroll(); }, { passive: true });

  /* ---------- Menu ---------- */
  var toggle = $(".menu-toggle");
  var toggleText = $(".menu-toggle__text");
  var menu = $(".menu");
  function openMenu() {
    body.classList.add("menu-open");
    if (toggle) toggle.setAttribute("aria-expanded", "true");
    if (toggleText) toggleText.textContent = "Close";
    if (lenis) lenis.stop();
    if (menu) menu.removeAttribute("inert");
    if (header) { header.classList.remove("is-hidden"); header.classList.add("on-dark"); }
  }
  function closeMenu(instant) {
    if (!body.classList.contains("menu-open")) return;
    if (instant && menu) menu.classList.add("no-anim");
    body.classList.remove("menu-open");
    if (toggle) toggle.setAttribute("aria-expanded", "false");
    if (toggleText) toggleText.textContent = "Menu";
    if (lenis) lenis.start();
    if (menu) menu.setAttribute("inert", "");
    onScroll();
    if (instant && menu) requestAnimationFrame(function () { requestAnimationFrame(function () { menu.classList.remove("no-anim"); }); });
  }
  if (toggle) toggle.addEventListener("click", function () { body.classList.contains("menu-open") ? closeMenu() : openMenu(); });
  document.addEventListener("keydown", function (e) { if (e.key === "Escape") closeMenu(); });

  /* ---------- Browser chrome colour ---------- */
  var themeMeta = $('meta[name="theme-color"]');
  function uiInk() { if (themeMeta) themeMeta.setAttribute("content", "#0b1622"); }
  function uiPaper() { if (themeMeta) themeMeta.setAttribute("content", "#fbf8f3"); }

  /* ---------- Loader (first visit per session, home only) ---------- */
  var loader = $(".loader");
  function loaded() {
    body.classList.add("is-loaded");
    document.dispatchEvent(new CustomEvent("site:loaded"));
  }
  /* Intro, "eyes opening": "Wake up." rises on the seam between two dark halves, a
     hairline of light slices across it, then the halves part like eyelids and the
     hero comes into focus behind them. */
  var SEAM_AT = 1050, OPEN_AT = 1550;
  if (loader && doc.classList.contains("is-loading") && !reduced) {
    var lWords = $$(".loader__word .w", loader);
    var lSeam = $(".loader__seam", loader), lCount = $(".loader__count", loader);
    requestAnimationFrame(function () { requestAnimationFrame(function () {
      doc.classList.add("loader-go");
      lWords.forEach(function (w, i) {                 /* both halves move in lockstep */
        w.style.transition = "transform 1.15s cubic-bezier(.22,1,.36,1) " + (0.15 + (i % 2) * 0.09) + "s";
        w.style.transform = "translateY(0)";
      });
    }); });
    setTimeout(function () {
      lSeam.style.transition = "transform .5s cubic-bezier(.65,0,.35,1)";
      lSeam.style.transform = "scaleX(1)";
    }, SEAM_AT);
    var t0 = performance.now();
    (function tick(now) {
      var p = Math.min(1, (now - t0) / OPEN_AT);
      var e = 1 - Math.pow(1 - p, 3);
      if (lCount) lCount.textContent = String(Math.round(e * 100)).padStart(3, "0");
      if (p < 1) requestAnimationFrame(tick);
      else finishLoader();
    })(t0);
  } else {
    if (loader) loader.remove();
    doc.classList.remove("is-loading");
    if (!doc.classList.contains("pt-enter")) uiPaper();
    loaded();
  }
  /* The eyelids open: top half up, bottom half down, tearing the word along the seam */
  function finishLoader() {
    var open = "transform 1.2s cubic-bezier(.83,0,.17,1)";
    var top = $(".loader__half--top", loader), bottom = $(".loader__half--bottom", loader);
    top.style.transition = open; bottom.style.transition = open;
    top.style.transform = "translateY(-101%)";
    bottom.style.transform = "translateY(101%)";
    loader.style.pointerEvents = "none";
    setTimeout(loaded, 220);      /* the hero comes into focus as the halves part */
    setTimeout(uiPaper, 600);
    setTimeout(function () {
      doc.classList.remove("is-loading", "loader-go");
      if (loader.parentNode) loader.parentNode.removeChild(loader);
    }, 1350);
  }

  /* ---------- Cursor ---------- */
  if (finePointer && !reduced) {
    var cursor = document.createElement("div");
    cursor.className = "cursor";
    cursor.setAttribute("aria-hidden", "true");
    cursor.innerHTML = '<div class="cursor__dot"></div><div class="cursor__ring"><span></span></div>';
    body.appendChild(cursor);
    var dot = $(".cursor__dot", cursor), ring = $(".cursor__ring", cursor), label = $("span", ring);
    var mx = -100, my = -100, rx = -100, ry = -100;
    window.addEventListener("mousemove", function (e) { mx = e.clientX; my = e.clientY; }, { passive: true });
    (function loop() {
      rx += (mx - rx) * 0.18; ry += (my - ry) * 0.18;
      dot.style.transform = "translate3d(" + mx + "px," + my + "px,0)";
      ring.style.transform = "translate3d(" + rx + "px," + ry + "px,0)";
      requestAnimationFrame(loop);
    })();
    document.addEventListener("mouseover", function (e) {
      var t = e.target.closest("[data-cursor], a, button, label.choice, .option");
      cursor.classList.remove("is-hover", "is-label");
      var sec = e.target.closest("[data-theme]");
      cursor.classList.toggle("on-dark", (sec && sec.getAttribute("data-theme") === "dark") || body.classList.contains("menu-open"));
      if (!t) return;
      var txt = t.getAttribute("data-cursor");
      if (txt) { label.textContent = txt; cursor.classList.add("is-label"); }
      else cursor.classList.add("is-hover");
    });
    document.addEventListener("mouseleave", function () { cursor.style.opacity = "0"; });
    document.addEventListener("mouseenter", function () { cursor.style.opacity = "1"; });
  }

  /* ==========================================================================
     IN-PLACE PAGE TRANSITIONS
     A sunrise-and-ink curtain covers the screen, the next page's <main> is
     fetched and swapped in behind it, then the curtain lifts away.
     ========================================================================== */
  var curtain = $(".curtain");
  var ctTitle = curtain ? $(".curtain__title", curtain) : null;
  var PAGE_TITLES = {
    "index": "Wake up &amp; feel <em>alive</em>", "": "Wake up &amp; feel <em>alive</em>",
    "about": "About <em>Carrie</em>", "self-mastery": "Self-<em>Mastery</em>™",
    "limitless-mastery": "Limitless <em>Mastery</em>", "results": "Client <em>results</em>",
    "speaking": "Speaking &amp; <em>keynotes</em>", "journal": "The <em>journal</em>",
    "clarity-call": "Your Clarity <em>Call</em>", "404": "Off the <em>path</em>"
  };
  function titleFor(path) {
    var key = (path.split("/").pop() || "").replace(/\.html$/, "");
    return PAGE_TITLES[key] || "Carrie <em>Bowman</em>";
  }
  function resetCurtain() {
    if (!curtain) return;
    curtain.classList.add("no-anim");
    curtain.classList.remove("is-leaving", "is-covering", "is-covered");
    doc.classList.remove("pt-enter", "pt-covered");
    doc.style.backgroundColor = "";
    uiPaper();
    void curtain.offsetHeight;
    requestAnimationFrame(function () { requestAnimationFrame(function () { curtain.classList.remove("no-anim"); }); });
  }
  function liftCurtain() {
    if (!curtain) return;
    curtain.classList.add("no-anim", "is-covered");
    curtain.classList.remove("is-covering");
    doc.classList.remove("pt-enter");
    void curtain.offsetHeight;
    curtain.classList.remove("no-anim");
    requestAnimationFrame(function () { requestAnimationFrame(function () {
      doc.classList.remove("pt-covered");
      curtain.classList.remove("is-covered");
      curtain.classList.add("is-leaving");
      setTimeout(uiPaper, 500);
      setTimeout(function () { resetCurtain(); onScroll(); }, 1300);
    }); });
  }
  /* Arrived via a full page load in the middle of a transition (fallback path) */
  if (curtain && doc.classList.contains("pt-enter")) {
    if (ctTitle) ctTitle.innerHTML = titleFor(location.pathname);
    liftCurtain();
  }

  var pageCache = {};
  function fetchPage(path) {
    if (!pageCache[path]) {
      pageCache[path] = fetch(path, { credentials: "same-origin" }).then(function (r) {
        if (!r.ok && r.status !== 404) throw new Error("HTTP " + r.status);
        return r.text();
      }).catch(function (err) { delete pageCache[path]; throw err; });
    }
    return pageCache[path];
  }
  function isPageLink(url) {
    return url.origin === location.origin && (/\.html$/.test(url.pathname) || /\/$/.test(url.pathname));
  }

  function cover(path) {
    return new Promise(function (resolve) {
      if (ctTitle) ctTitle.innerHTML = titleFor(path);
      curtain.classList.add("is-covering");
      setTimeout(uiInk, 300);
      var done = false;
      var fin = function () {
        if (done) return; done = true;
        curtain.classList.add("is-covered"); doc.classList.add("pt-covered");
        setTimeout(resolve, 420);
      };
      var ink = $(".curtain__ink", curtain);
      ink.addEventListener("transitionend", function h(ev) { if (ev.target === ink && ev.propertyName === "transform") { ink.removeEventListener("transitionend", h); fin(); } });
      setTimeout(fin, 1400);
    });
  }

  var navigating = false;
  function navigate(url, push) {
    if (navigating) return;
    navigating = true;
    Promise.all([fetchPage(url.pathname), cover(url.pathname)]).then(function (res) {
      swapPage(res[0], url, push);
      navigating = false;
    }).catch(function () {
      try { store.set("cb_pt", "1"); store.set("cb_pt_t", titleFor(url.pathname)); } catch (e) { /* ignore */ }
      location.href = url.href;
    });
  }

  function swapPage(html, url, push) {
    var next = new DOMParser().parseFromString(html, "text/html");
    var newMain = next.querySelector("main");
    if (!newMain) { location.href = url.href; return; }

    if (window.CBMotion) window.CBMotion.destroy();
    runCleanups();
    closeMenu(true);

    $("main").replaceWith(document.importNode(newMain, true));
    document.title = next.title;
    var a = $('meta[name="description"]'), b = next.querySelector('meta[name="description"]');
    if (a && b) a.setAttribute("content", b.getAttribute("content"));
    var canon = $('link[rel="canonical"]'), nCanon = next.querySelector('link[rel="canonical"]');
    if (canon && nCanon) canon.setAttribute("href", nCanon.getAttribute("href"));
    body.setAttribute("data-page", next.body.getAttribute("data-page") || "");
    [".site-header .nav", ".menu__list"].forEach(function (sel) {
      var x = $(sel), y = next.querySelector(sel);
      if (x && y) x.innerHTML = y.innerHTML;
    });

    if (push) history.pushState({ cb: 1 }, "", url.href);
    jumpTop();
    if (header) header.classList.remove("is-hidden");

    var main = $("main");
    initPage(main);
    if (window.CBMotion) window.CBMotion.init(main, "enter");
    lastY = 0; onScroll();

    if (url.hash) {
      var t = document.getElementById(url.hash.slice(1));
      if (t) setTimeout(function () { scrollToEl(t); }, 1000);
    }
    liftCurtain();
  }

  document.addEventListener("click", function (e) {
    var a = e.target.closest("a[href]");
    if (!a || e.defaultPrevented || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey || e.button !== 0) return;
    if (a.target && a.target !== "_self") return;
    var href = a.getAttribute("href");
    if (!href || /^(mailto:|tel:|javascript:)/i.test(href)) return;
    if (href.charAt(0) === "#") {
      if (href.length < 2) return;
      var target = document.querySelector(href);
      if (!target) return;
      e.preventDefault();
      closeMenu();
      scrollToEl(target);
      return;
    }
    var url = new URL(a.href, location.href);
    if (!isPageLink(url)) return;
    if (url.pathname === location.pathname && url.search === location.search) {
      e.preventDefault();
      closeMenu();
      if (url.hash) {
        var t = document.getElementById(url.hash.slice(1));
        if (t) scrollToEl(t);
      } else scrollToEl(document.body, 0);
      return;
    }
    if (!curtain || reduced) return;
    e.preventDefault();
    navigate(url, true);
  });

  if (curtain && !reduced) {
    history.replaceState({ cb: 1 }, "", location.href);
    window.addEventListener("popstate", function () {
      var url = new URL(location.href);
      if (isPageLink(url)) navigate(url, false);
    });
  }
  window.addEventListener("pageshow", function (e) { if (e.persisted) { closeMenu(true); resetCurtain(); } });

  function warmPath(path) { if (path !== location.pathname) fetchPage(path).catch(function () {}); }
  var warm = function (e) {
    var a = e.target.closest && e.target.closest("a[href]");
    if (!a) return;
    var href = a.getAttribute("href");
    if (!href || href.charAt(0) === "#" || /^(mailto:|tel:)/i.test(href) || a.target === "_blank") return;
    var u = new URL(a.href, location.href);
    if (isPageLink(u)) warmPath(u.pathname);
  };
  document.addEventListener("touchstart", warm, { passive: true });
  document.addEventListener("mouseover", warm, { passive: true });
  (window.requestIdleCallback || function (f) { return setTimeout(f, 1600); })(function () {
    $$(".site-header .nav a").forEach(function (a) {
      var u = new URL(a.href, location.href);
      if (isPageLink(u)) warmPath(u.pathname);
    });
  });

  /* ---------- Shared helpers for forms ---------- */
  function postJSON(endpoint, payload) {
    return fetch(endpoint, {
      method: "POST",
      headers: { "Content-Type": "application/json", "Accept": "application/json" },
      body: JSON.stringify(payload)
    }).then(function (r) { if (!r.ok) throw new Error("HTTP " + r.status); return r; });
  }
  function mailto(subject, summary) {
    var lines = Object.keys(summary).map(function (k) { return k + ": " + summary[k]; }).join("\n");
    window.location.href = "mailto:" + (CFG.email || "") + "?subject=" + encodeURIComponent(subject) + "&body=" + encodeURIComponent(lines);
  }
  function validEmail(v) { return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test((v || "").trim()); }
  function firstName(n) { return ((n || "").trim().split(/\s+/)[0]) || "friend"; }

  /* Newsletter / guide sign-ups (footer one is global, guide one lives in <main>) */
  function wireSignup(form) {
    if (form.dataset.wired) return; form.dataset.wired = "1";
    var kind = form.getAttribute("data-signup");
    var note = form.parentNode.querySelector(".form-note");
    form.addEventListener("submit", function (e) {
      e.preventDefault();
      var email = form.querySelector('[name="email"]');
      var name = form.querySelector('[name="name"]');
      var hp = form.querySelector('[name="_gotcha"]');
      if (hp && hp.value) return;
      if (!validEmail(email.value) || (name && !name.value.trim())) {
        form.classList.remove("shake"); void form.offsetWidth; form.classList.add("shake");
        if (note) { note.textContent = name && !name.value.trim() ? "Please add your first name and email." : "Please enter a valid email address."; note.classList.remove("is-ok"); }
        return;
      }
      var data = { email: email.value.trim(), name: name ? name.value.trim() : "", list: kind, source: location.href };
      var endpoint = kind === "guide" ? CFG.guideEndpoint : CFG.insiderEndpoint;
      var ok = function () {
        form.classList.add("is-sent");
        if (note) {
          note.classList.add("is-ok");
          note.textContent = kind === "guide" ? "Thank you, " + firstName(data.name) + "! The guide is on its way to your inbox." : "You’re in. Welcome to the inside.";
        }
        form.reset();
      };
      if (endpoint) {
        var btn = form.querySelector("button"); if (btn) btn.setAttribute("aria-busy", "true");
        postJSON(endpoint, data).then(ok).catch(function () {
          if (note) note.textContent = "Something went wrong. Please try again, or email Carrie directly.";
        }).then(function () { if (btn) btn.removeAttribute("aria-busy"); });
      } else {
        mailto(kind === "guide" ? "Please send me “5 Bold Steps to Your Dream Career”" : "Add me to the insider list",
          { Name: data.name || "—", Email: data.email, Request: kind === "guide" ? "Free guide: 5 Bold Steps to Your Dream Career" : "Insider emails" });
        if (note) { note.classList.add("is-ok"); note.textContent = "Your email app has opened with your request ready to send."; }
      }
    });
  }
  $$(".site-footer [data-signup]").forEach(wireSignup);

  /* ==========================================================================
     PER-PAGE INITIALISATION
     ========================================================================== */
  function initPage(root) {

    /* Dock: hide while the final call-to-action or footer is on screen */
    if ("IntersectionObserver" in window && dock) {
      var blockers = $$(".cta-final, .site-footer, .form", document);
      var visible = new Set();
      var dio = new IntersectionObserver(function (entries) {
        entries.forEach(function (en) { if (en.isIntersecting) visible.add(en.target); else visible.delete(en.target); });
        dockBlocked = visible.size > 0; onScroll();
      }, { threshold: 0.05 });
      blockers.forEach(function (b) { dio.observe(b); });
      onCleanup(function () { dio.disconnect(); dockBlocked = false; });
    }

    /* Magnetic buttons */
    if (finePointer && !reduced) {
      $$("[data-magnetic]", root).forEach(function (el) {
        el.addEventListener("mousemove", function (e) {
          var r = el.getBoundingClientRect();
          el.style.transform = "translate(" + (e.clientX - r.left - r.width / 2) * 0.18 + "px," + (e.clientY - r.top - r.height / 2) * 0.28 + "px)";
        });
        el.addEventListener("mouseleave", function () { el.style.transform = ""; });
      });
    }

    /* Marquees + testimonial wall: clone for a seamless loop */
    $$(".marquee__track", root).forEach(function (track) {
      var group = $(".marquee__group", track);
      if (!group || track.children.length > 1) return;
      var clone = group.cloneNode(true); clone.setAttribute("aria-hidden", "true"); track.appendChild(clone);
    });
    $$("[data-wall] .wall__col", root).forEach(function (col) {
      if (col.dataset.cloned) return; col.dataset.cloned = "1";
      Array.prototype.slice.call(col.children).forEach(function (card) {
        var c = card.cloneNode(true); c.setAttribute("aria-hidden", "true"); col.appendChild(c);
      });
    });

    /* FAQ */
    $$(".faq__item", root).forEach(function (item) {
      var q = $(".faq__q", item);
      if (!q) return;
      q.addEventListener("click", function () {
        var open = item.classList.toggle("is-open");
        q.setAttribute("aria-expanded", open ? "true" : "false");
        setTimeout(function () { if (window.ScrollTrigger) window.ScrollTrigger.refresh(); }, 700);
      });
    });

    /* Reasons accordion (one open at a time) */
    var reasons = $$(".reason", root);
    reasons.forEach(function (r) {
      var q = $(".reason__q", r);
      q.addEventListener("click", function () {
        var willOpen = !r.classList.contains("is-open");
        reasons.forEach(function (o) { o.classList.remove("is-open"); $(".reason__q", o).setAttribute("aria-expanded", "false"); });
        if (willOpen) { r.classList.add("is-open"); q.setAttribute("aria-expanded", "true"); }
        setTimeout(function () { if (window.ScrollTrigger) window.ScrollTrigger.refresh(); }, 800);
      });
    });

    /* Quote slider */
    $$("[data-qslider]", root).forEach(function (qroot) {
      var slides = $$(".qslide", qroot);
      var bar = $(".qslider__bar", qroot);
      var cur = $(".qslider__count b", qroot);
      var total = $(".qslider__count span", qroot);
      var i = 0, timer = null, DUR = 8000;
      if (!slides.length) return;
      slides[0].classList.add("is-active");
      if (total) total.textContent = String(slides.length).padStart(2, "0");
      function show(n) {
        slides[i].classList.remove("is-active");
        i = (n + slides.length) % slides.length;
        slides[i].classList.add("is-active");
        if (cur) cur.textContent = String(i + 1).padStart(2, "0");
        run();
      }
      function run() {
        clearTimeout(timer);
        if (bar) { bar.classList.remove("is-running"); void bar.offsetWidth; bar.style.setProperty("--dur", DUR + "ms"); bar.classList.add("is-running"); }
        if (!reduced) timer = setTimeout(function () { show(i + 1); }, DUR);
      }
      onCleanup(function () { clearTimeout(timer); });
      var prev = $("[data-prev]", qroot), next = $("[data-next]", qroot);
      if (prev) prev.addEventListener("click", function () { show(i - 1); });
      if (next) next.addEventListener("click", function () { show(i + 1); });
      if ("IntersectionObserver" in window) {
        var started = false;
        var io = new IntersectionObserver(function (en) { if (en[0].isIntersecting && !started) { started = true; run(); } }, { threshold: 0.3 });
        io.observe(qroot); onCleanup(function () { io.disconnect(); });
      } else run();
    });

    /* Results: filters + read more */
    var filterBar = $("[data-filters]", root);
    if (filterBar) {
      var chips = $$(".chip", filterBar);
      var stories = $$(".story", root);
      chips.forEach(function (chip) {
        var f = chip.getAttribute("data-filter");
        var n = f === "all" ? stories.length : stories.filter(function (s) { return (" " + s.getAttribute("data-cat") + " ").indexOf(" " + f + " ") > -1; }).length;
        if (!chip.querySelector("sup")) { var sup = document.createElement("sup"); sup.textContent = n; chip.appendChild(sup); }
        chip.addEventListener("click", function () {
          chips.forEach(function (c) { c.classList.remove("is-active"); c.setAttribute("aria-pressed", "false"); });
          chip.classList.add("is-active"); chip.setAttribute("aria-pressed", "true");
          stories.forEach(function (s) {
            var show = f === "all" || (" " + s.getAttribute("data-cat") + " ").indexOf(" " + f + " ") > -1;
            s.classList.toggle("is-hidden", !show);
            if (show) s.classList.add("is-in");
          });
          if (window.ScrollTrigger) window.ScrollTrigger.refresh();
        });
      });
    }
    $$(".story__more", root).forEach(function (btn) {
      btn.addEventListener("click", function () {
        var s = btn.closest(".story");
        var open = s.classList.toggle("is-open");
        btn.setAttribute("aria-expanded", open ? "true" : "false");
        $("span", btn).textContent = open ? "Show less" : "Read the full story";
        if (window.ScrollTrigger) setTimeout(function () { window.ScrollTrigger.refresh(); }, 50);
      });
    });

    /* Tabs */
    $$("[data-tabs]", root).forEach(function (tabs) {
      var btns = $$("button", tabs);
      var panels = $$(".tabpanel", tabs.parentNode);
      btns.forEach(function (b, k) {
        b.addEventListener("click", function () {
          btns.forEach(function (x, j) { x.classList.toggle("is-active", j === k); x.setAttribute("aria-selected", j === k ? "true" : "false"); });
          panels.forEach(function (p, j) { p.classList.toggle("is-active", j === k); });
          if (window.ScrollTrigger) window.ScrollTrigger.refresh();
        });
      });
    });

    /* Glimpses (flip cards) */
    $$(".glimpse", root).forEach(function (g) {
      var btn = $(".glimpse__f", g);
      var back = $(".glimpse__b", g);
      function flip() {
        var on = g.classList.toggle("is-flipped");
        btn.setAttribute("aria-expanded", on ? "true" : "false");
      }
      btn.addEventListener("click", flip);
      if (back) back.addEventListener("click", flip);
    });

    /* Quiet the noise */
    $$("[data-noise]", root).forEach(function (box) {
      var thoughts = $$(".thought", box);
      var out = $("[data-reframe-text]", box);
      var frame = $(".reframe", box);
      var n = $("[data-noise-n]", box);
      var sun = $(".sun", box);
      thoughts.forEach(function (t) {
        t.setAttribute("aria-pressed", "false");
        t.addEventListener("click", function () {
          t.classList.add("is-quiet"); t.setAttribute("aria-pressed", "true");
          var count = $$(".thought.is-quiet", box).length;
          if (n) n.textContent = count;
          if (sun) sun.style.setProperty("--sun-s", String(0.55 + count * 0.12));
          frame.classList.add("is-swap");
          setTimeout(function () {
            out.textContent = count === thoughts.length
              ? "That’s the sound of a quieter mind. Imagine living there every day. It starts with one conversation."
              : t.getAttribute("data-reframe");
            frame.classList.remove("is-swap");
            if (count === thoughts.length && !$(".reframe .link", box)) {
              var a = document.createElement("a");
              a.className = "link"; a.href = "clarity-call.html"; a.style.marginTop = "14px"; a.style.color = "var(--sun)";
              a.innerHTML = '<span>Request a Clarity Call</span><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M7 17 17 7M8 7h9v9"/></svg>';
              frame.appendChild(a);
            }
          }, 260);
        });
      });
    });

    /* Sticky sub-navigation: visible past the hero, highlights the section in view */
    $$("[data-subnav]", root).forEach(function (nav) {
      var links = $$("a", nav);
      var secs = links.map(function (l) { return document.getElementById(l.getAttribute("href").slice(1)); }).filter(Boolean);
      var bar = $(".subnav__bar", nav);
      function update() {
        var y = window.scrollY + window.innerHeight * 0.35;
        var first = secs[0] ? secs[0].getBoundingClientRect().top + window.scrollY : 0;
        nav.classList.toggle("is-on", window.scrollY + window.innerHeight * 0.5 > first);
        var active = -1;
        secs.forEach(function (s, i) { if (s.getBoundingClientRect().top + window.scrollY <= y) active = i; });
        links.forEach(function (l, i) {
          var on = i === active;
          if (on !== l.classList.contains("is-active")) {
            l.classList.toggle("is-active", on);
            if (on && bar) bar.scrollTo({ left: l.offsetLeft - 16, behavior: "smooth" });
          }
        });
      }
      var h = function () { requestAnimationFrame(update); };
      window.addEventListener("scroll", h, { passive: true });
      onCleanup(function () { window.removeEventListener("scroll", h); });
      update();
    });

    initQuiz(root);
    initIntake(root);
    initSpeaking(root);
    $$("[data-signup]", root).forEach(wireSignup);
    if (CFG.replyPromise) $$("[data-reply-promise]", root).forEach(function (el) { el.textContent = CFG.replyPromise; });
    if (CFG.speakingReply) $$("[data-speaking-reply]", root).forEach(function (el) { el.textContent = CFG.speakingReply; });
  }

  /* ==========================================================================
     READINESS CHECK: four questions that point to the right path and carry
     the answers into the Clarity Call request.
     ========================================================================== */
  var PATHS = {
    sm: {
      title: 'Self-<em>Mastery</em>™',
      text: "Your best fit is the 12-week immersive program: weekly experiential trainings, live Program Calls with Carrie and private one-on-one coaching. Structured, deep and fast, so you stop thinking about change and start living it.",
      learn: "self-mastery.html", learnLabel: "Explore Self-Mastery™", value: "self-mastery"
    },
    limitless: {
      title: 'Limitless <em>Mastery</em>',
      text: "You want intimate, immersive support on a tight timeline. Limitless Mastery is Carrie’s most intensive private coaching: weekly 1:1 sessions, on-demand access in between, and her complete library of tools.",
      learn: "limitless-mastery.html", learnLabel: "Explore Limitless Mastery", value: "limitless"
    },
    call: {
      title: 'Start with a <em>Clarity Call</em>',
      text: "You don’t need to decide yet. In 45 complimentary minutes Carrie will help you find the true source of what’s keeping you stuck and map your next step, whichever path that turns out to be.",
      learn: "about.html", learnLabel: "Meet Carrie first", value: "unsure"
    }
  };
  var TIMING_LABEL = { now: "Ready now", soon: "Next month or two", exploring: "Exploring" };

  function initQuiz(root) {
    $$("[data-quiz]", root).forEach(function (quiz) {
      var steps = $$(".quiz__step", quiz);
      var result = $(".quiz__result", quiz);
      var bars = $$(".quiz__bars i", quiz);
      var back = $(".quiz__back", quiz);
      var foot = $(".quiz__foot", quiz);
      var num = $("[data-q-num]", quiz);
      var count = $(".quiz__count", quiz);
      var answers = {};
      var cur = 0;
      function go(n) {
        cur = n;
        steps.forEach(function (s, k) { s.classList.toggle("is-active", k === n); });
        result.classList.remove("is-active");
        bars.forEach(function (b, k) { b.classList.toggle("is-done", k < n); });
        if (num) num.textContent = n + 1;
        if (count) count.style.visibility = "";
        if (back) back.disabled = n === 0;
        if (foot) foot.style.display = "";
      }
      function finish() {
        var tally = { sm: 0, limitless: 0, call: 0 };
        Object.keys(answers).forEach(function (k) {
          (answers[k].score || "").split(" ").forEach(function (p) { if (p) tally[p] += 1; });
        });
        var best = "sm";
        ["sm", "limitless", "call"].forEach(function (p) { if (tally[p] > tally[best]) best = p; });
        var p = PATHS[best];
        var timing = (answers.timing && answers.timing.value) || "exploring";
        $(".quiz__rtitle", result).innerHTML = p.title;
        $(".quiz__rtext", result).textContent = p.text;
        var tags = [];
        if (answers.need) tags.push(answers.need.label);
        tags.push(TIMING_LABEL[timing]);
        $(".quiz__rtags", result).innerHTML = tags.map(function (t) { return '<span class="pill">' + t.replace(/</g, "&lt;") + "</span>"; }).join("");
        var learn = $("[data-result-learn]", result);
        if (learn) { learn.setAttribute("href", p.learn); $("span", learn).textContent = p.learnLabel; }
        var send = $("[data-result-send]", result);
        var focus = answers.need && answers.need.focus ? "&focus=" + answers.need.focus : "";
        if (send) send.setAttribute("href", "clarity-call.html?path=" + p.value + "&timing=" + timing + focus);
        store.set("cb_ready", JSON.stringify({ path: p.value, timing: timing, focus: answers.need ? answers.need.focus : "", tried: answers.tried ? answers.tried.label : "", support: answers.support ? answers.support.label : "" }));
        steps.forEach(function (s) { s.classList.remove("is-active"); });
        bars.forEach(function (b) { b.classList.add("is-done"); });
        if (count) count.style.visibility = "hidden";
        if (foot) foot.style.display = "none";
        result.classList.add("is-active");
      }
      steps.forEach(function (step, k) {
        $$(".option", step).forEach(function (opt) {
          opt.setAttribute("aria-pressed", "false");
          opt.addEventListener("click", function () {
            $$(".option", step).forEach(function (o) { o.classList.remove("is-selected"); o.setAttribute("aria-pressed", "false"); });
            opt.classList.add("is-selected"); opt.setAttribute("aria-pressed", "true");
            answers[step.getAttribute("data-key")] = {
              score: opt.getAttribute("data-score") || "",
              value: opt.getAttribute("data-value") || "",
              focus: opt.getAttribute("data-focus") || "",
              label: ($("b", opt) || opt).textContent.trim()
            };
            setTimeout(function () { k < steps.length - 1 ? go(k + 1) : finish(); }, 320);
          });
        });
      });
      if (back) back.addEventListener("click", function () { if (cur > 0) go(cur - 1); });
      var restart = $(".quiz__restart", quiz);
      if (restart) restart.addEventListener("click", function () {
        answers = {};
        $$(".option", quiz).forEach(function (o) { o.classList.remove("is-selected"); o.setAttribute("aria-pressed", "false"); });
        go(0);
      });
      go(0);
    });
  }

  /* ==========================================================================
     CLARITY CALL INTAKE: four short steps, pre-filled from the Readiness
     Check, sent to Carrie, then straight into her Acuity calendar with the
     visitor's details already filled in.
     ========================================================================== */
  function initIntake(root) {
    var form = $("[data-intake]", root);
    if (!form) return;
    var steps = $$(".form__step", form);
    var bars = $$(".form__steps i", form);
    var countEl = $(".form__count", form);
    var next = $("[data-form-next]", form);
    var back = $("[data-form-back]", form);
    var nextLabel = next ? $(".btn__label", next) : null;
    var cur = 0;

    var params = new URLSearchParams(window.location.search);
    var saved = {};
    try { saved = JSON.parse(store.get("cb_ready") || "{}"); } catch (e) { saved = {}; }
    var pre = {
      path: params.get("path") || saved.path,
      timing: params.get("timing") || saved.timing,
      focus: params.get("focus") || saved.focus
    };
    ["path", "timing", "focus"].forEach(function (k) {
      if (!pre[k]) return;
      var input = form.querySelector('input[name="' + k + '"][value="' + pre[k] + '"]');
      if (input) input.checked = true;
    });
    if (saved.tried || saved.support) {
      var ctx = form.querySelector('[name="quiz"]');
      if (ctx) ctx.value = [saved.tried ? "Tried: " + saved.tried : "", saved.support ? "Wants: " + saved.support : ""].filter(Boolean).join(" · ");
    }

    function show(n) {
      steps.forEach(function (s, k) { s.classList.toggle("is-active", k === n); });
      bars.forEach(function (b, k) { b.classList.toggle("is-done", k <= n); });
      if (countEl) countEl.textContent = "Step " + (n + 1) + " of " + steps.length;
      if (back) back.hidden = n === 0;
      if (nextLabel) nextLabel.textContent = n === steps.length - 1 ? "Send to Carrie" : "Continue";
      cur = n;
    }
    function validate(step) {
      var ok = true;
      $$(".field", step).forEach(function (f) { f.classList.remove("has-error"); });
      $$("[required]", step).forEach(function (input) {
        var field = input.closest(".field");
        var valid = input.type === "email" ? validEmail(input.value) : input.value.trim().length > 0;
        if (!valid) { ok = false; if (field) field.classList.add("has-error"); }
      });
      var group = step.querySelector("[data-require-choice]");
      if (group) {
        var name = group.getAttribute("data-require-choice");
        if (!form.querySelector('input[name="' + name + '"]:checked')) {
          ok = false;
          group.classList.remove("shake"); void group.offsetWidth; group.classList.add("shake");
          var hint = step.querySelector(".form__hint");
          if (hint) { hint.style.color = "var(--ember-deep)"; setTimeout(function () { hint.style.color = ""; }, 1800); }
        }
      }
      if (!ok) { var bad = step.querySelector(".has-error input, .has-error textarea"); if (bad) bad.focus(); }
      return ok;
    }
    function labelsFor(name) {
      return $$('input[name="' + name + '"]:checked', form).map(function (i) {
        var s = i.parentNode.querySelector("span"); return s ? s.firstChild.textContent.trim() : i.value;
      }).join(", ");
    }
    function bookingLink(d) {
      if (!CFG.bookingUrl) return "";
      var u;
      try { u = new URL(CFG.bookingUrl); } catch (e) { return CFG.bookingUrl; }
      var parts = (d.name || "").trim().split(/\s+/);
      if (parts[0]) u.searchParams.set("firstName", parts[0]);
      if (parts.length > 1) u.searchParams.set("lastName", parts.slice(1).join(" "));
      if (d.email) u.searchParams.set("email", d.email.trim());
      if (d.phone) u.searchParams.set("phone", d.phone.trim());
      return u.toString();
    }
    function submit() {
      var fd = new FormData(form);
      if (fd.get("_gotcha")) return;
      var d = {};
      fd.forEach(function (v, k) { d[k] = v; });
      var summary = {
        "Wants to change": labelsFor("focus") || "—",
        "Interested in": labelsFor("path") || "—",
        "Timing": labelsFor("timing") || "—",
        "Name": d.name, "Email": d.email, "Phone": d.phone || "—",
        "Work / role": d.role || "—", "Based in": d.location || "—",
        "Heard about Carrie via": d.source || "—",
        "Readiness Check": d.quiz || "—",
        "Message": d.message || "—"
      };
      var done = function () {
        form.classList.add("is-sent");
        var nm = $("[data-sent-name]", form); if (nm) nm.textContent = firstName(d.name);
        var book = $("[data-book-time]", form);
        var link = bookingLink(d);
        if (book && link) book.setAttribute("href", link); else if (book) book.hidden = true;
        scrollToEl(form, -120);
        store.set("cb_ready", "");
      };
      if (CFG.intakeEndpoint) {
        if (next) next.setAttribute("aria-busy", "true");
        postJSON(CFG.intakeEndpoint, Object.assign({ _subject: "Clarity Call request: " + d.name, source: location.href }, summary))
          .then(done)
          .catch(function () { mailto("Clarity Call request: " + d.name, summary); done(); })
          .then(function () { if (next) next.removeAttribute("aria-busy"); });
      } else {
        done();
        setTimeout(function () { mailto("Clarity Call request: " + d.name, summary); }, 400);
      }
    }
    if (next) next.addEventListener("click", function (e) {
      e.preventDefault();
      if (!validate(steps[cur])) return;
      if (cur < steps.length - 1) show(cur + 1); else submit();
    });
    if (back) back.addEventListener("click", function (e) { e.preventDefault(); if (cur > 0) show(cur - 1); });
    form.addEventListener("submit", function (e) { e.preventDefault(); if (next) next.click(); });
    steps.forEach(function (step, k) {
      if (!step.hasAttribute("data-auto")) return;
      $$('input[type="radio"]', step).forEach(function (r) {
        r.addEventListener("change", function () { setTimeout(function () { if (cur === k && k < steps.length - 1) show(k + 1); }, 340); });
      });
    });
    var allSet = ["focus", "path", "timing"].every(function (k) { return form.querySelector('input[name="' + k + '"]:checked'); });
    show(allSet ? steps.length - 1 : 0);
    var preNote = $("[data-prefilled]", form);
    if (preNote && (allSet || pre.path)) preNote.hidden = false;
  }

  /* ==========================================================================
     SPEAKING ENQUIRY
     ========================================================================== */
  function initSpeaking(root) {
    var form = $("[data-speak]", root);
    if (!form) return;
    form.addEventListener("submit", function (e) {
      e.preventDefault();
      var ok = true;
      $$(".field", form).forEach(function (f) { f.classList.remove("has-error"); });
      $$("[required]", form).forEach(function (input) {
        var valid = input.type === "email" ? validEmail(input.value) : input.value.trim().length > 0;
        if (!valid) { ok = false; input.closest(".field").classList.add("has-error"); }
      });
      if (!ok) { var bad = form.querySelector(".has-error input, .has-error select"); if (bad) bad.focus(); return; }
      var fd = new FormData(form);
      if (fd.get("_gotcha")) return;
      var d = {}; fd.forEach(function (v, k) { d[k] = v; });
      var summary = {
        "Name": d.name, "Organization": d.company || "—", "Email": d.email, "Website": d.website || "—",
        "Engagement": d.type || "—", "Event / podcast URL": d.event_url || "—", "Date": d.date || "—",
        "Audience size": d.audience || "—", "About the event": d.message || "—"
      };
      var done = function () {
        form.classList.add("is-sent");
        var nm = $("[data-sent-name]", form); if (nm) nm.textContent = firstName(d.name);
        scrollToEl(form, -120);
      };
      if (CFG.speakingEndpoint) {
        postJSON(CFG.speakingEndpoint, Object.assign({ _subject: "Speaking enquiry: " + (d.company || d.name), source: location.href }, summary))
          .then(done).catch(function () { mailto("Speaking enquiry: " + (d.company || d.name), summary); done(); });
      } else {
        done();
        setTimeout(function () { mailto("Speaking enquiry: " + (d.company || d.name), summary); }, 400);
      }
    });
  }

  initPage($("main") || document);
  onScroll();
})();
