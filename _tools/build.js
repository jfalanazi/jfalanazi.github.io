#!/usr/bin/env node
/**
 * أداة بناء تقرير "معالجة آثار حريق مبنى 2"
 * ------------------------------------------------------------
 * تأخذ لقطة من قاعدة بيانات لوحة الإدارة وتبني منها نسختي التقرير الثابتتين:
 *   1) b2-7f3a9c2e/index.html  ← مستند كامل لـ GitHub Pages (doctype + viewport + noindex)
 *   2) <outDir>/artifact.html  ← "جزء صفحة" لنسخة الـ Artifact الاحتياطية
 * ثم تطبع ملخص الأرقام وفحص المهام المتشابهة.
 *
 * الاستخدام:
 *   node _tools/build.js <snapDir> [outDir]
 *   snapDir فيه: tasks/*.json  و  meta/*.json (أو meta.json واحد)
 *   — وهو نفس الشكل الذي تُخرجه أداة ArtifactData مع out_dir.
 *
 * مصدر التصميم: _tools/admin-source.html (نسخة من لوحة الإدارة). أي تعديل على اللوحة
 * يجب نسخه إلى هنا، وإلا سيُبنى التقرير بالتصميم القديم.
 */
const fs = require("fs");
const path = require("path");
const { findSimilar } = require("./similar.js");

const ROOT = path.join(__dirname, "..");
const SRC = path.join(__dirname, "admin-source.html");
const snapDir = process.argv[2];
const outDir = process.argv[3] || path.join(__dirname, "out");
if (!snapDir) { console.error("الاستخدام: node _tools/build.js <snapDir> [outDir]"); process.exit(1); }

// ---------- 1) البيانات ----------
function readJsonDir(dir) {
  const out = {};
  if (!fs.existsSync(dir)) return out;
  for (const f of fs.readdirSync(dir)) {
    if (f.startsWith(".") || !f.endsWith(".json")) continue;
    const raw = JSON.parse(fs.readFileSync(path.join(dir, f), "utf8"));
    out[path.basename(f, ".json")] = raw && raw.data && typeof raw.data === "object" && !Array.isArray(raw.data) && Object.keys(raw).length <= 3 ? raw.data : raw;
  }
  return out;
}
const taskMap = readJsonDir(path.join(snapDir, "tasks"));
const tasks = Object.keys(taskMap).map(id => { const d = Object.assign({}, taskMap[id]); delete d.version; return Object.assign({ id }, d); });
let meta = readJsonDir(path.join(snapDir, "meta"));
if (!Object.keys(meta).length && fs.existsSync(path.join(snapDir, "meta.json")))
  meta = JSON.parse(fs.readFileSync(path.join(snapDir, "meta.json"), "utf8"));
if (!tasks.length) { console.error("✗ لا توجد مهام في اللقطة — توقّف"); process.exit(2); }

const generatedAt = new Date().toISOString();
const DATA = { tasks, meta, generatedAt };

// ---------- 2) صفحة الإدارة → تقرير ----------
let html = fs.readFileSync(SRC, "utf8");
html = html.replace(/<title>[^<]*<\/title>/, "<title>تقرير معالجة آثار حريق مبنى 2</title>");
html = html.replace(/<h1>[^<]*<\/h1>/, "<h1>📄 تقرير معالجة آثار حريق — مبنى 2</h1>");

