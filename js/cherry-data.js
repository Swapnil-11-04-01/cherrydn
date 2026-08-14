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
      if (v == null || v === "") return;
      el.innerHTML = clean(v);
    });
    document.querySelectorAll("[data-cms-src]").forEach(function (el) {
      var v = map[el.dataset.cmsSrc];
      if (v == null || v === "") return;
      var url = plain(v).trim();
      if (/^javascript:/i.test(url)) return;
      if (el.getAttribute("src") !== url) el.setAttribute("src", url);
    });
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
      if (!grid || !groups[phase].length) return;
      grid.innerHTML = groups[phase].map(function (w, i) {
        return '<figure tabindex="0" role="button" data-note="' + plain(w.note).replace(/"/g, "&quot;") +
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
      if (!list || !groups[phase].length) return;
      list.innerHTML = groups[phase].map(function (p) {
        return '<li class="wl wl--text" data-r><div>' +
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
    return '<li class="trk" data-src="' + plain(t.audio_url).replace(/"/g, "&quot;") +
      '" data-title="' + plain(t.title).replace(/"/g, "&quot;") + '">' +
      (mirrored ? len + name + no : no + name + len) + "</li>";
  }
  function renderTracks(rows) {
    var touched = 0;
    [["cherry", ".dlist--cherry", true], ["dn", ".dlist--dn", false],
     ["spoken", ".tracklist", false]].forEach(function (spec) {
      var list = document.querySelector(spec[1]);
      if (!list) return;
      var mine = bySort(rows.filter(function (r) { return r.voice === spec[0]; }));
      if (!mine.length) return;
      mine.forEach(function (t, i) { t._n = i + 1; });
      list.innerHTML = mine.map(function (t) { return trackRow(t, spec[2]); }).join("");
      touched++;
    });
    return touched;
  }

  /* ---------- the doors on the landing ---------- */
  function renderPortals(rows) {
    var grid = document.querySelector(".portals");
    var strip = document.querySelector(".strip");
    var touched = 0;
    var doors = bySort(rows.filter(function (r) { return r.kind === "portal"; }));
    if (grid && doors.length) {
      grid.innerHTML = doors.map(function (p) {
        var slug = plain(p.href).replace(".html", "").replace(/[^a-z0-9-]/gi, "");
        return '<a class="portal portal--' + slug + '" href="' + plain(p.href).replace(/"/g, "&quot;") + '" data-r>' +
          '<div class="portal__fallback"></div>' +
          '<img src="' + plain(p.image_url).replace(/"/g, "&quot;") + '" alt="" loading="lazy" onerror="this.remove()" />' +
          '<div class="portal__veil"></div><div class="portal__text">' +
          '<h2 class="portal__name">' + clean(p.name) + "</h2>" +
          '<p class="portal__desc">' + clean(p.blurb) + "</p></div></a>";
      }).join("");
      touched++;
    }
    var links = bySort(rows.filter(function (r) { return r.kind === "strip"; }));
    if (strip && links.length) {
      strip.innerHTML = links.map(function (l) {
        return '<a href="' + plain(l.href).replace(/"/g, "&quot;") + '">' + clean(l.name) + "</a>";
      }).join("");
      touched++;
    }
    return touched;
  }

  /* ---------- ask once, apply what belongs to this page ---------- */
  var page = document.body.dataset.archive || "";
  var jobs = [api("cherry_settings?select=key,value")];
  jobs.push(page === "visuals"
    ? api("cherry_works?select=title,phase,note,image_url,sort&published=eq.true") : null);
  jobs.push(page === "written"
    ? api("cherry_pieces?select=title,kind,phase,excerpt,body,sort&published=eq.true") : null);
  jobs.push(document.querySelector(".dlist--cherry, .tracklist")
    ? api("cherry_tracks?select=title,voice,length,audio_url,sort&published=eq.true") : null);
  jobs.push(document.querySelector(".portals")
    ? api("cherry_portals?select=name,blurb,href,image_url,kind,sort&published=eq.true") : null);

  Promise.all(jobs.map(function (j) { return j ? j.catch(function () { return null; }) : null; }))
    .then(function (res) {
      var touched = 0;
      if (res[0] && res[0].length) applySettings(res[0]);
      if (res[1] && res[1].length) touched += renderWorks(res[1]);
      if (res[2] && res[2].length) touched += renderPieces(res[2]);
      if (res[3] && res[3].length) touched += renderTracks(res[3]);
      if (res[4] && res[4].length) touched += renderPortals(res[4]);
      if (touched && typeof window.CherryRebind === "function") window.CherryRebind();
    })
    .catch(function () { /* the page already has everything it needs */ });
})();
