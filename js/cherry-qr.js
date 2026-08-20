/* ============================================================
   THE CODE THAT GOES INSIDE THE COVER

   A QR code, made here rather than fetched from someone else's
   server, because this one gets printed into a book and has to
   keep working for as long as the book exists. Nothing to
   install, nothing to call, no third party who has to still be
   alive in ten years.

   Model 2, byte mode, versions 1 to 10. A web address is short,
   and a low version means fat modules, which is what survives
   ink on paper. Error correction defaults to H: thirty percent
   of the code can be scuffed, smudged or covered and the phone
   still reads it.
   ============================================================ */
window.CherryQR = (function () {
  "use strict";

  /* ---------- arithmetic in GF(256), the field QR is built on ---------- */
  var EXP = new Uint8Array(512), LOG = new Uint8Array(256);
  (function () {
    var x = 1;
    for (var i = 0; i < 255; i++) { EXP[i] = x; LOG[x] = i; x <<= 1; if (x & 0x100) x ^= 0x11D; }
    for (var j = 255; j < 512; j++) EXP[j] = EXP[j - 255];
  })();
  function mul(a, b) { return (a === 0 || b === 0) ? 0 : EXP[LOG[a] + LOG[b]]; }

  /* g(x) = (x - a^0)(x - a^1)...(x - a^(n-1)), highest power first */
  function genPoly(n) {
    var g = [1];
    for (var i = 0; i < n; i++) {
      var ng = new Array(g.length + 1);
      for (var z = 0; z < ng.length; z++) ng[z] = 0;
      for (var j = 0; j < g.length; j++) {
        ng[j] ^= g[j];
        ng[j + 1] ^= mul(g[j], EXP[i]);
      }
      g = ng;
    }
    return g;
  }
  /* the remainder is the error correction, which is the whole trick */
  function remainder(data, n) {
    var g = genPoly(n), res = data.slice(), i, j;
    for (i = 0; i < n; i++) res.push(0);
    for (i = 0; i < data.length; i++) {
      var c = res[i];
      if (!c) continue;
      for (j = 0; j < g.length; j++) res[i + j] ^= mul(g[j], c);
    }
    return res.slice(data.length);
  }

  /* ---------- how each version is cut into blocks ----------
     [ec codewords per block, blocks in group 1, data codewords each,
      blocks in group 2, data codewords each]  ISO/IEC 18004 table 9 */
  var BLOCKS = {
    L: [null,
      [7, 1, 19, 0, 0], [10, 1, 34, 0, 0], [15, 1, 55, 0, 0], [20, 1, 80, 0, 0],
      [26, 1, 108, 0, 0], [18, 2, 68, 0, 0], [20, 2, 78, 0, 0], [24, 2, 97, 0, 0],
      [30, 2, 116, 0, 0], [18, 2, 68, 2, 69]],
    M: [null,
      [10, 1, 16, 0, 0], [16, 1, 28, 0, 0], [26, 1, 44, 0, 0], [18, 2, 32, 0, 0],
      [24, 2, 43, 0, 0], [16, 4, 27, 0, 0], [18, 4, 31, 0, 0], [22, 2, 38, 2, 39],
      [22, 3, 36, 2, 37], [26, 4, 43, 1, 44]],
    Q: [null,
      [13, 1, 13, 0, 0], [22, 1, 22, 0, 0], [18, 2, 17, 0, 0], [26, 2, 24, 0, 0],
      [18, 2, 15, 2, 16], [24, 4, 19, 0, 0], [18, 2, 14, 4, 15], [22, 4, 18, 2, 19],
      [20, 4, 16, 4, 17], [24, 6, 19, 2, 20]],
    H: [null,
      [17, 1, 9, 0, 0], [28, 1, 16, 0, 0], [22, 2, 13, 0, 0], [16, 4, 9, 0, 0],
      [22, 2, 11, 2, 12], [28, 4, 15, 0, 0], [26, 4, 13, 1, 14], [26, 4, 14, 2, 15],
      [24, 4, 12, 4, 13], [28, 6, 15, 2, 16]]
  };
  var ALIGN = [null, [], [6, 18], [6, 22], [6, 26], [6, 30], [6, 34],
    [6, 22, 38], [6, 24, 42], [6, 26, 46], [6, 28, 50]];
  var ECBITS = { L: 1, M: 0, Q: 3, H: 2 };
  var MAXV = 10;

  function dataCodewords(v, ecc) {
    var b = BLOCKS[ecc][v];
    return b[1] * b[2] + b[3] * b[4];
  }

  /* ---------- text in, codewords out ---------- */
  function utf8(s) {
    var out = [], i, c;
    for (i = 0; i < s.length; i++) {
      c = s.charCodeAt(i);
      if (c < 0x80) out.push(c);
      else if (c < 0x800) out.push(0xC0 | (c >> 6), 0x80 | (c & 63));
      else if (c >= 0xD800 && c <= 0xDBFF && i + 1 < s.length) {
        var c2 = s.charCodeAt(++i);
        var u = 0x10000 + ((c - 0xD800) << 10) + (c2 - 0xDC00);
        out.push(0xF0 | (u >> 18), 0x80 | ((u >> 12) & 63), 0x80 | ((u >> 6) & 63), 0x80 | (u & 63));
      } else out.push(0xE0 | (c >> 12), 0x80 | ((c >> 6) & 63), 0x80 | (c & 63));
    }
    return out;
  }

  function bitStream() {
    var bits = [];
    return {
      put: function (val, len) { for (var i = len - 1; i >= 0; i--) bits.push((val >> i) & 1); },
      len: function () { return bits.length; },
      bits: bits
    };
  }

  function codewordsFor(bytes, v, ecc) {
    var cap = dataCodewords(v, ecc) * 8;
    var cci = v < 10 ? 8 : 16;
    var bs = bitStream();
    bs.put(4, 4);                 /* byte mode */
    bs.put(bytes.length, cci);
    for (var i = 0; i < bytes.length; i++) bs.put(bytes[i], 8);
    /* terminator, then out to a whole byte, then the two pad bytes forever */
    bs.put(0, Math.min(4, cap - bs.len()));
    while (bs.len() % 8) bs.bits.push(0);
    var cw = [];
    for (i = 0; i < bs.bits.length; i += 8) {
      var b = 0;
      for (var j = 0; j < 8; j++) b = (b << 1) | bs.bits[i + j];
      cw.push(b);
    }
    var pad = [0xEC, 0x11], p = 0;
    while (cw.length < cap / 8) cw.push(pad[p++ % 2]);
    return cw;
  }

  /* blocks are interleaved: one codeword from each block in turn */
  function weave(cw, v, ecc) {
    var spec = BLOCKS[ecc][v], ecLen = spec[0];
    var groups = [], at = 0, i, k;
    for (i = 0; i < spec[1]; i++) { groups.push(cw.slice(at, at + spec[2])); at += spec[2]; }
    for (i = 0; i < spec[3]; i++) { groups.push(cw.slice(at, at + spec[4])); at += spec[4]; }
    var ecs = groups.map(function (g) { return remainder(g, ecLen); });

    var out = [], most = 0;
    for (i = 0; i < groups.length; i++) most = Math.max(most, groups[i].length);
    for (k = 0; k < most; k++)
      for (i = 0; i < groups.length; i++)
        if (k < groups[i].length) out.push(groups[i][k]);
    for (k = 0; k < ecLen; k++)
      for (i = 0; i < ecs.length; i++) out.push(ecs[i][k]);
    return out;
  }

  /* ---------- the picture ---------- */
  function blank(n) {
    var m = [], i, j;
    for (i = 0; i < n; i++) { m.push([]); for (j = 0; j < n; j++) m[i].push(null); }
    return m;
  }
  function finder(m, r, c) {
    for (var i = -1; i <= 7; i++) for (var j = -1; j <= 7; j++) {
      var y = r + i, x = c + j;
      if (y < 0 || x < 0 || y >= m.length || x >= m.length) continue;
      var on = (i >= 0 && i <= 6 && (j === 0 || j === 6)) ||
               (j >= 0 && j <= 6 && (i === 0 || i === 6)) ||
               (i >= 2 && i <= 4 && j >= 2 && j <= 4);
      m[y][x] = on ? 1 : 0;
    }
  }
  function skeleton(v) {
    var n = v * 4 + 17, m = blank(n), i, j;
    finder(m, 0, 0); finder(m, 0, n - 7); finder(m, n - 7, 0);
    for (i = 8; i < n - 8; i++) { var on = i % 2 === 0 ? 1 : 0; m[6][i] = on; m[i][6] = on; }
    /* Alignment patterns sit at every crossing of these coordinates except
       the three that would land on a finder. The other exclusion people
       reach for, "skip it if something is already drawn there", is wrong
       from version 7 on: those versions put alignment patterns astride the
       timing row and column on purpose, and dropping them shifts every
       data module after it. */
    var pos = ALIGN[v], last = pos.length - 1;
    for (i = 0; i <= last; i++) for (j = 0; j <= last; j++) {
      if ((i === 0 && j === 0) || (i === 0 && j === last) || (i === last && j === 0)) continue;
      var r = pos[i], c = pos[j];
      for (var y = -2; y <= 2; y++) for (var x = -2; x <= 2; x++)
        m[r + y][c + x] = (Math.max(Math.abs(y), Math.abs(x)) !== 1) ? 1 : 0;
    }
    m[n - 8][8] = 1;                              /* the one module always dark */
    return m;
  }
  /* the squares reserved for format and version, so data steps over them */
  function reserved(v) {
    var n = v * 4 + 17, r = blank(n), i, j;
    for (i = 0; i < 9; i++) { r[8][i] = 1; r[i][8] = 1; }
    for (i = 0; i < 8; i++) { r[8][n - 1 - i] = 1; r[n - 1 - i][8] = 1; }
    if (v >= 7) for (i = 0; i < 6; i++) for (j = 0; j < 3; j++) {
      r[n - 11 + j][i] = 1; r[i][n - 11 + j] = 1;
    }
    return r;
  }

  function place(m, res, bytes) {
    var n = m.length, bit = 0, total = bytes.length * 8;
    function next() {
      if (bit >= total) return 0;
      var b = (bytes[bit >> 3] >> (7 - (bit & 7))) & 1;
      bit++;
      return b;
    }
    var up = true;
    for (var right = n - 1; right > 0; right -= 2) {
      if (right === 6) right = 5;                 /* the timing column is not data */
      for (var step = 0; step < n; step++) {
        var row = up ? n - 1 - step : step;
        for (var k = 0; k < 2; k++) {
          var col = right - k;
          if (m[row][col] !== null || res[row][col]) continue;
          m[row][col] = next();
        }
      }
      up = !up;
    }
  }

  var MASKS = [
    function (i, j) { return (i + j) % 2 === 0; },
    function (i) { return i % 2 === 0; },
    function (i, j) { return j % 3 === 0; },
    function (i, j) { return (i + j) % 3 === 0; },
    function (i, j) { return (Math.floor(i / 2) + Math.floor(j / 3)) % 2 === 0; },
    function (i, j) { return ((i * j) % 2) + ((i * j) % 3) === 0; },
    function (i, j) { return (((i * j) % 2) + ((i * j) % 3)) % 2 === 0; },
    function (i, j) { return (((i + j) % 2) + ((i * j) % 3)) % 2 === 0; }
  ];

  /* BCH(15,5) for the format, BCH(18,6) for the version */
  function formatBits(ecc, mask) {
    var d = (ECBITS[ecc] << 3) | mask, v = d << 10;
    for (var i = 4; i >= 0; i--) if (v & (1 << (i + 10))) v ^= 0x537 << i;
    return ((d << 10) | v) ^ 0x5412;
  }
  function versionBits(ver) {
    var v = ver << 12;
    for (var i = 5; i >= 0; i--) if (v & (1 << (i + 12))) v ^= 0x1F25 << i;
    return (ver << 12) | v;
  }
  function stamp(m, v, ecc, mask) {
    var n = m.length, f = formatBits(ecc, mask), i, b;
    for (i = 0; i < 15; i++) {
      /* the most significant bit lands first, at the left of the top row */
      b = (f >> (14 - i)) & 1;
      /* the copy that hugs the top-left finder */
      if (i < 6) m[8][i] = b;
      else if (i === 6) m[8][7] = b;
      else if (i === 7) m[8][8] = b;
      else if (i === 8) m[7][8] = b;
      else m[14 - i][8] = b;
      /* and the spare copy, so a torn corner is survivable: seven modules
         climbing the left edge, eight along the top right, and the module
         that is always dark left exactly where it is */
      if (i < 7) m[n - 1 - i][8] = b;
      else m[8][n - 15 + i] = b;
    }
    if (v >= 7) {
      var vb = versionBits(v);
      for (i = 0; i < 18; i++) {
        b = (vb >> i) & 1;
        m[Math.floor(i / 3)][n - 11 + (i % 3)] = b;
        m[n - 11 + (i % 3)][Math.floor(i / 3)] = b;
      }
    }
  }

  /* The four penalties, and the third one is the one that matters: it hunts
     for runs shaped like a finder pattern, 1:1:3:1:1 with light either side.
     A mask that sprinkles false finders through the data leaves a code the
     spec accepts and no phone can actually locate, so this is counted the
     long way, by run history, exactly as the standard describes. */
  function penalty(m) {
    var n = m.length, N1 = 3, N2 = 3, N3 = 40, N4 = 10, result = 0, x, y;

    function addHistory(len, hist) {
      if (hist[0] === 0) len += n;        /* the quiet zone counts as light */
      hist.unshift(len); hist.pop();
    }
    function countPatterns(hist) {
      var c = hist[1];
      var core = c > 0 && hist[2] === c && hist[3] === c * 3 && hist[4] === c && hist[5] === c;
      return (core && hist[0] >= c * 4 && hist[6] >= c ? 1 : 0) +
             (core && hist[6] >= c * 4 && hist[0] >= c ? 1 : 0);
    }
    function terminate(color, len, hist) {
      if (color) { addHistory(len, hist); len = 0; }
      len += n;
      addHistory(len, hist);
      return countPatterns(hist);
    }
    function sweep(at) {
      var color = 0, run = 0, hist = [0, 0, 0, 0, 0, 0, 0], k;
      for (k = 0; k < n; k++) {
        if (at(k) === color) {
          run++;
          if (run === 5) result += N1; else if (run > 5) result++;
        } else {
          addHistory(run, hist);
          if (!color) result += countPatterns(hist) * N3;
          color = at(k); run = 1;
        }
      }
      result += terminate(color, run, hist) * N3;
    }

    for (y = 0; y < n; y++) sweep(function (k) { return m[y][k]; });
    for (x = 0; x < n; x++) sweep(function (k) { return m[k][x]; });

    for (y = 0; y < n - 1; y++) for (x = 0; x < n - 1; x++) {
      var c0 = m[y][x];
      if (c0 === m[y][x + 1] && c0 === m[y + 1][x] && c0 === m[y + 1][x + 1]) result += N2;
    }

    var dark = 0;
    for (y = 0; y < n; y++) for (x = 0; x < n; x++) dark += m[y][x];
    var total = n * n;
    var k4 = Math.max(0, Math.ceil(Math.abs(dark * 20 - total * 10) / total) - 1);
    result += k4 * N4;
    return result;
  }

  /* ---------- the whole job ---------- */
  function encode(text, opts) {
    opts = opts || {};
    var ecc = opts.ecc || "H";
    if (!BLOCKS[ecc]) throw new Error("Error correction must be L, M, Q or H.");
    var bytes = utf8(String(text));
    var v = opts.version || 0;
    if (!v) {
      for (var t = 1; t <= MAXV; t++) {
        var cci = t < 10 ? 8 : 16;
        if (4 + cci + bytes.length * 8 <= dataCodewords(t, ecc) * 8) { v = t; break; }
      }
    }
    if (!v) throw new Error("That address is too long for a code this size. Shorten it.");

    var woven = weave(codewordsFor(bytes, v, ecc), v, ecc);
    var res = reserved(v);
    /* Everything the spec draws for the scanner rather than for the message:
       finders, separators, timing, alignment, and the squares held for the
       format and version. The mask must not touch a single one of them, or
       the phone cannot find the code at all. */
    var bare = skeleton(v), n0 = bare.length, fn = [], i, j;
    for (i = 0; i < n0; i++) {
      fn.push([]);
      for (j = 0; j < n0; j++) fn[i].push(bare[i][j] !== null || !!res[i][j]);
    }

    var best = null, bestScore = Infinity, bestMask = 0;
    var only = opts.mask == null ? -1 : opts.mask;
    for (var mask = 0; mask < 8; mask++) {
      if (only >= 0 && mask !== only) continue;
      var m = skeleton(v);
      place(m, res, woven);
      for (i = 0; i < n0; i++) for (j = 0; j < n0; j++)
        if (!fn[i][j] && MASKS[mask](i, j)) m[i][j] ^= 1;
      stamp(m, v, ecc, mask);
      var s = penalty(m);
      if (s < bestScore) { bestScore = s; best = m; bestMask = mask; }
    }
    for (i = 0; i < n0; i++) for (j = 0; j < n0; j++)
      if (best[i][j] !== 0 && best[i][j] !== 1)
        throw new Error("Module " + i + "," + j + " was never set. Refusing to hand out a broken code.");
    return { matrix: best, version: v, ecc: ecc, mask: bestMask, size: best.length, codewords: woven };
  }

  /* ---------- ways to hand it over ---------- */
  function toSVG(code, opts) {
    opts = opts || {};
    var quiet = opts.quiet == null ? 4 : opts.quiet;
    var m = code.matrix, n = m.length, span = n + quiet * 2;
    var dark = opts.dark || "#000000", light = opts.light || "#ffffff";
    var d = [];
    for (var i = 0; i < n; i++) for (var j = 0; j < n; j++)
      if (m[i][j]) d.push("M" + (j + quiet) + " " + (i + quiet) + "h1v1h-1z");
    return '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ' + span + " " + span +
      '" shape-rendering="crispEdges" role="img" aria-label="QR code">' +
      '<rect width="' + span + '" height="' + span + '" fill="' + light + '"/>' +
      '<path fill="' + dark + '" d="' + d.join("") + '"/></svg>';
  }

  /* a canvas, so it can be saved as a picture at whatever size a printer wants */
  function toCanvas(code, opts) {
    opts = opts || {};
    var quiet = opts.quiet == null ? 4 : opts.quiet;
    var scale = opts.scale || 8;
    var m = code.matrix, n = m.length, span = (n + quiet * 2) * scale;
    var cv = document.createElement("canvas");
    cv.width = cv.height = span;
    var g = cv.getContext("2d");
    g.fillStyle = opts.light || "#ffffff";
    g.fillRect(0, 0, span, span);
    g.fillStyle = opts.dark || "#000000";
    for (var i = 0; i < n; i++) for (var j = 0; j < n; j++)
      if (m[i][j]) g.fillRect((j + quiet) * scale, (i + quiet) * scale, scale, scale);
    return cv;
  }

  return { encode: encode, toSVG: toSVG, toCanvas: toCanvas, maxVersion: MAXV };
})();

if (typeof module !== "undefined" && module.exports) module.exports = window.CherryQR;
