/* ============================================================
   THE ARCHIVE — Cherry's own way in.
   No framework, no build step, and no credential in this file: the
   password is checked by the auth service, and the database itself
   refuses every write that does not carry her signed-in session. There
   is no way to sign up; the only accounts that exist were made for her.
   ============================================================ */
(function () {
  "use strict";
  var C = window.CHERRY, SCHEMA = window.CHERRY_SCHEMA, LISTS = window.CHERRY_LISTS;
  var SESSION = "cherry.session", LAST = "cherry.section";
  var $ = function (s, r) { return (r || document).querySelector(s); };
  var $$ = function (s, r) { return [].slice.call((r || document).querySelectorAll(s)); };

  /* ---------- session ---------- */
  function save(s) { try { localStorage.setItem(SESSION, JSON.stringify(s)); } catch (e) {} }
  function load() { try { return JSON.parse(localStorage.getItem(SESSION) || "null"); } catch (e) { return null; } }
  function forget() { try { localStorage.removeItem(SESSION); } catch (e) {} }

  var session = load();

  function token() { return session ? session.access_token : C.key; }

  /* Sessions last an hour. Rather than throwing her out mid-sentence,
     trade the refresh token for a fresh one and repeat the request. */
  function refresh() {
    if (!session || !session.refresh_token) return Promise.reject(new Error("no session"));
    return fetch(C.url + "/auth/v1/token?grant_type=refresh_token", {
      method: "POST", headers: { apikey: C.key, "Content-Type": "application/json" },
      body: JSON.stringify({ refresh_token: session.refresh_token })
    }).then(function (r) {
      if (!r.ok) throw new Error("refresh failed");
      return r.json();
    }).then(function (s) {
      session = { access_token: s.access_token, refresh_token: s.refresh_token };
      save(session);
      return session;
    });
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
        return refresh()
          .then(function () { return rest(path, opts, true); })
          .catch(function () {
            forget();
            throw new Error("You have been signed out. Sign in again to keep editing.");
          });
      }
      if (r.status === 401 || r.status === 403) throw new Error("You are not signed in.");
      if (!r.ok) return r.text().then(function (t) { throw new Error(t.slice(0, 160) || ("Error " + r.status)); });
      /* a minimal write answers 200 or 204 with an empty body, so read the
         text first and only parse when there is something to parse */
      return r.text().then(function (t) { return t ? JSON.parse(t) : null; });
    });
  }

  /* ---------- the door ---------- */
  function signIn(e) {
    e.preventDefault();
    var email = $("#email").value.trim();
    var password = $("#password").value;
    var msg = $("#gateMsg");
    var btn = $("#gateBtn");
    if (!email || !password) return;
    btn.disabled = true;
    msg.textContent = "Opening…";

    fetch(C.url + "/auth/v1/token?grant_type=password", {
      method: "POST", headers: { apikey: C.key, "Content-Type": "application/json" },
      body: JSON.stringify({ email: email, password: password })
    }).then(function (r) {
      return r.json().then(function (body) { return { ok: r.ok, body: body }; });
    }).then(function (res) {
      if (!res.ok || !res.body.access_token) {
        throw new Error(/invalid/i.test(JSON.stringify(res.body))
          ? "That email and password do not match."
          : "Could not sign in. Try again in a moment.");
      }
      session = { access_token: res.body.access_token, refresh_token: res.body.refresh_token };
      save(session);
      /* a valid account is not the same as permission to edit her archive */
      return fetch(C.url + "/rest/v1/rpc/cherry_is_admin", {
        method: "POST",
        headers: { apikey: C.key, Authorization: "Bearer " + session.access_token,
                   "Content-Type": "application/json" },
        body: "{}"
      }).then(function (r) { return r.ok ? r.json() : false; });
    }).then(function (isAdmin) {
      if (isAdmin !== true) {
        forget(); session = null;
        throw new Error("This account cannot edit the archive.");
      }
      location.reload();
    }).catch(function (err) {
      msg.textContent = err.message;
      btn.disabled = false;
      $("#password").value = "";
    });
  }

  /* ---------- state ---------- */
  var data = { settings: {}, works: [], pieces: [], tracks: [], portals: [] };
  var dirty = {};                 // key -> value, unsaved
  var dirtyRows = {};             // table:id -> {field: value}
  var current = null;

  function countDirty() { return Object.keys(dirty).length + Object.keys(dirtyRows).length; }
  function markDirty() {
    var n = countDirty();
    $("#saveBar").classList.toggle("is-on", n > 0);
    $("#dirtyCount").textContent = n === 1 ? "1 change" : n + " changes";
  }

  var toastT;
  function toast(msg, kind) {
    var t = $("#toast");
    t.textContent = msg;
    t.className = "toast is-up" + (kind ? " toast--" + kind : "");
    clearTimeout(toastT);
    toastT = setTimeout(function () { t.className = "toast"; }, kind === "bad" ? 6000 : 2600);
  }

  function esc(v) {
    return String(v == null ? "" : v).replace(/&/g, "&amp;").replace(/</g, "&lt;")
      .replace(/>/g, "&gt;").replace(/"/g, "&quot;");
  }

  /* ---------- fields ---------- */
  function fieldHTML(f, value, scope) {
    var id = scope + "|" + f.k;
    var hint = f.hint ? '<em class="hint">' + f.hint + "</em>" : "";
    var head = '<span class="f__label">' + esc(f.label) + hint + "</span>";

    if (f.type === "image" || f.type === "audio") {
      var isImg = f.type === "image";
      return '<div class="f f--media" data-field="' + esc(id) + '">' + head +
        '<div class="media">' +
        (isImg
          ? '<div class="media__thumb">' + (value ? '<img src="' + esc(value) + '" alt="" />' : "<span>empty</span>") + "</div>"
          : '<div class="media__thumb media__thumb--audio"><span>' + (value ? "audio" : "empty") + "</span></div>") +
        '<div class="media__side">' +
        '<input type="text" data-k="' + esc(f.k) + '" value="' + esc(value) + '" placeholder="' +
          (isImg ? "assets/… or a link" : "assets/audio/…") + '" />' +
        '<button class="btn btn--ghost btn--pick" type="button" data-accept="' +
          (isImg ? "image/*" : "audio/*") + '">choose a file</button>' +
        "</div></div></div>";
    }
    if (f.type === "phase") {
      return '<label class="f">' + head + '<select data-k="' + esc(f.k) + '">' +
        C.phases.map(function (p) {
          return '<option value="' + p + '"' + (p === value ? " selected" : "") + ">" + p + "</option>";
        }).join("") + "</select></label>";
    }
    if (f.type === "choice") {
      return '<label class="f">' + head + '<select data-k="' + esc(f.k) + '">' +
        f.options.map(function (p) {
          return '<option value="' + p + '"' + (p === value ? " selected" : "") + ">" + p + "</option>";
        }).join("") + "</select></label>";
    }
    if (f.type === "long") {
      return '<label class="f">' + head + '<textarea rows="' + (f.rows || 4) +
        '" data-k="' + esc(f.k) + '">' + esc(value) + "</textarea></label>";
    }
    return '<label class="f">' + head + '<input type="text" data-k="' + esc(f.k) +
      '" value="' + esc(value) + '" /></label>';
  }

  /* ---------- rows ---------- */
  function rowHTML(spec, row, listId) {
    var media = spec.media ? row[spec.media] : "";
    var thumb = spec.media && /image/.test(spec.fields.map(function (f) { return f.type; }).join())
      ? (media ? '<img src="' + esc(media) + '" alt="" />' : "<span>no image</span>")
      : "<span>" + (media ? "audio" : "empty") + "</span>";
    return '<article class="row" data-id="' + row.id + '" data-table="' + spec.table + '" data-list="' + listId + '" draggable="true">' +
      '<div class="row__grip" title="drag to reorder">⠿</div>' +
      '<div class="row__thumb">' + thumb + "</div>" +
      '<div class="row__main">' +
      '<div class="row__head">' +
      '<strong>' + esc(row.title || row.name || "Untitled") + "</strong>" +
      '<div class="row__acts">' +
      '<label class="switch"><input type="checkbox" data-k="published"' + (row.published ? " checked" : "") +
        ' /><span>' + (row.published ? "live" : "hidden") + "</span></label>" +
      '<button class="btn btn--ghost btn--open" type="button">edit</button>' +
      '<button class="btn btn--ghost btn--del" type="button" aria-label="delete">delete</button>' +
      "</div></div>" +
      '<div class="row__form" hidden>' +
      spec.fields.map(function (f) { return fieldHTML(f, row[f.k] == null ? "" : row[f.k], spec.table + ":" + row.id); }).join("") +
      "</div></div></article>";
  }

  function listHTML(listId) {
    var spec = LISTS[listId];
    var rows = data[spec.table === "cherry_works" ? "works"
      : spec.table === "cherry_pieces" ? "pieces"
      : spec.table === "cherry_portals" ? "portals" : "tracks"] || [];
    if (spec.filter) {
      Object.keys(spec.filter).forEach(function (k) {
        rows = rows.filter(function (r) { return spec.filter[k].indexOf(r[k]) > -1; });
      });
    }
    var groups = {};
    if (spec.grouped) {
      rows.forEach(function (r) { (groups[r[spec.grouped]] = groups[r[spec.grouped]] || []).push(r); });
    } else {
      groups[""] = rows;
    }
    var order = spec.grouped === "phase" ? C.phases : Object.keys(groups);
    return order.map(function (g) {
      var items = (groups[g] || []).sort(function (a, b) { return (a.sort | 0) - (b.sort | 0); });
      return '<section class="group" data-group="' + esc(g) + '" data-list="' + listId + '">' +
        (g ? '<h3 class="group__name">' + esc(g) + ' <em>' + items.length + "</em></h3>" : "") +
        (items.length ? items.map(function (r) { return rowHTML(spec, r, listId); }).join("")
                      : '<p class="none">nothing here yet</p>') +
        "</section>";
    }).join("") +
      '<button class="btn btn--add" type="button" data-add="' + listId + '">add ' + spec.label.toLowerCase() + "</button>" +
      (spec.adds === "image" || spec.adds === "audio"
        ? '<div class="drop" data-drop="' + listId + '"><strong>or drop files here</strong>' +
          "<span>they arrive as new " + spec.label.toLowerCase() + "s</span></div>" : "");
  }

  /* ---------- painting a section ---------- */
  function paint(id) {
    var sec = SCHEMA.filter(function (s) { return s.id === id; })[0];
    if (!sec) return;
    current = id;
    try { localStorage.setItem(LAST, id); } catch (e) {}

    $$("#rail a").forEach(function (a) { a.classList.toggle("is-on", a.dataset.go === id); });

    var html = '<header class="sheet__head">' +
      '<p class="sheet__num">' + esc(sec.num) + "</p>" +
      '<h2 class="sheet__name">' + esc(sec.name) + "</h2>" +
      '<p class="sheet__blurb">' + esc(sec.blurb) + "</p>" +
      '<a class="sheet__see" href="' + esc(sec.page) + '" target="_blank" rel="noopener">see the page &rarr;</a>' +
      "</header>";

    if (sec.fields) {
      html += '<div class="sheet__fields">' + sec.fields.map(function (f) {
        return fieldHTML(f, data.settings[f.k] == null ? "" : data.settings[f.k], "setting");
      }).join("") + "</div>";
    }
    if (sec.list) html += '<div class="sheet__list">' + listHTML(sec.list) + "</div>";

    $("#sheet").innerHTML = html;
    window.scrollTo(0, 0);
  }

  /* ---------- reading everything ---------- */
  function loadAll() {
    $("#sheet").innerHTML = '<p class="loading">opening the archive…</p>';
    return Promise.all([
      rest("cherry_settings?select=key,value"),
      rest("cherry_works?select=*&order=phase,sort"),
      rest("cherry_pieces?select=*&order=phase,sort"),
      rest("cherry_tracks?select=*&order=voice,sort"),
      rest("cherry_portals?select=*&order=kind,sort")
    ]).then(function (r) {
      data.settings = {};
      (r[0] || []).forEach(function (s) { data.settings[s.key] = s.value; });
      data.works = r[1] || []; data.pieces = r[2] || [];
      data.tracks = r[3] || []; data.portals = r[4] || [];
      dirty = {}; dirtyRows = {}; markDirty();
      var last = null;
      try { last = localStorage.getItem(LAST); } catch (e) {}
      paint(last && SCHEMA.some(function (s) { return s.id === last; }) ? last : "landing");
    }).catch(function (e) {
      $("#sheet").innerHTML = '<p class="loading">' + esc(e.message) + "</p>";
    });
  }

  /* ---------- saving ---------- */
  function saveAll() {
    var jobs = [];
    Object.keys(dirty).forEach(function (k) {
      jobs.push(rest("cherry_settings?on_conflict=key", {
        method: "POST",
        headers: { Prefer: "resolution=merge-duplicates,return=minimal" },
        body: [{ key: k, value: dirty[k] }]
      }));
    });
    Object.keys(dirtyRows).forEach(function (ref) {
      var parts = ref.split(":"), table = parts[0], id = parts[1];
      jobs.push(rest(table + "?id=eq." + id, {
        method: "PATCH", headers: { Prefer: "return=minimal" }, body: dirtyRows[ref]
      }));
    });
    if (!jobs.length) return Promise.resolve();
    $("#saveBtn").disabled = true;
    return Promise.all(jobs).then(function () {
      toast("Saved. The site has it.", "ok");
      return loadAll();
    }).catch(function (e) {
      toast(e.message, "bad");
    }).then(function () { $("#saveBtn").disabled = false; });
  }

  function revert() {
    if (!countDirty()) return;
    if (!confirm("Throw away " + countDirty() + " unsaved change(s)?")) return;
    loadAll();
  }

  /* ---------- uploading ---------- */
  function upload(file) {
    var clean = file.name.toLowerCase().replace(/[^a-z0-9.]+/g, "-").replace(/^-|-$/g, "");
    var path = Date.now() + "-" + clean;
    return fetch(C.url + "/storage/v1/object/" + C.bucket + "/" + path, {
      method: "POST",
      headers: { apikey: C.key, Authorization: "Bearer " + token(), "x-upsert": "true",
                 "Content-Type": file.type || "application/octet-stream" },
      body: file
    }).then(function (r) {
      if (!r.ok) return r.text().then(function (t) { throw new Error(t.slice(0, 140) || "upload failed"); });
      return C.url + "/storage/v1/object/public/" + C.bucket + "/" + path;
    });
  }

  function addRows(listId, files) {
    var spec = LISTS[listId];
    var list = [].slice.call(files);
    if (!list.length) return;
    toast("Uploading " + list.length + " file(s)…");
    (function next(i) {
      if (i >= list.length) { toast("Added.", "ok"); loadAll(); return; }
      upload(list[i]).then(function (url) {
        var body = { title: list[i].name.replace(/\.[a-z0-9]+$/i, ""), sort: 90, published: true };
        if (spec.media) body[spec.media] = url;
        Object.keys(spec.defaults || {}).forEach(function (k) { body[k] = spec.defaults[k]; });
        if (spec.grouped === "phase") body.phase = "water";
        if (spec.table === "cherry_tracks" && !body.voice) body.voice = "cherry";
        return rest(spec.table, { method: "POST", headers: { Prefer: "return=minimal" }, body: body });
      }).then(function () { next(i + 1); })
        .catch(function (e) { toast(e.message, "bad"); });
    })(0);
  }

  function addBlank(listId) {
    var spec = LISTS[listId];
    var body = { sort: 90, published: false };
    if (spec.table === "cherry_pieces") { body.title = "Untitled"; body.kind = "poem"; body.phase = "water"; }
    if (spec.table === "cherry_portals") { body.name = "New door"; body.kind = "portal"; }
    if (spec.table === "cherry_works") { body.title = "Untitled"; body.phase = "water"; }
    if (spec.table === "cherry_tracks") { body.title = "Untitled"; body.voice = spec.defaults ? spec.defaults.voice : "cherry"; }
    Object.keys(spec.defaults || {}).forEach(function (k) { body[k] = spec.defaults[k]; });
    rest(spec.table, { method: "POST", headers: { Prefer: "return=minimal" }, body: body })
      .then(function () { toast("Added, hidden until you publish it.", "ok"); loadAll(); })
      .catch(function (e) { toast(e.message, "bad"); });
  }

  /* ---------- events ---------- */
  document.addEventListener("input", function (e) {
    var i = e.target;
    if (!i.dataset || !i.dataset.k) return;
    var row = i.closest(".row");
    if (row) {
      var ref = row.dataset.table + ":" + row.dataset.id;
      dirtyRows[ref] = dirtyRows[ref] || {};
      dirtyRows[ref][i.dataset.k] = i.type === "checkbox" ? i.checked
        : (i.dataset.k === "sort" ? parseInt(i.value, 10) || 0 : i.value);
      var head = $(".row__head strong", row);
      if (i.dataset.k === "title" || i.dataset.k === "name") head.textContent = i.value || "Untitled";
      var thumb = $(".row__thumb img", row);
      if (thumb && (i.dataset.k === "image_url")) thumb.src = i.value;
    } else if ($("#sheet").contains(i)) {
      dirty[i.dataset.k] = i.value;
    }
    markDirty();
  });

  document.addEventListener("change", function (e) {
    var i = e.target;
    if (i.type === "checkbox" && i.dataset.k === "published") {
      var lab = i.closest(".switch").querySelector("span");
      if (lab) lab.textContent = i.checked ? "live" : "hidden";
      var row = i.closest(".row");
      if (row) {
        var ref = row.dataset.table + ":" + row.dataset.id;
        dirtyRows[ref] = dirtyRows[ref] || {};
        dirtyRows[ref].published = i.checked;
        markDirty();
      }
    }
    if (i.tagName === "SELECT" && i.dataset.k) {
      var r2 = i.closest(".row");
      if (r2) {
        var ref2 = r2.dataset.table + ":" + r2.dataset.id;
        dirtyRows[ref2] = dirtyRows[ref2] || {};
        dirtyRows[ref2][i.dataset.k] = i.value;
      } else { dirty[i.dataset.k] = i.value; }
      markDirty();
    }
  });

  document.addEventListener("click", function (e) {
    var go = e.target.closest("[data-go]");
    if (go) { e.preventDefault(); paint(go.dataset.go); $("#rail").classList.remove("is-open"); return; }

    var open = e.target.closest(".btn--open");
    if (open) {
      var row = open.closest(".row");
      var form = $(".row__form", row);
      form.hidden = !form.hidden;
      open.textContent = form.hidden ? "edit" : "done";
      row.classList.toggle("is-open", !form.hidden);
      return;
    }

    var del = e.target.closest(".btn--del");
    if (del) {
      var r = del.closest(".row");
      var name = $(".row__head strong", r).textContent;
      if (!confirm("Delete “" + name + "” permanently?")) return;
      rest(r.dataset.table + "?id=eq." + r.dataset.id, { method: "DELETE", headers: { Prefer: "return=minimal" } })
        .then(function () { toast("Deleted.", "ok"); loadAll(); })
        .catch(function (err) { toast(err.message, "bad"); });
      return;
    }

    var pick = e.target.closest(".btn--pick");
    if (pick) {
      var input = $("#filePicker");
      input.accept = pick.dataset.accept || "";
      input.onchange = function () {
        var f = input.files[0];
        if (!f) return;
        toast("Uploading " + f.name + "…");
        upload(f).then(function (url) {
          var text = $('input[type="text"]', pick.closest(".media"));
          text.value = url;
          text.dispatchEvent(new Event("input", { bubbles: true }));
          var t = $(".media__thumb", pick.closest(".media"));
          t.innerHTML = /audio/.test(pick.dataset.accept) ? "<span>audio</span>" : '<img src="' + url + '" alt="" />';
          toast("Uploaded. Save to keep it.", "ok");
        }).catch(function (err) { toast(err.message, "bad"); });
        input.value = "";
      };
      input.click();
      return;
    }

    var add = e.target.closest("[data-add]");
    if (add) {
      var lid = add.dataset.add;
      if (LISTS[lid].adds === "blank") addBlank(lid);
      else {
        var fp = $("#filePicker");
        fp.accept = LISTS[lid].adds === "audio" ? "audio/*" : "image/*";
        fp.onchange = function () { addRows(lid, fp.files); fp.value = ""; };
        fp.click();
      }
      return;
    }

    if (e.target.closest("#saveBtn")) { saveAll(); return; }
    if (e.target.closest("#revertBtn")) { revert(); return; }
    if (e.target.closest("#menuBtn")) { $("#rail").classList.toggle("is-open"); return; }
    if (e.target.closest("#signout")) {
      fetch(C.url + "/auth/v1/logout", { method: "POST",
        headers: { apikey: C.key, Authorization: "Bearer " + token() } }).catch(function () {});
      forget(); location.reload();
    }
  });

  /* drag to reorder inside a group */
  var dragging = null;
  document.addEventListener("dragstart", function (e) {
    var row = e.target.closest(".row");
    if (!row) return;
    dragging = row;
    row.classList.add("is-dragging");
    e.dataTransfer.effectAllowed = "move";
  });
  document.addEventListener("dragend", function () {
    if (!dragging) return;
    dragging.classList.remove("is-dragging");
    var group = dragging.closest(".group");
    dragging = null;
    if (!group) return;
    $$(".row", group).forEach(function (r, i) {
      var ref = r.dataset.table + ":" + r.dataset.id;
      dirtyRows[ref] = dirtyRows[ref] || {};
      dirtyRows[ref].sort = i;
    });
    markDirty();
    toast("Order changed. Save to keep it.");
  });
  document.addEventListener("dragover", function (e) {
    if (!dragging) return;
    var over = e.target.closest(".row");
    if (!over || over === dragging) return;
    if (over.closest(".group") !== dragging.closest(".group")) return;
    e.preventDefault();
    var box = over.getBoundingClientRect();
    var after = (e.clientY - box.top) / box.height > 0.5;
    over.parentNode.insertBefore(dragging, after ? over.nextSibling : over);
  });

  /* dropping files onto a list */
  document.addEventListener("dragenter", function (e) {
    var d = e.target.closest("[data-drop]");
    if (d) { e.preventDefault(); d.classList.add("is-over"); }
  });
  document.addEventListener("dragleave", function (e) {
    var d = e.target.closest("[data-drop]");
    if (d) d.classList.remove("is-over");
  });
  document.addEventListener("drop", function (e) {
    var d = e.target.closest("[data-drop]");
    if (!d) return;
    e.preventDefault();
    d.classList.remove("is-over");
    addRows(d.dataset.drop, e.dataTransfer.files);
  });

  document.addEventListener("keydown", function (e) {
    if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "s") { e.preventDefault(); saveAll(); }
  });
  window.addEventListener("beforeunload", function (e) {
    if (countDirty()) { e.preventDefault(); e.returnValue = ""; }
  });

  /* ---------- boot ---------- */
  if (session) {
    $("#gate").hidden = true;
    $("#shell").hidden = false;
    $("#rail").innerHTML = SCHEMA.map(function (s) {
      return '<a href="#" data-go="' + s.id + '"><em>' + esc(s.num) + "</em>" + esc(s.name) + "</a>";
    }).join("");
    loadAll();
  } else {
    $("#gate").hidden = false;
    $("#shell").hidden = true;
    $("#gateForm").addEventListener("submit", signIn);
  }
})();
