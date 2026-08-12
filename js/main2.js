/* ============================================================
   CHERRY DN — Underwater Fire · TEMPLATE 2 (The Stages)
   scene player · embers · themes · curator mode
   The site is a deck of full-screen scenes, not a long page:
   scrolling dissolves one scene out and brings the next in.
   ============================================================ */

(function () {
  "use strict";

  const prefersReducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  const root = document.documentElement;

  /* ---------- Theme toggle (Underwater Fire ↔ Cherry Noir) ---------- */
  const toggle = document.getElementById("themeToggle");
  const toggleLabel = toggle.querySelector("[data-label]");
  const THEMES = {
    fire: { next: "noir", label: "Underwater Fire" },
    noir: { next: "fire", label: "Cherry Noir" },
  };

  let savedTheme = null;
  try { savedTheme = localStorage.getItem("cdn-theme"); } catch (e) {}
  if (savedTheme && THEMES[savedTheme]) root.dataset.theme = savedTheme;
  if (!THEMES[root.dataset.theme]) root.dataset.theme = "fire";
  toggleLabel.textContent = THEMES[root.dataset.theme].label;

  toggle.addEventListener("click", () => {
    const next = THEMES[root.dataset.theme].next;
    root.dataset.theme = next;
    toggleLabel.textContent = THEMES[next].label;
    try { localStorage.setItem("cdn-theme", next); } catch (e) {}
    recolorEmbers();
  });

  /* ---------- Mobile menu ---------- */
  const nav = document.querySelector(".nav");
  const burger = document.getElementById("burger");
  const menu = document.getElementById("menu");

  function setMenu(open) {
    burger.classList.toggle("is-open", open);
    menu.classList.toggle("is-open", open);
    burger.setAttribute("aria-expanded", String(open));
    menu.setAttribute("aria-hidden", String(!open));
    document.querySelector("main").inert = open;
    if (curatorBar) curatorBar.inert = open;
    if (open) menu.querySelector("a").focus();
    else burger.focus();
  }
  burger.addEventListener("click", () => setMenu(!menu.classList.contains("is-open")));
  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape" && menu.classList.contains("is-open")) setMenu(false);
  });
  window.matchMedia("(min-width: 1121px)").addEventListener("change", (mq) => {
    if (mq.matches && menu.classList.contains("is-open")) setMenu(false);
  });

  /* ============================================================
     SCENE PLAYER
     ============================================================ */
  const scenes = Array.from(document.querySelectorAll(".scene"));
  const DUR = prefersReducedMotion ? 0 : 1050;
  const COOLDOWN = prefersReducedMotion ? 150 : 350;
  let idx = 0;
  let locked = false;
  let navTime = 0;

  function staggerScene(sc) {
    sc.querySelectorAll("[data-flow]").forEach((el, j) => {
      el.style.setProperty("--d", `${Math.min(j * 0.08, 0.55)}s`);
    });
  }
  scenes.forEach(staggerScene);

  /* progress rail (thin ticks, right edge) + scene caption (bottom left) */
  const rail = document.createElement("nav");
  rail.className = "rail";
  rail.setAttribute("aria-label", "Scenes");
  const railTicks = scenes.map((sc, i) => {
    const b = document.createElement("button");
    b.type = "button";
    b.className = "rail__tick";
    b.title = sc.dataset.label || `Scene ${i + 1}`;
    b.setAttribute("aria-label", sc.dataset.label || `Scene ${i + 1}`);
    b.addEventListener("click", () => go(i));
    rail.appendChild(b);
    return b;
  });
  document.body.appendChild(rail);

  const caption = document.createElement("div");
  caption.className = "scene-caption";
  caption.setAttribute("aria-hidden", "true");
  document.body.appendChild(caption);

  function syncUI() {
    railTicks.forEach((b, i) => b.classList.toggle("is-current", i === idx));
    scenes.forEach((sc, i) => { sc.inert = i !== idx; });
    nav.classList.toggle("is-scrolled", idx > 0);
    root.style.setProperty("--depth", scenes.length > 1 ? (idx / (scenes.length - 1)).toFixed(3) : 0);
    const id = scenes[idx].id;
    root.dataset.scene = id || "";
    caption.textContent =
      String(idx + 1).padStart(2, "0") + " · " + (scenes[idx].dataset.label || "").toLowerCase();
    if (id && history.replaceState) history.replaceState(null, "", "#" + id);
  }

  function go(n) {
    n = Math.max(0, Math.min(scenes.length - 1, n));
    if (n === idx || locked) return;
    const dir = n > idx ? 1 : -1;
    const cur = scenes[idx];
    const next = scenes[n];
    locked = true;

    next.scrollTop = 0;
    next.classList.remove("is-exit", "dir-up", "dir-down", "is-active");
    next.classList.add("is-ready", dir > 0 ? "from-down" : "from-up");
    void next.offsetWidth; // commit start positions
    next.classList.add("is-active");
    next.classList.remove("from-down", "from-up");

    cur.classList.remove("is-active");
    cur.classList.add("is-exit", dir > 0 ? "dir-up" : "dir-down");

    idx = n;
    syncUI();

    setTimeout(() => {
      cur.classList.remove("is-exit", "dir-up", "dir-down");
      cur.scrollTop = 0;
      next.classList.remove("is-ready");
      locked = false;
      navTime = performance.now();
      wheelAcc = 0;
    }, DUR);
  }

  function step(dir) {
    go(idx + dir);
  }

  function canScrollInside(sc, dir) {
    return dir > 0
      ? sc.scrollTop + sc.clientHeight < sc.scrollHeight - 2
      : sc.scrollTop > 2;
  }

  /* wheel */
  let wheelAcc = 0;
  let lastWheel = 0;
  window.addEventListener("wheel", (e) => {
    if (menu.classList.contains("is-open")) return;
    const dir = e.deltaY > 0 ? 1 : -1;
    const sc = scenes[idx];
    if (locked) { e.preventDefault(); return; }
    if (canScrollInside(sc, dir)) { wheelAcc = 0; return; } // let the scene scroll inside itself
    e.preventDefault();
    const now = performance.now();
    if (now - navTime < COOLDOWN) return; // swallow trackpad inertia after a transition
    if (now - lastWheel > 160) wheelAcc = 0;
    lastWheel = now;
    wheelAcc += e.deltaY;
    if (Math.abs(wheelAcc) > 60) {
      const d = wheelAcc > 0 ? 1 : -1;
      wheelAcc = 0;
      step(d);
    }
  }, { passive: false });

  /* touch */
  let touchY = null;
  window.addEventListener("touchstart", (e) => {
    touchY = e.touches[0].clientY;
  }, { passive: true });
  window.addEventListener("touchend", (e) => {
    if (touchY === null || locked || menu.classList.contains("is-open")) { touchY = null; return; }
    const dy = touchY - e.changedTouches[0].clientY; // positive = swipe up = forward
    touchY = null;
    if (Math.abs(dy) < 55) return;
    const dir = dy > 0 ? 1 : -1;
    if (canScrollInside(scenes[idx], dir)) return;
    if (performance.now() - navTime < COOLDOWN) return;
    step(dir);
  }, { passive: true });

  /* keys */
  document.addEventListener("keydown", (e) => {
    if (menu.classList.contains("is-open")) return;
    if (e.target instanceof Element &&
        e.target.closest("input, textarea, select, [contenteditable=\"true\"]")) return;
    switch (e.key) {
      case "ArrowDown": case "PageDown": e.preventDefault(); step(1); break;
      case " ": e.preventDefault(); step(e.shiftKey ? -1 : 1); break;
      case "ArrowUp": case "PageUp": e.preventDefault(); step(-1); break;
      case "Home": e.preventDefault(); go(0); break;
      case "End": e.preventDefault(); go(scenes.length - 1); break;
    }
  });

  /* internal anchors → scene navigation */
  document.addEventListener("click", (e) => {
    const a = e.target.closest('a[href^="#"]');
    if (!a) return;
    const id = a.getAttribute("href").slice(1);
    const target = id === "top" ? 0 : scenes.findIndex((sc) => sc.id === id);
    if (target < 0) return;
    e.preventDefault();
    if (menu.classList.contains("is-open")) setMenu(false);
    go(target);
  });

  /* initial scene (honour a shared #hash); entrance plays on load */
  const initialId = location.hash.slice(1);
  const found = scenes.findIndex((sc) => sc.id === initialId);
  idx = found >= 0 ? found : 0;
  syncUI();
  requestAnimationFrame(() =>
    requestAnimationFrame(() => scenes[idx].classList.add("is-active"))
  );

  /* ---------- Embers: fire that rises like bubbles ---------- */
  const canvas = document.getElementById("embers");
  const ctx = canvas.getContext("2d");
  let W, H, dpr, particles = [];

  const PALETTES = {
    fire: [
      { r: 198, g: 38, b: 65 },   // cherry
      { r: 224, g: 92, b: 84 },   // ember rose
      { r: 75, g: 135, b: 166 },  // water blue
      { r: 163, g: 201, b: 216 }, // pale water
    ],
    noir: [
      { r: 212, g: 32, b: 67 },   // cherry
      { r: 240, g: 237, b: 232 }, // bone white
      { r: 157, g: 147, b: 153 }, // silver
      { r: 122, g: 16, b: 40 },   // deep cherry
    ],
  };

  function resizeCanvas() {
    dpr = Math.min(window.devicePixelRatio || 1, 2);
    W = canvas.clientWidth;
    H = canvas.clientHeight;
    canvas.width = W * dpr;
    canvas.height = H * dpr;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  }

  function spawn(initial) {
    const c = PALETTES[root.dataset.theme] || PALETTES.fire;
    return {
      x: Math.random() * W,
      y: initial ? Math.random() * H : H + 12,
      r: 0.6 + Math.random() * 2.2,
      vy: 0.14 + Math.random() * 0.5,
      sway: 0.3 + Math.random() * 1.1,
      phase: Math.random() * Math.PI * 2,
      alpha: 0.15 + Math.random() * 0.5,
      color: c[Math.floor(Math.random() * c.length)],
      life: 0,
    };
  }

  function initParticles() {
    const density = Math.min(90, Math.floor((W * H) / 22000));
    particles = Array.from({ length: density }, () => spawn(true));
  }

  function recolorEmbers() {
    const c = PALETTES[root.dataset.theme] || PALETTES.fire;
    particles.forEach((p) => { p.color = c[Math.floor(Math.random() * c.length)]; });
  }

  let t = 0;
  function tick() {
    t += 0.008;
    ctx.clearRect(0, 0, W, H);
    for (let i = 0; i < particles.length; i++) {
      const p = particles[i];
      p.life += 0.004;
      p.y -= p.vy;
      p.x += Math.sin(t * 2 + p.phase) * p.sway * 0.18;
      const fade = Math.min(1, p.life * 6) * Math.max(0, Math.min(1, p.y / (H * 0.22)));
      const a = p.alpha * fade;
      if (p.y < -14 || a <= 0.004) { particles[i] = spawn(false); continue; }
      const { r, g, b } = p.color;
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
      ctx.fillStyle = `rgba(${r},${g},${b},${a})`;
      ctx.shadowColor = `rgba(${r},${g},${b},${Math.min(0.8, a * 1.6)})`;
      ctx.shadowBlur = 8;
      ctx.fill();
      ctx.shadowBlur = 0;
    }
    requestAnimationFrame(tick);
  }

  if (!prefersReducedMotion) {
    resizeCanvas();
    initParticles();
    requestAnimationFrame(tick);
    let resizeTimer;
    window.addEventListener("resize", () => {
      clearTimeout(resizeTimer);
      resizeTimer = setTimeout(() => { resizeCanvas(); initParticles(); }, 200);
    });
  }

  /* ---------- Newsletter (front-end only for now) ---------- */
  const form = document.getElementById("newsletterForm");
  const ok = document.getElementById("newsletterOk");
  const err = document.getElementById("newsletterErr");
  form.addEventListener("submit", (e) => {
    e.preventDefault();
    const email = form.email.value.trim();
    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      err.hidden = false;
      form.email.setAttribute("aria-invalid", "true");
      form.email.style.borderColor = "var(--cherry)";
      form.email.focus();
      return;
    }
    err.hidden = true;
    form.email.removeAttribute("aria-invalid");
    form.email.style.borderColor = "";
    form.hidden = true;
    ok.hidden = false;
    ok.focus();
  });

  /* ============================================================
     CURATOR MODE — Cherry dresses the site with her own art.
     Media lives in IndexedDB, text edits in localStorage,
     all in her own browser. No server, no accounts.
     ============================================================ */
  const DB_NAME = "cdn-site", STORE = "media";

  function openDB() {
    return new Promise((resolve, reject) => {
      try {
        const req = indexedDB.open(DB_NAME, 1);
        req.onupgradeneeded = () => req.result.createObjectStore(STORE);
        req.onsuccess = () => resolve(req.result);
        req.onerror = () => reject(req.error);
      } catch (e) { reject(e); }
    });
  }
  function dbOp(mode, fn) {
    return openDB().then((db) => new Promise((resolve, reject) => {
      const tx = db.transaction(STORE, mode);
      const out = fn(tx.objectStore(STORE));
      tx.oncomplete = () => resolve(out && "result" in out ? out.result : undefined);
      tx.onerror = () => reject(tx.error);
    }));
  }
  const dbPut = (key, val) => dbOp("readwrite", (s) => s.put(val, key));
  const dbGet = (key) => dbOp("readonly", (s) => s.get(key));
  const dbDel = (key) => dbOp("readwrite", (s) => s.delete(key));
  const dbKeys = () => dbOp("readonly", (s) => s.getAllKeys());

  const SLOTS = [
    { id: "portrait", sel: ".portrait-frame__art" },
    { id: "photo-1", sel: ".photo__art--1" },
    { id: "photo-2", sel: ".photo__art--2" },
    { id: "photo-3", sel: ".photo__art--3" },
    { id: "photo-4", sel: ".photo__art--4" },
    { id: "film-1", sel: ".film__still--1", video: true },
    { id: "film-2", sel: ".film__still--2", video: true },
    { id: "prod-1", sel: ".product__art--book" },
    { id: "prod-2", sel: ".product__art--print" },
    { id: "prod-3", sel: ".product__art--bundle" },
    { id: "book-cover", sel: ".bookcover__front", tinted: true },
  ];

  const galleryGrid = document.querySelector(".photo__grid");
  let curating = false;

  function applySlotMedia(slot, rec) {
    const el = document.querySelector(slot.sel);
    if (!el) return;
    const old = el.querySelector(".slot-video");
    if (old) { URL.revokeObjectURL(old.src); old.remove(); }
    el.classList.remove("has-media");
    el.style.backgroundImage = "";
    if (!rec) return;
    const url = URL.createObjectURL(rec.blob);
    if (rec.type && rec.type.startsWith("video")) {
      const v = document.createElement("video");
      v.className = "slot-video";
      v.src = url;
      v.muted = true;
      v.setAttribute("muted", "");
      v.playsInline = true;
      v.setAttribute("aria-hidden", "true");
      v.tabIndex = -1;
      if (!prefersReducedMotion) { v.autoplay = true; v.loop = true; }
      else { v.preload = "metadata"; }
      el.prepend(v);
    } else if (slot.tinted) {
      el.style.backgroundImage =
        `linear-gradient(rgba(5,7,13,0.5), rgba(5,7,13,0.72)), url("${url}")`;
      el.classList.add("has-media");
    } else {
      el.style.backgroundImage = `url("${url}")`;
      el.classList.add("has-media");
    }
  }

  function galleryFigure(key, rec) {
    const fig = document.createElement("figure");
    fig.className = "photo__item gallery-item";
    fig.dataset.key = key;
    const art = document.createElement("div");
    art.className = "photo__art has-media";
    art.style.backgroundImage = `url("${URL.createObjectURL(rec.blob)}")`;
    const cap = document.createElement("figcaption");
    cap.textContent = rec.caption || "untitled piece";
    const rm = document.createElement("button");
    rm.type = "button";
    rm.className = "gallery-remove";
    rm.textContent = "remove";
    rm.addEventListener("click", () => {
      dbDel(key).catch(() => {});
      fig.remove();
    });
    cap.addEventListener("blur", () => {
      rec.caption = cap.textContent.trim();
      dbPut(key, rec).catch(() => {});
    });
    fig.append(art, cap, rm);
    return fig;
  }

  async function restoreMedia() {
    let keys = [];
    try { keys = await dbKeys(); } catch (e) { return; }
    for (const key of keys) {
      if (typeof key !== "string") continue;
      const rec = await dbGet(key).catch(() => null);
      if (!rec) continue;
      if (key.startsWith("slot:")) {
        const slot = SLOTS.find((s) => s.id === key.slice(5));
        if (slot) applySlotMedia(slot, rec);
      } else if (key.startsWith("track:")) {
        const row = document.querySelector(`.track[data-track="${key.slice(6)}"]`);
        if (row) row.querySelector(".track__play").classList.add("has-audio");
      } else if (key.startsWith("gallery:") && galleryGrid) {
        const fig = galleryFigure(key, rec);
        fig.setAttribute("data-flow", "");
        galleryGrid.appendChild(fig);
      }
    }
    scenes.forEach(staggerScene);
  }

  /* --- text edits --- */
  const TEXT_KEY = "cdn-text";
  function restoreText() {
    let map = null;
    try { map = JSON.parse(localStorage.getItem(TEXT_KEY) || "{}"); } catch (e) { return; }
    document.querySelectorAll("[data-edit]").forEach((el) => {
      const v = map[el.dataset.edit];
      if (typeof v === "string") el.innerHTML = v;
    });
  }
  function saveText(el) {
    try {
      const map = JSON.parse(localStorage.getItem(TEXT_KEY) || "{}");
      map[el.dataset.edit] = el.innerHTML;
      localStorage.setItem(TEXT_KEY, JSON.stringify(map));
    } catch (e) {}
  }

  /* --- curator UI --- */
  const curateBtn = document.getElementById("curateBtn");
  const filePick = document.createElement("input");
  filePick.type = "file";
  filePick.hidden = true;
  document.body.appendChild(filePick);

  function pickFile(accept) {
    return new Promise((resolve) => {
      filePick.accept = accept;
      filePick.value = "";
      filePick.onchange = () => resolve(filePick.files[0] || null);
      filePick.click();
    });
  }

  function slotUI(slot) {
    const el = document.querySelector(slot.sel);
    if (!el || el.querySelector(".slot-ui")) return;
    const ui = document.createElement("div");
    ui.className = "slot-ui";
    const up = document.createElement("button");
    up.type = "button";
    up.textContent = slot.video ? "art / clip" : "artwork";
    up.addEventListener("click", async (e) => {
      e.stopPropagation();
      const file = await pickFile(slot.video ? "image/*,video/*" : "image/*");
      if (!file) return;
      const rec = { blob: file, type: file.type };
      try { await dbPut("slot:" + slot.id, rec); } catch (err2) {}
      applySlotMedia(slot, rec);
    });
    const rm = document.createElement("button");
    rm.type = "button";
    rm.textContent = "reset";
    rm.addEventListener("click", (e) => {
      e.stopPropagation();
      dbDel("slot:" + slot.id).catch(() => {});
      applySlotMedia(slot, null);
    });
    ui.append(up, rm);
    el.classList.add("slot-host");
    el.appendChild(ui);
  }

  let addTile = null, curatorBar = null;

  function setCurating(on) {
    curating = on;
    document.body.classList.toggle("curating", on);
    if (on) {
      SLOTS.forEach(slotUI);
      if (galleryGrid && !addTile) {
        addTile = document.createElement("button");
        addTile.type = "button";
        addTile.className = "gallery-add";
        addTile.innerHTML = "＋<span>add a piece</span>";
        addTile.addEventListener("click", async () => {
          const file = await pickFile("image/*");
          if (!file) return;
          const key = "gallery:" + Date.now() + "-" + Math.floor(Math.random() * 1e6);
          const rec = { blob: file, type: file.type, caption: "untitled piece" };
          try { await dbPut(key, rec); } catch (e) {}
          const fig = galleryFigure(key, rec);
          fig.setAttribute("data-flow", "");
          galleryGrid.insertBefore(fig, addTile);
          const cap = fig.querySelector("figcaption");
          cap.setAttribute("contenteditable", "true");
          cap.addEventListener("blur", onEditBlur);
          staggerScene(document.getElementById("photography"));
        });
        galleryGrid.appendChild(addTile);
      }
      if (!curatorBar) {
        curatorBar = document.createElement("div");
        curatorBar.className = "curator-bar";
        curatorBar.innerHTML =
          '<span>curator mode — your art &amp; words are saved in this browser</span>';
        const done = document.createElement("button");
        done.type = "button";
        done.textContent = "done";
        done.addEventListener("click", () => setCurating(false));
        curatorBar.appendChild(done);
        document.body.appendChild(curatorBar);
      }
      curatorBar.hidden = false;
      if (addTile) addTile.hidden = false;
      document.querySelectorAll("[data-edit], .gallery-item figcaption").forEach((el) => {
        el.setAttribute("contenteditable", "true");
        el.addEventListener("blur", onEditBlur);
      });
    } else {
      if (curatorBar) curatorBar.hidden = true;
      if (addTile) addTile.hidden = true;
      document.querySelectorAll(".slot-ui").forEach((el) => el.remove());
      document.querySelectorAll(".slot-host").forEach((el) => el.classList.remove("slot-host"));
      document.querySelectorAll("[contenteditable]").forEach((el) => {
        el.removeAttribute("contenteditable");
        el.removeEventListener("blur", onEditBlur);
      });
    }
  }

  function onEditBlur(e) {
    const el = e.currentTarget;
    if (el.dataset.edit) saveText(el);
  }

  if (curateBtn) {
    if (new URLSearchParams(location.search).has("curate")) {
      curateBtn.addEventListener("click", () => setCurating(!curating));
    } else {
      curateBtn.remove();
    }
  }

  /* --- the book leans toward the cursor --- */
  (function bookTilt() {
    const stage = document.querySelector(".book__stage");
    const cover = document.querySelector(".bookcover");
    if (!stage || !cover || prefersReducedMotion) return;
    const BASE_Y = -13, BASE_X = 1.5;
    let ty = BASE_Y, tx = BASE_X, cy = BASE_Y, cx = BASE_X;
    let hovering = false, rafId = null;
    function loop() {
      cy += (ty - cy) * 0.09;
      cx += (tx - cx) * 0.09;
      cover.style.transform = `rotateY(${cy.toFixed(2)}deg) rotateX(${cx.toFixed(2)}deg)`;
      cover.style.setProperty("--shine-x", `${(50 - (cy - BASE_Y) * 2.4).toFixed(1)}%`);
      if (!hovering && Math.abs(ty - cy) < 0.05 && Math.abs(tx - cx) < 0.05) {
        cover.style.transform = "";
        cover.style.removeProperty("--shine-x");
        rafId = null;
        return;
      }
      rafId = requestAnimationFrame(loop);
    }
    const ensure = () => { if (!rafId) rafId = requestAnimationFrame(loop); };
    stage.addEventListener("pointermove", (e) => {
      const r = stage.getBoundingClientRect();
      ty = BASE_Y + ((e.clientX - r.left) / r.width - 0.5) * 30;
      tx = BASE_X - ((e.clientY - r.top) / r.height - 0.5) * 16;
      hovering = true;
      ensure();
    });
    stage.addEventListener("pointerleave", () => {
      ty = BASE_Y; tx = BASE_X;
      hovering = false;
      ensure();
    });
  })();

  /* --- track audio: upload her songs in curator mode, play anywhere --- */
  const trackAudio = new Audio();
  let playingBtn = null;
  let playingRow = null;
  function stopTrack() {
    trackAudio.pause();
    if (playingBtn) playingBtn.classList.remove("is-playing");
    if (playingRow) playingRow.classList.remove("is-playing");
    playingBtn = null;
    playingRow = null;
  }
  trackAudio.addEventListener("ended", stopTrack);
  document.querySelectorAll(".track[data-track]").forEach((row) => {
    const btn = row.querySelector(".track__play");
    if (!btn) return;
    btn.addEventListener("click", async () => {
      if (curating) {
        const file = await pickFile("audio/*");
        if (!file) return;
        try { await dbPut("track:" + row.dataset.track, { blob: file, type: file.type }); } catch (e) {}
        btn.classList.add("has-audio");
        return;
      }
      if (playingBtn === btn) { stopTrack(); return; }
      const rec = await dbGet("track:" + row.dataset.track).catch(() => null);
      if (!rec) return;
      stopTrack();
      if (trackAudio.src) URL.revokeObjectURL(trackAudio.src);
      trackAudio.src = URL.createObjectURL(rec.blob);
      trackAudio.play().catch(() => {});
      playingBtn = btn;
      playingRow = row;
      btn.classList.add("is-playing");
      row.classList.add("is-playing");
    });
  });

  restoreText();
  restoreMedia().then(() => {
    if (new URLSearchParams(location.search).has("curate")) setCurating(true);
  });
})();
