/* ============================================================
   THE STUDIO — her page on one side, her words on the other.
   Nothing here is a credential: the password is checked by the auth
   service and the database refuses every write that does not carry
   her signed-in session. There is no way to sign up.

   Notes for whoever comes next:
   · the frame has no sandbox attribute on purpose. It is same-origin,
     which is what lets a keystroke repaint the page instantly.
   · never reassign frame.src to "refresh" it, and never move the frame
     in the DOM. Both reload the page and lose her place. Move it with
     CSS only.
   ============================================================ */
(function () {
  "use strict";
  var C = window.CHERRY, SCHEMA = window.CHERRY_SCHEMA,
      LISTS = window.CHERRY_LISTS, ROOMS = window.CHERRY_ROOMS,
      PAGES = window.CHERRY_PAGES;
  var SESSION = "cherry.session", LAST = "cherry.page";
  var $ = function (s, r) { return (r || document).querySelector(s); };
  var $$ = function (s, r) { return [].slice.call((r || document).querySelectorAll(s)); };

  /* ---------- session ---------- */
  function save(s) { try { localStorage.setItem(SESSION, JSON.stringify(s)); } catch (e) {} }
  function load() { try { return JSON.parse(localStorage.getItem(SESSION) || "null"); } catch (e) { return null; } }
  function forget() { try { localStorage.removeItem(SESSION); } catch (e) {} }
  var session = load();
  function token() { return session ? session.access_token : C.key; }

  function refresh() {
    if (!session || !session.refresh_token) return Promise.reject(new Error("no session"));
    return fetch(C.url + "/auth/v1/token?grant_type=refresh_token", {
      method: "POST", headers: { apikey: C.key, "Content-Type": "application/json" },
      body: JSON.stringify({ refresh_token: session.refresh_token })
    }).then(function (r) { if (!r.ok) throw new Error("refresh"); return r.json(); })
      .then(function (s) {
        session = { access_token: s.access_token, refresh_token: s.refresh_token };
        save(session); return session;
      });
  }

  /* every error she can see is one of these four sentences */
  function humanise(err) {
    var raw = String(err && err.message || err || "");
    console.error("[archive]", raw);
    if (/signed out|refresh|JWT|401|403/i.test(raw))
      return "You have been signed out. Sign in again; your words are still on this screen.";
    if (/too large|413|exceeded|maximum allowed size/i.test(raw))
      return "That file is bigger than 50 MB, which is all the archive can hold. " +
             "Put it on YouTube or Vimeo and paste the link instead.";
    if (/mime type|not supported/i.test(raw))
      return "The archive does not know that kind of file. Films work best as MP4.";
    if (/Failed to fetch|NetworkError|offline/i.test(raw))
      return "The archive did not answer. Nothing is lost, try again in a moment.";
    return "Something went wrong saving that. Your words are still on screen.";
  }

  function rest(path, opts, retried) {
    opts = opts || {};
    var h = { apikey: C.key, Authorization: "Bearer " + token(), "Content-Type": "application/json" };
    Object.keys(opts.headers || {}).forEach(function (k) { h[k] = opts.headers[k]; });
    return fetch(C.url + "/rest/v1/" + path, {
      method: opts.method || "GET", headers: h,
      body: opts.body ? JSON.stringify(opts.body) : undefined
    }).then(function (r) {
      if ((r.status === 401 || r.status === 403) && !retried && session) {
        return refresh().then(function () { return rest(path, opts, true); })
          .catch(function () { forget(); throw new Error("signed out"); });
      }
      if (!r.ok) return r.text().then(function (t) { throw new Error(t.slice(0, 200) || ("Error " + r.status)); });
      return r.text().then(function (t) { return t ? JSON.parse(t) : null; });
    });
  }

  /* ---------- the door ---------- */
  function signIn(e) {
    e.preventDefault();
    var email = $("#email").value.trim(), password = $("#password").value;
    var msg = $("#gateMsg"), btn = $("#gateBtn");
    if (!email || !password) return;
    btn.disabled = true; msg.textContent = "Opening…";
    fetch(C.url + "/auth/v1/token?grant_type=password", {
      method: "POST", headers: { apikey: C.key, "Content-Type": "application/json" },
      body: JSON.stringify({ email: email, password: password })
    }).then(function (r) { return r.json().then(function (b) { return { ok: r.ok, body: b }; }); })
      .then(function (res) {
        if (!res.ok || !res.body.access_token) throw new Error("That email and password do not match.");
        session = { access_token: res.body.access_token, refresh_token: res.body.refresh_token };
        save(session);
        return fetch(C.url + "/rest/v1/rpc/cherry_is_admin", {
          method: "POST", headers: { apikey: C.key, Authorization: "Bearer " + session.access_token,
            "Content-Type": "application/json" }, body: "{}"
        }).then(function (r) { return r.ok ? r.json() : false; });
      }).then(function (isAdmin) {
        if (isAdmin !== true) { forget(); session = null; throw new Error("This account cannot edit the archive."); }
        location.reload();
      }).catch(function (err) {
        msg.textContent = err.message; btn.disabled = false; $("#password").value = "";
      });
  }

  /* ---------- state ---------- */
  var data = { settings: {}, works: [], pieces: [], tracks: [], portals: [], films: [] };
  var here = null, frame = null, picked = null;

  /* one place that knows which table lives in which drawer */
  var POOL = {
    cherry_works: "works", cherry_pieces: "pieces",
    cherry_portals: "portals", cherry_tracks: "tracks", cherry_films: "films"
  };

  /* the archive holds what it can hold: past this, a film belongs on
     YouTube or Vimeo and the site just points at it */
  var MAX_FILE = 50 * 1024 * 1024;

  function esc(v) {
    return String(v == null ? "" : v).replace(/&/g, "&amp;").replace(/</g, "&lt;")
      .replace(/>/g, "&gt;").replace(/"/g, "&quot;");
  }
  /* she presses Enter; the site needs <br> */
  function toBox(v) { return String(v == null ? "" : v).replace(/<br\s*\/?>/gi, "\n"); }
  function toSite(v) { return String(v == null ? "" : v).replace(/\r?\n/g, "<br/>"); }

  var sayT;
  function say(text, kind, undo) {
    var s = $("#status");
    s.innerHTML = esc(text) + (undo ? ' <button class="undo" type="button">Put it back</button>' : "");
    s.className = "status" + (kind ? " status--" + kind : "");
    if (undo) s._undo = undo;
    clearTimeout(sayT);
    if (kind !== "bad") sayT = setTimeout(function () {
      s.textContent = "All saved"; s.className = "status";
    }, undo ? 12000 : 2400);
  }

  /* ---------- talking to the page ---------- */
  function tell(msg) {
    if (!frame || !frame.contentWindow) return;
    msg.from = "cherry-desk";
    frame.contentWindow.postMessage(msg, location.origin);
  }
  function openPage(pageFile) {
    var now = (frame.getAttribute("src") || "").split("/").pop();
    if (now === pageFile) return;               // already there: never reload under her
    frame.src = pageFile;                       // only ever on a page change
  }

  /* ---------- reading ---------- */
  function loadAll() {
    return Promise.all([
      rest("cherry_settings?select=key,value"),
      rest("cherry_works?select=*&order=phase,sort"),
      rest("cherry_pieces?select=*&order=phase,sort"),
      rest("cherry_tracks?select=*&order=voice,sort"),
      rest("cherry_portals?select=*&order=kind,sort"),
      rest("cherry_films?select=*&order=sort")
    ]).then(function (r) {
      data.settings = {};
      (r[0] || []).forEach(function (s) { data.settings[s.key] = s.value; });
      data.works = r[1] || []; data.pieces = r[2] || [];
      data.tracks = r[3] || []; data.portals = r[4] || [];
      data.films = r[5] || [];
    });
  }

  function rowsFor(listId) {
    var spec = LISTS[listId];
    var rows = data[POOL[spec.table]].slice();
    Object.keys(spec.where || {}).forEach(function (k) {
      rows = rows.filter(function (r) { return r[k] === spec.where[k]; });
    });
    return rows.sort(function (a, b) { return (a.sort | 0) - (b.sort | 0); });
  }
  function findRow(table, id) {
    var pool = data[POOL[table]] || [];
    for (var i = 0; i < pool.length; i++) if (String(pool[i].id) === String(id)) return pool[i];
    return null;
  }

  /* ---------- writing, one field at a time ---------- */
  var timers = {};
  /* ============================================================
     WHAT SHE HAS CHANGED, AND WHAT THE WORLD HAS SEEN

     Everything she types is kept here first, in her own draft, and
     her live site does not move until she says so. That is the whole
     point: a person who is frightened of breaking something in public
     edits timidly, and timid is the opposite of what this is for.

     Her Studio and the preview beside it show the draft. Her live
     site shows what she last made live. Nothing else changes.

     Adding something already arrives switched off, so a new poem is
     invisible until she turns it on and makes it live. Removing
     something waits here too, and the trash still holds it either
     way.
     ============================================================ */
  var draft = { settings: {}, rows: {}, gone: {} };

  function loadDraft() {
    try {
      var d = JSON.parse(data.settings.desk_draft || "null");
      if (d && typeof d === "object") {
        draft = { settings: d.settings || {}, rows: d.rows || {}, gone: d.gone || {} };
      }
    } catch (e) { draft = { settings: {}, rows: {}, gone: {} }; }
  }
  /* the draft lives in her archive, not this browser, so a closed laptop
     or a crashed tab never costs her an afternoon */
  var draftTimer;
  function saveDraft() {
    clearTimeout(draftTimer);
    draftTimer = setTimeout(function () {
      var blob = JSON.stringify(draft);
      data.settings.desk_draft = blob;
      rest("cherry_settings?on_conflict=key", {
        method: "POST", headers: { Prefer: "resolution=merge-duplicates,return=minimal" },
        body: [{ key: "desk_draft", value: blob }]
      }).catch(function (e) { say(humanise(e), "bad"); });
    }, 600);
  }

  function waiting() {
    return Object.keys(draft.settings).length + Object.keys(draft.rows).length +
           Object.keys(draft.gone).length;
  }
  /* her words for her own keys, so the waiting list reads like a diary */
  function settingLabel(key) {
    var found = key;
    SCHEMA.forEach(function (sec) {
      (sec.fields || []).forEach(function (f) { if (f.k === key) found = f.label; });
    });
    return found;
  }
  function rowLabel(table, id) {
    var r = findRow(table, id);
    return (r && (r.title || r.name)) || "something";
  }
  function markWaiting() {
    var n = waiting(), btn = $("#liveBtn"), tag = $("#waiting");
    if (tag) tag.textContent = n ? (n === 1 ? "1 change waiting" : n + " changes waiting") : "";
    if (btn) { btn.hidden = !n; btn.textContent = "Make it live"; }
    var pb = $("#pendingBtn");
    if (pb) pb.hidden = !n;
    if (!n && $("#pending")) $("#pending").hidden = true;
    document.body.classList.toggle("has-draft", !!n);
    if ($("#pending") && !$("#pending").hidden) paintPending();
  }

  /* the waiting list, in the order she made the changes, newest first */
  function paintPending() {
    var box = $("#pending");
    if (!box) return;
    var items = [];
    Object.keys(draft.settings).forEach(function (k) {
      var e = draft.settings[k];
      items.push({ at: e.at, kind: "setting", ref: k, what: e.label || k, did: "rewrote" });
    });
    Object.keys(draft.rows).forEach(function (ref) {
      var d = draft.rows[ref];
      items.push({ at: d.at, kind: "row", ref: ref, what: d.label || "something", did: "changed" });
    });
    Object.keys(draft.gone).forEach(function (ref) {
      var g = draft.gone[ref];
      items.push({ at: g.at, kind: "gone", ref: ref, what: g.label || "something", did: "removed" });
    });
    items.sort(function (a, b) { return (b.at || 0) - (a.at || 0); });

    box.innerHTML = items.length
      ? '<h3 class="pending__name">Waiting to go live</h3>' +
        '<p class="pending__lead">None of this is on your site yet. Nobody but you can see it.</p>' +
        '<ul class="pending__list">' + items.map(function (i) {
          return '<li><span class="pending__what"><b>' + esc(i.what) + "</b> " + esc(i.did) + "</span>" +
            '<button class="mini" type="button" data-undo="' + i.kind + '" data-ref="' + esc(i.ref) +
            '">Put it back</button></li>';
        }).join("") + "</ul>" +
        '<div class="pending__feet">' +
        '<button class="add" id="liveBtn2" type="button">Make it live</button>' +
        '<button class="mini mini--red" id="discardBtn" type="button">Undo everything</button></div>'
      : '<h3 class="pending__name">Nothing is waiting</h3>' +
        '<p class="pending__lead">Your site is showing everything you have made live.</p>';
  }

  function saveSetting(key, value) {
    /* the desk's own bookkeeping is not content and never waits */
    if (key === "desk_draft" || key === "desk_trash") {
      data.settings[key] = value;
      rest("cherry_settings?on_conflict=key", {
        method: "POST", headers: { Prefer: "resolution=merge-duplicates,return=minimal" },
        body: [{ key: key, value: value }]
      }).catch(function (e) { say(humanise(e), "bad"); });
      return;
    }
    var had = draft.settings[key];
    var before = had ? had.before : (data.settings[key] === undefined ? "" : data.settings[key]);
    data.settings[key] = value;
    if (String(before) === String(value)) delete draft.settings[key];
    else draft.settings[key] = { before: before, value: value, at: Date.now(), label: settingLabel(key) };
    saveDraft(); markWaiting();
    say("Kept in your draft");
  }

  function saveRow(table, id, patch, quiet) {
    var row = findRow(table, id);
    var ref = table + ":" + id;
    var d = draft.rows[ref] || { table: table, id: id, before: {}, patch: {}, at: Date.now() };
    Object.keys(patch).forEach(function (k) {
      if (!(k in d.before)) d.before[k] = row ? row[k] : null;
      d.patch[k] = patch[k];
      if (row) row[k] = patch[k];
    });
    /* a value she typed and then typed back is not a change */
    var moved = Object.keys(d.patch).some(function (k) { return String(d.patch[k]) !== String(d.before[k]); });
    d.at = Date.now();
    d.label = rowLabel(table, id);
    if (moved) draft.rows[ref] = d; else delete draft.rows[ref];
    saveDraft(); markWaiting();
    if (!quiet) say("Kept in your draft");
  }

  /* put one change back the way it was, without touching her live site */
  function undoOne(kind, ref) {
    if (kind === "setting") {
      var e = draft.settings[ref];
      if (!e) return;
      data.settings[ref] = e.before;
      delete draft.settings[ref];
      tell({ type: "set", key: ref, value: e.before });
    } else if (kind === "row") {
      var d = draft.rows[ref];
      if (!d) return;
      var row = findRow(d.table, d.id);
      Object.keys(d.before).forEach(function (k) {
        if (row) row[k] = d.before[k];
        tell({ type: "setRow", scope: d.table + ":" + d.id, key: k, value: d.before[k] });
      });
      delete draft.rows[ref];
    } else if (kind === "gone") {
      var g = draft.gone[ref];
      if (!g) return;
      var pool = POOL[g.table];
      if (pool && !findRow(g.table, g.id)) data[pool].push(g.row);
      delete draft.gone[ref];
    }
    saveDraft(); markWaiting(); paint(); repaintFrame();
    say("Put back");
  }

  function discardDraft() {
    Object.keys(draft.settings).forEach(function (k) { data.settings[k] = draft.settings[k].before; });
    Object.keys(draft.rows).forEach(function (ref) {
      var d = draft.rows[ref], row = findRow(d.table, d.id);
      if (row) Object.keys(d.before).forEach(function (k) { row[k] = d.before[k]; });
    });
    Object.keys(draft.gone).forEach(function (ref) {
      var g = draft.gone[ref], pool = POOL[g.table];
      if (pool && !findRow(g.table, g.id)) data[pool].push(g.row);
    });
    draft = { settings: {}, rows: {}, gone: {} };
    saveDraft(); markWaiting(); paint(); repaintFrame();
    say("Everything is back to how your site looks now");
  }

  /* the one button that moves her live site */
  function goLive() {
    var n = waiting();
    if (!n) { say("Nothing is waiting."); return; }
    var btn = $("#liveBtn");
    if (btn) { btn.disabled = true; btn.textContent = "Going live…"; }
    say("Making it live…");

    var jobs = [];
    Object.keys(draft.settings).forEach(function (k) {
      jobs.push(function () {
        return rest("cherry_settings?on_conflict=key", {
          method: "POST", headers: { Prefer: "resolution=merge-duplicates,return=minimal" },
          body: [{ key: k, value: draft.settings[k].value }]
        }).then(function () { delete draft.settings[k]; });
      });
    });
    Object.keys(draft.rows).forEach(function (ref) {
      var d = draft.rows[ref];
      jobs.push(function () {
        return rest(d.table + "?id=eq." + d.id, { method: "PATCH",
          headers: { Prefer: "return=minimal" }, body: d.patch })
          .then(function () { delete draft.rows[ref]; });
      });
    });
    Object.keys(draft.gone).forEach(function (ref) {
      var g = draft.gone[ref];
      jobs.push(function () {
        return rest(g.table + "?id=eq." + g.id, { method: "DELETE",
          headers: { Prefer: "return=minimal" } })
          .then(function () { delete draft.gone[ref]; });
      });
    });

    /* one at a time, and anything that fails simply stays in the draft */
    jobs.reduce(function (chain, job) {
      return chain.then(job);
    }, Promise.resolve()).then(function () {
      saveDraft(); markWaiting(); paint();
      if (btn) { btn.disabled = false; }
      say("Your site is live. " + n + (n === 1 ? " change is" : " changes are") + " out in the world.");
    }).catch(function (e) {
      saveDraft(); markWaiting(); paint();
      if (btn) { btn.disabled = false; btn.textContent = "Make it live"; }
      say(humanise(e) + " Nothing was lost, it is still waiting.", "bad");
    });
  }

  /* ---------- the trash: nothing says "permanently" ---------- */
  function remove(table, id) {
    var row = findRow(table, id);
    if (!row) return;
    var trash = [];
    try { trash = JSON.parse(data.settings.desk_trash || "[]"); } catch (e) { trash = []; }
    trash.unshift({ table: table, row: row, at: Date.now() });
    trash = trash.slice(0, 20);
    var blob = JSON.stringify(trash);
    saveSetting("desk_trash", blob);

    /* it leaves her desk now and leaves her live site when she says so */
    var ref = table + ":" + id;
    draft.gone[ref] = { table: table, id: id, row: row, at: Date.now(),
                        label: row.title || row.name || "something" };
    var pool = POOL[table];
    data[pool] = data[pool].filter(function (r) { return String(r.id) !== String(id); });
    saveDraft(); markWaiting(); paint(); repaintFrame();
    say("Removed from your draft", "ok", function () { undoOne("gone", ref); });
  }
  function putBack(table, row) {
    /* if it is still only removed in her draft, the row never left the
       archive: cancelling the removal is the whole job */
    var ref = table + ":" + row.id;
    if (draft.gone[ref]) { undoOne("gone", ref); return; }
    var body = {};
    Object.keys(row).forEach(function (k) {
      if (k !== "created_at" && k !== "updated_at") body[k] = row[k];
    });
    rest(table, { method: "POST", headers: { Prefer: "return=representation" }, body: body })
      .then(function () { return loadAll(); })
      .then(function () { applyDraft(); paint(); repaintFrame(); say("Put back"); })
      .catch(function (e) { say(humanise(e), "bad"); });
  }

  /* after any reload from the archive, her unpublished work goes back on top */
  function applyDraft() {
    Object.keys(draft.settings).forEach(function (k) { data.settings[k] = draft.settings[k].value; });
    Object.keys(draft.rows).forEach(function (ref) {
      var d = draft.rows[ref], row = findRow(d.table, d.id);
      if (row) Object.keys(d.patch).forEach(function (k) { row[k] = d.patch[k]; });
    });
    Object.keys(draft.gone).forEach(function (ref) {
      var g = draft.gone[ref], pool = POOL[g.table];
      if (pool) data[pool] = data[pool].filter(function (r) { return String(r.id) !== String(g.id); });
    });
  }

  /* ---------- adding ---------- */
  function nextSort(listId, room) {
    var rows = rowsFor(listId).filter(function (r) { return !room || r.phase === room; });
    return rows.reduce(function (m, r) { return Math.max(m, r.sort | 0); }, -1) + 1;
  }
  function addRow(listId, room, extra, quiet) {
    var spec = LISTS[listId];
    var body = { sort: nextSort(listId, room), published: false };
    Object.keys(spec.where || {}).forEach(function (k) { body[k] = spec.where[k]; });
    if (spec.room) body[spec.room] = room || "water";
    if (spec.table === "cherry_pieces") { body.title = "Untitled"; body.kind = "poem"; }
    else if (spec.table === "cherry_portals") body.name = "New link";
    else body.title = "Untitled";
    Object.keys(extra || {}).forEach(function (k) { body[k] = extra[k]; });
    return rest(spec.table, { method: "POST", headers: { Prefer: "return=representation" }, body: body })
      .then(function () { return loadAll(); })
      .then(function () {
        applyDraft();
        if (quiet) return;
        paint(); say("Added. Only you can see it, switch it on when you are ready.");
      });
  }

  /* films are heavy: she needs to see the bar move, so this is XHR and
     not fetch, which cannot report how far a body has got */
  function put(file, name, onward, retried) {
    return new Promise(function (ok, no) {
      var tidy = String(name || file.name).toLowerCase()
        .replace(/[^a-z0-9.]+/g, "-").replace(/^-|-$/g, "");
      var path = Date.now() + "-" + tidy;
      var x = new XMLHttpRequest();
      x.open("POST", C.url + "/storage/v1/object/" + C.bucket + "/" + path);
      x.setRequestHeader("apikey", C.key);
      x.setRequestHeader("Authorization", "Bearer " + token());
      x.setRequestHeader("x-upsert", "true");
      x.setRequestHeader("Content-Type", file.type || "application/octet-stream");
      if (onward) x.upload.onprogress = function (e) {
        if (e.lengthComputable) onward(e.loaded / e.total);
      };
      x.onload = function () {
        if (x.status >= 200 && x.status < 300) {
          ok(C.url + "/storage/v1/object/public/" + C.bucket + "/" + path);
        } else if ((x.status === 401 || x.status === 403) && !retried && session) {
          /* a long upload can outlive the session that started it */
          refresh().then(function () { return put(file, name, onward, true); })
            .then(ok, function () { no(new Error("signed out")); });
        } else {
          no(new Error(String(x.responseText || "").slice(0, 160) || ("upload " + x.status)));
        }
      };
      x.onerror = function () { no(new Error("Failed to fetch")); };
      x.send(file);
    });
  }
  function upload(file, onward) {
    if (file.size > MAX_FILE) {
      return Promise.reject(new Error("too large: " + file.name));
    }
    return put(file, file.name, onward);
  }

  /* the first frame of her film, so a film that has not been opened yet
     still has a face on the page */
  function posterFrom(file) {
    return new Promise(function (done) {
      if (!/^video\//.test(file.type || "")) return done(null);
      var url = URL.createObjectURL(file), v = document.createElement("video");
      var give = function (blob) { URL.revokeObjectURL(url); done(blob); };
      var guard = setTimeout(function () { give(null); }, 15000);
      v.preload = "metadata"; v.muted = true; v.playsInline = true;
      v.onloadeddata = function () {
        try { v.currentTime = Math.min(1.5, (v.duration || 4) / 4); } catch (e) { give(null); }
      };
      v.onseeked = function () {
        clearTimeout(guard);
        try {
          var c = document.createElement("canvas");
          c.width = v.videoWidth; c.height = v.videoHeight;
          if (!c.width || !c.height) return give(null);
          c.getContext("2d").drawImage(v, 0, 0, c.width, c.height);
          c.toBlob(function (b) { give(b); }, "image/jpeg", 0.82);
        } catch (e) { give(null); }
      };
      v.onerror = function () { clearTimeout(guard); give(null); };
      v.src = url;
    });
  }
  /* she should never have to time her own recordings with a stopwatch */
  function audioLength(file) {
    return new Promise(function (done) {
      if (!/^audio\//.test(file.type || "")) return done("");
      var url = URL.createObjectURL(file), a = new Audio();
      var finish = function (v) { URL.revokeObjectURL(url); done(v); };
      a.preload = "metadata";
      a.onloadedmetadata = function () {
        var s = Math.round(a.duration || 0);
        finish(s ? Math.floor(s / 60) + ":" + ("0" + (s % 60)).slice(-2) : "");
      };
      a.onerror = function () { finish(""); };
      setTimeout(function () { finish(""); }, 8000);
      a.src = url;
    });
  }

  function addFiles(listId, room, files, base) {
    var list = [].slice.call(files);
    if (!list.length) return;
    var spec = LISTS[listId], skipped = [];
    (function next(i) {
      if (i >= list.length) {
        paint();
        if (skipped.length) {
          say(skipped.length + (skipped.length === 1 ? " file was" : " files were") +
            " bigger than 50 MB, so it stayed on your computer. Put those on YouTube " +
            "or Vimeo and paste the links.", "bad");
        } else {
          say("Added. Only you can see " + (list.length === 1 ? "it" : "them") + " yet.");
        }
        return;
      }
      var f = list[i];
      var of = list.length > 1 ? " (" + (i + 1) + " of " + list.length + ")" : "";
      if (f.size > MAX_FILE) { skipped.push(f.name); return next(i + 1); }
      say("Sending " + f.name + "…" + of);
      Promise.all([
        upload(f, function (frac) {
          say("Sending " + f.name + "… " + Math.round(frac * 100) + "%" + of);
        }),
        audioLength(f), posterFrom(f)
      ]).then(function (got) {
        var extra = { title: f.name.replace(/\.[a-z0-9]+$/i, "") };
        Object.keys(base || {}).forEach(function (k) { extra[k] = base[k]; });
        extra[spec.media] = got[0];
        if (got[1]) extra.length = got[1];
        if (!got[2]) return extra;
        return put(got[2], extra.title + "-frame.jpg")
          .then(function (url) { extra.poster_url = url; return extra; })
          .catch(function () { return extra; });     /* no face is not a failure */
      }).then(function (extra) { return addRow(listId, room, extra, true); })
        .then(function () { next(i + 1); })
        .catch(function (e) { say(humanise(e), "bad"); });
    })(0);
  }

  /* ---------- drawing the shelf ---------- */
  function filmKind(url) {
    var u = String(url || "").trim();
    if (!u) return "";
    if (/youtube\.com|youtu\.be/i.test(u)) return "youtube";
    if (/vimeo\.com/i.test(u)) return "vimeo";
    return "file";
  }
  /* a link she pastes should bring its own picture with it */
  function posterForLink(url) {
    var m = String(url).match(/(?:youtube\.com\/(?:watch\?(?:.*&)?v=|embed\/|shorts\/)|youtu\.be\/)([\w-]{6,})/i);
    return m ? "https://img.youtube.com/vi/" + m[1] + "/maxresdefault.jpg" : "";
  }

  function fieldHTML(f, value, scope) {
    var hint = f.hint ? '<em class="hint">' + esc(f.hint) + "</em>" : "";
    var em = f.em ? '<em class="hint">the &lt;em&gt; marks make a word italic, leave them as they are.</em>' : "";
    var head = '<span class="lab">' + esc(f.label) + hint + em + "</span>";
    var attrs = 'data-k="' + esc(f.k) + '" data-scope="' + esc(scope) + '"';

    if (f.type === "image" || f.type === "audio") {
      var isImg = f.type === "image";
      return '<div class="fld fld--media">' + head +
        '<div class="mediabox' + (value ? " has" : "") + '" ' + attrs + ' data-accept="' +
          (isImg ? "image/*" : "audio/*") + '">' +
        (isImg && value ? '<img src="' + esc(value) + '" alt="" />'
                        : '<span class="mediabox__none">' + (value ? "Recording added" : "No " + (isImg ? "photo" : "recording") + " yet") + "</span>") +
        '<span class="mediabox__do">' + (value ? "Change" : "Choose") + (isImg ? " a photo" : " a recording") + "…</span>" +
        "</div></div>";
    }
    /* two ways in, because a whole film rarely fits in a database:
       hand it the file, or hand it a link to where it already lives */
    if (f.type === "film") {
      var kind = filmKind(value);
      var said = kind === "file" ? "A film you uploaded"
        : kind === "youtube" ? "A film on YouTube"
        : kind === "vimeo" ? "A film on Vimeo"
        : "No film yet";
      return '<div class="fld">' + head +
        '<div class="mediabox mediabox--film' + (value ? " has" : "") + '" ' + attrs +
          ' data-accept="video/mp4,video/webm,video/quicktime,video/x-m4v">' +
        '<span class="mediabox__none">' + said + "</span>" +
        '<span class="mediabox__do">' + (value ? "Choose a different film" : "Choose a film from this computer") + "…</span>" +
        "</div>" +
        '<input type="text" class="linkbox" ' + attrs +
          ' value="' + esc(kind === "file" ? "" : (value || "")) + '"' +
          ' placeholder="or paste a YouTube or Vimeo link" />' +
        '<em class="hint">Anything longer than a few minutes belongs on YouTube or Vimeo. ' +
        'Paste the link here and it plays on your page just the same.</em>' +
        "</div>";
    }
    if (f.type === "choice") {
      return '<div class="fld">' + head + '<div class="pills" ' + attrs + ">" +
        f.options.map(function (o) {
          return '<button type="button" class="pill' + (o[0] === value ? " on" : "") +
            '" data-v="' + esc(o[0]) + '">' + esc(o[1]) + "</button>";
        }).join("") + "</div></div>";
    }
    if (f.type === "page") {
      return '<label class="fld">' + head + "<select " + attrs + ">" +
        PAGES.map(function (p) {
          return '<option value="' + esc(p[0]) + '"' + (p[0] === value ? " selected" : "") + ">" + esc(p[1]) + "</option>";
        }).join("") + "</select></label>";
    }
    /* anything she may want to break across lines has to be a box she can
       press Enter inside; a one-line input silently swallows the key */
    if (f.type === "long" || f.enter) {
      return '<label class="fld">' + head + '<textarea rows="' +
        (f.rows || (f.type === "long" ? 4 : 2)) + '" ' + attrs + ">" +
        esc(toBox(value)) + "</textarea></label>";
    }
    return '<label class="fld">' + head + '<input type="text" ' + attrs + ' value="' +
      esc(toBox(value).replace(/\n/g, " ")) + '" /></label>';
  }

  /* ---------- the groups she names for herself ---------- */
  /* Two lists carry groups now, the chapters and her spoken word, and they
     must not share names: a group called "Live" on one page has nothing to
     do with the other. Each list keeps its own setting. */
  function groupKey(listId) {
    return (LISTS[listId] && LISTS[listId].groupKey) || "spoken_groups";
  }

  /* ---------- her books ----------
     A book is a name over a fixed id. The id is what a printed code carries,
     so it is made once and never changes: she can retitle a book the day
     before it goes to press and every copy already in the world still opens
     the right page. Kept in her settings rather than a table of its own, so
     adding a book costs her nothing but typing. */
  function booksList() {
    try {
      var a = JSON.parse(data.settings.cherry_books || "[]");
      return Array.isArray(a) ? a.filter(function (b) { return b && b.id; }) : [];
    } catch (e) { return []; }
  }
  function saveBooks(list) {
    saveSetting("cherry_books", JSON.stringify(list));
  }
  function newBookId(taken) {
    var tries = 0, id;
    do {
      id = Math.random().toString(36).slice(2, 9);
      tries++;
    } while (tries < 50 && taken.some(function (b) { return b.id === id; }));
    return id;
  }

  /* One shape for both kinds of block: a plain group is its own label, a book
     is a label with an id underneath. Everything downstream reads {key,label}
     and never has to know which it is looking at. */
  function groupSpecs(listId) {
    if (LISTS[listId] && LISTS[listId].books) {
      return booksList().map(function (b) { return { key: b.id, label: b.title || "Untitled book", book: true }; });
    }
    return groupNames(listId).map(function (n) { return { key: n, label: n }; });
  }
  function groupNames(listId) {
    try {
      var a = JSON.parse(data.settings[groupKey(listId)] || "[]");
      return Array.isArray(a) ? a : [];
    } catch (e) { return []; }
  }
  function saveGroups(listId, list) {
    saveSetting(groupKey(listId), JSON.stringify(list));
  }

  function sectionChooser(row, listId) {
    var specs = groupSpecs(listId);
    if (!specs.length) return "";
    var known = specs.some(function (g) { return g.key === row.section; });
    var spec = LISTS[listId] || {};
    return '<div class="fld"><span class="lab">' +
      esc(spec.which || "Which part of the page?") + "</span>" +
      '<div class="rooms" data-k="section" data-scope="' + row._scope + '">' +
      specs.map(function (g) {
        return '<button type="button" class="room' + (g.key === row.section ? " on" : "") +
          '" data-v="' + esc(g.key) + '"><strong>' + esc(g.label) + "</strong></button>";
      }).join("") +
      '<button type="button" class="room' + (known ? "" : " on") +
        '" data-v=""><strong>' + (spec.books ? "No book yet" : "No group") + "</strong></button>" +
      "</div></div>";
  }

  function countLine(rows) {
    var hidden = rows.filter(function (r) { return !r.published; }).length;
    return "<em>" + (rows.length - hidden) + " on the site" +
      (hidden ? " · " + hidden + " only you" : "") + "</em>";
  }

  function groupsHTML(listId) {
    var spec = LISTS[listId], specs = groupSpecs(listId), rows = rowsFor(listId);
    var keys = specs.map(function (g) { return g.key; });

    var out = specs.map(function (g) {
      var mine = rows.filter(function (r) { return r.section === g.key; });
      return '<section class="block" data-groupblock="' + esc(g.key) + '" data-glist="' + listId + '">' +
        '<h3 class="block__name"><input class="gname" type="text" value="' + esc(g.label) + '" ' +
          'aria-label="The name of this ' + (g.book ? "book" : "group") + '" /> ' + countLine(mine) +
        '<span class="gmove"><button class="mini" type="button" data-gmove="up">Move up</button>' +
        '<button class="mini" type="button" data-gmove="down">Move down</button>' +
        '<button class="mini mini--red" type="button" data-gdrop="1">Remove the ' +
          (g.book ? "book" : "group") + "</button></span></h3>" +
        (g.book ? bookCodeHTML(g.key, g.label) : "") +
        (mine.length ? mine.map(function (r) { return cardHTML(listId, r); }).join("")
                     : '<p class="none">Nothing in this ' + (g.book ? "book" : "group") + ' yet.</p>') +
        '<button class="add" type="button" data-add="' + listId + '" data-group="' + esc(g.key) + '">' +
          esc(spec.add) + "</button>" +
        "</section>";
    }).join("");

    var loose = rows.filter(function (r) { return keys.indexOf(r.section) < 0; });
    if (loose.length || !specs.length) {
      out += '<section class="block">' +
        '<h3 class="block__name">' + (specs.length ? esc(spec.loose || "Not in any group")
                                                   : esc(spec.loose || "Everything here")) +
          " " + countLine(loose) + "</h3>" +
        (spec.books && specs.length
          ? '<p class="none">These belong to whichever book comes first until you say otherwise. ' +
            'Open one and choose its book.</p>' : "") +
        (loose.length ? loose.map(function (r) { return cardHTML(listId, r); }).join("")
                      : '<p class="none">Nothing here yet.</p>') +
        '<button class="add" type="button" data-add="' + listId + '" data-group="">' +
          esc(spec.add) + "</button></section>";
    }

    out += '<section class="block"><h3 class="block__name">' +
      (spec.books ? "Another book" : "A new group") + "</h3>" +
      '<div class="gnew"><input class="gnewbox" type="text" placeholder="' + esc(spec.newGroup || "Name it") + '" />' +
      '<button class="add" id="gnewBtn" type="button" data-list="' + listId + '">' +
        (spec.books ? "Add the book" : "Make the group") + "</button></div>" +
      "</section>";
    return out;
  }

  /* the code for one book, drawn under its name */
  function bookCodeHTML(id, title) {
    return '<div class="qr qr--book" data-book="' + esc(id) + '">' +
      '<div class="qr__paper" data-qrbox="' + esc(id) + '"></div>' +
      '<div class="qr__side">' +
      '<p class="qr__addr">' + esc(bookAddress(id)) + "</p>" +
      '<p class="qr__note" data-qrnote="' + esc(id) + '"></p>' +
      '<button class="add" type="button" data-qr="svg" data-book="' + esc(id) + '">Download for printing</button>' +
      '<button class="add" type="button" data-qr="png" data-book="' + esc(id) + '">Download as a picture</button>' +
      "</div></div>";
  }

  function roomChooser(row) {
    return '<div class="fld"><span class="lab">Which room does it live in?</span>' +
      '<div class="rooms" data-k="phase" data-scope="' + row._scope + '">' +
      ROOMS.map(function (r) {
        return '<button type="button" class="room' + (r.k === row.phase ? " on" : "") + '" data-v="' + r.k + '">' +
          "<strong>" + r.name + "</strong><span>" + r.says + "</span></button>";
      }).join("") + "</div></div>";
  }

  function cardHTML(listId, row) {
    var spec = LISTS[listId];
    var scope = spec.table + ":" + row.id;
    row._scope = scope;
    var media = spec.media ? row[spec.media] : "";
    var thumb = spec.media && spec.accept === "image/*"
      ? (media ? '<img src="' + esc(media) + '" alt="" />' : '<span>No photo</span>')
      : "";
    return '<article class="card" data-scope="' + scope + '" data-list="' + listId + '">' +
      '<button class="card__top" type="button">' +
      (thumb ? '<span class="card__thumb">' + thumb + "</span>" : "") +
      '<span class="card__name">' + esc(row.title || row.name || "Untitled") + "</span>" +
      (row.published ? "" : '<span class="card__hid">only you</span>') +
      '<span class="card__chev">›</span></button>' +
      '<div class="card__body" hidden>' +
      spec.fields.map(function (f) { return fieldHTML(f, row[f.k], scope); }).join("") +
      (spec.room ? roomChooser(row) : "") +
      (spec.groups ? sectionChooser(row, listId) : "") +
      '<div class="card__foot">' +
      '<label class="onoff"><input type="checkbox" data-k="published" data-scope="' + scope + '"' +
        (row.published ? " checked" : "") + ' /><span>' +
        (row.published ? "On the site" : "Only you can see it") + "</span></label>" +
      '<div class="card__move"><button class="mini" type="button" data-move="up">Move up</button>' +
      '<button class="mini" type="button" data-move="down">Move down</button></div>' +
      "</div>" +
      '<div class="card__danger"><button class="mini mini--red" type="button" data-remove="1">Remove this ' +
        esc(spec.one) + "</button></div>" +
      "</div></article>";
  }

  function listHTML(listId, title) {
    var spec = LISTS[listId];
    var rows = rowsFor(listId);
    var hidden = rows.filter(function (r) { return !r.published; }).length;
    return '<section class="block" data-list="' + listId + '">' +
      '<h3 class="block__name">' + esc(title) +
        ' <em>' + (rows.length - hidden) + " on the site" + (hidden ? " · " + hidden + " only you" : "") + "</em></h3>" +
      (rows.length ? rows.map(function (r) { return cardHTML(listId, r); }).join("")
                   : '<p class="none">Nothing here yet.</p>') +
      '<button class="add" type="button" data-add="' + listId + '">' + esc(spec.add) + "</button>" +
      (spec.drop ? '<div class="drop" data-drop="' + listId + '">' + esc(spec.drop) + "</div>" : "") +
      "</section>";
  }

  function roomsHTML(listId) {
    var spec = LISTS[listId];
    return ROOMS.map(function (room) {
      var rows = rowsFor(listId).filter(function (r) { return r.phase === room.k; });
      var hidden = rows.filter(function (r) { return !r.published; }).length;
      return '<section class="block" data-list="' + listId + '" data-room="' + room.k + '">' +
        '<h3 class="block__name">' + room.name +
          ' <em>' + (rows.length - hidden) + " on the site" + (hidden ? " · " + hidden + " only you" : "") + "</em></h3>" +
        fieldHTML({ k: "phase_" + room.k + "_theme", label: "The words under " + room.name,
                    hint: "This line also shows on the other page." },
                  data.settings["phase_" + room.k + "_theme"], "setting") +
        (rows.length ? rows.map(function (r) { return cardHTML(listId, r); }).join("")
                     : '<p class="none">Nothing in this room yet.</p>') +
        '<button class="add" type="button" data-add="' + listId + '" data-room="' + room.k + '">' +
          esc(spec.add) + "</button>" +
        (spec.drop ? '<div class="drop" data-drop="' + listId + '" data-room="' + room.k + '">' +
          esc(spec.drop) + "</div>" : "") +
        "</section>";
    }).join("");
  }

  function hiddenHTML() {
    var out = "", any = 0;
    Object.keys(POOL).forEach(function (table) {
      var pool = POOL[table];
      data[pool].filter(function (r) { return !r.published; }).forEach(function (r) {
        any++;
        out += '<article class="card card--flat" data-scope="' + table + ":" + r.id + '">' +
          '<span class="card__name">' + esc(r.title || r.name || "Untitled") + "</span>" +
          '<button class="mini" type="button" data-publish="' + table + ":" + r.id + '">Put it on the site</button>' +
          "</article>";
      });
    });
    var trash = [];
    try { trash = JSON.parse(data.settings.desk_trash || "[]"); } catch (e) {}
    var back = trash.map(function (t, i) {
      return '<article class="card card--flat">' +
        '<span class="card__name">' + esc(t.row.title || t.row.name || "Untitled") + "</span>" +
        '<button class="mini" type="button" data-restore="' + i + '">Put it back</button></article>';
    }).join("");
    return '<section class="block"><h3 class="block__name">Not on the site yet</h3>' +
      (any ? out : '<p class="none">Everything you have made is on the site.</p>') + "</section>" +
      '<section class="block"><h3 class="block__name">Removed</h3>' +
      (back || '<p class="none">Nothing removed.</p>') + "</section>";
  }

  /* ---------- the code that goes inside each printed book ---------- */
  /* Made here, in her browser, from the address she types. Nothing is sent
     anywhere to draw it, which matters for a picture that gets printed into
     a book and has to keep working long after any free QR site has gone.
     Every book gets its own code, and a code carries the book's fixed id, so
     retitling a book never orphans a copy already printed. */
  function qrBase() {
    var saved = String(data.settings.gift_qr_url || "").trim();
    if (saved) return saved;
    try { return new URL("gift.html", location.href).href; } catch (e) { return "gift.html"; }
  }
  function bookAddress(id) {
    var base = qrBase();
    if (!id) return base;
    try {
      var u = new URL(base, location.href);
      u.searchParams.set("b", id);
      return u.href;
    } catch (e) {
      return base + (base.indexOf("?") < 0 ? "?" : "&") + "b=" + encodeURIComponent(id);
    }
  }
  function fileName(title) {
    var slug = String(title || "book").toLowerCase()
      .replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 40);
    return "cherry-dn-qr-" + (slug || "book");
  }

  function qrHTML() {
    return '<section class="block">' +
      '<h3 class="block__name">Where the codes point</h3>' +
      '<p class="qr__lead">Every book below gets its own square to print inside the cover. ' +
      'They all start from this address, and each one adds its own book to the end.</p>' +
      '<label class="fld"><span class="lab">Your gift page</span>' +
      '<input id="qrurl" type="text" spellcheck="false" data-k="gift_qr_url" data-scope="setting" value="' +
        esc(qrBase()) + '" />' +
      '<em class="hint">Once a code is printed it cannot be changed, so use the address you mean to keep. ' +
      'Changing this changes every code that has not been printed yet.</em>' +
      "</label></section>";
  }

  /* draw every code on the shelf, each from its own book */
  function drawQR() {
    if (!window.CherryQR) return;
    $$("[data-qrbox]").forEach(function (box) {
      var id = box.dataset.qrbox;
      var note = $('[data-qrnote="' + id + '"]');
      try {
        var code = window.CherryQR.encode(bookAddress(id), { ecc: "H" });
        box.innerHTML = window.CherryQR.toSVG(code, { quiet: 4 });
        if (note) {
          note.className = "qr__note";
          note.textContent = code.size + " squares across, at the strongest error correction. " +
            "Print it about 3 cm wide, never under 2 cm.";
        }
      } catch (e) {
        box.innerHTML = "";
        if (note) { note.className = "qr__note qr__note--bad"; note.textContent = e.message; }
      }
    });
  }

  function keep(blob, name) {
    var u = URL.createObjectURL(blob), a = document.createElement("a");
    a.href = u; a.download = name;
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(function () { URL.revokeObjectURL(u); }, 8000);
    say("Saved to your downloads");
  }

  function downloadQR(kind, id) {
    var book = booksList().filter(function (b) { return b.id === id; })[0];
    var code;
    try { code = window.CherryQR.encode(bookAddress(id), { ecc: "H" }); }
    catch (e) { say(e.message, "bad"); return; }
    var name = fileName(book && book.title);
    if (kind === "svg") {
      keep(new Blob([window.CherryQR.toSVG(code, { quiet: 4 })], { type: "image/svg+xml" }),
           name + ".svg");
      return;
    }
    /* big enough that a printer never has to guess at an edge */
    var span = code.size + 8;
    var cv = window.CherryQR.toCanvas(code, { quiet: 4, scale: Math.max(8, Math.round(2400 / span)) });
    if (cv.toBlob) cv.toBlob(function (b) { keep(b, name + ".png"); }, "image/png");
    else say("This browser cannot save the picture. Use the printing file instead.", "bad");
  }

  /* ---------- the light in the rooms ---------- */
  /* Seven sliders, her words on all of them, and not one number shown.
     The solver turns them into the whole palette; she never meets a hex
     code, a ratio or the word contrast. Every position on every slider is
     safe, so there is nothing here to warn her about and no way to be
     wrong. Her changes wait in the draft with everything else. */
  var AXES = [
    { grp: "THE WATER", note: "the dark you are inside", k: "d",
      label: "How deep you are", lo: "shallow, almost morning", hi: "far down, almost nothing" },
    { k: "hg", label: "What the water is made of", wrap: true,
      lo: "take it all the way round and come back", hi: "" },
    { grp: "THE FIRE", note: "the one colour that is not the dark", k: "t",
      label: "How hot it burns", lo: "ash", hi: "a wound" },
    { k: "f", label: "What it burns", lo: "oxblood", hi: "brass" },
    { grp: "THE LIGHT", note: "your words, and everything they touch", k: "w",
      label: "How warm the light is", lo: "moonlight on water", hi: "candle on paper",
      under: "Your words stay exactly as bright. This only changes their colour of light." },
    { grp: "THE AIR", note: "how much room the light has to travel", k: "a",
      label: "How much mist", lo: "the glass is clean", hi: "you are looking through weather" },
    { k: "gr", label: "How much dust in the light", lo: "nothing", hi: "an old print" }
  ];

  var MOODS = {
    submerged: { d: 0.530, hg: 203.1, t: 0.835, f: 0.470, w: 0.557, a: 0.550, gr: 0.310 },
    ember:     { d: 0.400, hg: 28,    t: 1.000, f: 0.620, w: 0.850, a: 0.620, gr: 0.450 },
    ash:       { d: 0.660, hg: 210,   t: 0.250, f: 0.400, w: 0.350, a: 0.400, gr: 0.550 },
    tidepool:  { d: 0.620, hg: 168,   t: 0.550, f: 0.300, w: 0.300, a: 0.700, gr: 0.200 },
    nocturne:  { d: 0.880, hg: 276,   t: 0.700, f: 0.150, w: 0.400, a: 0.450, gr: 0.350 },
    salt:      { d: 0.300, hg: 195,   t: 0.450, f: 0.520, w: 0.200, a: 0.300, gr: 0.150 }
  };

  function seedsNow() {
    var s = {};
    try { s = JSON.parse(data.settings.mood_seeds || "null") || {}; } catch (e) { s = {}; }
    var out = {};
    Object.keys(window.CherrySolve.DEFAULTS).forEach(function (k) {
      out[k] = typeof s[k] === "number" ? s[k] : window.CherrySolve.DEFAULTS[k];
    });
    return out;
  }

  function moodHTML() {
    var s = seedsNow();
    var html = '<section class="block"><h3 class="block__name">Six moods to start from</h3>' +
      '<div class="moods">' + Object.keys(MOODS).map(function (n) {
        var v = window.CherrySolve.generate(MOODS[n]);
        return '<button class="mood" type="button" data-mood="' + n + '" ' +
          'style="background:' + v["--bg"] + ';border-color:' + v["--line"] + '">' +
          '<span class="mood__fire" style="background:' + v["--red-t"] + '"></span>' +
          '<span class="mood__ink" style="color:' + v["--ink"] + '">' + n + "</span></button>";
      }).join("") + "</div>" +
      '<p class="qr__lead">Tap one and every slider moves there. Then take it anywhere you like.</p></section>';

    html += '<section class="block">';
    AXES.forEach(function (ax) {
      if (ax.grp) html += '<h3 class="block__name axis__grp">' + ax.grp +
        ' <em>' + esc(ax.note) + "</em></h3>";
      var max = ax.wrap ? 360 : 1, step = ax.wrap ? 1 : 0.005;
      html += '<div class="axis"><span class="lab">' + esc(ax.label) + "</span>" +
        '<input class="axis__slide" type="range" data-axis="' + ax.k + '" min="0" max="' + max +
          '" step="' + step + '" value="' + s[ax.k] + '" aria-label="' + esc(ax.label) + '" />' +
        '<span class="axis__ends"><i>' + esc(ax.lo) + "</i><i>" + esc(ax.hi || "") + "</i></span>" +
        (ax.under ? '<em class="hint">' + esc(ax.under) + "</em>" : "") +
        "</div>";
    });
    html += "</section>";

    html += '<section class="block"><h3 class="block__name">If you change your mind</h3>' +
      '<button class="add" type="button" id="moodReset">Put it back the way it came</button>' +
      '<p class="qr__lead">This returns every slider to the colours the site was made with.</p>' +
      "</section>";
    return html;
  }

  /* solve, show it beside her, and let it wait in the draft like everything else */
  var moodTimer;
  function moodChanged(live) {
    var s = {};
    $$("[data-axis]").forEach(function (i) { s[i.dataset.axis] = parseFloat(i.value); });
    var vars = window.CherrySolve.generate(s);
    delete vars.__meta;
    tell({ type: "mood", vars: vars });          /* instant, every frame she drags */
    if (!live) return;
    clearTimeout(moodTimer);
    moodTimer = setTimeout(function () {
      saveSetting("mood_seeds", JSON.stringify(s));
      saveSetting("mood", JSON.stringify(vars));
    }, 260);
  }

  /* ---------- the colour out of one of her own paintings ---------- */
  /* She clicks a place in a picture she made. Only the HUE of that pixel is
     kept: its lightness and its colourfulness are thrown away before the
     number ever reaches the solver, which is why this can be completely
     free and still completely safe. A muddy pixel and a screaming one give
     the same result, and neither can darken her words. */
  function herPictures() {
    var seen = {}, out = [];
    function add(src, name) {
      src = String(src || "").trim();
      if (!src || seen[src]) return;
      seen[src] = 1; out.push({ src: src, name: name || "" });
    }
    add(data.settings.landing_hero_image, "the picture behind your name");
    (data.works || []).forEach(function (w) { add(w.image_url, w.title); });
    (data.portals || []).forEach(function (p2) { add(p2.image_url, p2.name); });
    return out;
  }

  function dropperHTML() {
    var pics = herPictures();
    if (!pics.length) return "";
    return '<section class="block"><h3 class="block__name">Take the colour from one of your pictures</h3>' +
      '<p class="qr__lead">The whole site gets built out of one colour you choose. ' +
      'Only the colour itself is taken, never how bright or how strong it is, so anything you pick is safe.</p>' +
      '<div class="pics">' + pics.slice(0, 24).map(function (p2, i) {
        return '<button class="pic" type="button" data-pic="' + i + '" ' +
          'style="background-image:url(' + esc(p2.src).replace(/"/g, "&quot;") + ')" ' +
          'title="' + esc(p2.name) + '"></button>';
      }).join("") + "</div>" +
      '<div class="dropper" id="dropper" hidden></div></section>';
  }

  var dropperPics = [];
  function openPicture(i) {
    var pic = dropperPics[i];
    if (!pic) return;
    var box = $("#dropper");
    box.hidden = false;
    box.innerHTML = '<p class="qr__lead"><b>Click anywhere in the painting.</b></p>' +
      '<div class="dropper__stage"><canvas id="dropCv"></canvas></div>' +
      '<p class="qr__lead" id="dropStones">The colours this painting is made of…</p>' +
      '<div id="dropPick"></div>';
    var img = new Image();
    img.onload = function () {
      var cv = $("#dropCv"), w = Math.min(560, img.naturalWidth);
      var h = Math.round(img.naturalHeight * (w / img.naturalWidth));
      cv.width = w; cv.height = h;
      cv.getContext("2d").drawImage(img, 0, 0, w, h);
      stonesFrom(cv);
    };
    img.onerror = function () { box.innerHTML = '<p class="none">That picture would not open.</p>'; };
    img.src = pic.src;
    box.scrollIntoView({ block: "nearest", behavior: "smooth" });
  }

  /* the handful of colours the picture is actually made of, so she does not
     have to hunt for a pixel */
  function stonesFrom(cv) {
    var g = cv.getContext("2d");
    var d2, bins = {};
    try { d2 = g.getImageData(0, 0, cv.width, cv.height).data; } catch (e) { return; }
    var step = Math.max(1, Math.floor(cv.width * cv.height / 12000));
    for (var i = 0; i < d2.length; i += 4 * step) {
      if (d2[i + 3] < 200) continue;
      var o = window.CherrySolve.rgbToOklch(d2[i], d2[i + 1], d2[i + 2]);
      if (o.C < 0.035) continue;
      var b = Math.round(o.H / 12) * 12 % 360;
      bins[b] = (bins[b] || 0) + o.C;
    }
    var top = Object.keys(bins).sort(function (a, b2) { return bins[b2] - bins[a]; }).slice(0, 5);
    if (!top.length) return;
    $("#dropStones").innerHTML = "The colours this painting is made of: " +
      top.map(function (h) {
        var c = window.CherrySolve.hex(window.CherrySolve.at(0.62, 0.11, +h));
        return '<button class="stone" type="button" data-hue="' + h + '" style="background:' + c + '"></button>';
      }).join("");
  }

  function tookHue(H, swatch) {
    say("Got it. Now say where it goes.");
    var fire = window.CherrySolve.hueToFire(H);
    var burn = window.CherrySolve.hex(window.CherrySolve.at(0.62, 0.12, H));
    $("#dropPick").innerHTML =
      '<div class="took"><span class="took__chip" style="background:' + (swatch || burn) + '"></span>' +
      '<p class="qr__lead">Where should this colour go?</p></div>' +
      '<div class="took__ways">' +
      '<button class="add" type="button" data-take="burn" data-hue="' + H + '">Let it burn' +
        '<em>' + (fire.exact ? "this colour becomes the fire" :
                  "some colours can only burn: this is the nearest one that can") + "</em></button>" +
      '<button class="add" type="button" data-take="drown" data-hue="' + H + '">Let it drown' +
        "<em>this colour becomes the water</em></button></div>";
  }

  /* ---------- seeing it the way a visitor will ---------- */
  /* The frame is given the real width and height of a screen, so her page
     lays itself out exactly as it would there, and then the whole thing is
     scaled down to fit whatever room the desk has. She is looking at a true
     phone layout, not a squeezed one. The frame is never reloaded, only
     resized, so she keeps her place on the page. */
  var SIZES = {
    "390":  { w: 390,  h: 844,  say: "Phone" },
    "820":  { w: 820,  h: 1180, say: "Tablet" },
    "1280": { w: 1280, h: 800,  say: "Laptop" },
    "1680": { w: 1680, h: 1050, say: "Big screen" }
  };
  var sizeNow = "fill";

  function fitFrame() {
    var pane = $("#pane"), f = $("#frame"), tag = $("#sizesNow");
    if (!pane || !f) return;
    if (sizeNow === "fill" || !SIZES[sizeNow]) {
      pane.classList.remove("is-sized");
      f.style.width = "100%"; f.style.height = "100%";
      f.style.transform = ""; f.style.marginBottom = "";
      if (tag) tag.textContent = Math.round(pane.clientWidth) + " across";
      return;
    }
    var s2 = SIZES[sizeNow];
    pane.classList.add("is-sized");
    f.style.width = s2.w + "px";
    f.style.height = s2.h + "px";
    /* leave a little air, and never blow a small screen up bigger than life */
    var k = Math.min((pane.clientWidth - 24) / s2.w, (pane.clientHeight - 24) / s2.h, 1);
    k = Math.max(k, 0.2);
    f.style.transform = "scale(" + k.toFixed(4) + ")";
    /* a scaled element still reserves its unscaled height, so give the
       scrolling pane back the difference or it scrolls into empty space */
    f.style.marginBottom = Math.round(-s2.h * (1 - k)) + "px";
    if (tag) tag.textContent = s2.w + " × " + s2.h + (k < 0.999 ? "  ·  shown at " + Math.round(k * 100) + "%" : "");
  }

  function setSize(key) {
    sizeNow = key;
    try { localStorage.setItem("cherry.size", key); } catch (e) {}
    $$("#sizes button").forEach(function (b) { b.classList.toggle("on", b.dataset.size === key); });
    fitFrame();
  }

  /* ---------- painting the shelf ---------- */
  function paint(keepOpen) {
    var open = keepOpen || $$(".card__body:not([hidden])").map(function (b) {
      return b.parentNode.dataset.scope;
    });
    var sec = SCHEMA.filter(function (s) { return s.id === here; })[0] || SCHEMA[0];
    $$("#pages button").forEach(function (b) { b.classList.toggle("on", b.dataset.page === sec.id); });

    var html = '<header class="shelf__head"><h2>' + esc(sec.name) + "</h2>" +
      '<p>' + esc(sec.blurb) + "</p></header>";

    if (sec.special === "hidden") html += hiddenHTML();
    else {
      if (sec.fields) html += '<section class="block">' +
        sec.fields.map(function (f) { return fieldHTML(f, data.settings[f.k], "setting"); }).join("") + "</section>";
      if (sec.tool === "qr") html += qrHTML();
      if (sec.tool === "mood") html += moodHTML() + dropperHTML();
      if (sec.rooms) html += roomsHTML(sec.rooms);
      if (sec.groups) html += groupsHTML(sec.groups);
      (sec.lists || []).forEach(function (l) { html += listHTML(l.id, l.title); });
    }
    $("#shelf").innerHTML = html;
    if (sec.tool === "qr") drawQR();
    if (sec.tool === "mood") { dropperPics = herPictures(); moodChanged(false); }
    open.forEach(function (scope) {
      var card = $('.card[data-scope="' + scope + '"]');
      if (card) { $(".card__body", card).hidden = false; card.classList.add("open"); }
    });
  }

  /* push everything she has locally into the frame, without reloading it */
  function repaintFrame() {
    Object.keys(data.settings).forEach(function (k) {
      if (k !== "desk_trash") tell({ type: "set", key: k, value: data.settings[k] });
    });
  }

  /* one file into one slot she is already looking at */
  function takeFile(media, f) {
    if (f.size > MAX_FILE) { say(humanise(new Error("too large")), "bad"); return; }
    say("Sending " + f.name + "… 0%");
    Promise.all([
      upload(f, function (frac) { say("Sending " + f.name + "… " + Math.round(frac * 100) + "%"); }),
      audioLength(f), posterFrom(f)
    ]).then(function (got) {
      var url = got[0], shot = got[2];
      if (media.dataset.scope === "setting") {
        saveSetting(media.dataset.k, url);
        tell({ type: "set", key: media.dataset.k, value: url, reveal: true });
        paint(); return;
      }
      var p = media.dataset.scope.split(":");
      var patch = keyed(media.dataset.k, url);
      if (got[1]) patch.length = got[1];

      var land = function () {
        saveRow(p[0], p[1], patch);
        Object.keys(patch).forEach(function (k) {
          tell({ type: "setRow", scope: media.dataset.scope, key: k, value: patch[k] });
        });
        paint();
      };
      var row = findRow(p[0], p[1]);
      if (shot && row && !row.poster_url) {
        return put(shot, f.name.replace(/\.[a-z0-9]+$/i, "") + "-frame.jpg")
          .then(function (u) { patch.poster_url = u; })
          .catch(function () {})
          .then(land);
      }
      land();
    }).catch(function (err) { say(humanise(err), "bad"); });
  }

  /* ---------- events ---------- */
  document.addEventListener("click", function (e) {
    var page = e.target.closest("#pages button");
    if (page) {
      here = page.dataset.page;
      try { localStorage.setItem(LAST, here); } catch (err) {}
      var sec = SCHEMA.filter(function (s) { return s.id === here; })[0];
      paint();
      $("#shelf").scrollTop = 0;
      if (sec) openPage(sec.page);
      document.body.classList.remove("show-pages");
      return;
    }
    if (e.target.closest("#pagesBtn")) { document.body.classList.toggle("show-pages"); return; }
    if (!e.target.closest("#pages")) document.body.classList.remove("show-pages");
    if (e.target.closest("#seeBtn")) { document.body.classList.toggle("show-frame"); return; }

    var top = e.target.closest(".card__top");
    if (top) {
      var card = top.parentNode, body = $(".card__body", card);
      body.hidden = !body.hidden;
      card.classList.toggle("open", !body.hidden);
      if (!body.hidden) tellRow(card.dataset.scope);
      return;
    }

    var pill = e.target.closest(".pill, .room");
    if (pill) {
      var wrap = pill.parentNode;
      $$(".pill, .room", wrap).forEach(function (p) { p.classList.remove("on"); });
      pill.classList.add("on");
      var parts = wrap.dataset.scope.split(":");
      saveRow(parts[0], parts[1], keyed(wrap.dataset.k, pill.dataset.v));
      if (wrap.dataset.k === "phase" || wrap.dataset.k === "section") {
        setTimeout(function () { paint(); }, 600);
        repaintRows();
      }
      return;
    }

    var media = e.target.closest(".mediabox");
    if (media) {
      var picker = $("#picker");
      picker.accept = media.dataset.accept || "";
      picker.onchange = function () {
        var f = picker.files[0]; picker.value = "";
        if (f) takeFile(media, f);
      };
      picker.click();
      return;
    }

    var mv = e.target.closest("[data-move]");
    if (mv) { move(mv.closest(".card"), mv.dataset.move); return; }

    var rm = e.target.closest("[data-remove]");
    if (rm) {
      var c = rm.closest(".card");
      if (rm.dataset.confirm) {
        var p2 = c.dataset.scope.split(":");
        remove(p2[0], p2[1]);
      } else {
        rm.dataset.confirm = "1";
        rm.textContent = "Really remove it?";
        setTimeout(function () { delete rm.dataset.confirm; rm.textContent = "Remove this"; }, 4000);
      }
      return;
    }

    var pub = e.target.closest("[data-publish]");
    if (pub) {
      var pp = pub.dataset.publish.split(":");
      saveRow(pp[0], pp[1], { published: true });
      setTimeout(function () { paint(); repaintRows(); }, 600);
      return;
    }

    var res = e.target.closest("[data-restore]");
    if (res) {
      var trash = [];
      try { trash = JSON.parse(data.settings.desk_trash || "[]"); } catch (err) {}
      var item = trash[+res.dataset.restore];
      if (item) putBack(item.table, item.row);
      return;
    }

    var sz = e.target.closest("[data-size]");
    if (sz) { setSize(sz.dataset.size); return; }

    var pk = e.target.closest("[data-pic]");
    if (pk) { openPicture(+pk.dataset.pic); return; }

    var stone = e.target.closest("[data-hue]");
    if (stone && !stone.dataset.take) {
      tookHue(+stone.dataset.hue, stone.style.background);
      return;
    }
    var take = e.target.closest("[data-take]");
    if (take) {
      var H = +take.dataset.hue;
      var sl;
      if (take.dataset.take === "drown") {
        sl = $('[data-axis="hg"]');
        sl.value = H;
        say("The water is that colour now.");
      } else {
        var fire = window.CherrySolve.hueToFire(H);
        sl = $('[data-axis="f"]');
        sl.value = fire.f;
        say(fire.exact ? "The fire is that colour now."
                       : "Only the reds can burn, so it took the nearest one.");
      }
      moodChanged(true);
      return;
    }

    var md = e.target.closest("[data-mood]");
    if (md) {
      var pick = MOODS[md.dataset.mood];
      $$("[data-axis]").forEach(function (i) { i.value = pick[i.dataset.axis]; });
      moodChanged(true);
      say("Moved to " + md.dataset.mood + ". Every slider is still yours.");
      return;
    }
    if (e.target.closest("#moodReset")) {
      $$("[data-axis]").forEach(function (i) { i.value = window.CherrySolve.DEFAULTS[i.dataset.axis]; });
      moodChanged(true);
      say("Back to the colours the site was made with.");
      return;
    }
    if (e.target.closest("#liveBtn") || e.target.closest("#liveBtn2")) { goLive(); return; }
    if (e.target.closest("#discardBtn")) {
      var db = e.target.closest("#discardBtn");
      if (db.dataset.confirm) { discardDraft(); return; }
      db.dataset.confirm = "1";
      db.textContent = "Really? Everything waiting is lost";
      setTimeout(function () { delete db.dataset.confirm; db.textContent = "Undo everything"; }, 4000);
      return;
    }
    if (e.target.closest("#pendingBtn")) {
      var pane = $("#pending");
      pane.hidden = !pane.hidden;
      if (!pane.hidden) paintPending();
      return;
    }
    var un = e.target.closest("[data-undo]");
    if (un) { undoOne(un.dataset.undo, un.dataset.ref); return; }

    var qrb = e.target.closest("[data-qr]");
    if (qrb) { downloadQR(qrb.dataset.qr, qrb.dataset.book || ""); return; }

    /* making a group is just naming it */
    var gnew = e.target.closest("#gnewBtn");
    if (gnew) {
      var glist = gnew.dataset.list;
      var box = gnew.parentNode.querySelector(".gnewbox"), name = box.value.trim();
      if (LISTS[glist] && LISTS[glist].books) {
        if (!name) { box.focus(); say("Give the book its name first."); return; }
        var books = booksList();
        if (books.some(function (b) { return b.title === name; })) {
          say("You already have a book called that."); return;
        }
        books.push({ id: newBookId(books), title: name });
        saveBooks(books);
        paint();
        say("Added. Its code is ready to print whenever you are.");
        return;
      }
      if (!name) { box.focus(); say("Give the group a name first."); return; }
      var all = groupNames(glist);
      if (all.indexOf(name) >= 0) { say("You already have a group called that."); return; }
      all.push(name);
      saveGroups(glist, all);
      paint();
      say("Made. Put your recordings into it whenever you like.");
      return;
    }

    var gm = e.target.closest("[data-gmove]");
    if (gm) {
      var gblock = gm.closest("[data-groupblock]");
      var here2 = gblock.dataset.groupblock, gl = gblock.dataset.glist;
      if (LISTS[gl] && LISTS[gl].books) {
        var bl = booksList(), bat = -1;
        bl.forEach(function (b, i) { if (b.id === here2) bat = i; });
        var bto = gm.dataset.gmove === "up" ? bat - 1 : bat + 1;
        if (bat < 0 || bto < 0 || bto >= bl.length) return;
        bl.splice(bto, 0, bl.splice(bat, 1)[0]);
        saveBooks(bl);
        paint(); repaintRows(); say("Moved");
        return;
      }
      var list = groupNames(gl), at = list.indexOf(here2);
      var to = gm.dataset.gmove === "up" ? at - 1 : at + 1;
      if (at < 0 || to < 0 || to >= list.length) return;
      list.splice(to, 0, list.splice(at, 1)[0]);
      saveGroups(gl, list);
      paint(); repaintRows(); say("Moved");
      return;
    }

    var gd = e.target.closest("[data-gdrop]");
    if (gd) {
      var gdb = gd.closest("[data-groupblock]");
      var gone = gdb.dataset.groupblock, gdl = gdb.dataset.glist;
      var isBook = !!(LISTS[gdl] && LISTS[gdl].books);
      if (gd.dataset.confirm) {
        if (isBook) {
          saveBooks(booksList().filter(function (b) { return b.id !== gone; }));
          paint(); repaintRows();
          say("The book is gone. Its chapters were kept, but any code already printed for it now opens nothing.");
        } else {
          /* only the heading goes: the recordings fall out of it, whole */
          saveGroups(gdl, groupNames(gdl).filter(function (n) { return n !== gone; }));
          paint(); repaintRows();
          say("The group is gone. Nothing inside it was removed.");
        }
      } else {
        gd.dataset.confirm = "1";
        gd.textContent = isBook ? "Really? Printed codes will stop working" : "Really remove the group?";
        setTimeout(function () {
          delete gd.dataset.confirm;
          gd.textContent = isBook ? "Remove the book" : "Remove the group";
        }, 4000);
      }
      return;
    }

    var add = e.target.closest("[data-add]");
    if (add) {
      var lid = add.dataset.add, spec = LISTS[lid];
      var into = add.dataset.group != null ? { section: add.dataset.group } : null;
      if (spec.accept && spec.media) {
        var fp = $("#picker");
        fp.accept = spec.accept;
        fp.onchange = function () { addFiles(lid, add.dataset.room, fp.files, into); fp.value = ""; };
        fp.click();
      } else {
        addRow(lid, add.dataset.room, into).catch(function (err) { say(humanise(err), "bad"); });
      }
      return;
    }

    var undo = e.target.closest(".undo");
    if (undo && $("#status")._undo) { $("#status")._undo(); return; }

    if (e.target.closest("#signout")) {
      forget(); location.reload();
    }
  });

  function keyed(k, v) { var o = {}; o[k] = v; return o; }

  function move(card, dir) {
    var block = card.closest(".block");
    var cards = $$(".card", block);
    var i = cards.indexOf(card);
    var j = dir === "up" ? i - 1 : i + 1;
    if (j < 0 || j >= cards.length) return;
    block.insertBefore(dir === "up" ? card : cards[j], dir === "up" ? cards[j] : card);
    $$(".card", block).forEach(function (c, n) {
      var p = c.dataset.scope.split(":");
      saveRow(p[0], p[1], { sort: n }, true);
    });
    say("Moved");
    setTimeout(repaintRows, 700);
  }

  /* rows need the page reloaded to re-render; do it quietly and rarely */
  var rowT;
  function repaintRows() {
    clearTimeout(rowT);
    rowT = setTimeout(function () {
      if (frame && frame.contentWindow) frame.contentWindow.location.reload();
    }, 900);
  }

  /* a place in the painting: average a small patch so one stray pixel of
     compression never decides the colour of her site */
  document.addEventListener("click", function (e) {
    var cv = e.target.closest && e.target.closest("#dropCv");
    if (!cv) return;
    var r = cv.getBoundingClientRect();
    var x = Math.round((e.clientX - r.left) * cv.width / r.width);
    var y = Math.round((e.clientY - r.top) * cv.height / r.height);
    var g = cv.getContext("2d"), lr = 0, lg = 0, lb = 0, n = 0;
    function un(c) { c /= 255; return c <= 0.04045 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4); }
    function re(c) { c = c <= 0.0031308 ? 12.92 * c : 1.055 * Math.pow(c, 1 / 2.4) - 0.055; return Math.round(c * 255); }
    try {
      var d3 = g.getImageData(Math.max(0, x - 2), Math.max(0, y - 2), 5, 5).data;
      for (var i = 0; i < d3.length; i += 4) {
        if (d3[i + 3] < 200) continue;
        lr += un(d3[i]); lg += un(d3[i + 1]); lb += un(d3[i + 2]); n++;
      }
    } catch (err) { say("That picture will not let me read its colours.", "bad"); return; }
    if (!n) return;
    var rgb = [re(lr / n), re(lg / n), re(lb / n)];
    var o = window.CherrySolve.rgbToOklch(rgb[0], rgb[1], rgb[2]);
    if (o.C < 0.035) {
      say("That spot is almost colourless. The site needs a colour with some blood in it.", "bad");
      return;
    }
    tookHue(o.H, window.CherrySolve.hex(rgb));
  });

  document.addEventListener("input", function (e) {
    var i = e.target;
    if (i && i.dataset && i.dataset.axis) { moodChanged(true); return; }
    if (i && i.id === "qrurl") drawQR();
    if (!i.dataset || !i.dataset.k || !i.dataset.scope) return;
    var raw = i.value;
    if (i.dataset.scope === "setting") {
      var value = (i.tagName === "TEXTAREA" || i.dataset.enter) ? toSite(raw) : raw;
      saveSetting(i.dataset.k, value);
      tell({ type: "set", key: i.dataset.k, value: value });
    } else {
      var p = i.dataset.scope.split(":");
      var v2 = i.tagName === "TEXTAREA" ? toSite(raw) : raw;
      saveRow(p[0], p[1], keyed(i.dataset.k, v2));
      var card = i.closest(".card");
      if (card && (i.dataset.k === "title" || i.dataset.k === "name")) {
        $(".card__name", card).textContent = raw || "Untitled";
      }
      /* paint it straight into the page: a reload while she is still
         typing would throw her back to the top of her own poem */
      tell({ type: "setRow", scope: i.dataset.scope, key: i.dataset.k, value: v2 });

      /* a pasted link arrives with its own picture; take it, unless she
         has already chosen one herself */
      if (i.dataset.k === "video_url") {
        var row2 = findRow(p[0], p[1]), face = posterForLink(v2);
        if (face && row2 && !row2.poster_url) {
          saveRow(p[0], p[1], { poster_url: face }, true);
          tell({ type: "setRow", scope: i.dataset.scope, key: "poster_url", value: face });
          setTimeout(function () { paint(); }, 900);
        }
      }
    }
  });

  document.addEventListener("change", function (e) {
    var i = e.target;

    /* renaming a group carries everything inside it along */
    if (i.classList && i.classList.contains("gname")) {
      var rblock = i.closest("[data-groupblock]");
      var was = rblock.dataset.groupblock, rl = rblock.dataset.glist, now = i.value.trim();
      if (LISTS[rl] && LISTS[rl].books) {
        /* the id underneath never moves, so a printed code survives this */
        var bks = booksList(), me = bks.filter(function (b) { return b.id === was; })[0];
        if (!me) return;
        if (!now || now === me.title) { i.value = me.title; return; }
        if (bks.some(function (b) { return b.id !== was && b.title === now; })) {
          i.value = me.title; say("You already have a book called that."); return;
        }
        me.title = now;
        saveBooks(bks);
        say("Renamed. Codes already printed still open it.");
        return;
      }
      if (!now || now === was) { i.value = was; return; }
      var all = groupNames(rl);
      if (all.indexOf(now) >= 0) { i.value = was; say("You already have a group called that."); return; }
      all[all.indexOf(was)] = now;
      saveGroups(rl, all);
      rowsFor(rl).forEach(function (r) {
        if (r.section === was) saveRow("cherry_tracks", r.id, { section: now }, true);
      });
      setTimeout(function () { paint(); }, 800);
      repaintRows();
      say("Renamed");
      return;
    }
    if (i.type === "checkbox" && i.dataset.k === "published") {
      var p = i.dataset.scope.split(":");
      saveRow(p[0], p[1], { published: i.checked });
      var lab = i.parentNode.querySelector("span");
      if (lab) lab.textContent = i.checked ? "On the site" : "Only you can see it";
      repaintRows();
      setTimeout(function () { paint(); }, 700);
    }
    if (i.tagName === "SELECT" && i.dataset.scope && i.dataset.scope !== "setting") {
      var q = i.dataset.scope.split(":");
      saveRow(q[0], q[1], keyed(i.dataset.k, i.value));
      repaintRows();
    }
  });

  /* dropping photos straight into a room */
  ["dragenter", "dragover"].forEach(function (ev) {
    document.addEventListener(ev, function (e) {
      var d = e.target.closest("[data-drop]");
      if (d) { e.preventDefault(); d.classList.add("over"); }
    });
  });
  document.addEventListener("dragleave", function (e) {
    var d = e.target.closest("[data-drop]");
    if (d) d.classList.remove("over");
  });
  document.addEventListener("drop", function (e) {
    var d = e.target.closest("[data-drop]");
    if (!d) return;
    e.preventDefault(); d.classList.remove("over");
    addFiles(d.dataset.drop, d.dataset.room, e.dataTransfer.files);
  });

  /* ---------- hearing the page ---------- */
  function tellRow(scope) { tell({ type: "revealRow", scope: scope }); }

  window.addEventListener("message", function (e) {
    if (e.origin !== location.origin) return;
    if (!e.data || e.data.from !== "cherry-page") return;
    var m = e.data;

    if (m.type === "ready") { repaintFrame(); tell({ type: "marks", on: true }); }

    if (m.type === "pick") {
      var field = $('[data-k="' + m.key + '"][data-scope="setting"]');
      if (!field) {
        /* the words she tapped belong to another part of the shelf: go and
           get them for her, but leave the page in the frame where it is */
        var holder = SCHEMA.filter(function (s) {
          return (s.fields || []).some(function (f) { return f.k === m.key; });
        })[0];
        if (!holder) { say("You cannot change that one from here."); return; }
        here = holder.id;
        try { localStorage.setItem(LAST, here); } catch (err2) {}
        paint();
        $("#shelf").scrollTop = 0;
        field = $('[data-k="' + m.key + '"][data-scope="setting"]');
        if (!field) return;
      }
      field.scrollIntoView({ block: "center", behavior: "smooth" });
      if (field.focus) field.focus();
      field.classList.add("lit");
      setTimeout(function () { field.classList.remove("lit"); }, 1200);
      document.body.classList.remove("show-frame");
    }

    if (m.type === "pickRow") {
      var card = $('.card[data-scope="' + m.scope + '"]');
      if (!card) { say("Open the page that holds it to edit that."); return; }
      $$(".card__body").forEach(function (b) { b.hidden = true; b.parentNode.classList.remove("open"); });
      $(".card__body", card).hidden = false;
      card.classList.add("open");
      card.scrollIntoView({ block: "center", behavior: "smooth" });
      document.body.classList.remove("show-frame");
    }
  });

  /* ---------- boot ---------- */
  if (!session) {
    $("#gate").hidden = false; $("#studio").hidden = true;
    $("#gateForm").addEventListener("submit", signIn);
    return;
  }

  $("#gate").hidden = true;
  $("#studio").hidden = false;
  frame = $("#frame");
  $("#pages").innerHTML = SCHEMA.map(function (s) {
    return '<button type="button" data-page="' + s.id + '">' + esc(s.name) + "</button>";
  }).join("");

  try { here = localStorage.getItem(LAST); } catch (e) {}
  if (!here || !SCHEMA.some(function (s) { return s.id === here; })) here = "home";

  /* the frame carries the looking glass, injected after each load so the
     public pages never ship it */
  function dressFrame() {
    try {
      var doc = frame.contentDocument;
      if (!doc || !doc.body || doc.querySelector("script[data-glass]")) return;
      var s = doc.createElement("script");
      s.src = "js/cherry-preview.js?v=6";
      s.setAttribute("data-glass", "1");
      doc.body.appendChild(s);
    } catch (err) { console.error(err); }
  }
  frame.addEventListener("load", dressFrame);
  dressFrame();   // in case the first page finished before we got here

  try {
    var lastSize = localStorage.getItem("cherry.size");
    if (lastSize && (lastSize === "fill" || SIZES[lastSize])) sizeNow = lastSize;
  } catch (e) {}
  $$("#sizes button").forEach(function (b) { b.classList.toggle("on", b.dataset.size === sizeNow); });
  fitFrame();
  window.addEventListener("resize", fitFrame);

  say("All saved");
  loadAll().then(function () {
    loadDraft();
    applyDraft();
    markWaiting();
    paint();
    var sec = SCHEMA.filter(function (s) { return s.id === here; })[0];
    openPage(sec ? sec.page : "index.html");
  }).catch(function (e) {
    $("#shelf").innerHTML = '<p class="none">' + esc(humanise(e)) + "</p>";
  });
})();
