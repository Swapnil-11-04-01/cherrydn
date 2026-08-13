/* ============================================================
   THE ADMIN VIEW — Cherry's own way in.
   No framework, no build step, no password held anywhere: she asks for
   a link, the link signs her in, and the database itself refuses every
   write that does not carry her session.
   ============================================================ */
(function () {
  "use strict";
  var C = window.CHERRY;
  var SESSION = "cherry.session";

  var el = function (id) { return document.getElementById(id); };
  var gate = el("gate"), desk = el("desk"), gateMsg = el("gateMsg");

  /* ---------- session ---------- */
  function saveSession(s) { try { localStorage.setItem(SESSION, JSON.stringify(s)); } catch (e) {} }
  function loadSession() {
    try { return JSON.parse(localStorage.getItem(SESSION) || "null"); } catch (e) { return null; }
  }
  function clearSession() { try { localStorage.removeItem(SESSION); } catch (e) {} }

  /* the magic link comes back with the tokens in the URL fragment */
  function readHash() {
    if (!location.hash || location.hash.indexOf("access_token") === -1) return null;
    var p = new URLSearchParams(location.hash.slice(1));
    var s = {
      access_token: p.get("access_token"),
      refresh_token: p.get("refresh_token"),
      expires_at: Date.now() + (parseInt(p.get("expires_in"), 10) || 3600) * 1000
    };
    history.replaceState(null, "", location.pathname);
    return s.access_token ? s : null;
  }

  var session = readHash() || loadSession();
  if (session) saveSession(session);

  function authed(extra) {
    var h = {
      apikey: C.key,
      Authorization: "Bearer " + (session ? session.access_token : C.key),
      "Content-Type": "application/json"
    };
    Object.keys(extra || {}).forEach(function (k) { h[k] = extra[k]; });
    return h;
  }

  function rest(path, opts) {
    opts = opts || {};
    return fetch(C.url + "/rest/v1/" + path, {
      method: opts.method || "GET",
      headers: authed(opts.headers),
      body: opts.body ? JSON.stringify(opts.body) : undefined
    }).then(function (r) {
      if (r.status === 401 || r.status === 403) throw new Error("Your session has expired. Ask for a new link.");
      if (!r.ok) return r.text().then(function (t) { throw new Error(t || ("Error " + r.status)); });
      return r.status === 204 ? null : r.json();
    });
  }

  /* ---------- the door ---------- */
  function askForLink(e) {
    e.preventDefault();
    var email = el("email").value.trim();
    if (!email) return;
    gateMsg.textContent = "Sending your link…";
    fetch(C.url + "/auth/v1/otp", {
      method: "POST",
      headers: { apikey: C.key, "Content-Type": "application/json" },
      body: JSON.stringify({
        email: email,
        create_user: false,
        options: { email_redirect_to: location.origin + location.pathname }
      })
    }).then(function (r) {
      if (!r.ok) return r.text().then(function (t) { throw new Error(t); });
      gateMsg.textContent = "Check your inbox. The link opens this page, signed in.";
    }).catch(function () {
      gateMsg.textContent = "That did not send. Check the address, or try again in a minute.";
    });
  }

  function signOut() {
    fetch(C.url + "/auth/v1/logout", { method: "POST", headers: authed() }).catch(function () {});
    clearSession();
    session = null;
    location.reload();
  }

  /* ---------- desk ---------- */
  var state = { works: [], pieces: [] };

  function say(msg, kind) {
    var s = el("status");
    s.textContent = msg;
    s.className = "status" + (kind ? " status--" + kind : "");
    if (kind === "ok") setTimeout(function () { if (s.textContent === msg) s.textContent = ""; }, 2600);
  }

  function field(label, value, attrs) {
    return '<label class="f"><span>' + label + "</span>" +
      (attrs && attrs.area
        ? '<textarea rows="' + (attrs.rows || 4) + '" data-k="' + attrs.k + '">' + esc(value) + "</textarea>"
        : '<input type="' + (attrs.type || "text") + '" data-k="' + attrs.k + '" value="' + esc(value) + '" />') +
      "</label>";
  }
  function esc(v) {
    return String(v == null ? "" : v).replace(/&/g, "&amp;").replace(/</g, "&lt;")
      .replace(/>/g, "&gt;").replace(/"/g, "&quot;");
  }
  function phaseSelect(v) {
    return '<label class="f"><span>phase</span><select data-k="phase">' +
      C.phases.map(function (p) {
        return '<option value="' + p + '"' + (p === v ? " selected" : "") + ">" + p + "</option>";
      }).join("") + "</select></label>";
  }

  function workCard(w) {
    return '<article class="card" data-id="' + w.id + '" data-table="cherry_works">' +
      '<div class="card__thumb">' + (w.image_url ? '<img src="' + esc(w.image_url) + '" alt="" />' : "<span>no image</span>") + "</div>" +
      '<div class="card__body">' +
      field("title", w.title, { k: "title" }) +
      phaseSelect(w.phase) +
      field("a few words (shown when the image is opened)", w.note, { k: "note", area: true, rows: 3 }) +
      field("image url", w.image_url, { k: "image_url" }) +
      '<div class="row">' +
      field("order", w.sort, { k: "sort", type: "number" }) +
      '<label class="f f--check"><input type="checkbox" data-k="published"' + (w.published ? " checked" : "") + " /><span>published</span></label>" +
      "</div>" +
      '<div class="row row--end"><button class="btn btn--save">save</button>' +
      '<button class="btn btn--ghost btn--del">delete</button></div>' +
      "</div></article>";
  }

  function pieceCard(p) {
    return '<article class="card card--text" data-id="' + p.id + '" data-table="cherry_pieces">' +
      '<div class="card__body">' +
      field("title", p.title, { k: "title" }) +
      '<div class="row">' +
      '<label class="f"><span>kind</span><select data-k="kind">' +
      ["poem", "monologue"].map(function (k) {
        return '<option value="' + k + '"' + (k === p.kind ? " selected" : "") + ">" + k + "</option>";
      }).join("") + "</select></label>" +
      phaseSelect(p.phase) +
      "</div>" +
      field("excerpt (the lines shown before opening)", p.excerpt, { k: "excerpt", area: true, rows: 2 }) +
      field("the piece itself", p.body, { k: "body", area: true, rows: 10 }) +
      '<div class="row">' +
      field("order", p.sort, { k: "sort", type: "number" }) +
      '<label class="f f--check"><input type="checkbox" data-k="published"' + (p.published ? " checked" : "") + " /><span>published</span></label>" +
      "</div>" +
      '<div class="row row--end"><button class="btn btn--save">save</button>' +
      '<button class="btn btn--ghost btn--del">delete</button></div>' +
      "</div></article>";
  }

  function groupByPhase(rows) {
    var out = {};
    C.phases.forEach(function (p) { out[p] = []; });
    rows.forEach(function (r) { (out[r.phase] || (out[r.phase] = [])).push(r); });
    return out;
  }

  function paint() {
    var w = groupByPhase(state.works), p = groupByPhase(state.pieces);
    el("works").innerHTML = C.phases.map(function (ph) {
      return '<section class="grp"><h3>' + ph + " <em>" + w[ph].length + "</em></h3>" +
        (w[ph].length ? w[ph].map(workCard).join("") : '<p class="empty">nothing here yet</p>') + "</section>";
    }).join("");
    el("pieces").innerHTML = C.phases.map(function (ph) {
      return '<section class="grp"><h3>' + ph + " <em>" + p[ph].length + "</em></h3>" +
        (p[ph].length ? p[ph].map(pieceCard).join("") : '<p class="empty">nothing here yet</p>') + "</section>";
    }).join("");
  }

  function collect(card) {
    var out = {};
    card.querySelectorAll("[data-k]").forEach(function (i) {
      var k = i.dataset.k;
      out[k] = i.type === "checkbox" ? i.checked : (i.type === "number" ? parseInt(i.value, 10) || 0 : i.value);
    });
    return out;
  }

  function load() {
    return Promise.all([
      rest("cherry_works?select=*&order=phase,sort"),
      rest("cherry_pieces?select=*&order=phase,sort")
    ]).then(function (r) {
      state.works = r[0] || [];
      state.pieces = r[1] || [];
      paint();
      say("");
    }).catch(function (e) { say(e.message, "bad"); });
  }

  /* ---------- actions ---------- */
  document.addEventListener("click", function (e) {
    var btn = e.target.closest(".btn");
    if (!btn) return;
    var card = btn.closest(".card");

    if (btn.classList.contains("btn--save") && card) {
      e.preventDefault();
      var body = collect(card);
      say("Saving…");
      rest(card.dataset.table + "?id=eq." + card.dataset.id, {
        method: "PATCH", headers: { Prefer: "return=minimal" }, body: body
      }).then(function () { say("Saved.", "ok"); return load(); })
        .catch(function (err) { say(err.message, "bad"); });
    }

    if (btn.classList.contains("btn--del") && card) {
      e.preventDefault();
      if (!confirm("Delete this permanently?")) return;
      rest(card.dataset.table + "?id=eq." + card.dataset.id, {
        method: "DELETE", headers: { Prefer: "return=minimal" }
      }).then(function () { say("Deleted.", "ok"); return load(); })
        .catch(function (err) { say(err.message, "bad"); });
    }

    if (btn.id === "addPiece") {
      e.preventDefault();
      rest("cherry_pieces", {
        method: "POST", headers: { Prefer: "return=minimal" },
        body: { title: "Untitled", kind: "poem", phase: "water", published: false, sort: 99 }
      }).then(function () { say("A new piece, unpublished until you say so.", "ok"); return load(); })
        .catch(function (err) { say(err.message, "bad"); });
    }
  });

  /* ---------- uploading a new artwork ---------- */
  function upload(file) {
    var clean = file.name.toLowerCase().replace(/[^a-z0-9.]+/g, "-").replace(/^-|-$/g, "");
    var path = Date.now() + "-" + clean;
    say("Uploading " + file.name + "…");
    return fetch(C.url + "/storage/v1/object/" + C.bucket + "/" + path, {
      method: "POST",
      headers: {
        apikey: C.key,
        Authorization: "Bearer " + session.access_token,
        "x-upsert": "true",
        "Content-Type": file.type || "application/octet-stream"
      },
      body: file
    }).then(function (r) {
      if (!r.ok) return r.text().then(function (t) { throw new Error(t || "upload failed"); });
      return C.url + "/storage/v1/object/public/" + C.bucket + "/" + path;
    });
  }

  function handleFiles(files) {
    var list = [].slice.call(files);
    if (!list.length) return;
    var phase = el("newPhase").value;
    (function next(i) {
      if (i >= list.length) { say("Uploaded.", "ok"); return load(); }
      upload(list[i]).then(function (url) {
        return rest("cherry_works", {
          method: "POST", headers: { Prefer: "return=minimal" },
          body: {
            title: list[i].name.replace(/\.[a-z0-9]+$/i, ""),
            phase: phase, image_url: url, sort: 50, published: true
          }
        });
      }).then(function () { next(i + 1); })
        .catch(function (err) { say(err.message, "bad"); });
    })(0);
  }

  /* ---------- boot ---------- */
  if (session) {
    gate.hidden = true;
    desk.hidden = false;
    el("who").textContent = "signed in";
    el("signout").addEventListener("click", signOut);
    var drop = el("drop"), picker = el("picker");
    drop.addEventListener("click", function () { picker.click(); });
    picker.addEventListener("change", function () { handleFiles(picker.files); picker.value = ""; });
    ["dragenter", "dragover"].forEach(function (ev) {
      drop.addEventListener(ev, function (e) { e.preventDefault(); drop.classList.add("is-over"); });
    });
    ["dragleave", "drop"].forEach(function (ev) {
      drop.addEventListener(ev, function (e) { e.preventDefault(); drop.classList.remove("is-over"); });
    });
    drop.addEventListener("drop", function (e) { handleFiles(e.dataTransfer.files); });
    document.querySelectorAll(".tabs button").forEach(function (t) {
      t.addEventListener("click", function () {
        document.querySelectorAll(".tabs button").forEach(function (b) { b.classList.remove("is-on"); });
        t.classList.add("is-on");
        el("works").hidden = t.dataset.pane !== "works";
        el("pieces").hidden = t.dataset.pane !== "pieces";
        el("uploader").hidden = t.dataset.pane !== "works";
      });
    });
    load();
  } else {
    gate.hidden = false;
    desk.hidden = true;
    el("gateForm").addEventListener("submit", askForLink);
  }
})();
