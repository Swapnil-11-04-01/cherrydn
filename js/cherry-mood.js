/* ============================================================
   HER COLOURS, PUT ON THE PAGE

   The palette is one setting: a small object of custom property
   names and values. Nothing here knows or cares which controls
   made it, so the controls can change shape without this moving.

   Two jobs, and the second is the awkward one:

     1. Put the palette on the page.
     2. Put it there before the page paints.

   Her archive answers over the network, which is far too late: a
   visitor would see the built-in colours flash and then her own
   arrive, which looks like a fault. So the palette is kept in the
   browser as well, and the tiny script in every <head> lays the
   remembered one down before anything is drawn. The archive's copy
   then quietly replaces it. Only a first-ever visit can flash, and
   only once.
   ============================================================ */
window.CherryMood = (function () {
  "use strict";

  var KEY = "cherry.mood";

  /* A value out of the archive is hers, but it still goes onto the page
     as CSS, so it is held to a shape: a custom property name and a plain
     colour. Anything else is dropped rather than trusted. */
  var NAME = /^--[a-z0-9-]{1,40}$/;
  var VALUE = /^[#a-zA-Z0-9 ,.()%\/-]{1,120}$/;

  function clean(mood) {
    var out = {};
    if (!mood || typeof mood !== "object") return out;
    Object.keys(mood).forEach(function (k) {
      var v = mood[k];
      if (typeof v !== "string") return;
      v = v.trim();
      if (!NAME.test(k) || !VALUE.test(v)) return;
      if (v.indexOf(";") > -1 || v.indexOf("}") > -1 || v.indexOf("{") > -1) return;
      out[k] = v;
    });
    return out;
  }

  function apply(mood, root) {
    var safe = clean(mood);
    var el = root || document.documentElement;
    Object.keys(safe).forEach(function (k) { el.style.setProperty(k, safe[k]); });
    return safe;
  }

  /* take back every property this ever set, so a preview can return to
     the built-in colours without a reload */
  function clear(root, mood) {
    var el = root || document.documentElement;
    Object.keys(clean(mood) || {}).forEach(function (k) { el.style.removeProperty(k); });
  }

  function remember(mood) {
    try { localStorage.setItem(KEY, JSON.stringify(clean(mood))); } catch (e) {}
  }
  function recall() {
    try { return clean(JSON.parse(localStorage.getItem(KEY) || "null")); } catch (e) { return {}; }
  }

  /* what the <head> calls: lay down what we remember, right now */
  function early() { return apply(recall()); }

  return { apply: apply, clear: clear, clean: clean,
           remember: remember, recall: recall, early: early };
})();

if (typeof module !== "undefined" && module.exports) module.exports = window.CherryMood;
