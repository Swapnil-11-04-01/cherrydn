/* ============================================================
   SEVEN NUMBERS INTO A WHOLE PALETTE

   Cherry moves seven sliders. This turns them into the thirty-odd
   colours the site is built from.

   The rule the whole thing rests on:

       solve the beauty, clamp the failure.

   The pleasant relationships between her colours are fixed, and
   they are the ones her site already has, so the middle of every
   slider reproduces the site exactly as she knows it. The
   readability rules are one-directional floors: they only ever
   push a colour in the safe direction, and only when it would
   otherwise fall through. Solving every colour down to its minimum
   ratio instead would hand back a grey, obedient site with the
   13.7:1 chasm between her ink and her ground flattened out, and
   that chasm IS this site.

   Lightness is solved against WCAG relative luminance, never
   against OKLCh L, because L is not monotonic in luminance across
   hue: --red-t sits at L 0.584 and luminance 0.181 while --muted
   at L 0.757 reaches 0.432. Solving against L would silently let
   contrast collapse at some hues and not others.

   Chroma is clamped, never lightness. Clamping chroma keeps the
   luminance, and therefore the contrast, exactly where it was
   solved. Letting the browser clip out-of-gamut channels does not.

   This never runs on her public site. Her Studio solves the
   palette and stores the finished colours; a visitor only ever
   receives a flat list of names and values, so a mistake in here
   can never reach a reader.
   ============================================================ */
