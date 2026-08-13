/* ============================================================
   THE ARCHIVE, LIVE
   The pages ship with Cherry's work written into the HTML, so the site
   is complete before a single request is made. This file asks the
   database whether she has changed anything since, and only if it gets
   a real answer does it re-render. Any failure leaves the page exactly
   as it was: the static markup is the floor, never a loading state.
   ============================================================ */
(function () {
  "use strict";
  var C = window.CHERRY;
  if (!C || !window.fetch) return;

  var page = document.body.dataset.archive;      // "visuals" | "written"
  if (!page) return;

  function api(path) {
    return fetch(C.url + "/rest/v1/" + path, {
      headers: { apikey: C.key, Authorization: "Bearer " + C.key }
    }).then(function (r) {
      if (!r.ok) throw new Error("archive " + r.status);
      return r.json();
    });
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

  /* her words are stored as she wrote them, with <br/> for line breaks.
     Nothing else is allowed through. */
  function safe(html) {
    var d = document.createElement("div");
    d.textContent = String(html == null ? "" : html);
    return d.innerHTML.replace(/&lt;br\s*\/?&gt;/gi, "<br/>");
  }

  function renderWorks(rows) {
    var groups = byPhase(rows);
    var touched = 0;
    C.phases.forEach(function (phase) {
      var section = document.querySelector(".phase--" + phase);
      var grid = section && section.querySelector(".vgrid");
      if (!grid || !groups[phase].length) return;
      var vg = 0;
      grid.innerHTML = groups[phase].map(function (w) {
        vg++;
        return '<figure tabindex="0" role="button" data-note="' + safe(w.note) +
          '" class="vitem vg' + ((vg - 1) % 5 + 1) + '" data-r>' +
          '<img src="' + safe(w.image_url) + '" alt="' + safe(w.title) +
          '" loading="lazy" onerror="this.parentElement.classList.add(\'is-empty\');this.remove()" />' +
          '<figcaption class="vitem__cap">' + safe(w.title) + "</figcaption></figure>";
      }).join("");
      touched++;
    });
    return touched;
  }

  function renderPieces(rows) {
    var groups = byPhase(rows);
    var touched = 0;
    C.phases.forEach(function (phase) {
      var section = document.querySelector(".phase--" + phase);
      var list = section && section.querySelector(".wlist");
      if (!list || !groups[phase].length) return;
      list.innerHTML = groups[phase].map(function (p) {
        return '<li class="wl wl--text" data-r><div>' +
          '<h2 class="wl__title">' + safe(p.title) + "</h2>" +
          '<p class="wl__kind">' + safe(p.kind) + "</p>" +
          '<p class="wl__excerpt">' + safe(p.excerpt) + "</p>" +
          '<div class="wl__body">' + safe(p.body) + "</div>" +
          '<button class="rlink wl__read" type="button">read &rarr;</button>' +
          "</div></li>";
      }).join("");
      touched++;
    });
    return touched;
  }

  var query = page === "visuals"
    ? "cherry_works?select=title,phase,note,image_url,sort&published=eq.true"
    : "cherry_pieces?select=title,kind,phase,excerpt,body,sort&published=eq.true";

  api(query).then(function (rows) {
    if (!Array.isArray(rows) || !rows.length) return;   // keep what shipped
    var touched = page === "visuals" ? renderWorks(rows) : renderPieces(rows);
    if (touched && typeof window.CherryRebind === "function") window.CherryRebind();
  }).catch(function () {
    /* offline, blocked, or the archive is asleep: the page already has
       everything it needs. */
  });
})();
