/* ============================================================
   THE LOOKING GLASS
   Loaded only inside the admin's preview frame. It lets the desk
   speak to the real page: paint a change the moment she types it,
   and tell the desk which words she just clicked so the right box
   opens for her. Never loaded by the public site.
   ============================================================ */
(function () {
  "use strict";
  if (window.top === window.self) return;          // only inside the frame

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

  /* where each field of a list item actually shows on the page, so a poem
     title can change under her hands without reloading anything */
  var ROWMAP = {
    cherry_works:   { title: ".vitem__cap", note: "@data-note", image_url: "@img" },
    cherry_pieces:  { title: ".wl__title", kind: ".wl__kind",
                      excerpt: ".wl__excerpt", body: ".wl__body" },
    cherry_tracks:  { title: ".trk__name", length: ".trk__len",
                      audio_url: "@data-src", lyrics: ".trk__lyrics" },
    cherry_portals: { name: ".portal__name", blurb: ".portal__desc",
                      image_url: "@img", href: "@href" },
    cherry_films:   { title: ".film__title", note: ".film__note",
                      poster_url: "@img", video_url: "@data-video" }
  };

  function paintRow(scope, key, value) {
    var row = document.querySelector('[data-cms-row="' + scope + '"]');
    if (!row) return 0;
    var where = (ROWMAP[String(scope).split(":")[0]] || {})[key];
    if (!where) return 0;
    if (where === "@img") {
      var img = row.querySelector("img");
      if (img) img.setAttribute("src", plain(value).trim());
    } else if (where === "@href") {
      row.setAttribute("href", plain(value).trim());
    } else if (where.charAt(0) === "@") {
      row.setAttribute(where.slice(1), plain(value));
    } else {
      var t = row.querySelector(where);
      if (!t) return 0;
      t.innerHTML = clean(value);
    }
    return 1;
  }

  function paint(key, value) {
    var hit = 0;
    document.querySelectorAll('[data-cms="' + key + '"]').forEach(function (el) {
      el.innerHTML = clean(value); hit++;
    });
    document.querySelectorAll('[data-cms-src="' + key + '"]').forEach(function (el) {
      el.setAttribute("src", String(value || "")); hit++;
    });
    if (/^phase_(\w+)_theme$/.test(key)) {
      var phase = key.match(/^phase_(\w+)_theme$/)[1];
      var t = document.querySelector(".phase--" + phase + " .phase__theme");
      if (t) { t.innerHTML = clean(value); hit++; }
    }
    return hit;
  }

  function flash(el) {
    el.style.transition = "outline-color .45s ease";
    el.style.outline = "1px solid rgba(192,82,99,.9)";
    el.style.outlineOffset = "3px";
    setTimeout(function () { el.style.outlineColor = "transparent"; }, 480);
    setTimeout(function () { el.style.outline = ""; el.style.outlineOffset = ""; }, 1000);
  }

  /* ---------- hearing the desk ---------- */
  window.addEventListener("message", function (e) {
    if (!e.data || e.data.from !== "cherry-desk") return;
    var m = e.data;

    if (m.type === "set") {
      var n = paint(m.key, m.value);
      if (n && m.reveal) {
        var el = document.querySelector('[data-cms="' + m.key + '"], [data-cms-src="' + m.key + '"]');
        if (el) {
          el.scrollIntoView({ block: "center", behavior: "smooth" });
          flash(el);
        }
      }
    }

    if (m.type === "setRow") paintRow(m.scope, m.key, m.value);

    if (m.type === "reveal") {
      var target = document.querySelector('[data-cms="' + m.key + '"], [data-cms-src="' + m.key + '"]');
      if (target) { target.scrollIntoView({ block: "center", behavior: "smooth" }); flash(target); }
    }

    if (m.type === "revealRow") {
      var row = document.querySelector('[data-cms-row="' + m.scope + '"]');
      if (row) { row.scrollIntoView({ block: "center", behavior: "smooth" }); flash(row); }
    }

    if (m.type === "marks") {
      document.documentElement.classList.toggle("cherry-marks", !!m.on);
    }
  });

  /* ---------- letting her point at things ---------- */
  var style = document.createElement("style");
  style.textContent =
    ".cherry-marks [data-cms], .cherry-marks [data-cms-src] {" +
    "  outline: 1px dashed rgba(192,82,99,.42); outline-offset: 3px; cursor: pointer; }" +
    ".cherry-marks [data-cms]:hover, .cherry-marks [data-cms-src]:hover {" +
    "  outline: 1px solid rgba(192,82,99,.95); background: rgba(142,31,45,.08); }" +
    ".cherry-marks [data-cms-row] {" +
    "  outline: 1px dashed rgba(185,174,163,.28); outline-offset: 4px; }";
  document.head.appendChild(style);

  document.addEventListener("click", function (e) {
    var hit = e.target.closest("[data-cms], [data-cms-src]");
    var item = e.target.closest(".vitem, .wl, .trk, .portal, .film");

    if (hit) {
      e.preventDefault(); e.stopPropagation();
      parent.postMessage({ from: "cherry-page", type: "pick",
        key: hit.dataset.cms || hit.dataset.cmsSrc }, location.origin);
      return;
    }
    if (item) {
      e.preventDefault(); e.stopPropagation();
      var holder = item.closest("[data-cms-row]") || item;
      parent.postMessage({ from: "cherry-page", type: "pickRow",
        scope: holder.dataset.cmsRow || "" }, location.origin);
      return;
    }
    /* never let the preview wander off the page being edited */
    var link = e.target.closest("a[href]");
    if (link) { e.preventDefault(); }
  }, true);

  parent.postMessage({ from: "cherry-page", type: "ready",
    page: location.pathname.split("/").pop() || "index.html" }, location.origin);
})();