window.CherrySolve = (function () {
  "use strict";

  /* ---------- OKLab, and back to something a screen can show ---------- */
  function oklchToRgb(L, C, H) {
    var h = H * Math.PI / 180, a = C * Math.cos(h), b = C * Math.sin(h);
    var l_ = L + 0.3963377774 * a + 0.2158037573 * b;
    var m_ = L - 0.1055613458 * a - 0.0638541728 * b;
    var s_ = L - 0.0894841775 * a - 1.2914855480 * b;
    var l = l_ * l_ * l_, m = m_ * m_ * m_, s = s_ * s_ * s_;
    return [
      4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s,
      -1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s,
      -0.0041960863 * l - 0.7034186147 * m + 1.7076147010 * s
    ];
  }
  function gamma(c) {
    return c <= 0.0031308 ? 12.92 * c : 1.055 * Math.pow(c, 1 / 2.4) - 0.055;
  }
  function inGamut(lin) {
    for (var i = 0; i < 3; i++) if (lin[i] < -0.0001 || lin[i] > 1.0001) return false;
    return true;
  }
  function rgb255(L, C, H) {
    var lin = oklchToRgb(L, C, H), out = [];
    for (var i = 0; i < 3; i++) {
      out.push(Math.max(0, Math.min(255, Math.round(gamma(Math.max(0, Math.min(1, lin[i]))) * 255))));
    }
    return out;
  }
  /* the most colour this lightness and hue can actually hold on a screen */
  function gmax(L, H) {
    var lo = 0, hi = 0.45;
    for (var i = 0; i < 28; i++) {
      var mid = (lo + hi) / 2;
      if (inGamut(oklchToRgb(L, mid, H))) lo = mid; else hi = mid;
    }
    return lo;
  }

  /* ---------- the readability arithmetic ---------- */
  function lin1(c) { c /= 255; return c <= 0.04045 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4); }
  function Y(rgb) { return 0.2126 * lin1(rgb[0]) + 0.7152 * lin1(rgb[1]) + 0.0722 * lin1(rgb[2]); }
  function CR(a, b) {
    var ya = Y(a), yb = Y(b), hi = Math.max(ya, yb), lo = Math.min(ya, yb);
    return (hi + 0.05) / (lo + 0.05);
  }
  /* what a translucent colour actually becomes once it is laid over another */
  function over(fg, alpha, bg) {
    return [0, 1, 2].map(function (i) { return Math.round(fg[i] * alpha + bg[i] * (1 - alpha)); });
  }
  function hex(rgb) {
    return "#" + rgb.map(function (v) { return ("0" + v.toString(16)).slice(-2).toUpperCase(); }).join("");
  }

  /* the lightness at which this hue and chroma reach an exact ratio */
  function solveL(H, C, ground, want) {
    var lo = 0, hi = 1;
    for (var i = 0; i < 30; i++) {
      var mid = (lo + hi) / 2;
      var c = Math.min(C, gmax(mid, H));
      if (CR(rgb255(mid, c, H), ground) < want) lo = mid; else hi = mid;
    }
    return hi;
  }
  /* leave a lightness alone unless it fails, then lift it only as far as it must go */
  function raise(L, C, H, ground, want, capL) {
    var c = Math.min(C, gmax(L, H));
    if (CR(rgb255(L, c, H), ground) >= want) return L;
    var need = solveL(H, C, ground, want);
    return capL == null ? need : Math.min(need, capL);
  }
  function at(L, C, H) { return rgb255(L, Math.min(C, gmax(L, H)), H); }

  /* the way back: a pixel out of one of her paintings, into a hue */
  function rgbToOklch(r, g, b) {
    var R = lin1(r), G2 = lin1(g), B = lin1(b);
    var l = Math.cbrt(0.4122214708 * R + 0.5363325363 * G2 + 0.0514459929 * B);
    var m = Math.cbrt(0.2119034982 * R + 0.6806995451 * G2 + 0.1073969566 * B);
    var s2 = Math.cbrt(0.0883024619 * R + 0.2817188376 * G2 + 0.6299787005 * B);
    var L = 0.2104542553 * l + 0.7936177850 * m - 0.0040720468 * s2;
    var A = 1.9779984951 * l - 2.4285922050 * m + 0.4505937099 * s2;
    var Bb = 0.0259040371 * l + 0.7827717662 * m - 0.8086757660 * s2;
    var C = Math.sqrt(A * A + Bb * Bb);
    var H = (Math.atan2(Bb, A) * 180 / Math.PI + 360) % 360;
    return { L: L, C: C, H: H };
  }

  /* The fire can only burn through the reds: 338 degrees round to 62. A hue
     from her painting that falls outside that arc is put at whichever end is
     nearer, and she is told, rather than being silently moved. */
  var FIRE_FROM = 338, FIRE_SPAN = 84;
  function hueToFire(H) {
    var rel = ((H - FIRE_FROM) % 360 + 360) % 360;
    if (rel <= FIRE_SPAN) return { f: rel / FIRE_SPAN, exact: true };
    /* outside the arc: which end is closer, going the short way round */
    var toStart = Math.min(((FIRE_FROM - H) % 360 + 360) % 360, ((H - FIRE_FROM) % 360 + 360) % 360);
    var end = (FIRE_FROM + FIRE_SPAN) % 360;
    var toEnd = Math.min(((end - H) % 360 + 360) % 360, ((H - end) % 360 + 360) % 360);
    return { f: toStart <= toEnd ? 0 : 1, exact: false };
  }

  var DEFAULTS = { d: 0.530, hg: 203.1, t: 0.835, f: 0.470, w: 0.557, a: 0.550, gr: 0.310 };

  function generate(seed) {
    var s = {}, k;
    for (k in DEFAULTS) s[k] = (seed && typeof seed[k] === "number") ? seed[k] : DEFAULTS[k];
    var d = Math.max(0, Math.min(1, s.d)), t = Math.max(0, Math.min(1, s.t));
    var f = Math.max(0, Math.min(1, s.f)), w = Math.max(0, Math.min(1, s.w));
    var a = Math.max(0, Math.min(1, s.a)), gr = Math.max(0, Math.min(1, s.gr));
    var hg = ((s.hg % 360) + 360) % 360;

    var Lg = 0.275 - 0.150 * d;          /* how deep she is */
    var cg = 0.017;                      /* the ground is never allowed to be colourful */
    var ha = (338 + 84 * f) % 360;       /* the fire only burns through the reds */
    var Ca = 0.075 + 0.085 * t;
    var hi_ = (hg + 224 + (w - 0.5) * 60 + 360) % 360;
    var ci = 0.008 + 0.016 * w;

    var bg   = at(Lg, cg, hg);
    var bg2  = at(Lg + 0.029, cg * 1.16, (hg + 5) % 360);

    /* Her words do not sit on the ground. They sit on whatever the mist
       composites to, and the music page floods a red wash under text. So
       ink and muted are solved against the worst thing underneath them,
       and if that leaves no room, the mist is thinned rather than her
       sentences. She loses some weather; she never loses a word. */
    var alpha = 0.35 + 0.65 * a, ink, muted, tide, G;
    for (var guard = 0; guard < 40; guard++) {
      tide = at(Math.min(Lg + 0.150, 0.44), Math.min(0.045, gmax(Math.min(Lg + 0.150, 0.44), hg)), hg);
      var red0 = at(0.360 + 0.354 * Lg, Ca, ha);
      var cands = [bg2, over(red0, 0.72 * alpha, bg2), over(tide, 0.55 * alpha, bg2)];
      G = cands.reduce(function (p, c) { return Y(c) > Y(p) ? c : p; }, cands[0]);

      /* seven against the worst composited ground, and eleven against the
         bare ground: the second is not a legibility rule, it is the chasm
         between her ink and her dark that the site is actually made of.
         Shallow water is where it comes closest, so it is asked for by
         name rather than hoped for. */
      var Li = raise(0.905, ci, hi_, G, 7.0, 0.940);
      Li = Math.max(Li, Math.min(0.940, raise(Li, ci, hi_, bg, 11.0, 0.940)));
      ink = at(Li, ci, hi_);
      var Lm = raise(Li - 0.148, ci * 1.18, (hi_ - 3 + 360) % 360, G, 4.5, Li - 0.055);
      muted = at(Lm, ci * 1.18, (hi_ - 3 + 360) % 360);
      var okInk = CR(ink, G) >= 6.99 && Li <= 0.9401;
      var okMut = CR(muted, G) >= 4.49 && Lm <= Li - 0.0549;
      if ((okInk && okMut) || alpha <= 0.3501) break;
      alpha = Math.max(0.35, alpha - 0.02);
    }
    /* the red ladder: a display red that only has to clear large text, and a
       text red that has to clear body text on the PANELS as well as the
       ground, because the panels are the lighter of the two */
    var Lr = 0.360 + 0.354 * Lg, red = at(Lr, Ca, ha);
    while (CR(ink, red) < 4.5 && Lr > 0.20) { Lr -= 0.005; red = at(Lr, Ca, ha); }
    var redDisplay = at(solveL(ha, Ca * 1.06, bg, 3.05), Ca * 1.06, ha);
    var redText = at(solveL(ha, Ca * 0.97, bg2, 4.55), Ca * 0.97, ha);

    var steel  = at(raise(Lg + 0.347, Math.min(cg * 1.60, 0.030), hg, bg, 3.05), Math.min(cg * 1.60, 0.030), hg);
    var steelT = at(raise(Lg + 0.600, Math.min(cg * 1.60, 0.030) * 0.72, hg, bg, 4.5), Math.min(cg * 1.60, 0.030) * 0.72, hg);

    /* the derived families hang off ink's lightness, so recover it */
    var inkL = (function () {
      var lo = 0, hi2 = 1;
      for (var i = 0; i < 24; i++) {
        var mid = (lo + hi2) / 2;
        if (Y(at(mid, ci, hi_)) < Y(ink)) lo = mid; else hi2 = mid;
      }
      return hi2;
    })();

    var warm    = at(raise(inkL - 0.129, Math.min(Ca * 0.40, 0.060), (hi_ + 8) % 360, bg, 4.5), Math.min(Ca * 0.40, 0.060), (hi_ + 8) % 360);
    var elWater = at(raise(inkL - 0.244, Math.min(Ca * 0.35, 0.052), (hg + 11) % 360, bg, 4.5), Math.min(Ca * 0.35, 0.052), (hg + 11) % 360);
    var elEarth = at(raise(inkL - 0.177, Math.min(Ca * 0.48, 0.070), (hi_ + 8) % 360, bg, 4.5), Math.min(Ca * 0.48, 0.070), (hi_ + 8) % 360);
    var elAir   = at(raise(inkL - 0.089, cg * 1.10, (hi_ + 11) % 360, bg, 4.5), cg * 1.10, (hi_ + 11) % 360);

    /* the washed accent: as much red as can be kept while staying readable */
    var redInk = redText, m;
    for (m = 0.80; m >= 0.34; m -= 0.02) {
      var mixed = [0, 1, 2].map(function (i) { return Math.round(redText[i] * m + ink[i] * (1 - m)); });
      if (CR(mixed, G) >= 4.5) { redInk = mixed; break; }
    }

    /* the hairline: solved so it is just visible and never a fence */
    var la = 0.16;
    for (var A = 0.10; A <= 0.2201; A += 0.002) {
      if (CR(over(muted, A, bg), bg) >= 1.330) { la = A; break; }
      la = A;
    }

    var out = {
      "--bg": hex(bg), "--bg2": hex(bg2),
      "--bg-lift": hex(at(Lg + 0.024, cg * 0.95, hg)),
      "--bg-sink": hex(at(Math.max(0.02, Lg - 0.030), cg * 0.90, hg)),
      "--tide": hex(tide),
      "--grade": hex(at(Math.max(0.02, Lg - 0.023), cg * 1.07, (hi_ - 12 + 360) % 360)),
      "--ink": hex(ink), "--muted": hex(muted),
      "--line": "rgba(" + muted[0] + ", " + muted[1] + ", " + muted[2] + ", " + la.toFixed(3) + ")",
      "--red": hex(red), "--red-display": hex(redDisplay), "--red-t": hex(redText),
      "--red-ink": hex(redInk),
      "--steel": hex(steel), "--steel-t": hex(steelT), "--warm": hex(warm),
      "--el-water": hex(elWater), "--el-earth": hex(elEarth), "--el-air": hex(elAir),
      "--atm": alpha.toFixed(3), "--wash": alpha.toFixed(3),
      "--grain": (0.018 + 0.055 * gr).toFixed(4)
    };
    out.__meta = { alpha: alpha, thinned: alpha < 0.35 + 0.65 * a - 0.0001, ground: hex(G) };
    return out;
  }

  /* every floor the palette must never fall through, checked on a finished set */
  function check(vars) {
    function px(h) {
      if (h.charAt(0) === "#") { h = h.slice(1); return [0, 2, 4].map(function (i) { return parseInt(h.substr(i, 2), 16); }); }
      var m = h.match(/[\d.]+/g); return [ +m[0], +m[1], +m[2] ];
    }
    var bg = px(vars["--bg"]), bg2 = px(vars["--bg2"]), ink = px(vars["--ink"]);
    var bad = [];
    function need(name, fg, ground, min) {
      var r = CR(px(fg), ground);
      if (r < min - 0.02) bad.push(name + " " + r.toFixed(2) + " < " + min);
      return r;
    }
    need("ink/bg", vars["--ink"], bg, 11.0);
    need("muted/bg", vars["--muted"], bg, 6.5);
    need("red-t/bg2", vars["--red-t"], bg2, 4.5);
    need("red-display/bg", vars["--red-display"], bg, 3.0);
    need("steel/bg", vars["--steel"], bg, 3.0);
    need("steel-t/bg", vars["--steel-t"], bg, 4.5);
    need("warm/bg", vars["--warm"], bg, 4.5);
    need("el-water/bg", vars["--el-water"], bg, 4.5);
    need("el-earth/bg", vars["--el-earth"], bg, 4.5);
    need("el-air/bg", vars["--el-air"], bg, 4.5);
    var r = CR(ink, px(vars["--red"]));
    if (r < 4.48) bad.push("ink/red " + r.toFixed(2) + " < 4.5");
    return bad;
  }

  return { generate: generate, check: check, DEFAULTS: DEFAULTS,
           CR: CR, hex: hex, at: at, gmax: gmax, over: over,
           rgbToOklch: rgbToOklch, hueToFire: hueToFire };
})();

if (typeof module !== "undefined" && module.exports) module.exports = window.CherrySolve;
