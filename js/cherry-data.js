/* ============================================================
   THE ARCHIVE, LIVE
   Every page ships with Cherry's work written into the HTML, so the site
   is complete before a single request is made. This asks the archive
   whether she has changed anything since, and only re-renders what it
   gets a real answer for. Any failure leaves the page exactly as it was:
   the static markup is the floor, never a loading state.
   ============================================================ */
(function () {
  "use strict";
  var C = window.CHERRY;
  if (!C || !window.fetch) return;

  function api(path) {
    return fetch(C.url + "/rest/v1/" + path, {
      headers: { apikey: C.key, Authorization: "Bearer " + C.key }
    }).then(function (r) {
      if (!r.ok) throw new Error("archive " + r.status);
      return r.json();
    });
  }

  /* Only Cherry can write these values, but nothing she saves should be
     able to run as code. Allow the small set of tags her copy uses. */
  var ALLOWED = /^(br|em|i|b|strong|span)$/i;
  function clean(html) {
    var box = document.createElement("div");
    box.innerHTML = String(html == null ? "" : html);
    (function walk(node) {
      [].slice.call(node.children).forEach(function (child) {
        if (!ALLOWED.test(child.tagName)) {
          child.replaceWith(document.createTextNode(child.textContent));
          return;
        }
        [].slice.call(child.attributes).forEach(function (a) { child.removeAttribute(a.name); });
        walk(child);
      });
    })(box);
    return box.innerHTML;
  }
  function plain(html) {
    var box = document.createElement("div");
    box.innerHTML = String(html == null ? "" : html);
    return box.textContent;
  }

  function byPhase(rows) {
    var out = {};
    C.phases.forEach(function (p) { out[p] = []; });
    rows.forEach(function (r) { if (out[r.phase]) out[r.phase].push(r); });
    C.phases.forEach(function (p) {
      out[p].sort(function (a, b) { return (a.sort | 0) - (b.sort | 0); });
    });
    return out;
  }
  function bySort(rows) {
    return rows.slice().sort(function (a, b) { return (a.sort | 0) - (b.sort | 0); });
  }

  /* ---------- her words, wherever they appear ---------- */
  function applySettings(rows) {
    var map = {};
    rows.forEach(function (r) { map[r.key] = r.value; });

    document.querySelectorAll("[data-cms]").forEach(function (el) {
      var v = map[el.dataset.cms];
      if (v == null) return;          /* never touched: the shipped HTML stands */
      el.innerHTML = clean(v);        /* emptied on purpose: honour it */
    });
    document.querySelectorAll("[data-cms-src]").forEach(function (el) {
      var v = map[el.dataset.cmsSrc];
      if (v == null || v === "") return;   /* an empty image would break the layout */
      var url = plain(v).trim();
      if (/^javascript:/i.test(url)) return;
      if (el.getAttribute("src") !== url) el.setAttribute("src", url);
    });
    /* the footer address and handle, text and link together */
    var mail = map.site_email, insta = map.site_instagram;
    if (mail) {
      document.querySelectorAll('.foot__meta a[href^="mailto:"]').forEach(function (a) {
        a.textContent = plain(mail); a.setAttribute("href", "mailto:" + plain(mail));
      });
    }
    if (insta) {
      document.querySelectorAll('.foot__meta a[href*="instagram"]').forEach(function (a) {
        var handle = plain(insta).trim();
        a.textContent = handle;
        a.setAttribute("href", "https://instagram.com/" + handle.replace(/^@/, ""));
      });
    }

    /* the four phase themes are shared by the poems and the paintings */
    C.phases.forEach(function (p) {
      var v = map["phase_" + p + "_theme"];
      if (!v) return;
      var t = document.querySelector(".phase--" + p + " .phase__theme");
      if (t) t.innerHTML = clean(v);
    });
  }

  /* ---------- the wall of artworks ---------- */
  function renderWorks(rows) {
    var groups = byPhase(rows), touched = 0;
    C.phases.forEach(function (phase) {
      var grid = document.querySelector(".phase--" + phase + " .vgrid");
      if (!grid) return;
      grid.innerHTML = groups[phase].map(function (w, i) {
        return '<figure tabindex="0" role="button" data-cms-row="cherry_works:' + w.id + '" data-note="' + plain(w.note).replace(/"/g, "&quot;") +
          '" class="vitem vg' + (i % 5 + 1) + '" data-r>' +
          '<img src="' + plain(w.image_url).replace(/"/g, "&quot;") + '" alt="' + plain(w.title).replace(/"/g, "&quot;") +
          '" loading="lazy" onerror="this.parentElement.classList.add(\'is-empty\');this.remove()" />' +
          '<figcaption class="vitem__cap">' + clean(w.title) + "</figcaption></figure>";
      }).join("");
      touched++;
    });
    return touched;
  }

  /* ---------- the poems and monologues ---------- */
  function renderPieces(rows) {
    var groups = byPhase(rows), touched = 0;
    C.phases.forEach(function (phase) {
      var list = document.querySelector(".phase--" + phase + " .wlist");
      if (!list) return;
      list.innerHTML = groups[phase].map(function (p) {
        /* no wrapper: the fields are the grid, so her name can hold the
           left column while the words take the whole right one */
        return '<li class="wl wl--text" data-cms-row="cherry_pieces:' + p.id + '" data-r>' +
          '<h2 class="wl__title">' + clean(p.title) + "</h2>" +
          '<p class="wl__kind">' + clean(p.kind) + "</p>" +
          '<p class="wl__excerpt">' + clean(p.excerpt) + "</p>" +
          '<div class="wl__body">' + clean(p.body) + "</div>" +
          '<button class="rlink wl__read" type="button">read &rarr;</button>' +
          "</li>";
      }).join("");
      touched++;
    });
    return touched;
  }

  /* ---------- the code inside the printed cover ---------- */
  /* The panels used to carry a drawn square that looked like a QR code and
     scanned as nothing, which is a small lie told to anyone who points a
     phone at it. Where the generator is loaded, the real code replaces it,
     built from the same address her Studio prints onto the book so the two
     can never drift apart. */
  var codeAddress = null;
  /* One gift page serves every book she prints. The code inside a cover
     carries ?b=<the book's fixed id>, so a reader lands on that book's own
     chapters. No id, or an id she has since removed, falls back to her first
     book, which is also what happens before she has named any books at all. */
  var books = [], theBook = null;
  function pickBook() {
    var want = "";
    try { want = new URLSearchParams(location.search).get("b") || ""; } catch (e) {}
    var found = books.filter(function (b) { return b.id === want; })[0];
    theBook = found || books[0] || null;
    return theBook;
  }
  function bookAddress(id) {
    var base = codeAddress;
    if (!base) {
      try { base = new URL("gift.html", location.href).href; } catch (e) { return ""; }
    }
    if (!id) return base;
    try {
      var u = new URL(base, location.href);
      u.searchParams.set("b", id);
      return u.href;
    } catch (e) {
      return base + (base.indexOf("?") < 0 ? "?" : "&") + "b=" + encodeURIComponent(id);
    }
  }
  function paintCodes() {
    if (!window.CherryQR) return 0;
    var slots = document.querySelectorAll(".giftpanel__qr");
    if (!slots.length) return 0;
    var want = bookAddress(theBook ? theBook.id : "");
    if (!want) return 0;
    var svg;
    try {
      /* her own two colours, so the square sits in the panel the way the
         drawing did. The file she sends to a printer stays black on white:
         that one is made in the Studio, not here. */
      var ink = getComputedStyle(document.documentElement);
      svg = window.CherryQR.toSVG(window.CherryQR.encode(want, { ecc: "H" }), {
        quiet: 2,
        light: (ink.getPropertyValue("--ink") || "#E7DED4").trim(),
        dark: (ink.getPropertyValue("--bg") || "#0C1718").trim()
      });
    } catch (e) { return 0; }        /* an address too long to encode: keep the drawing */
    slots.forEach(function (slot) {
      if (slot.dataset.code === want) return;
      slot.innerHTML = svg;
      slot.dataset.code = want;
    });
    return 1;
  }

  /* ---------- her voice: tracks and chapters ---------- */
  function trackRow(t, mirrored) {
    var len = '<span class="trk__len">' + clean(t.length || "--:--") + "</span>";
    var name = '<span class="trk__name">' + clean(t.title) + "</span>";
    var no = '<span class="trk__no">' + (t._n < 10 ? "0" + t._n : t._n) + "</span>";
    /* the words are only offered when she has written them */
    var words = String(t.lyrics || "").trim()
      ? '<button class="trk__words" type="button" aria-expanded="false">words</button>' +
        '<div class="trk__lyrics" hidden>' + clean(t.lyrics) + "</div>"
      : "";
    /* no recording yet means no data-src at all: an empty one would be
       fetched as the page itself, come back 200, and count as live */
    var src = plain(t.audio_url).trim();
    return '<li class="trk" data-cms-row="cherry_tracks:' + t.id + '"' +
      (src ? ' data-src="' + src.replace(/"/g, "&quot;") + '"' : "") +
      ' data-title="' + plain(t.title).replace(/"/g, "&quot;") + '">' +
      (mirrored ? len + name + no : no + name + len) + words + "</li>";
  }
  /* Two lists are drawn this way and they are not the same list: the book
     read aloud, which only the code inside the printed cover opens, and her
     spoken word, which is its own work. Each .chapters box says on itself
     which one it wants.

     Either can be one plain list or the groups she has named for it. Groups
     win only when she has made them; a recording that belongs to no group is
     never dropped, it just keeps its place at the end under no heading. An
     empty answer leaves the page's own list alone rather than blanking it. */
  function renderChapters(all, groupsBy) {
    var drawn = 0;
    document.querySelectorAll(".chapters").forEach(function (box) {
      var voice = box.dataset.voice || "spoken";
      var mine = bySort(all.filter(function (t) { return t.voice === voice; }));

      /* A chapter belongs to a book through the section it carries. Chapters
         she has not filed yet show under her first book, so the page is never
         empty just because she has not got round to sorting them. */
      if (voice === "chapter" && theBook) {
        var known = books.map(function (b) { return b.id; });
        var first = books[0] && books[0].id === theBook.id;
        mine = mine.filter(function (t) {
          var at = String(t.section || "");
          return at === theBook.id || (first && known.indexOf(at) < 0);
        });
      }
      /* Nothing in the archive for this list leaves whatever the page was
         written with, the same way every other list here behaves. Blanking
         it instead would empty the gift page the moment the archive answers
         about songs but not about chapters. */
      if (!mine.length) return;
      mine.forEach(function (t, i) { t._n = i + 1; });

      var groups = groupsBy[voice] || [];
      var named = groups.filter(function (g) {
        return mine.some(function (t) { return t.section === g; });
      });
      var loose = mine.filter(function (t) { return named.indexOf(t.section) < 0; });

      function listOf(rows) {
        return '<ul class="tracklist" data-r>' +
          rows.map(function (t) { return trackRow(t, false); }).join("") + "</ul>";
      }
      var html = named.map(function (g) {
        return '<section class="chgroup" data-r><h2 class="chgroup__name">' + clean(g) + "</h2>" +
          listOf(mine.filter(function (t) { return t.section === g; })) + "</section>";
      }).join("");
      if (loose.length) html += listOf(loose);

      box.innerHTML = html;
      drawn++;
    });
    return drawn;
  }

  function renderTracks(rows, groups) {
    var touched = 0;
    [["cherry", ".dlist--cherry", true], ["dn", ".dlist--dn", false]].forEach(function (spec) {
      var list = document.querySelector(spec[1]);
      if (!list) return;
      var mine = bySort(rows.filter(function (r) { return r.voice === spec[0]; }));
      mine.forEach(function (t, i) { t._n = i + 1; });
      list.innerHTML = mine.map(function (t) { return trackRow(t, spec[2]); }).join("");
      touched++;
    });

    touched += renderChapters(rows, groups || {});
    return touched;
  }

  /* ---------- the projection room ---------- */
  function renderFilms(rows) {
    var reel = document.querySelector(".reel");
    if (!reel) return 0;
    reel.innerHTML = bySort(rows).map(function (f) {
      var poster = plain(f.poster_url).trim();
      var name = plain(f.title).replace(/"/g, "&quot;");
      return '<article class="film" data-cms-row="cherry_films:' + f.id +
        '" data-video="' + plain(f.video_url).replace(/"/g, "&quot;") + '" data-r>' +
        '<div class="film__frame">' +
        '<img class="film__poster"' + (poster ? ' src="' + poster.replace(/"/g, "&quot;") + '"' : "") +
          ' alt="" loading="lazy" onerror="this.removeAttribute(\'src\')" />' +
        '<button class="film__play" type="button" aria-label="Play ' + (name || "this film") + '"></button>' +
        "</div>" +
        '<h2 class="film__title">' + clean(f.title) + "</h2>" +
        '<p class="film__note">' + clean(f.note) + "</p>" +
        "</article>";
    }).join("");
    /* the placeholder strip has done its job */
    document.querySelectorAll("[data-film-empty]").forEach(function (n) { n.remove(); });
    return 1;
  }

  /* ---------- the doors on the landing ---------- */
  function renderPortals(rows) {
    var grid = document.querySelector(".portals");
    var strip = document.querySelector(".strip");
    var touched = 0;
    var doors = bySort(rows.filter(function (r) { return r.kind === "portal"; }));
    if (grid) {
      grid.innerHTML = doors.map(function (p) {
        var slug = plain(p.href).replace(".html", "").replace(/[^a-z0-9-]/gi, "");
        return '<a class="portal portal--' + slug + '" data-cms-row="cherry_portals:' + p.id + '" href="' + plain(p.href).replace(/"/g, "&quot;") + '" data-r>' +
          '<div class="portal__fallback"></div>' +
          '<img src="' + plain(p.image_url).replace(/"/g, "&quot;") + '" alt="" loading="lazy" onerror="this.remove()" />' +
          '<div class="portal__veil"></div><div class="portal__text">' +
          '<h2 class="portal__name">' + clean(p.name) + "</h2>" +
          '<p class="portal__desc">' + clean(p.blurb) + "</p></div></a>";
      }).join("");
      touched++;
    }
    var links = bySort(rows.filter(function (r) { return r.kind === "strip"; }));
    if (strip) {
      strip.innerHTML = links.map(function (l) {
        return '<a href="' + plain(l.href).replace(/"/g, "&quot;") + '">' + clean(l.name) + "</a>";
      }).join("");
      touched++;
    }
    return touched;
  }

  /* ---------- ask once, apply what belongs to this page ---------- */
  paintCodes();                 /* the address it falls back to needs no archive */

  var page = document.body.dataset.archive || "";
  /* desk_trash holds what she removed and desk_draft holds what she has not
     published yet. Neither is hers to show a visitor, and both would be
     downloadable if this query did not refuse them. */
  var jobs = [api("cherry_settings?select=key,value&key=not.in.(desk_trash,desk_draft)")];
  jobs.push(page === "visuals"
    ? api("cherry_works?select=id,title,phase,note,image_url,sort&published=eq.true") : null);
  jobs.push(page === "written"
    ? api("cherry_pieces?select=id,title,kind,phase,excerpt,body,sort&published=eq.true") : null);
  jobs.push(document.querySelector(".dlist--cherry, .tracklist, .chapters")
    ? api("cherry_tracks?select=id,title,voice,length,audio_url,lyrics,section,sort&published=eq.true") : null);
  jobs.push(document.querySelector(".portals")
    ? api("cherry_portals?select=id,name,blurb,href,image_url,kind,sort&published=eq.true") : null);
  jobs.push(document.querySelector(".reel")
    ? api("cherry_films?select=id,title,note,poster_url,video_url,sort&published=eq.true") : null);

  Promise.all(jobs.map(function (j) { return j ? j.catch(function () { return null; }) : null; }))
    .then(function (res) {
      var touched = 0;
      if (res[0] && res[0].length) applySettings(res[0]);
      (res[0] || []).forEach(function (s) {
        if (s.key === "gift_qr_url" && String(s.value || "").trim()) {
          codeAddress = String(s.value).trim();
        }
        if (s.key === "cherry_books") {
          try {
            var a = JSON.parse(s.value);
            if (Array.isArray(a)) books = a.filter(function (b) { return b && b.id; });
          } catch (e) { /* an unreadable list is simply no books */ }
        }
      });
      pickBook();
      if (theBook) {
        document.querySelectorAll("[data-book-title]").forEach(function (n) {
          n.textContent = theBook.title || "";
          n.hidden = !theBook.title;
        });
      }
      paintCodes();
      /* the order she has put each set of groups in, kept apart by list */
      var groups = { spoken: [], chapter: [] };
      (res[0] || []).forEach(function (s) {
        var to = s.key === "spoken_groups" ? "spoken"
               : s.key === "chapter_groups" ? "chapter" : "";
        if (!to) return;
        try {
          var a = JSON.parse(s.value);
          if (Array.isArray(a)) groups[to] = a;
        } catch (e) { /* a group list that will not parse is simply no groups */ }
      });
      if (res[1] && res[1].length) touched += renderWorks(res[1]);
      if (res[2] && res[2].length) touched += renderPieces(res[2]);
      if (res[3] && res[3].length) touched += renderTracks(res[3], groups);
      if (res[4] && res[4].length) touched += renderPortals(res[4]);
      if (res[5] && res[5].length) touched += renderFilms(res[5]);
      if (touched && typeof window.CherryRebind === "function") window.CherryRebind();
    })
    .catch(function () { /* the page already has everything it needs */ });
})();
