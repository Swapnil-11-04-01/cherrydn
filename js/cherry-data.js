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
        return '<li class="wl wl--text" data-cms-row="cherry_pieces:' + p.id + '" data-r><div>' +
          '<h2 class="wl__title">' + clean(p.title) + "</h2>" +
          '<p class="wl__kind">' + clean(p.kind) + "</p>" +
          '<p class="wl__excerpt">' + clean(p.excerpt) + "</p>" +
          '<div class="wl__body">' + clean(p.body) + "</div>" +
          '<button class="rlink wl__read" type="button">read &rarr;</button>' +
          "</div></li>";
      }).join("");
      touched++;
    });
    return touched;
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
  /* The chapters can be one plain list, or the groups she has named for
     herself. Groups win only when she has made them; a recording that
     belongs to no group is never dropped, it just keeps its own place at
     the end under no heading. */
  function renderChapters(mine, groups) {
    var box = document.querySelector(".chapters");
    if (!box) return 0;
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
    return 1;
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

    var spoken = bySort(rows.filter(function (r) { return r.voice === "spoken"; }));
    if (spoken.length) {
      spoken.forEach(function (t, i) { t._n = i + 1; });
      touched += renderChapters(spoken, groups || []);
    }
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
  var page = document.body.dataset.archive || "";
  var jobs = [api("cherry_settings?select=key,value&key=neq.desk_trash")];
  jobs.push(page === "visuals"
    ? api("cherry_works?select=id,title,phase,note,image_url,sort&published=eq.true") : null);
  jobs.push(page === "written"
    ? api("cherry_pieces?select=id,title,kind,phase,excerpt,body,sort&published=eq.true") : null);
  jobs.push(document.querySelector(".dlist--cherry, .tracklist")
    ? api("cherry_tracks?select=id,title,voice,length,audio_url,lyrics,section,sort&published=eq.true") : null);
  jobs.push(document.querySelector(".portals")
    ? api("cherry_portals?select=id,name,blurb,href,image_url,kind,sort&published=eq.true") : null);
  jobs.push(document.querySelector(".reel")
    ? api("cherry_films?select=id,title,note,poster_url,video_url,sort&published=eq.true") : null);

  Promise.all(jobs.map(function (j) { return j ? j.catch(function () { return null; }) : null; }))
    .then(function (res) {
      var touched = 0;
      if (res[0] && res[0].length) applySettings(res[0]);
      /* the order she has put her chapter groups in */
      var groups = [];
      (res[0] || []).forEach(function (s) {
        if (s.key !== "spoken_groups") return;
        try { groups = JSON.parse(s.value) || []; } catch (e) { groups = []; }
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