const FROZEN = `
  /* ====== بيانات مجمّدة — تُولَّد آليًا، لا تُحرَّر يدويًا ====== */
  /* ==DATA_START== */
  var FROZEN_DATA = ${JSON.stringify(DATA)};
  /* ==DATA_END== */
  function frozenDoc(p){
    var key = String(p).split("/")[1];
    return {
      onSnapshot: function(next){
        var d = FROZEN_DATA.meta && FROZEN_DATA.meta[key];
        next(d ? {exists:true, data:function(){ return d; }}
               : {exists:false, data:function(){ return {}; }});
      },
      update:function(){ return Promise.reject({code:"not_granted"}); },
      set:function(){ return Promise.reject({code:"not_granted"}); },
      delete:function(){ return Promise.reject({code:"not_granted"}); }
    };
  }
  function frozenCollection(p){
    return {
      doc:function(id){ return frozenDoc(p+"/"+id); },
      orderBy:function(){ return this; },
      limit:function(){ return this; },
      onSnapshot:function(next){
        next({docs: FROZEN_DATA.tasks.map(function(t){
          return {id:t.id, data:function(){ return t; }};
        })});
      },
      add:function(){ return Promise.reject({code:"not_granted"}); }
    };
  }
  var FROZEN_DB   = { doc: frozenDoc, collection: frozenCollection };
  var FROZEN_USER = { isOwner:function(){ return false; }, canEdit:function(){ return false; }, can:function(){ return false; } };
`;
const guardStart = html.indexOf("    if(!window.claude || !window.claude.use){");
const guardEnd = html.indexOf("    }", html.indexOf("      return;", guardStart)) + "    }".length;
if (guardStart === -1 || guardEnd < guardStart) throw new Error("لم أجد فحص window.claude — تغيّرت بنية الصفحة");
html = html.slice(0, guardStart) + "    /* بيئة التقرير الثابت: لا حاجة لفحص Claude */" + html.slice(guardEnd);
const liveCall = 'Promise.all([window.claude.use("db"), window.claude.use("user")]).then(function(r){';
if (!html.includes(liveCall)) throw new Error("لم أجد نداء قاعدة البيانات — تغيّرت بنية الصفحة");
html = html.replace(liveCall, "Promise.resolve([FROZEN_DB, FROZEN_USER]).then(function(r){");
html = html.replace('  "use strict";', '  "use strict";\n' + FROZEN);

const stamp = new Date(generatedAt).toLocaleString("ar-SA-u-ca-gregory-nu-latn", {
  timeZone: "Asia/Riyadh", weekday: "long", day: "numeric", month: "long", year: "numeric", hour: "numeric", minute: "2-digit"
});
const bannerRe = /<div class="report-banner">[^<]*<\/div>/;
if (!bannerRe.test(html)) throw new Error("لم أجد شريط التقرير");
html = html.replace(bannerRe, '<div class="report-banner">📄 تقرير معالجة آثار الحريق — آخر تحديث: ' + stamp + "</div>");

// ---------- 3) فحص سلامة السكربت ----------
const js = html.match(/<script>([\s\S]*)<\/script>/);
new Function(js[1]);

// ---------- 4) الكتابة ----------
fs.mkdirSync(outDir, { recursive: true });
const fragment = html;
const fullDoc = '<!doctype html>\n<html lang="ar" dir="rtl">\n<head>\n<meta charset="utf-8">\n' +
  '<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">\n' +
  '<meta name="robots" content="noindex, nofollow, noarchive">\n</head>\n<body>\n' + fragment + "\n</body>\n</html>\n";
fs.writeFileSync(path.join(outDir, "artifact.html"), fragment);
const ghFile = path.join(ROOT, "b2-7f3a9c2e", "index.html");
fs.writeFileSync(ghFile, fullDoc);

// ---------- 5) ملخص ----------
const leaves = tasks.filter(t => !t.isParent && t.status !== "deferred");
const done = leaves.filter(t => t.status === "done").length;
console.log("✅ GitHub:", path.relative(ROOT, ghFile), "| Artifact:", path.join(outDir, "artifact.html"));
console.log("📊 مهام نشطة:", leaves.length, "| منجز:", done, "| الإنجاز:", (leaves.length ? Math.round(done / leaves.length * 100) : 0) + "%", "| آخر تحديث:", stamp);
const sims = findSimilar(tasks);
if (!sims.length) console.log("🔎 لا تشابهات");
else {
  console.log("🔎 مهام متشابهة (" + sims.length + "):");
  sims.forEach(s => console.log("  • " + s.score + "% " + (s.sameGroup ? "[نفس المجموعة]" : "[مجموعتان مختلفتان]") +
    "\n     ① " + s.a.description + " (" + s.a.status + ")\n     ② " + s.b.description + " (" + s.b.status + ")"));
}
