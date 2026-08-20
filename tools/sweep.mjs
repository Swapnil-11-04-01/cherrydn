/* Every palette Cherry can reach, checked against every readability floor.
   Deterministic lattice, not random sampling: re-run this on any change to
   the solver and it must print zero violations. */
import { createRequire } from "module";
const require = createRequire(import.meta.url);
global.window = {};
const S = require("../js/cherry-solve.js");

const HG = Array.from({length: 24}, (_, i) => i * 15);
const D  = [0, 0.25, 0.5, 0.75, 1];
const T  = [0, 0.5, 1];
const F  = [0, 0.25, 0.5, 0.75, 1];
const W  = [0, 0.5, 1];
const A  = [0, 0.5, 1];

let n = 0, bad = [];
const worst = {};
const track = (k, v) => { if (worst[k] === undefined || v < worst[k]) worst[k] = v; };
const px = h => h.charAt(0) === "#"
  ? [0,2,4].map(i => parseInt(h.slice(1).substr(i,2), 16))
  : h.match(/[\d.]+/g).slice(0,3).map(Number);

for (const hg of HG) for (const d of D) for (const t of T)
for (const f of F) for (const w of W) for (const a of A) {
  n++;
  const v = S.generate({ d, hg, t, f, w, a, gr: 0.3 });
  const viol = S.check(v);
  if (viol.length) bad.push({ seeds: {d,hg,t,f,w,a}, viol });
  const bg = px(v["--bg"]), bg2 = px(v["--bg2"]), ink = px(v["--ink"]);
  track("ink/bg",        S.CR(ink, bg));
  track("muted/bg",      S.CR(px(v["--muted"]), bg));
  track("red-t/bg2",     S.CR(px(v["--red-t"]), bg2));
  track("red-display/bg",S.CR(px(v["--red-display"]), bg));
  track("ink/red",       S.CR(ink, px(v["--red"])));
  track("steel/bg",      S.CR(px(v["--steel"]), bg));
  track("steel-t/bg",    S.CR(px(v["--steel-t"]), bg));
  track("warm/bg",       S.CR(px(v["--warm"]), bg));
  track("el-water/bg",   S.CR(px(v["--el-water"]), bg));
  track("el-earth/bg",   S.CR(px(v["--el-earth"]), bg));
  track("el-air/bg",     S.CR(px(v["--el-air"]), bg));
  track("ink/G*",        S.CR(ink, px(v.__meta.ground)));
  track("muted/G*",      S.CR(px(v["--muted"]), px(v.__meta.ground)));
  track("red-ink/G*",    S.CR(px(v["--red-ink"]), px(v.__meta.ground)));
}

console.log(`palettes checked: ${n}`);
console.log(`violations:       ${bad.length}`);
console.log("\nworst value ever reached, across every reachable palette:");
for (const k of Object.keys(worst).sort()) {
  console.log("   " + k.padEnd(16) + worst[k].toFixed(2));
}
if (bad.length) {
  console.log("\nfirst failures:");
  bad.slice(0,5).forEach(b => console.log("  ", JSON.stringify(b.seeds), b.viol.join("; ")));
  process.exit(1);
}
