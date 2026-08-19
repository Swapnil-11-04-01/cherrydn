/* ============================================================
   THE ROOM TONE
   Every page of this site has a key. Nothing here is an audio file: the
   beds, the ether under the cursor and the small sounds under a click are
   synthesised, so the site carries its own sound without spending a byte
   of bandwidth on it.

   Three rules this obeys, and must keep obeying:
   · Silence is the default. A browser will not start audio before a
     gesture anyway, and a site that sings at you unasked is a site people
     close. It is turned on once and then remembered.
   · Cherry's own work always wins. The moment a song, a chapter or a film
     plays, the bed ducks almost to nothing and the ether goes quiet.
   · It never runs inside the Studio's preview frame. She is working in
     there; it would sing at her while she typed.

   graph() builds into whatever context it is handed, which is what lets
   _render() bounce the very same graph offline to a file: the sound you
   audition is the sound that ships, not a re-creation of it.
   ============================================================ */
(function () {
  "use strict";
  if (window.top !== window.self) return;              /* not in her Studio */
  var Ctx = window.AudioContext || window.webkitAudioContext;
  if (!Ctx) return;

  var KEY = "cherry.sound";
  var page = (location.pathname.split("/").pop() || "index.html").toLowerCase();

  /* ---------- what each room sounds like ----------
     root is a real pitch, low; mode is scale degrees in semitones above
     it. Nothing is random: each page keeps its own key, so moving through
     the site is a modulation rather than a change of record. */
  var ROOMS = {
    "index.html":       { root: 55.00, mode: [0, 7, 10, 14, 19], air: 0.34, tilt: 520, name: "the sea" },
    "book.html":        { root: 73.42, mode: [0, 7, 12, 16, 19], air: 0.24, tilt: 620, name: "the heart" },
    "written-word.html":{ root: 49.00, mode: [0, 3, 10, 15, 22], air: 0.20, tilt: 430, name: "ink" },
    "visuals.html":     { root: 65.41, mode: [0, 5, 7, 14, 17], air: 0.30, tilt: 700, name: "the wall" },
    "spoken-word.html": { root: 55.00, mode: [0, 5, 12, 17, 19], air: 0.40, tilt: 480, name: "breath" },
    "film.html":        { root: 41.20, mode: [0, 7, 10, 12, 19], air: 0.26, tilt: 360, name: "the projector" },
    "music.html":       { root: 58.27, mode: [0, 3, 7, 14, 15], air: 0.16, tilt: 500, name: "between them" },
    "about.html":       { root: 87.31, mode: [0, 4, 7, 11, 14], air: 0.22, tilt: 660, name: "a footnote" },
    "contact.html":     { root: 73.42, mode: [0, 5, 9, 12, 17], air: 0.28, tilt: 580, name: "the letter" },
    "gift.html":        { root: 58.27, mode: [0, 7, 11, 14, 18], air: 0.36, tilt: 540, name: "the ember" }
  };
  var room = ROOMS[page] || ROOMS["index.html"];
  var BED = 0.055, DUCKED = 0.006;
  function semi(n) { return Math.pow(2, n / 12); }

  function noiseBuffer(ac, seconds) {
    var len = Math.floor(ac.sampleRate * seconds);
    var buf = ac.createBuffer(1, len, ac.sampleRate);
    var d = buf.getChannelData(0);
    /* tilted toward the low end, so it reads as air rather than hiss */
    var b0 = 0, b1 = 0, b2 = 0;
    for (var i = 0; i < len; i++) {
      var w = Math.random() * 2 - 1;
      b0 = 0.997 * b0 + w * 0.0555;
      b1 = 0.985 * b1 + w * 0.0750;
      b2 = 0.950 * b2 + w * 0.1538;
      d[i] = (b0 + b1 + b2 + w * 0.1848) * 0.6;
    }
    return buf;
  }

  /* ---------- the graph ---------- */
  function graph(ac, room, destination) {
    var master = ac.createGain();
    master.gain.value = 0;                    /* faded in, never switched on */
    master.connect(destination || ac.destination);

    var meter = null;
    if (ac.createAnalyser && !ac.startRendering) {
      meter = ac.createAnalyser();
      meter.fftSize = 2048;
      master.connect(meter);
    }

    /* a cheap sense of a large room: one long lowpassed delay, fed back */
    var space = ac.createGain();
    var delay = ac.createDelay(1.2);
    delay.delayTime.value = 0.37;
    var fb = ac.createGain();
    fb.gain.value = 0.42;
    var damp = ac.createBiquadFilter();
    damp.type = "lowpass";
    damp.frequency.value = 1500;
    space.connect(master);
    space.connect(delay);
    delay.connect(damp);
    damp.connect(fb);
    fb.connect(delay);
    damp.connect(master);

    /* --- the bed: three slow voices in the room's own key --- */
    var bed = ac.createGain();
    bed.gain.value = BED;
    bed.connect(space);

    var tone = ac.createBiquadFilter();
    tone.type = "lowpass";
    tone.frequency.value = room.tilt;
    tone.Q.value = 0.6;
    tone.connect(bed);

    var voices = [];
    [0, 1, 2].forEach(function (i) {
      var osc = ac.createOscillator();
      osc.type = i === 0 ? "sine" : "triangle";
      osc.frequency.value = room.root * semi(room.mode[i]) * (i === 2 ? 2 : 1);
      osc.detune.value = (i - 1) * 6;
      var g = ac.createGain();
      g.gain.value = i === 0 ? 0.5 : 0.22;
      /* each voice breathes on its own cycle, so the chord never sits still */
      var lfo = ac.createOscillator();
      lfo.frequency.value = 0.017 + i * 0.011;
      var depth = ac.createGain();
      depth.gain.value = i === 0 ? 0.16 : 0.12;
      lfo.connect(depth);
      depth.connect(g.gain);
      osc.connect(g);
      g.connect(tone);
      osc.start();
      lfo.start();
      voices.push({ osc: osc, gain: g, degree: i });
    });

    /* --- the air of the room --- */
    var air = ac.createBufferSource();
    air.buffer = noiseBuffer(ac, 4);
    air.loop = true;
    var airBand = ac.createBiquadFilter();
    airBand.type = "bandpass";
    airBand.frequency.value = 320;
    airBand.Q.value = 0.8;
    var airGain = ac.createGain();
    airGain.gain.value = 0.02 * room.air;
    var airLfo = ac.createOscillator();
    airLfo.frequency.value = 0.031;
    var airDepth = ac.createGain();
    airDepth.gain.value = 140;
    airLfo.connect(airDepth);
    airDepth.connect(airBand.frequency);
    air.connect(airBand);
    airBand.connect(airGain);
    airGain.connect(bed);
    air.start();
    airLfo.start();

    /* --- the ether: what the cursor stirs up as it moves --- */
    var ether = ac.createGain();
    ether.connect(space);
    var eNoise = ac.createBufferSource();
    eNoise.buffer = noiseBuffer(ac, 4);
    eNoise.loop = true;
    var etherBand = ac.createBiquadFilter();
    etherBand.type = "bandpass";
    etherBand.frequency.value = 200;
    etherBand.Q.value = 0.6;
    var etherGain = ac.createGain();
    etherGain.gain.value = 0;
    eNoise.connect(etherBand);
    etherBand.connect(etherGain);
    etherGain.connect(ether);
    eNoise.start();

    return { ac: ac, master: master, meter: meter, space: space, bed: bed,
             voices: voices, etherGain: etherGain, etherBand: etherBand };
  }

  /* one small sound, struck into a graph at a given time */
  function pluck(g, room, degree, level, bright, when) {
    var ac = g.ac, t = when == null ? ac.currentTime : when;
    var out = ac.createGain();
    out.gain.setValueAtTime(0, t);
    out.gain.linearRampToValueAtTime(level, t + 0.006);
    out.gain.exponentialRampToValueAtTime(0.0001, t + 0.26);
    var hp = ac.createBiquadFilter();
    hp.type = "highpass";
    hp.frequency.value = 180;
    out.connect(hp);
    hp.connect(g.space);
    [1, 2.004].forEach(function (mult, i) {
      var o = ac.createOscillator();
      o.type = i ? "sine" : "triangle";
      o.frequency.value = room.root * 4 * semi(degree) * mult * (bright ? 1.5 : 1);
      var vg = ac.createGain();
      vg.gain.value = i ? 0.3 : 1;
      o.connect(vg);
      vg.connect(out);
      o.start(t);
      o.stop(t + 0.3);
    });
  }

  /* ---------- the switch in the nav ----------
     Injected rather than written into ten pages: the control cannot work
     without this script, so it should not exist without it either. */
  var nav = document.querySelector(".nav");
  var btn = null;
  if (nav) {
    btn = document.createElement("button");
    btn.type = "button";
    btn.className = "nav__sound";
    btn.id = "soundToggle";
    btn.setAttribute("aria-pressed", "false");
    btn.setAttribute("aria-label", "Sound");
    btn.innerHTML =
      '<svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">' +
      '<path class="nav__sound-core" d="M4 9.5h3.2L11.6 6v12L7.2 14.5H4z"/>' +
      '<path class="nav__sound-a" d="M14.6 9.2c1 1 1 4.6 0 5.6"/>' +
      '<path class="nav__sound-b" d="M17.4 6.6c2.3 2.4 2.3 8.4 0 10.8"/>' +
      '<path class="nav__sound-off" d="M15 9l6 6M21 9l-6 6"/>' +
      "</svg>";
    var cta = nav.querySelector(".nav__cta");
    if (cta) nav.insertBefore(btn, cta); else nav.appendChild(btn);
  }

  /* ---------- state ---------- */
  var G = null, on = false, ducked = false, raf = 0, moved1 = false;
  var px = 0.5, py = 0.5, lastX = 0, lastY = 0, speed = 0, lastTick = 0, chordT = 0;

  function say(state) {
    if (!btn) return;
    btn.setAttribute("aria-pressed", state ? "true" : "false");
    btn.classList.toggle("is-on", !!state);
    btn.setAttribute("aria-label", state ? "Sound on" : "Sound off");
  }

  /* ---------- moving through it ---------- */
  function follow() {
    raf = 0;
    if (!on || !G) return;
    var t = G.ac.currentTime, quiet = ducked ? 0 : 1;
    /* below a real gesture there is nothing at all: resting the hand,
       reaching for a link, nudging the page must all be silent */
    var reach = Math.max(0, Math.min(1, (speed - 9) / 34));
    reach *= reach;                                   /* and it starts gently */
    G.etherGain.gain.setTargetAtTime(0.020 * reach * quiet, t, reach > 0.02 ? 0.40 : 1.20);
    G.etherBand.frequency.setTargetAtTime(90 + py * 430 + reach * 180, t, 0.55);
    speed *= 0.90;

    if (t > chordT) {                     /* one voice steps to another degree */
      chordT = t + 16 + Math.random() * 18;
      var v = G.voices[1 + Math.floor(Math.random() * 2)];
      var d = room.mode[1 + Math.floor(Math.random() * (room.mode.length - 1))];
      v.osc.frequency.setTargetAtTime(room.root * semi(d) * (v.degree === 2 ? 2 : 1), t, 6);
    }

    if (speed > 0.05) raf = requestAnimationFrame(follow);
    else G.etherGain.gain.setTargetAtTime(0, t, 1.2);   /* it takes its time leaving */
  }

  function moved(e) {
    if (!on) return;
    var x = e.clientX, y = e.clientY;
    if (moved1) {
      var dx = x - lastX, dy = y - lastY;
      speed = Math.min(60, speed + Math.sqrt(dx * dx + dy * dy));
    }
    moved1 = true; lastX = x; lastY = y;
    px = Math.max(0, Math.min(1, x / innerWidth));
    py = Math.max(0, Math.min(1, y / innerHeight));
    if (!raf) raf = requestAnimationFrame(follow);
  }

  /* ---------- the small sounds ---------- */
  function degreeFor(el) {
    var i = 0;
    if (el.closest("a")) i = 2;
    if (el.closest(".nav, .menu")) i = 4;
    if (el.closest("button, [role=button], .trk, .vitem, .film__play")) i = 1;
    return room.mode[i % room.mode.length];
  }
  document.addEventListener("pointerdown", function (e) {
    if (!on || !G || ducked || !e.target.closest) return;
    if (!e.target.closest("a, button, [role=button], .trk, .vitem, .film__play, .portal, label, input, select")) return;
    pluck(G, room, degreeFor(e.target), 0.075, false);
  }, true);
  /* ---------- her work always wins ---------- */
  function duck(yes) {
    ducked = !!yes;
    if (!G || !on) return;
    var t = G.ac.currentTime;
    G.bed.gain.setTargetAtTime(ducked ? DUCKED : BED, t, ducked ? 0.25 : 1.4);
    if (ducked) G.etherGain.gain.setTargetAtTime(0, t, 0.2);
  }
  document.addEventListener("cherry:media", function (e) {
    duck(!(e.detail && e.detail.playing === false));
  });
  document.addEventListener("play", function () { duck(true); }, true);
  ["pause", "ended"].forEach(function (kind) {
    document.addEventListener(kind, function () {
      var live = [].slice.call(document.querySelectorAll("audio, video"))
        .some(function (m) { return !m.paused && !m.ended; });
      if (!live) duck(false);
    }, true);
  });

  /* ---------- on, off, and remembered ---------- */
  function start() {
    if (!G) G = graph(new Ctx(), room);
    if (G.ac.state === "suspended") G.ac.resume();
    on = true;
    var t = G.ac.currentTime;
    G.master.gain.setTargetAtTime(1, t, 1.6);            /* it arrives, never snaps */
    G.bed.gain.setTargetAtTime(ducked ? DUCKED : BED, t, 1.6);
    chordT = t + 14;
    say(true);
    try { localStorage.setItem(KEY, "on"); } catch (err) {}
    addEventListener("pointermove", moved, { passive: true });
  }
  function stop(remember) {
    on = false;
    say(false);
    removeEventListener("pointermove", moved);
    if (raf) { cancelAnimationFrame(raf); raf = 0; }
    if (G) {
      G.master.gain.setTargetAtTime(0, G.ac.currentTime, 0.35);
      var c = G.ac;
      setTimeout(function () { if (!on && c.state === "running") c.suspend(); }, 1400);
    }
    if (remember !== false) { try { localStorage.setItem(KEY, "off"); } catch (err) {} }
  }
  if (btn) btn.addEventListener("click", function () { on ? stop() : start(); });

  /* Turned on once, it comes back on the next page; the browser still
     wants a gesture first, so the very first move or touch resumes it. */
  var want = null;
  try { want = localStorage.getItem(KEY); } catch (err) {}
  if (want === "on") {
    say(true);
    var keys = ["pointerdown", "pointermove", "keydown", "touchstart", "wheel"];
    var wake = function () {
      keys.forEach(function (k) { removeEventListener(k, wake); });
      start();
    };
    keys.forEach(function (k) { addEventListener(k, wake, { passive: true }); });
  }

  /* leaving the tab should leave silence behind */
  document.addEventListener("visibilitychange", function () {
    if (!G || !on) return;
    if (document.hidden) G.ac.suspend(); else G.ac.resume();
  });

  /* ---------- measuring, and auditioning ----------
     level() answers "is this making a sound, and how loud", which is the
     only way to check a room tone without ears. _render() bounces any
     room to a buffer offline, so one can be heard without visiting it. */
  function level() {
    if (!G || !G.meter) return 0;
    var buf = new Float32Array(G.meter.fftSize);
    G.meter.getFloatTimeDomainData(buf);
    var sum = 0;
    for (var i = 0; i < buf.length; i++) sum += buf[i] * buf[i];
    return Math.sqrt(sum / buf.length);
  }
  function render(which, seconds, opts) {
    var r = ROOMS[which] || room, secs = seconds || 18;
    opts = opts || {};
    var OC = window.OfflineAudioContext || window.webkitOfflineAudioContext;
    var oc = new OC(2, 44100 * secs, 44100);
    var g = graph(oc, r);
    if (opts.bed === false) g.bed.gain.value = 0;
    g.master.gain.setValueAtTime(0, 0);
    g.master.gain.linearRampToValueAtTime(1, 2.2);
    /* a hand crossing the page, twice, then two small sounds */
    [[3.0, 0.55, 0.30], [3.6, 0.9, 0.42], [4.4, 0.35, 0.7], [5.2, 0.8, 0.5],
     [9.0, 0.5, 0.25], [9.7, 0.95, 0.6], [10.5, 0.2, 0.8]].forEach(function (m) {
      var t = m[0], reach = m[1], y = m[2];
      g.etherGain.gain.setTargetAtTime(0.020 * reach * reach, t, 0.40);
      g.etherBand.frequency.setTargetAtTime(90 + y * 430 + reach * 180, t, 0.55);
      g.etherGain.gain.setTargetAtTime(0, t + 0.9, 1.2);
    });
    pluck(g, r, r.mode[1], 0.075, false, 7.0);
    pluck(g, r, r.mode[2], 0.075, false, 7.5);
    g.voices[1].osc.frequency.setTargetAtTime(r.root * semi(r.mode[3]), 13, 5);
    return oc.startRendering();
  }

  window.CherrySound = {
    on: function () { return on; }, start: start, stop: stop,
    room: room.name, rooms: Object.keys(ROOMS), level: level, render: render,
    _ac: function () { return G && G.ac; }, _out: function () { return G && G.master; }
  };
})();
