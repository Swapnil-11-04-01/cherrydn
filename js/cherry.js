/* ============================================================
   CHERRY DN — shared behavior for all pages
   nav · menu · reveals · filters · audio · read-toggles · contact
   ============================================================ */

(function () {
  "use strict";

  var reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  /* one owner of the scroll lock. The menu and the lightbox both used to
     write body.style.overflow directly, so closing one released the other. */
  var locks = 0;
  function lockScroll(on) {
    locks = Math.max(0, locks + (on ? 1 : -1));
    /* the root, not body: overflow lives on html now, so body no longer
       propagates to the viewport and locking it would do nothing. */
    document.documentElement.style.overflow = locks ? "hidden" : "";
  }
  function releaseAllLocks() {
    locks = 0;
    document.documentElement.style.overflow = "";
  }

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
      lockScroll(open);
    });
  }

  /* ---------- reveals ---------- */
  var io = null;
  if ("IntersectionObserver" in window && !reduced) {
    io = new IntersectionObserver(function (entries) {
      entries.forEach(function (e) {
        if (e.isIntersecting) { e.target.classList.add("is-in"); io.unobserve(e.target); }
      });
    }, { threshold: 0.1 });
  }
  function observeReveals() {
    var els = document.querySelectorAll("[data-r], .page__head");
    els.forEach(function (el, i) {
      if (el.dataset.watched) return;
      el.dataset.watched = "1";
      if (!io) { el.classList.add("is-in"); return; }
      el.style.transitionDelay = Math.min(i % 6 * 0.07, 0.4) + "s";
      io.observe(el);
    });
  }
  observeReveals();

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
  function bindReadToggles(root) {
    (root || document).querySelectorAll(".wl__read").forEach(function (btn) {
      if (btn.dataset.bound) return;
      btn.dataset.bound = "1";
      btn.addEventListener("click", function () {
        var wl = btn.closest(".wl");
        var open = wl.classList.toggle("is-open");
        btn.textContent = open ? "close" : "read \u2192";
      });
    });
  }
  bindReadToggles();

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
    if (window.CherryAttend) window.CherryAttend.settle();
    /* the audio element lives outside the document, so nothing can hear it
       stop unless it says so */
    document.dispatchEvent(new CustomEvent("cherry:media", { detail: { playing: false } }));
  }
  audio.addEventListener("ended", stopAll);
  audio.addEventListener("timeupdate", function () {
    if (playerTime) playerTime.textContent = fmt(audio.currentTime) + " / " + fmt(audio.duration);
  });
  audio.addEventListener("error", function () {
    if (currentRow) { currentRow.classList.add("is-ghost"); }
    stopAll();
  });

  /* This runs twice: once over the rows shipped in the HTML, and again
     over the rows the archive renders in their place. The second run has
     to be able to take back what the first one concluded, or a page whose
     songs are all live keeps telling visitors they are not. `flight`
     makes the newest run the only one whose verdict counts. */
  var rows = [], flight = 0;
  function preflight() {
  var mine = ++flight;
  rows = [].slice.call(document.querySelectorAll("[data-src]"));
  var live = 0, checked = 0, total = rows.length;

  function verdict() {
    if (mine !== flight) return;
    var quiet = live === 0;
    document.querySelectorAll("[data-media-note]").forEach(function (n) { n.hidden = !quiet; });
    if (playerBtn) {
      if (quiet) playerBtn.setAttribute("aria-disabled", "true");
      else playerBtn.removeAttribute("aria-disabled");
    }
  }
  function ghost(row, dead) {
    if (mine !== flight) return;
    row.classList.toggle("is-ghost", dead !== false);
    if (dead === false) row.classList.remove("is-ghost");
    else row.classList.remove("is-current");
    var go = row.querySelector(".trk__go");
    if (go) {
      if (dead === false) go.removeAttribute("aria-disabled");
      else go.setAttribute("aria-disabled", "true");
    }
  }

  if (!total) { verdict(); return; }
  rows.forEach(function (row) {
    fetch(row.dataset.src, { method: "HEAD" }).then(function (r) {
      if (mine !== flight) return;
      if (!r.ok) ghost(row); else { ghost(row, false); live++; }
    }).catch(function () { ghost(row); })
      .finally(function () { checked++; if (checked === total) verdict(); });
  });
  }
  function bindRows() {
  rows = [].slice.call(document.querySelectorAll("[data-src]"));
  rows.forEach(function (row) {
    if (row.dataset.bound) return;
    row.dataset.bound = "1";

    /* The row used to be the button itself: role="button" on the li. That
       makes everything inside it presentational, which hid the lyrics
       button from screen readers entirely, and Enter on that button played
       the song instead of opening the words. So the play control is a real
       button of its own, lying under the row, and the li goes back to
       being a listitem with a button or two inside it. */
    var go = document.createElement("button");
    go.type = "button";
    go.className = "trk__go";
    go.setAttribute("aria-label", "Play " + (row.dataset.title || "this song"));
    row.insertBefore(go, row.firstChild);

    go.addEventListener("click", function () {
      if (row.classList.contains("is-ghost")) return;
      if (currentRow === row) { stopAll(); return; }
      stopAll();
      audio.src = row.dataset.src;
      audio.play().then(function () {
        currentRow = row;
        row.classList.add("is-current");
        var half = row.closest(".dstage__half, .duality__half");
        if (half) {
          document.body.dataset.persona = /--dn/.test(half.className) ? "dn" : "cherry";
          if (window.CherryAttend) window.CherryAttend.settle();
        }
        if (playerBtn) playerBtn.classList.add("is-playing");
        if (playerNow) playerNow.textContent = row.dataset.title || row.textContent.trim();
        document.dispatchEvent(new CustomEvent("cherry:media", { detail: { playing: true } }));
      }).catch(function (err) {
        if (err && err.name === "AbortError") return;
        row.classList.add("is-ghost");
        go.setAttribute("aria-disabled", "true");
      });
    });
  });
  }
  preflight();
  bindRows();
  if (playerBtn) {
    playerBtn.addEventListener("click", function () {
      if (currentRow) { stopAll(); return; }
      if (rows.length && !rows[0].classList.contains("is-ghost")) { rows[0].click(); return; }
      document.querySelectorAll("[data-media-note]").forEach(function (n) {
        n.hidden = false;
      });
    });
  }

  /* ---------- the wall opens: an artwork, held up with her words ---------- */
  var bindWorks = null;
  var lbox = document.getElementById("lbox");
  if (lbox) {
    var works = [].slice.call(document.querySelectorAll(".vitem"));
    var lImg = document.getElementById("lboxImg");
    var lTitle = document.getElementById("lboxTitle");
    var lNote = document.getElementById("lboxNote");
    var lPrev = document.getElementById("lboxPrev");
    var lNext = document.getElementById("lboxNext");
    var lClose = document.getElementById("lboxClose");
    var at = -1;
    var opener = null;

    function show(i) {
      var live = works.filter(function (w) { return !w.hidden && w.querySelector("img"); });
      if (!live.length) return;
      at = (i + live.length) % live.length;
      var fig = live[at];
      var img = fig.querySelector("img");
      var cap = fig.querySelector(".vitem__cap");
      lImg.src = img.getAttribute("src");
      lImg.alt = cap ? cap.textContent.trim() : "";
      lTitle.textContent = cap ? cap.textContent.trim() : "";
      var note = (fig.dataset.note || "").trim();
      lNote.innerHTML = note;
      lNote.hidden = !note;
      lbox._live = live;
    }
    function openAt(fig) {
      opener = fig;
      var live = works.filter(function (w) { return !w.hidden && w.querySelector("img"); });
      show(live.indexOf(fig));
      lbox.hidden = false;
      lockScroll(true);
      /* flush layout so the fade has a start frame. rAF would stall while
         the tab is throttled and the overlay could open invisible. */
      void lbox.offsetWidth;
      lbox.classList.add("is-open");
      lClose.focus();
    }
    function closeBox() {
      lbox.classList.remove("is-open");
      lockScroll(false);
      var done = function () { lbox.hidden = true; lImg.removeAttribute("src"); };
      if (reduced) done(); else setTimeout(done, 260);
      if (opener) opener.focus();
    }
    function step(d) { show(at + d); }

    bindWorks = function () {
      works = [].slice.call(document.querySelectorAll(".vitem"));
      works.forEach(function (fig) {
        if (fig.dataset.bound) return;
        fig.dataset.bound = "1";
        fig.addEventListener("click", function () { if (fig.querySelector("img")) openAt(fig); });
        fig.addEventListener("keydown", function (e) {
          if (e.key === "Enter" || e.key === " ") { e.preventDefault(); fig.click(); }
        });
      });
    };
    bindWorks();
    lClose.addEventListener("click", closeBox);
    lPrev.addEventListener("click", function () { step(-1); });
    lNext.addEventListener("click", function () { step(1); });
    lbox.addEventListener("click", function (e) { if (e.target === lbox) closeBox(); });
    document.addEventListener("keydown", function (e) {
      if (lbox.hidden) return;
      if (e.key === "Escape") { e.preventDefault(); closeBox(); }
      else if (e.key === "ArrowLeft") step(-1);
      else if (e.key === "ArrowRight") step(1);
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

  /* ---------- which half she is attending ----------
     Pointer, keyboard focus and the playing persona all want a say in
     which half comes forward. They are resolved here, in one place, into
     one attribute: .dstage[data-attend="cherry"|"dn"]. The stylesheet
     never has to guess which of them wins, and a keyboard reaches the
     same states a mouse does.

     The float distance is a measurement, not something CSS can know, so
     it is taken here and handed over as --drift-x / --drift-y. It is
     measured from the RESTING page, at the moment she first arrives at
     the stage: nothing is transformed then, so nothing has to be undone
     to read it, and no running transition is disturbed. */
  var stage = document.querySelector(".dstage");
  if (stage) (function () {
    var halves = [].slice.call(stage.querySelectorAll(".dstage__half"));
    var still = window.matchMedia ? matchMedia("(prefers-reduced-motion: reduce)") : null;
    var off = window.matchMedia ? matchMedia("(hover: none), (max-width: 860px)") : null;
    var measured = false, pointer = "", focused = "";

    function sideOf(half) { return /--cherry/.test(half.className) ? "cherry" : "dn"; }

    /* the ink, not the box: the name is a stretched column flex item, so
       its rect is the whole column and its letters sit against one edge
       of it. A range over the contents gives the letters themselves. */
    function inkOf(el) {
      try {
        var r = document.createRange();
        r.selectNodeContents(el);
        var box = r.getBoundingClientRect();
        if (box.width && box.height) return box;
      } catch (e) {}
      return el.getBoundingClientRect();
    }

    function measure() {
      if (measured || (off && off.matches)) return;
      var away = parseFloat(getComputedStyle(stage).getPropertyValue("--away-scale")) || 0.84;
      var quiet = still && still.matches;
      halves.forEach(function (half) {
        var name = half.querySelector(".dstage__name");
        if (!name) return;
        if (quiet) {           /* no journey at all: it shrinks where it stands */
          half.style.setProperty("--drift-x", "0px");
          half.style.setProperty("--drift-y", "0px");
          return;
        }
        var n = inkOf(name), h = half.getBoundingClientRect();
        /* the name is anchored by its outer edge, so shrinking moves its
           centre inward by half of what it loses */
        var toLeft = sideOf(half) === "cherry";
        var cx = toLeft ? n.right - (n.width * away) / 2 : n.left + (n.width * away) / 2;
        var cy = n.top + n.height / 2;
        half.style.setProperty("--drift-x", Math.round(h.left + h.width / 2 - cx) + "px");
        half.style.setProperty("--drift-y", Math.round(h.top + h.height / 2 - cy) + "px");
      });
      measured = true;
    }
    /* anything that can move the type invalidates the measurement; the
       next arrival takes it again */
    function forget() { measured = false; }

    function settle() {
      if (off && off.matches) { stage.removeAttribute("data-attend"); return; }
      var who = pointer || focused || document.body.dataset.persona || "";
      if (who) measure();
      if (who) stage.dataset.attend = who; else stage.removeAttribute("data-attend");
      /* nothing invisible may be reached by Tab */
      halves.forEach(function (half) {
        var hidden = who && sideOf(half) !== who;
        half.querySelectorAll(".trk__go, .trk__words").forEach(function (b) {
          b.tabIndex = hidden ? -1 : 0;
        });
        var list = half.querySelector(".dlist");
        if (list) list.setAttribute("aria-hidden", hidden ? "true" : "false");
      });
    }

    halves.forEach(function (half) {
      var side = sideOf(half);
      half.addEventListener("pointerenter", function () { pointer = side; settle(); });
      half.addEventListener("pointerleave", function () {
        if (pointer === side) pointer = "";
        settle();
      });
      half.addEventListener("focusin", function () { focused = side; settle(); });
      half.addEventListener("focusout", function (e) {
        if (half.contains(e.relatedTarget)) return;
        if (focused === side) focused = "";
        settle();
      });
    });

    var reT;
    addEventListener("resize", function () {
      clearTimeout(reT);
      forget();
      reT = setTimeout(settle, 180);
    });
    if (document.fonts && document.fonts.ready) document.fonts.ready.then(forget);
    if (off && off.addEventListener) off.addEventListener("change", function () { forget(); settle(); });

    window.CherryAttend = { settle: settle, forget: forget };
  })();

  /* ---------- her words, under her songs ---------- */
  function bindLyrics() {
    document.querySelectorAll(".trk__words").forEach(function (btn) {
      if (btn.dataset.bound) return;
      btn.dataset.bound = "1";
      btn.addEventListener("click", function (e) {
        e.stopPropagation();
        var sheet = btn.parentNode.querySelector(".trk__lyrics");
        if (!sheet) return;
        var open = sheet.hidden;
        sheet.hidden = !open;
        if (window.CherryAttend) window.CherryAttend.forget();
        btn.setAttribute("aria-expanded", String(open));
        btn.textContent = open ? "close" : "words";
      });
    });
  }
  bindLyrics();

  /* ---------- the projector ----------
     A film either lives in the archive as a file, or it lives on YouTube
     or Vimeo and we point at it. Nothing third-party is fetched until she
     or a visitor actually presses play. */
  function readsAs(raw) {
    var u = String(raw || "").trim();
    if (!u || /^javascript:/i.test(u)) return null;
    var yt = u.match(/(?:youtube\.com\/(?:watch\?(?:.*&)?v=|embed\/|shorts\/|v\/)|youtu\.be\/)([\w-]{6,})/i);
    if (yt) return { kind: "embed",
      src: "https://www.youtube-nocookie.com/embed/" + yt[1] + "?autoplay=1&rel=0&modestbranding=1" };
    var vm = u.match(/vimeo\.com\/(?:video\/)?(\d{6,})/i);
    if (vm) return { kind: "embed", src: "https://player.vimeo.com/video/" + vm[1] + "?autoplay=1" };
    if (/^(data|vbscript|file):/i.test(u)) return null;
    return { kind: "file", src: u };   /* the archive, or any direct link she has */
  }

  function shutProjector(except) {
    document.querySelectorAll(".film__frame.is-playing").forEach(function (fr) {
      if (fr === except) return;
      var p = fr.querySelector(".film__player");
      if (p) { if (p.pause) { try { p.pause(); } catch (e) {} } p.remove(); }
      fr.classList.remove("is-playing");
      document.dispatchEvent(new CustomEvent("cherry:media", { detail: { playing: false } }));
    });
  }

  function bindFilms() {
    document.querySelectorAll(".film").forEach(function (card) {
      if (card.dataset.bound) return;
      card.dataset.bound = "1";
      var frame = card.querySelector(".film__frame");
      var btn = card.querySelector(".film__play");
      if (!frame || !btn) return;

      var found = readsAs(card.dataset.video);
      if (!found) { frame.classList.add("is-empty"); btn.disabled = true; return; }

      btn.addEventListener("click", function (e) {
        e.preventDefault();
        if (frame.classList.contains("is-playing")) return;
        shutProjector(frame);
        stopAll();                       /* a song and a film do not share a room */

        var player;
        if (found.kind === "file") {
          player = document.createElement("video");
          player.src = found.src;
          player.controls = true;
          player.autoplay = true;
          player.setAttribute("playsinline", "");
          var face = card.querySelector(".film__poster");
          if (face && face.getAttribute("src")) player.poster = face.getAttribute("src");
          player.addEventListener("error", function () {
            frame.classList.remove("is-playing");
            frame.classList.add("is-empty");
            player.remove();
          });
        } else {
          player = document.createElement("iframe");
          player.src = found.src;
          player.allow = "accelerometer; autoplay; encrypted-media; picture-in-picture";
          player.allowFullscreen = true;
          player.referrerPolicy = "no-referrer";
          var t = card.querySelector(".film__title");
          player.title = t ? t.textContent : "Film";
        }
        player.className = "film__player";
        frame.classList.add("is-playing");
        document.dispatchEvent(new CustomEvent("cherry:media", { detail: { playing: true } }));
        frame.appendChild(player);
        if (player.play) { var go = player.play(); if (go && go.catch) go.catch(function () {}); }
      });
    });
  }
  bindFilms();

  /* ---------- restore sanity on back/forward ---------- */
  window.addEventListener("pageshow", function (e) {
    if (!e.persisted) return;
    document.documentElement.classList.remove("leaving");
    if (menu && burger) {
      menu.classList.remove("is-open");
      burger.classList.remove("is-open");
      burger.setAttribute("aria-expanded", "false");
    }
    releaseAllLocks();
    stopAll();
    shutProjector();
  });
  document.addEventListener("keydown", function (e) {
    if (e.key === "Escape" && menu && menu.classList.contains("is-open")) {
      burger.click();
      burger.focus();
    }
  });

  /* the archive can re-render a wall or a list from the database after
     load; give it one way to wake the behaviour back up */
  window.CherryRebind = function () {
    observeReveals();
    bindReadToggles();
    bindRows();
    preflight();
    bindFilms();
    bindLyrics();
    /* new rows need their play buttons reachable, and the archive can
       change how tall a half is, so the measurement is retaken */
    if (window.CherryAttend) { window.CherryAttend.forget(); window.CherryAttend.settle(); }
    if (typeof bindWorks === "function") bindWorks();
  };

  /* ---------- contact → the letter sends itself ---------- */
  var cform = document.getElementById("cform");
  if (cform) {
    var cstatus = document.getElementById("cstatus");
    var csend = document.getElementById("csend");

    /* arriving from the book page: the letter already knows why */
    var about = new URLSearchParams(location.search).get("about");
    if (about === "book" && cform.subject && !cform.subject.value) {
      cform.subject.value = "Reserving a copy of the book";
    }

    function say(text, kind) {
      if (!cstatus) return;
      cstatus.textContent = text;
      cstatus.className = "form-status" + (kind ? " form-status--" + kind : "");
      cstatus.hidden = false;
    }

    /* letters land in Cherry's own inbox. The address is assembled here
       rather than sitting in the page source for harvesters to scrape;
       the form's action attribute keeps the public artist address so the
       page still works with JavaScript off. */
    var inbox = ["natalia", "domprits", "@", "gmail.com"].join("");

    cform.addEventListener("submit", function (e) {
      var endpoint = cform.dataset.endpoint || ("https://formsubmit.co/ajax/" + inbox);
      if (!endpoint) return;               // no endpoint: let the plain POST happen
      e.preventDefault();
      if (cform.classList.contains("is-sending")) return;
      cform.classList.add("is-sending");
      if (csend) csend.textContent = "sending";
      say("Sending your letter.", null);

      var payload = {
        name: cform.name.value.trim(),
        email: cform.email.value.trim(),
        subject: (cform.subject.value || "A whisper from the site").trim(),
        message: cform.message.value.trim(),
        _subject: (cform.subject.value || "A whisper from the site").trim(),
        _captcha: "false"
      };

      fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json", "Accept": "application/json" },
        body: JSON.stringify(payload)
      }).then(function (r) {
        return r.json().catch(function () { return {}; }).then(function (data) {
          return { ok: r.ok, data: data || {} };
        });
      }).then(function (res) {
        /* only say "sent" when the service confirms it really was:
           an unactivated form answers 200 with success false */
        if (res.ok && String(res.data.success) === "true") {
          cform.reset();
          say("Your letter has been sent.", "sent");
          if (csend) csend.textContent = "sent";
          return;
        }
        var msg = String(res.data.message || "").toLowerCase();
        if (msg.indexOf("activat") > -1 || msg.indexOf("confirm") > -1) {
          say("This letterbox is not switched on yet. Write to cherrydn.contact@gmail.com and it will reach her.", "error");
        } else {
          say("The letter did not go through. Write to cherrydn.contact@gmail.com and it will reach her.", "error");
        }
        if (csend) csend.textContent = "send →";
      }).catch(function () {
        say("The letter did not go through. Write to cherrydn.contact@gmail.com and it will reach her.", "error");
        if (csend) csend.textContent = "send →";
      }).then(function () {
        cform.classList.remove("is-sending");
      });
    });
  }
})();
