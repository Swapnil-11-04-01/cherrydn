/* ============================================================
   CHERRY DN — shared behavior for all pages
   nav · menu · reveals · filters · audio · read-toggles · contact
   ============================================================ */

(function () {
  "use strict";

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
  var revealEls = document.querySelectorAll("[data-r]");
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
      btn.textContent = open ? "close —" : "read —";
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
  rows.forEach(function (row) {
    row.addEventListener("click", function () {
      if (row.classList.contains("is-ghost")) return;
      if (currentRow === row) { stopAll(); return; }
      stopAll();
      audio.src = row.dataset.src;
      audio.play().then(function () {
        currentRow = row;
        row.classList.add("is-current");
        if (playerBtn) playerBtn.classList.add("is-playing");
        if (playerNow) playerNow.textContent = row.dataset.title || row.textContent.trim();
      }).catch(function () {
        row.classList.add("is-ghost");
      });
    });
  });
  if (playerBtn) {
    playerBtn.addEventListener("click", function () {
      if (currentRow) { stopAll(); }
      else if (rows.length) { rows[0].click(); }
    });
  }

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
