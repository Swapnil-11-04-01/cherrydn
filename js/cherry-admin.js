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
  function saveSetting(key, value) {
    data.settings[key] = value;
    clearTimeout(timers[key]);
    say("Saving…");
    timers[key] = setTimeout(function () {
      rest("cherry_settings?on_conflict=key", {
        method: "POST", headers: { Prefer: "resolution=merge-duplicates,return=minimal" },
        body: [{ key: key, value: value }]
      }).then(function () { say("Saved just now"); })
        .catch(function (e) { say(humanise(e), "bad"); });
    }, 700);
  }
  function saveRow(table, id, patch, quiet) {
    var row = findRow(table, id);
    if (row) Object.keys(patch).forEach(function (k) { row[k] = patch[k]; });
    var ref = table + id + Object.keys(patch).join();
    clearTimeout(timers[ref]);
    if (!quiet) say("Saving…");
    timers[ref] = setTimeout(function () {
      rest(table + "?id=eq." + id, { method: "PATCH",
        headers: { Prefer: "return=minimal" }, body: patch })
        .then(function () { if (!quiet) say("Saved just now"); })
        .catch(function (e) { say(humanise(e), "bad"); });
    }, 500);
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
    data.settings.desk_trash = blob;

    rest("cherry_settings?on_conflict=key", {
      method: "POST", headers: { Prefer: "resolution=merge-duplicates,return=minimal" },
      body: [{ key: "desk_trash", value: blob }]
    }).then(function () {
      return rest(table + "?id=eq." + id, { method: "DELETE", headers: { Prefer: "return=minimal" } });
    }).then(function () {
      var pool = POOL[table];
      data[pool] = data[pool].filter(function (r) { return String(r.id) !== String(id); });
      paint(); repaintFrame();
      say("Removed", "ok", function () { putBack(table, row); });
    }).catch(function (e) { say(humanise(e), "bad"); });
  }
  function putBack(table, row) {
    var body = {};
    Object.keys(row).forEach(function (k) {
      if (k !== "created_at" && k !== "updated_at") body[k] = row[k];
    });
    rest(table, { method: "POST", headers: { Prefer: "return=representation" }, body: body })
      .then(function () { return loadAll(); })
      .then(function () { paint(); repaintFrame(); say("Put back"); })
      .catch(function (e) { say(humanise(e), "bad"); });
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
    var names = groupNames(listId);
    if (!names.length) return "";
    return '<div class="fld"><span class="lab">Which part of the page?</span>' +
      '<div class="rooms" data-k="section" data-scope="' + row._scope + '">' +
      names.map(function (g) {
        return '<button type="button" class="room' + (g === row.section ? " on" : "") +
          '" data-v="' + esc(g) + '"><strong>' + esc(g) + "</strong></button>";
      }).join("") +
      '<button type="button" class="room' + (names.indexOf(row.section) < 0 ? " on" : "") +
        '" data-v=""><strong>No group</strong></button>' +
      "</div></div>";
  }

  function countLine(rows) {
    var hidden = rows.filter(function (r) { return !r.published; }).length;
    return "<em>" + (rows.length - hidden) + " on the site" +
      (hidden ? " · " + hidden + " only you" : "") + "</em>";
  }

  function groupsHTML(listId) {
    var spec = LISTS[listId], names = groupNames(listId), rows = rowsFor(listId);
    var out = names.map(function (g) {
      var mine = rows.filter(function (r) { return r.section === g; });
      return '<section class="block" data-groupblock="' + esc(g) + '" data-glist="' + listId + '">' +
        '<h3 class="block__name"><input class="gname" type="text" value="' + esc(g) + '" ' +
          'aria-label="The name of this group" /> ' + countLine(mine) +
        '<span class="gmove"><button class="mini" type="button" data-gmove="up">Move up</button>' +
        '<button class="mini" type="button" data-gmove="down">Move down</button>' +
        '<button class="mini mini--red" type="button" data-gdrop="1">Remove the group</button></span></h3>' +
        (mine.length ? mine.map(function (r) { return cardHTML(listId, r); }).join("")
                     : '<p class="none">Nothing in this group yet.</p>') +
        '<button class="add" type="button" data-add="' + listId + '" data-group="' + esc(g) + '">' +
          esc(spec.add) + "</button>" +
        "</section>";
    }).join("");

    var loose = rows.filter(function (r) { return names.indexOf(r.section) < 0; });
    if (loose.length || !names.length) {
      out += '<section class="block">' +
        '<h3 class="block__name">' + (names.length ? "Not in any group" : (spec.loose || "Everything here")) +
          " " + countLine(loose) + "</h3>" +
        (loose.length ? loose.map(function (r) { return cardHTML(listId, r); }).join("")
                      : '<p class="none">Nothing here yet.</p>') +
        '<button class="add" type="button" data-add="' + listId + '" data-group="">' +
          esc(spec.add) + "</button></section>";
    }

    out += '<section class="block"><h3 class="block__name">A new group</h3>' +
      '<div class="gnew"><input class="gnewbox" type="text" placeholder="' + esc(spec.newGroup || "Name it") + '" />' +
      '<button class="add" id="gnewBtn" type="button" data-list="' + listId + '">Make the group</button></div>' +
      "</section>";
    return out;
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

  /* ---------- the code that goes inside the printed book ---------- */
  /* Made here, in her browser, from the address she types. Nothing is sent
     anywhere to draw it, which matters for a picture that gets printed into
     a book and has to keep working long after any free QR site has gone. */
  function qrAddress() {
    var saved = String(data.settings.gift_qr_url || "").trim();
    if (saved) return saved;
    try { return new URL("gift.html", location.href).href; } catch (e) { return "gift.html"; }
  }

  function qrHTML() {
    return '<section class="block">' +
      '<h3 class="block__name">The code for the printed book</h3>' +
      '<p class="qr__lead">This is the picture that goes inside the cover. Anyone who scans it ' +
      'arrives on this page, where the book is read aloud.</p>' +
      '<label class="fld"><span class="lab">Where it should send them</span>' +
      '<input id="qrurl" type="text" spellcheck="false" data-k="gift_qr_url" data-scope="setting" value="' +
        esc(qrAddress()) + '" />' +
      '<em class="hint">Once this is printed it cannot be changed, so use the address you mean to keep.</em>' +
      "</label>" +
      '<div class="qr"><div class="qr__paper" id="qrbox"></div>' +
      '<div class="qr__side"><p class="qr__note" id="qrnote"></p>' +
      '<button class="add" type="button" data-qr="svg">Download for printing</button>' +
      '<button class="add" type="button" data-qr="png">Download as a picture</button>' +
      '<p class="qr__test">Point your phone at the square on the left before you send anything ' +
      'to the printer. If it opens the right page, the code is good.</p>' +
      "</div></div></section>";
  }

  function drawQR() {
    var box = $("#qrbox"), note = $("#qrnote");
    if (!box || !window.CherryQR) return;
    try {
      var code = window.CherryQR.encode(qrAddress(), { ecc: "H" });
      box.innerHTML = window.CherryQR.toSVG(code, { quiet: 4 });
      note.className = "qr__note";
      note.textContent = code.size + " squares across, with the strongest error correction, " +
        "so it still reads when the ink smudges. Print it about 3 cm wide, never under 2 cm.";
    } catch (e) {
      box.innerHTML = "";
      note.className = "qr__note qr__note--bad";
      note.textContent = e.message;
    }
  }

  function keep(blob, name) {
    var u = URL.createObjectURL(blob), a = document.createElement("a");
    a.href = u; a.download = name;
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(function () { URL.revokeObjectURL(u); }, 8000);
    say("Saved to your downloads");
  }

  function downloadQR(kind) {
    var code;
    try { code = window.CherryQR.encode(qrAddress(), { ecc: "H" }); }
    catch (e) { say(e.message, "bad"); return; }
    if (kind === "svg") {
      keep(new Blob([window.CherryQR.toSVG(code, { quiet: 4 })], { type: "image/svg+xml" }),
           "cherry-dn-qr.svg");
      return;
    }
    /* big enough that a printer never has to guess at an edge */
    var span = code.size + 8;
    var cv = window.CherryQR.toCanvas(code, { quiet: 4, scale: Math.max(8, Math.round(2400 / span)) });
    if (cv.toBlob) cv.toBlob(function (b) { keep(b, "cherry-dn-qr.png"); }, "image/png");
    else say("This browser cannot save the picture. Use the printing file instead.", "bad");
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
      if (sec.rooms) html += roomsHTML(sec.rooms);
      if (sec.groups) html += groupsHTML(sec.groups);
      (sec.lists || []).forEach(function (l) { html += listHTML(l.id, l.title); });
    }
    $("#shelf").innerHTML = html;
    if (sec.tool === "qr") drawQR();
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

    var qrb = e.target.closest("[data-qr]");
    if (qrb) { downloadQR(qrb.dataset.qr); return; }

    /* making a group is just naming it */
    var gnew = e.target.closest("#gnewBtn");
    if (gnew) {
      var glist = gnew.dataset.list;
      var box = gnew.parentNode.querySelector(".gnewbox"), name = box.value.trim();
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
      if (gd.dataset.confirm) {
        /* only the heading goes: the recordings fall out of it, whole */
        saveGroups(gdl, groupNames(gdl).filter(function (n) { return n !== gone; }));
        paint(); repaintRows();
        say("The group is gone. Nothing inside it was removed.");
      } else {
        gd.dataset.confirm = "1";
        gd.textContent = "Really remove the group?";
        setTimeout(function () { delete gd.dataset.confirm; gd.textContent = "Remove the group"; }, 4000);
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

  document.addEventListener("input", function (e) {
    var i = e.target;
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
      s.src = "js/cherry-preview.js?v=5";
      s.setAttribute("data-glass", "1");
      doc.body.appendChild(s);
    } catch (err) { console.error(err); }
  }
  frame.addEventListener("load", dressFrame);
  dressFrame();   // in case the first page finished before we got here

  say("All saved");
  loadAll().then(function () {
    paint();
    var sec = SCHEMA.filter(function (s) { return s.id === here; })[0];
    openPage(sec ? sec.page : "index.html");
  }).catch(function (e) {
    $("#shelf").innerHTML = '<p class="none">' + esc(humanise(e)) + "</p>";
  });
})();
