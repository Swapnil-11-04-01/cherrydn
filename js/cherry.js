/* ============================================================
   CHERRY DN — shared behavior for all pages
   nav · menu · reveals · filters · audio · read-toggles · contact
   ============================================================ */

(function () {
  "use strict";

  var reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  /* ---------- page breath ---------- */
  requestAnimationFrame(function () {
    requestAnimationFrame(function () {
      document.documentElement.classList.add("ready");
    });
  });
  var hasVT = "onpagereveal" in window; // cross-document view transitions
  if (!hasVT && !reduced) {
    document.addEventListener("click", function (e) {
      if (document.documentElement.classList.contains("leaving")) { e.preventDefault(); return; }
      var a = e.target.closest("a[href]");
      if (!a) return;
      var href = a.getAttribute("href");
      if (!href || href.charAt(0) === "#" || a.target === "_blank" ||
          /^(https?:|mailto:|tel:)/.test(href) ||
          e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
      e.preventDefault();
      document.documentElement.classList.add("leaving");
      setTimeout(function () { location.href = href; }, 200);
    });
    window.addEventListener("pageshow", function (e) {
      if (e.persisted) document.documentElement.classList.remove("leaving");
    });
  }

  /* ---------- nav ---------- */
  var nav = document.querySelector(".nav");
  var onScroll = function () { nav.classList.toggle("is-scrolled", window.scrollY > 24); };
  window.addEventListener("scroll", onScroll, { passive: true });
  onScroll();

  var here = location.pathname.split("/").pop() || "index.html";
  document.querySelectorAll(".nav__links a, .menu a").forEach(function (a) {
    if (a.getAttribute("href") === here) a.classList.add("is-active");
  });

  var burger = document.getElementById("burger");
  var menu = document.getElementById("menu");
  if (burger && menu) {
    burger.addEventListener("click", function () {
      var open = !menu.classList.contains("is-open");
      menu.classList.toggle("is-open", open);
      burger.classList.toggle("is-open", open);
      burger.setAttribute("aria-expanded", String(open));
      document.body.style.overflow = open ? "hidden" : "";
    });
  }

  /* ---------- reveals ---------- */
  var revealEls = document.querySelectorAll("[data-r], .page__head");
  if ("IntersectionObserver" in window &&
      !window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (e) {
        if (e.isIntersecting) { e.target.classList.add("is-in"); io.unobserve(e.target); }
      });
    }, { threshold: 0.1 });
    revealEls.forEach(function (el, i) {
      el.style.transitionDelay = Math.min(i % 6 * 0.07, 0.4) + "s";
      io.observe(el);
    });
  } else {
    revealEls.forEach(function (el) { el.classList.add("is-in"); });
  }

  /* ---------- filter tabs (written word, visuals) ---------- */
  document.querySelectorAll("[data-tabs]").forEach(function (tabs) {
    var scope = document.querySelector(tabs.dataset.tabs);
    if (!scope) return;
    tabs.querySelectorAll(".tab").forEach(function (tab) {
      tab.addEventListener("click", function () {
        tabs.querySelectorAll(".tab").forEach(function (t) { t.classList.remove("is-active"); });
        tab.classList.add("is-active");
        var want = tab.dataset.filter;
        scope.querySelectorAll("[data-tags]").forEach(function (item) {
          item.hidden = want !== "all" && item.dataset.tags.split(" ").indexOf(want) === -1;
        });
      });
    });
  });

  /* ---------- read toggles (written word) ---------- */
  document.querySelectorAll(".wl__read").forEach(function (btn) {
    btn.addEventListener("click", function () {
      var wl = btn.closest(".wl");
      var open = wl.classList.toggle("is-open");
      btn.textContent = open ? "close" : "read \u2192";
    });
  });

  /* ---------- audio (music + spoken word) ----------
     Rows carry data-src pointing into assets/audio/.
     Until Cherry's files exist, rows stay as a quiet index. */
  var audio = new Audio();
  var currentRow = null;
  var playerBtn = document.querySelector(".player__btn");
  var playerNow = document.querySelector(".player__now");
  var playerTime = document.querySelector(".player__time");

  function fmt(s) {
    if (!isFinite(s)) return "00:00";
    var m = Math.floor(s / 60), r = Math.floor(s % 60);
    return (m < 10 ? "0" + m : m) + ":" + (r < 10 ? "0" + r : r);
  }
  function stopAll() {
    audio.pause();
    if (currentRow) currentRow.classList.remove("is-current");
    if (playerBtn) playerBtn.classList.remove("is-playing");
    currentRow = null;
    delete document.body.dataset.persona;
  }
  audio.addEventListener("ended", stopAll);
  audio.addEventListener("timeupdate", function () {
    if (playerTime) playerTime.textContent = fmt(audio.currentTime) + " / " + fmt(audio.duration);
  });
  audio.addEventListener("error", function () {
    if (currentRow) { currentRow.classList.add("is-ghost"); }
    stopAll();
  });

  var rows = document.querySelectorAll("[data-src]");
  var liveCount = 0, checked = 0;
  rows.forEach(function (row) {
    fetch(row.dataset.src, { method: "HEAD" }).then(function (r) {
      if (!r.ok) { row.classList.add("is-ghost"); row.classList.remove("is-current"); }
      else { liveCount++; }
    }).catch(function () {
      row.classList.add("is-ghost");
      row.classList.remove("is-current");
    }).finally(function () {
      checked++;
      if (checked === rows.length && liveCount === 0) {
        document.querySelectorAll("[data-media-note]").forEach(function (n) { n.hidden = false; });
        if (playerBtn) playerBtn.setAttribute("aria-disabled", "true");
      }
    });
  });
  rows.forEach(function (row) {
    row.tabIndex = 0;
    row.setAttribute("role", "button");
    row.addEventListener("keydown", function (e) {
      if (e.key === "Enter" || e.key === " ") { e.preventDefault(); row.click(); }
    });
    row.addEventListener("click", function () {
      if (row.classList.contains("is-ghost")) return;
      if (currentRow === row) { stopAll(); return; }
      stopAll();
      audio.src = row.dataset.src;
      audio.play().then(function () {
        currentRow = row;
        row.classList.add("is-current");
        var half = row.closest(".dstage__half, .duality__half");
        if (half) {
          document.body.dataset.persona =
            /--dn/.test(half.className) ? "dn" : "cherry";
        }
        if (playerBtn) playerBtn.classList.add("is-playing");
        if (playerNow) playerNow.textContent = row.dataset.title || row.textContent.trim();
      }).catch(function (err) {
        if (err && err.name === "AbortError") return;
        row.classList.add("is-ghost");
      });
    });
  });
  if (playerBtn) {
    playerBtn.addEventListener("click", function () {
      if (currentRow) { stopAll(); return; }
      if (rows.length && !rows[0].classList.contains("is-ghost")) { rows[0].click(); return; }
      document.querySelectorAll("[data-media-note]").forEach(function (n) {
        n.hidden = false;
      });
    });
  }

  /* ---------- film box: answer the click ---------- */
  var fb = document.querySelector(".filmbox");
  if (fb) {
    fb.addEventListener("click", function () {
      fb.classList.add("show-note");
      clearTimeout(fb._t);
      fb._t = setTimeout(function () { fb.classList.remove("show-note"); }, 3200);
    });
  }

  /* ---------- restore sanity on back/forward ---------- */
  window.addEventListener("pageshow", function (e) {
    if (!e.persisted) return;
    document.documentElement.classList.remove("leaving");
    if (menu && burger) {
      menu.classList.remove("is-open");
      burger.classList.remove("is-open");
      burger.setAttribute("aria-expanded", "false");
    }
    document.body.style.overflow = "";
    stopAll();
  });
  document.addEventListener("keydown", function (e) {
    if (e.key === "Escape" && menu && menu.classList.contains("is-open")) {
      burger.click();
      burger.focus();
    }
  });

  /* ---------- contact → opens a written letter ---------- */
  var cform = document.getElementById("cform");
  if (cform) {
    cform.addEventListener("submit", function (e) {
      e.preventDefault();
      var f = cform;
      var subject = (f.subject.value || "A whisper from the site").trim();
      var body = "From: " + f.name.value.trim() + " <" + f.email.value.trim() + ">\n\n" + f.message.value.trim();
      location.href = "mailto:cherrydn.contact@gmail.com?subject=" +
        encodeURIComponent(subject) + "&body=" + encodeURIComponent(body);
    });
  }
})();
