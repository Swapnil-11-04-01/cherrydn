/* ============================================================
   CHERRY DN — Underwater Fire
   scroll choreography · embers · themes · curator mode
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

  /* ---------- Nav scroll state ---------- */
  const nav = document.querySelector(".nav");
  const onScroll = () => nav.classList.toggle("is-scrolled", window.scrollY > 40);
  window.addEventListener("scroll", onScroll, { passive: true });
  onScroll();

  /* ---------- Mobile menu ---------- */
  const burger = document.getElementById("burger");
  const menu = document.getElementById("menu");

  function setMenu(open) {
    burger.classList.toggle("is-open", open);
    menu.classList.toggle("is-open", open);
    burger.setAttribute("aria-expanded", String(open));
    menu.setAttribute("aria-hidden", String(!open));
    document.body.style.overflow = open ? "hidden" : "";
    document.querySelector("main").inert = open;
    if (curatorBar) curatorBar.inert = open;
    if (open) menu.querySelector("a").focus();
    else burger.focus();
  }
  burger.addEventListener("click", () => setMenu(!menu.classList.contains("is-open")));
  menu.querySelectorAll("a").forEach((a) => a.addEventListener("click", () => setMenu(false)));
  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape" && menu.classList.contains("is-open")) setMenu(false);
  });
  window.matchMedia("(min-width: 1121px)").addEventListener("change", (mq) => {
    if (mq.matches && menu.classList.contains("is-open")) setMenu(false);
  });

  /* ---------- Hero load-in (one-shot, CSS-driven) ---------- */
  const heroReveals = document.querySelectorAll(".hero [data-reveal]");
  heroReveals.forEach((el, i) => el.style.setProperty("--d", `${0.15 + i * 0.14}s`));
  requestAnimationFrame(() =>
    requestAnimationFrame(() => heroReveals.forEach((el) => el.classList.add("is-visible")))
  );

  /* ============================================================
     SCROLL CHOREOGRAPHY
     Elements flow in as they approach, drift out as they leave.
     Continuous + reversible; a soft lerp gives it a cinematic lag.
     ============================================================ */
  const clamp01 = (v) => (v < 0 ? 0 : v > 1 ? 1 : v);
  const easeOut = (t) => 1 - Math.pow(1 - t, 3);
  const easeInOut = (t) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);

  const flowEls = Array.from(document.querySelectorAll("[data-flow]"));
  const driftEls = Array.from(document.querySelectorAll("[data-drift]"));
  const bookEl = document.querySelector(".bookcover");
  const bookGrid = document.querySelector(".book__grid");
  const heroEl = document.querySelector(".hero");

  const flows = [];
  const drifts = [];
  let bookScene = null;
  let vh = window.innerHeight;

  function buildScenes() {
    flows.length = 0;
    drifts.length = 0;
    flowEls.forEach((el) => {
      if (!el.isConnected) return;
      flows.push({
        el,
        mode: el.dataset.flow || "rise",
        lag: parseFloat(el.dataset.lag || "0"),
        top: 0, h: 1,
      });
    });
    driftEls.forEach((el) => {
      if (!el.isConnected) return;
      drifts.push({ el, speed: parseFloat(el.dataset.drift || "0.05"), top: 0, h: 1 });
    });
    bookScene = bookEl && bookGrid ? { top: 0, h: 1 } : null;
  }

  function measure() {
    vh = window.innerHeight;
    const y = window.scrollY;
    // neutralise transforms so we read true layout positions
    flows.forEach((f) => { f.el.style.transform = ""; });
    drifts.forEach((d) => { d.el.style.transform = ""; });
    if (bookEl) bookEl.style.transform = "";
    flows.forEach((f) => {
      const r = f.el.getBoundingClientRect();
      f.top = r.top + y; f.h = Math.max(r.height, 1);
    });
    drifts.forEach((d) => {
      const r = d.el.getBoundingClientRect();
      d.top = r.top + y; d.h = Math.max(r.height, 1);
    });
    if (bookScene) {
      const r = bookGrid.getBoundingClientRect();
      bookScene.top = r.top + y; bookScene.h = Math.max(r.height, 1);
    }
  }

  function progressOf(top, h, y) {
    return clamp01((y + vh - top) / (vh + h));
  }

  function applyFlows(y) {
    for (const f of flows) {
      const shift = f.lag * 0.05;
      const p = clamp01((progressOf(f.top, f.h, y) - shift) / (1 - shift));
      const enter = easeOut(clamp01(p / 0.3));
      const exit = clamp01((p - 0.84) / 0.16);
      const op = enter * (1 - exit * 0.92);
      let x = 0, yy = (1 - enter) * 72 - exit * 44, s = 1;
      if (f.mode === "left") x = (1 - enter) * -90;
      else if (f.mode === "right") x = (1 - enter) * 90;
      else if (f.mode === "scale") { s = 0.93 + enter * 0.07; yy = (1 - enter) * 40 - exit * 30; }
      else if (f.mode === "fade") yy = (1 - enter) * 24 - exit * 16;
      f.el.style.opacity = op.toFixed(3);
      f.el.style.transform = `translate3d(${x.toFixed(1)}px, ${yy.toFixed(1)}px, 0) scale(${s.toFixed(3)})`;
    }
    for (const d of drifts) {
      const center = d.top + d.h / 2 - (y + vh / 2);
      d.el.style.transform = `translate3d(0, ${(center * -d.speed).toFixed(1)}px, 0)`;
    }
    if (bookScene && bookEl) {
      const p = progressOf(bookScene.top, bookScene.h, y);
      const open = easeInOut(clamp01((p - 0.1) / 0.55));
      bookEl.style.transform = `rotateY(${(-36 + open * 25).toFixed(1)}deg) rotateX(2deg)`;
    }
    if (heroEl) {
      const fade = clamp01(y / (vh * 0.85));
      heroEl.style.transform = `translate3d(0, ${(y * 0.42).toFixed(1)}px, 0)`;
      heroEl.style.opacity = (1 - fade).toFixed(3);
      heroEl.style.pointerEvents = fade > 0.6 ? "none" : "";
      heroEl.style.visibility = fade >= 1 ? "hidden" : "";
    }
  }

  function staticFlows() {
    // reduced motion / fallback: everything simply visible
    flowEls.forEach((el) => { el.style.opacity = "1"; el.style.transform = "none"; });
  }

  /* ---------- Depth: fire dims, water thickens as you sink ---------- */
  function setDepth(y) {
    const max = document.body.scrollHeight - vh;
    root.style.setProperty("--depth", max > 0 ? (y / max).toFixed(3) : 0);
  }

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
  function embersTick() {
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
  }

  /* ---------- Master loop ---------- */
  if (!prefersReducedMotion) {
    resizeCanvas();
    initParticles();
    buildScenes();
    measure();

    let smoothY = window.scrollY;
    let lastDepthY = -1;

    function frame() {
      const target = window.scrollY;
      if (Math.abs(target - smoothY) > vh) smoothY = target;
      smoothY += (target - smoothY) * 0.16;
      if (Math.abs(target - smoothY) < 0.1) smoothY = target;
      applyFlows(smoothY);
      if (Math.abs(target - lastDepthY) > 4) { setDepth(target); lastDepthY = target; }
      embersTick();
      requestAnimationFrame(frame);
    }
    applyFlows(smoothY);
    setDepth(smoothY);
    requestAnimationFrame(frame);

    let resizeTimer;
    window.addEventListener("resize", () => {
      clearTimeout(resizeTimer);
      resizeTimer = setTimeout(() => { resizeCanvas(); initParticles(); measure(); }, 200);
    });
    window.addEventListener("load", measure);
    if (document.fonts && document.fonts.ready) document.fonts.ready.then(measure);
  } else {
    staticFlows();
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
      refreshChoreography();
    });
    cap.addEventListener("blur", () => {
      rec.caption = cap.textContent.trim();
      dbPut(key, rec).catch(() => {});
    });
    fig.append(art, cap, rm);
    return fig;
  }

  function refreshChoreography() {
    if (prefersReducedMotion) { staticFlows(); return; }
    // pick up dynamically added/removed gallery items
    flowEls.length = 0;
    document.querySelectorAll("[data-flow]").forEach((el) => flowEls.push(el));
    buildScenes();
    measure();
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
        fig.setAttribute("data-flow", "rise");
        galleryGrid.appendChild(fig);
      }
    }
    refreshChoreography();
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
          fig.setAttribute("data-flow", "rise");
          galleryGrid.insertBefore(fig, addTile);
          const cap = fig.querySelector("figcaption");
          cap.setAttribute("contenteditable", "true");
          cap.addEventListener("blur", onEditBlur);
          refreshChoreography();
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
    refreshChoreography();
  }

  function onEditBlur(e) {
    const el = e.currentTarget;
    if (el.dataset.edit) saveText(el);
    refreshChoreography();
  }

  if (curateBtn) {
    if (new URLSearchParams(location.search).has("curate")) {
      curateBtn.addEventListener("click", () => setCurating(!curating));
    } else {
      curateBtn.remove();
    }
  }

  /* --- track audio: upload her songs in curator mode, play anywhere --- */
  const trackAudio = new Audio();
  let playingBtn = null;
  function stopTrack() {
    trackAudio.pause();
    if (playingBtn) playingBtn.classList.remove("is-playing");
    playingBtn = null;
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
      btn.classList.add("is-playing");
    });
  });

  restoreText();
  restoreMedia().then(() => {
    if (new URLSearchParams(location.search).has("curate")) setCurating(true);
  });
})();
