/**
 * كشف المهام المتشابهة — بدون دمج أو حذف؛ جابر وحده يقرر.
 * تحسينات عن النسخة الأولى:
 *  - تطبيع عربي + تجذيع خفيف (حذف "و" و"ال" و"بال/لل" من أول الكلمة)
 *  - تجاهل كلمات القالب المتكررة التي تصنع تشابهًا شكليًا (تشغيل، تجريبي، نظام، فحص...)
 *  - عتبة 30% داخل نفس المجموعة، و45% بين مجموعتين مختلفتين
 */
const STOP = new Set("من في على الى عن مع بعد قبل كل جميع و او ثم التي الذي هذا هذه ما لا ان اذا حتي عند بين".split(" "));
const TEMPLATE = new Set(("تشغيل تجريبي نظام انظمه فحص اصلاح اعاده تنظيف منطقه حريق مبني مبنى طابق طوابق كامل شامل " +
  "مؤقت جزئي المتاثر متاثر اعمال عمل").split(" "));
function norm(s) {
  return String(s || "").replace(/[ً-ٰٟ]/g, "").replace(/[أإآ]/g, "ا").replace(/ى/g, "ي").replace(/ة/g, "ه")
    .replace(/[^ء-يa-zA-Z0-9\s]/g, " ").toLowerCase();
}
function stem(w) {
  if (w.length > 3 && w[0] === "و") w = w.slice(1);
  for (const p of ["بال", "لل", "ال"]) if (w.length > p.length + 2 && w.startsWith(p)) { w = w.slice(p.length); break; }
  return w;
}
function tokens(s) {
  const out = new Set();
  for (let w of norm(s).split(/\s+/)) {
    if (!w || STOP.has(w)) continue;
    w = stem(w);
    // "لنظام" / "بفحص" → كلمة قالب بعد حذف حرف الجر
    if ((w[0] === "ل" || w[0] === "ب") && TEMPLATE.has(stem(w.slice(1)))) continue;
    if (w.length < 2 || STOP.has(w) || TEMPLATE.has(w)) continue;
    out.add(w);
  }
  return out;
}
function jaccard(a, b) {
  if (!a.size || !b.size) return 0;
  let i = 0; for (const x of a) if (b.has(x)) i++;
  return i / (a.size + b.size - i);
}
function findSimilar(tasks) {
  const list = tasks.filter(t => !t.isParent).map(t => ({ t, k: tokens(t.description) }));
  const res = [];
  for (let i = 0; i < list.length; i++) for (let j = i + 1; j < list.length; j++) {
    const a = list[i], b = list[j];
    const same = !!a.t.parentId && a.t.parentId === b.t.parentId;
    const sc = jaccard(a.k, b.k);
    if (sc >= (same ? 0.30 : 0.45)) res.push({ score: Math.round(sc * 100), sameGroup: same, a: a.t, b: b.t });
  }
  return res.sort((x, y) => y.score - x.score);
}
module.exports = { findSimilar, tokens };
