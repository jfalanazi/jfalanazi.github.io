/* ورد التدبر — معلّم شخصي لحفظ جزء عمّ وفهمه */
'use strict';

const KEY = 'wird.v1';
const INTERVALS = [1, 3, 7, 15, 30, 60, 120];
const STEPS = [
  { k: 'tadabbur', t: 'تدبّر',           s: 'افهم قبل أن تحفظ' },
  { k: 'photo',    t: 'قراءة تصويرية',   s: '٦٠ ثانية بالعين' },
  { k: 'recall',   t: 'استحضار',          s: 'من الذاكرة' },
  { k: 'detail',   t: 'متشابهات وتجويد',  s: 'الفروق والأداء' },
  { k: 'link',     t: 'الربط والتطبيق',   s: 'بالدرس القادم' },
];

let Q = {}, LESSONS = [], TEACHER = {}, SIMILAR = [];
let S = { items: {}, streak: 0, lastDay: null, done: 0, key: '', model: 'claude-sonnet-5', theme: '' };
let V = { tab: 'today', step: 0, lvl: 0, mastery: null, mode: 'auto', rid: null, open: {}, busy: false, answer: '' };
let timer = null, left = 60;

/* ---------- أدوات ---------- */
const $ = s => document.querySelector(s);
const today = () => new Date().toLocaleDateString('en-CA');
const addDays = (d, n) => { const x = new Date(d + 'T00:00:00'); x.setDate(x.getDate() + n); return x.toLocaleDateString('en-CA'); };
const esc = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const AR = n => String(n).replace(/\d/g, d => '٠١٢٣٤٥٦٧٨٩'[d]);

function toast(m) {
  const t = $('#toast'); t.firstElementChild.textContent = m; t.classList.add('show');
  clearTimeout(toast._i); toast._i = setTimeout(() => t.classList.remove('show'), 2000);
}
function save() { try { localStorage.setItem(KEY, JSON.stringify(S)); } catch (e) {} }
function load() {
  try { const r = localStorage.getItem(KEY); if (r) S = Object.assign(S, JSON.parse(r)); } catch (e) {}
  if (S.theme) document.documentElement.dataset.theme = S.theme;
}

/* تجريد التشكيل لمقارنة الكلمات */
const bare = w => w
  .replace(/[ً-ٰٟۖ-ۭـ]/g, '')
  .replace(/[آأإٱ]/g, 'ا')
  .replace(/ى/g, 'ي');

/* فرق على مستوى الكلمة: بادئة ولاحقة مشتركة، والوسط هو الفرق */
function diffMark(a, b) {
  const A = a.split(' '), B = b.split(' ');
  const na = A.map(bare), nb = B.map(bare);
  let p = 0; while (p < na.length && p < nb.length && na[p] === nb[p]) p++;
  let s = 0; while (s < na.length - p && s < nb.length - p && na[na.length - 1 - s] === nb[nb.length - 1 - s]) s++;
  const wrap = (arr) => arr.map((w, i) =>
    (i >= p && i < arr.length - s) ? '<mark>' + esc(w) + '</mark>' : esc(w)).join(' ');
  return { a: wrap(A), b: wrap(B), same: p >= na.length && p >= nb.length };
}

/* ---------- محرّك المراجعة ---------- */
const lessonById = id => LESSONS.find(l => l.id === id);
function dueIds() {
  const t = today();
  return LESSONS.filter(l => S.items[l.id] && S.items[l.id].due <= t).map(l => l.id);
}
function nextNew() { return LESSONS.find(l => !S.items[l.id]) || null; }
function verses(l) { return Q[l.sid].v.slice(l.from - 1, l.to); }
function lessonTitle(l) { return l.name + (l.part ? ' · الجزء ' + AR(l.part) + ' من ' + AR(l.parts) : ''); }
function lessonRange(l) { return l.from === l.to ? 'الآية ' + AR(l.from) : 'الآيات ' + AR(l.from) + '–' + AR(l.to); }

function current() {
  const due = dueIds(), nxt = nextNew();
  if (V.mode === 'review' && V.rid) return { l: lessonById(V.rid), rev: true, due, nxt };
  if (V.mode === 'new' && nxt) return { l: nxt, rev: false, due, nxt };
  if (due.length) return { l: lessonById(due[0]), rev: true, due, nxt };
  return { l: nxt, rev: false, due, nxt };
}

function complete(id, m) {
  const prev = S.items[id], t = today();
  let stage = prev ? prev.stage : 0;
  if (m >= 4) stage = Math.min(stage + 1, INTERVALS.length - 1);
  else if (m <= 2) stage = 0;
  else stage = prev ? stage : 0;
  S.items[id] = { stage, last: t, due: addDays(t, INTERVALS[stage]), reps: (prev ? prev.reps : 0) + 1, m };
  if (S.lastDay !== t) {
    S.streak = (S.lastDay && addDays(S.lastDay, 1) === t) ? S.streak + 1 : 1;
    S.lastDay = t;
  }
  S.done = Object.keys(S.items).length;
  save();
  toast(prev ? 'تمت المراجعة · القادمة بعد ' + AR(INTERVALS[stage]) + ' يوم' : 'أُضيف إلى خطة المراجعة');
  V = Object.assign(V, { step: 0, lvl: 0, mastery: null, mode: 'auto', rid: null, open: {} });
  stopTimer(); render();
}

/* ---------- عرض الآيات ---------- */
function vhtml(l, lvl, open) {
  return verses(l).map((txt, i) => {
    const n = l.from + i, W = txt.split(' ');
    let out;
    if (lvl === 0) out = esc(txt);
    else if (lvl === 1) out = esc(W.slice(0, Math.max(1, W.length - 1)).join(' ')) + ' <span class="gap"></span>';
    else if (lvl === 2) out = esc(W.slice(0, Math.ceil(W.length / 2)).join(' ')) + ' <span class="gap"></span>';
    else out = esc(W[0]) + ' <span class="gap"></span>';
    const o = open[i];
    return `<span class="v${o ? ' open' : ''}" data-v="${i}">${o ? esc(txt) : out}<span class="num">${AR(n)}</span></span>`;
  }).join('');
}

function startTimer() { stopTimer(); left = 60; timer = setInterval(() => {
  left--; const e = $('#tmr'); if (e) e.textContent = AR(left);
  if (left <= 0) { stopTimer(); toast('انتهت ٦٠ ثانية — انتقل للاستحضار'); }
}, 1000); }
function stopTimer() { if (timer) { clearInterval(timer); timer = null; } }

/* ---------- الرسم ---------- */
function render() {
  const due = dueIds();
  $('#chips').innerHTML =
    `<span class="chip ${S.streak ? 'on' : ''}">${AR(S.streak)} يوم متتابع</span>` +
    `<span class="chip">${AR(S.done)}/${AR(LESSONS.length)} درس</span>` +
    (due.length ? `<span class="chip due">${AR(due.length)} مراجعة</span>` : '');
  document.querySelectorAll('#nav button').forEach(b =>
    b.setAttribute('aria-current', b.dataset.tab === V.tab ? 'page' : 'false'));
  const f = { today: vToday, path: vPath, similar: vSimilar, ask: vAsk, more: vMore }[V.tab];
  $('#view').innerHTML = f();
  $('#src').innerHTML = V.tab === 'more' ? '' :
    'النص العثماني من موسوعة القرآن الكريم · رخصة CC BY 4.0';
  if (V.tab === 'today' && STEPS[V.step].k === 'photo' && !timer) startTimer();
  if (!(V.tab === 'today' && STEPS[V.step].k === 'photo')) stopTimer();
}

/* ===== اليوم ===== */
function vToday() {
  const { l, rev, due, nxt } = current();
  if (!l) return `<div class="card"><div class="empty">
    <h2>أتممت جزء عمّ</h2>
    <p class="tiny">أنهيت ${AR(LESSONS.length)} درسًا ولا توجد مراجعات مستحقّة اليوم.</p>
    <p class="tiny">اطلب من كلود إضافة جزء تبارك.</p></div></div>`;

  const T = TEACHER[l.sid] || {}, st = STEPS[V.step], atEnd = V.step === STEPS.length - 1;
  const sims = SIMILAR.filter(p => p.a.s === l.sid || p.b.s === l.sid);
  const idx = LESSONS.indexOf(l), after = LESSONS[idx + 1];
  let body = '';

  if (st.k === 'tadabbur') {
    body = `<div class="eyebrow">محور السورة</div><p class="muted">${T.theme || ''}</p>
      ${T.sabab ? `<div class="sep"></div><div class="eyebrow">سبب النزول</div><p class="t13 muted">${T.sabab}</p>` : ''}
      <div class="sep"></div><div class="eyebrow">المعنى والبناء</div><p>${T.tadabbur || ''}</p>
      <div class="sep"></div><div class="verses frame">${vhtml(l, 0, {})}</div>`;
  } else if (st.k === 'photo') {
    body = `<p class="tiny muted">اقرأ بعينك فقط بلا صوت. لاحظ شكل الآيات: أين تبدأ وأين تنتهي، وأطوالها، والكلمات المكرّرة. لا تحاول الحفظ الآن — صوّرها.</p>
      <div class="timer"><span id="tmr">${AR(left)}</span></div>
      <div class="verses frame">${vhtml(l, 0, {})}</div>`;
  } else if (st.k === 'recall') {
    const lab = ['النص كامل', 'أُخفيت الكلمة الأخيرة', 'أُخفي نصف كل آية', 'بقيت الكلمة الأولى'];
    body = `<p class="tiny muted">استحضر من ذاكرتك قبل أن تكشف. اضغط أي آية لكشفها، وارفع المستوى تدريجيًا.</p>
      <div class="chips" style="margin:11px 0">
        ${[1, 2, 3].map(n => `<button class="chip ${V.lvl === n ? 'on' : ''}" data-lvl="${n}">مستوى ${AR(n)}</button>`).join('')}
        <button class="chip ${V.lvl === 0 ? 'on' : ''}" data-lvl="0">كشف الكل</button></div>
      <div class="eyebrow">${lab[V.lvl]}</div>
      <div class="verses frame">${vhtml(l, V.lvl, V.open)}</div>`;
  } else if (st.k === 'detail') {
    body = `<div class="eyebrow">ملاحظة الأداء والتجويد</div><p class="t13">${T.tajweed || ''}</p>`;
    body += sims.length
      ? `<div class="sep"></div><div class="eyebrow">مواضع يختلط فيها الحفظ</div>
         <p class="tiny muted">اضبط الفرق الآن — أرخص بكثير من تصحيحه بعد سنة.</p>${sims.map(pairHtml).join('')}`
      : `<div class="sep"></div><p class="tiny muted">لا توجد متشابهات مسجّلة تخصّ هذه السورة.</p>`;
  } else {
    body = after
      ? `<p class="tiny muted">اربط آخر آية هنا بأول آية في الدرس القادم، حتى لا يتوقّف لسانك عند حدّ المقطع في السرد المتّصل.</p>
         <div class="pair">
           <div class="tag">آخر آية — ${esc(lessonTitle(l))}</div>
           <div class="side">${esc(verses(l).slice(-1)[0])}</div>
           <div class="tag">أول آية — ${esc(lessonTitle(after))}</div>
           <div class="side">${esc(verses(after)[0])}</div>
           <div class="note">كرّرهما متّصلتين ثلاث مرات بنفَس واحد، بلا وقفة بينهما.</div></div>`
      : `<p class="tiny muted">هذا آخر درس في المسار.</p>`;
    if (T.qs && T.qs.length) body += `<div class="sep"></div><div class="eyebrow">أسئلة للتدبّر</div>
      <ol class="qlist t13 muted">${T.qs.map(q => `<li>${q}</li>`).join('')}</ol>
      <div class="row tightrow"><button class="btn ghost sm" data-askq="${esc(T.qs[0])}">اسأل معلّمي عن هذا</button></div>`;
  }

  const queue = due.length ? `<div class="card flat tight">
    <div class="eyebrow">مستحقّ اليوم</div>
    <div class="chips">${due.slice(0, 8).map(id => {
      const x = lessonById(id); return `<span class="chip">${esc(x.name)}${x.part ? ' ' + AR(x.part) : ''}</span>`;
    }).join('')}${due.length > 8 ? `<span class="chip">+${AR(due.length - 8)}</span>` : ''}</div></div>` : '';

  const nav = `<div class="row">
    ${V.step > 0 ? `<button class="btn quiet" data-nav="-1">السابق</button>` : ''}
    ${!atEnd ? `<button class="btn" data-nav="1">${STEPS[V.step + 1].t} ←</button>` : ''}</div>`;

  const finish = atEnd ? `<div class="card">
    <div class="eyebrow">قيّم إتقانك</div>
    <p class="tiny muted">يحدّد متى تعود لهذا المقطع: ٤–٥ تباعد المراجعة، ١–٢ ترجعها للغد.</p>
    <div class="mastery">${[1, 2, 3, 4, 5].map(n =>
      `<button data-m="${n}" class="${V.mastery === n ? 'sel' : ''}">${AR(n)}</button>`).join('')}</div>
    <div class="mlabels"><span>متعثّر</span><span>متقن</span></div>
    <div class="row"><button class="btn" id="done" ${V.mastery ? '' : 'disabled'}>${rev ? 'إتمام المراجعة' : 'إتمام الدرس'}</button></div>
  </div>` : '';

  const sw = (due.length && !rev) ? `<div class="row"><button class="btn ghost" data-mode="review" data-rid="${due[0]}">ابدأ بالمراجعات أولًا</button></div>`
    : (rev && nxt) ? `<div class="row"><button class="btn ghost" data-mode="new">تخطّ إلى الدرس الجديد — ${esc(nxt.name)}</button></div>` : '';

  return queue + `<div class="card">
    <div class="steprail">${STEPS.map((_, i) => `<div class="${i < V.step ? 'done' : i === V.step ? 'now' : ''}"></div>`).join('')}</div>
    <div class="eyebrow">${rev ? 'مراجعة مجدولة' : 'درس جديد'} · الخطوة ${AR(V.step + 1)} من ${AR(STEPS.length)}</div>
    <div class="lesshead"><b>${esc(lessonTitle(l))}</b><span>${lessonRange(l)} · ${esc(Q[l.sid].type)}</span></div>
    <div class="eyebrow" style="color:var(--accent);margin-top:9px">${st.t} — ${st.s}</div>
    ${body}${nav}</div>` + finish + sw;
}

function pairHtml(p) {
  const ta = Q[p.a.s].v[p.a.v - 1], tb = Q[p.b.s].v[p.b.v - 1];
  const d = diffMark(ta, tb);
  return `<div class="pair">
    <div class="tag">${esc(Q[p.a.s].n)} · الآية ${AR(p.a.v)}</div><div class="side">${d.a}</div>
    <div class="tag">${esc(Q[p.b.s].n)} · الآية ${AR(p.b.v)}</div><div class="side">${d.b}</div>
    <div class="note">${d.same ? '<b>متطابقتان حرفيًا.</b> ' : ''}${p.note}</div></div>`;
}

/* ===== المسار ===== */
function vPath() {
  const nxt = nextNew(), t = today();
  let out = '', lastSid = null;
  LESSONS.forEach((l, i) => {
    if (l.sid !== lastSid) { lastSid = l.sid; out += `<div class="stagehead">سورة ${esc(l.name)}</div>`; }
    const it = S.items[l.id];
    const due = it && it.due <= t;
    const cls = due ? 'due' : it ? 'done' : (nxt && nxt.id === l.id ? 'next' : '');
    const sub = it ? (due ? 'مستحقّة اليوم · تكرار ' + AR(it.reps) : 'المراجعة ' + it.due + ' · تكرار ' + AR(it.reps) + ' · إتقان ' + AR(it.m))
      : (nxt && nxt.id === l.id ? 'التالي' : 'لم يبدأ');
    out += `<div class="node ${cls}"><div class="dot">${it ? (due ? '!' : '✓') : AR(i + 1)}</div>
      <div style="min-width:0"><h4>${esc(lessonTitle(l))}</h4><div class="tiny">${lessonRange(l)} · ${sub}</div></div></div>`;
  });
  return `<div class="card"><div class="eyebrow">جزء عمّ — من الناس صعودًا إلى النبأ</div>
    <p class="tiny muted">${AR(LESSONS.length)} درسًا. كل درس يدخل خطة المراجعة المتباعدة فور إتمامه.</p>${out}</div>`;
}

/* ===== المتشابهات ===== */
function vSimilar() {
  return `<div class="card"><div class="eyebrow">سجل المتشابهات</div>
    <p class="tiny muted">المواضع التي يختلط فيها الحفظ في جزء عمّ، والفروق مميّزة تلقائيًا، ومعها ضابط التمييز.</p>
    ${SIMILAR.map(pairHtml).join('')}</div>`;
}

/* ===== معلّمي ===== */
function vAsk() {
  const { l } = current();
  const ctx = l ? lessonTitle(l) : '';
  const sug = l ? [
    'ما الفرق بين هذه السورة والتي قبلها في المعنى؟',
    'كيف أثبّت حفظ هذا المقطع إذا نسيته كثيرًا؟',
    'اشرح لي إعراب أصعب آية في هذا المقطع.',
  ] : [];
  if (!S.key) return `<div class="card">
    <div class="eyebrow">اسأل معلّمي</div>
    <p class="t13 muted">هذه الخاصية تتيح لك سؤال أي شيء عن الآيات التي تحفظها وتحصل على جواب فورًا. تحتاج مفتاح Anthropic API خاصًّا بك — يُحفظ في متصفّحك وحده ولا يُرسل لأي جهة غير Anthropic.</p>
    <div class="row"><button class="btn" data-go="more">أضف المفتاح في الإعداد</button></div>
    <div class="sep"></div>
    <p class="tiny muted">كل محتوى المعلّم المكتوب (التفسير، أسباب النزول، المتشابهات، التجويد) يعمل بدون مفتاح وبدون إنترنت — موجود داخل الدروس.</p></div>`;

  return `<div class="card">
    <div class="eyebrow">اسأل معلّمي${ctx ? ' · ' + esc(ctx) : ''}</div>
    <div class="ask">
      <textarea id="q" placeholder="اكتب سؤالك عن الآيات، المعنى، الإعراب، التجويد، أو طريقة التثبيت…">${esc(V.q || '')}</textarea>
      <div class="qsug">${sug.map(s => `<button class="chip" data-fill="${esc(s)}">${esc(s)}</button>`).join('')}</div>
      <div class="row tightrow"><button class="btn" id="send" ${V.busy ? 'disabled' : ''}>${V.busy ? 'يكتب…' : 'اسأل'}</button></div>
      ${V.answer ? `<div class="answer">${esc(V.answer)}</div>` : ''}
    </div>
    <div class="sep"></div>
    <p class="tiny muted">المعلّم يجيب عن القرآن وعلومه فقط، ويُنبّهك إن كان في المسألة خلاف. راجع ما يُشكل عليك مع أهل العلم.</p></div>`;
}

/* ===== الإعداد ===== */
function vMore() {
  const th = document.documentElement.dataset.theme || '';
  return `<div class="card">
    <div class="eyebrow">المظهر</div>
    <div class="chips">
      <button class="chip ${th === '' ? 'on' : ''}" data-theme="">تلقائي</button>
      <button class="chip ${th === 'light' ? 'on' : ''}" data-theme="light">فاتح</button>
      <button class="chip ${th === 'dark' ? 'on' : ''}" data-theme="dark">داكن</button></div>
  </div>

  <div class="card">
    <div class="eyebrow">مفتاح معلّمي</div>
    <p class="tiny muted">مفتاح Anthropic API. يُحفظ في متصفّح هذا الجهاز وحده. احصل عليه من console.anthropic.com</p>
    <div class="field"><label for="apikey">المفتاح</label>
      <input type="password" id="apikey" value="${esc(S.key)}" placeholder="sk-ant-…" autocomplete="off"></div>
    <div class="field"><label for="model">النموذج</label>
      <input type="text" id="model" value="${esc(S.model)}" autocomplete="off"></div>
    <div class="row"><button class="btn" id="savekey">حفظ</button>
      ${S.key ? `<button class="btn quiet" id="clearkey">حذف المفتاح</button>` : ''}</div>
  </div>

  <div class="card">
    <div class="eyebrow">التنبيه اليومي</div>
    <p class="t13 muted">يصلك تنبيه يومي الساعة ٨:٤٢ مساءً بتوقيت الرياض عبر تطبيق كلود، فيه مراجعات اليوم ودرسك الجديد.</p>
    <p class="tiny muted">إشعارات مستقلة من هذا التطبيق مباشرة — خطوة قادمة. لتعمل على الآيفون يجب إضافة التطبيق إلى الشاشة الرئيسية أولًا.</p>
  </div>

  <div class="card">
    <div class="eyebrow">تثبيت التطبيق على جوالك</div>
    <ol class="steps muted">
      <li><b>آيفون:</b> افتح الرابط في Safari ← زر المشاركة ← «إضافة إلى الشاشة الرئيسية».</li>
      <li><b>أندرويد:</b> افتحه في Chrome ← القائمة ← «تثبيت التطبيق».</li>
      <li>بعدها يعمل بأيقونة واسم وشاشة كاملة، ويفتح بدون إنترنت.</li>
    </ol>
  </div>

  <div class="card">
    <div class="eyebrow">نسخة احتياطية</div>
    <p class="tiny muted">تقدّمك محفوظ في هذا الجهاز فقط. انسخه قبل تغيير الجهاز أو مسح بيانات المتصفح.</p>
    <div class="row">
      <button class="btn quiet" id="exp">تصدير تقدّمي</button>
      <button class="btn quiet" id="imp">استيراد</button></div>
    <div class="row tightrow"><button class="btn quiet" id="reset" style="color:var(--bad);border-color:var(--bad)">تصفير كل التقدّم</button></div>
  </div>

  <div class="card">
    <div class="eyebrow">المصادر</div>
    <p class="tiny muted">النص العثماني من <b>موسوعة القرآن الكريم</b> (quranenc.com) برخصة CC BY 4.0، عبر حزمة quran-json. جزء عمّ كاملًا: ٣٧ سورة، ٥٦٤ آية، مقسّمة إلى ${AR(LESSONS.length)} درسًا.</p>
    <p class="tiny muted">محتوى التدبّر والتجويد والمتشابهات كُتب لهذا التطبيق. ما أشكل عليك فراجعه مع أهل العلم.</p>
  </div>`;
}

/* ---------- سؤال المعلّم ---------- */
async function askTeacher(q) {
  const { l } = current();
  let ctx = '';
  if (l) {
    ctx = `المقطع الذي يدرسه الآن: سورة ${l.name}، ${lessonRange(l)}.\nنصّه:\n` +
      verses(l).map((t, i) => (l.from + i) + '. ' + t).join('\n');
  }
  const sys = `أنت معلّم قرآن يخاطب رجلًا بالغًا يحفظ جزء عمّ ويريد الفهم قبل الحفظ. أجب بالعربية الفصحى، بإيجاز ووضوح، في حدود ١٨٠ كلمة ما لم يطلب التفصيل.
التزم بالآتي:
- اقتصر على القرآن وعلومه: التفسير، المعاني، الإعراب، البلاغة، التجويد، أسباب النزول، طرق الحفظ والتثبيت. وإن سُئلت عن غير ذلك فاعتذر بلطف.
- لا تنسب حديثًا أو أثرًا أو قولًا لعالم إلا إذا كنت واثقًا منه؛ وإن شككت فقل إنك غير متأكد من صحّة النسبة.
- إذا كانت المسألة خلافية فاذكر أنها خلافية وأشر إلى أشهر القولين بإيجاز، ولا ترجّح بقطع.
- لا تخترع أرقام آيات ولا نصوصًا؛ اعتمد على النصّ المعطى لك.
- لا تستخدم تنسيق ماركداون ولا عناوين؛ اكتب فقرات قصيرة.
${ctx}`;

  const r = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      'x-api-key': S.key,
      'anthropic-version': '2023-06-01',
      'anthropic-dangerous-direct-browser-access': 'true',
    },
    body: JSON.stringify({
      model: S.model || 'claude-sonnet-5',
      max_tokens: 900,
      system: sys,
      messages: [{ role: 'user', content: q }],
    }),
  });
  if (!r.ok) {
    let m = 'تعذّر الاتصال (' + r.status + ')';
    try { const j = await r.json(); if (j.error && j.error.message) m += ' — ' + j.error.message; } catch (e) {}
    if (r.status === 401) m = 'المفتاح غير صالح. راجعه في الإعداد.';
    if (r.status === 429) m = 'تجاوزت حدّ الطلبات. انتظر قليلًا ثم أعد المحاولة.';
    throw new Error(m);
  }
  const j = await r.json();
  return (j.content || []).filter(c => c.type === 'text').map(c => c.text).join('\n').trim();
}

/* ---------- الأحداث ---------- */
document.addEventListener('click', async e => {
  const g = s => e.target.closest(s);
  let t;
  if ((t = g('#nav button'))) { V.tab = t.dataset.tab; V.answer = ''; render(); window.scrollTo(0, 0); return; }
  if ((t = g('[data-go]'))) { V.tab = t.dataset.go; render(); window.scrollTo(0, 0); return; }
  if ((t = g('[data-nav]'))) { V.step = Math.max(0, Math.min(STEPS.length - 1, V.step + (+t.dataset.nav))); V.open = {}; render(); window.scrollTo(0, 0); return; }
  if ((t = g('[data-lvl]'))) { V.lvl = +t.dataset.lvl; V.open = {}; render(); return; }
  if ((t = g('.v')) && STEPS[V.step].k === 'recall' && V.tab === 'today') { V.open[t.dataset.v] = !V.open[t.dataset.v]; render(); return; }
  if ((t = g('[data-m]'))) { V.mastery = +t.dataset.m; render(); return; }
  if ((t = g('[data-mode]'))) { V.mode = t.dataset.mode; V.rid = t.dataset.rid || null; V = Object.assign(V, { step: 0, lvl: 0, mastery: null, open: {} }); render(); window.scrollTo(0, 0); return; }
  if (g('#done')) { const { l } = current(); if (l && V.mastery) complete(l.id, V.mastery); return; }
  if ((t = g('[data-theme]'))) {
    const v = t.dataset.theme;
    if (v) document.documentElement.dataset.theme = v; else delete document.documentElement.dataset.theme;
    S.theme = v; save(); render(); return;
  }
  if ((t = g('[data-fill]'))) { V.q = t.dataset.fill; render(); $('#q').focus(); return; }
  if ((t = g('[data-askq]'))) { V.q = t.dataset.askq; V.tab = 'ask'; V.answer = ''; render(); window.scrollTo(0, 0); return; }
  if (g('#savekey')) {
    S.key = $('#apikey').value.trim(); S.model = $('#model').value.trim() || 'claude-sonnet-5';
    save(); toast(S.key ? 'حُفظ المفتاح' : 'حُذف المفتاح'); render(); return;
  }
  if (g('#clearkey')) { S.key = ''; save(); toast('حُذف المفتاح'); render(); return; }
  if (g('#send')) {
    const q = ($('#q').value || '').trim();
    if (!q) { toast('اكتب سؤالك أولًا'); return; }
    V.q = q; V.busy = true; V.answer = ''; render();
    try { V.answer = await askTeacher(q) || 'لم يصل جواب.'; }
    catch (err) { V.answer = err.message; }
    V.busy = false; render(); return;
  }
  if (g('#exp')) {
    const blob = new Blob([JSON.stringify(S, null, 2)], { type: 'application/json' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob); a.download = 'wird-' + today() + '.json';
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(a.href), 4000); return;
  }
  if (g('#imp')) {
    const i = document.createElement('input'); i.type = 'file'; i.accept = 'application/json';
    i.onchange = () => {
      const f = i.files[0]; if (!f) return;
      const r = new FileReader();
      r.onload = () => {
        try {
          const d = JSON.parse(r.result);
          if (!d || typeof d !== 'object' || !d.items) throw 0;
          S = Object.assign(S, d); S.done = Object.keys(S.items).length; save();
          toast('اُستورد التقدّم'); render();
        } catch (err) { toast('الملف غير صالح'); }
      };
      r.readAsText(f);
    };
    i.click(); return;
  }
  if (g('#reset')) {
    if (V.confirmReset) {
      S = { items: {}, streak: 0, lastDay: null, done: 0, key: S.key, model: S.model, theme: S.theme };
      save(); V.confirmReset = false; toast('صُفِّر التقدّم'); render();
    } else { V.confirmReset = true; toast('اضغط مرّة أخرى للتأكيد'); setTimeout(() => { V.confirmReset = false; }, 4000); }
    return;
  }
});
document.addEventListener('input', e => { if (e.target.id === 'q') V.q = e.target.value; });

/* ---------- الإقلاع ---------- */
(async function boot() {
  load();
  try {
    const [q, l, t, s] = await Promise.all(
      ['data/quran.json', 'data/lessons.json', 'data/teacher.json', 'data/similar.json']
        .map(u => fetch(u).then(r => { if (!r.ok) throw new Error(u); return r.json(); })));
    Q = q; LESSONS = l; TEACHER = t; SIMILAR = s;
    S.done = Object.keys(S.items).length;
    render();
  } catch (e) {
    $('#view').innerHTML = `<div class="card"><div class="empty">
      <h3>تعذّر تحميل بيانات المصحف</h3>
      <p class="tiny">تأكّد من اتصالك مرّة واحدة فقط — بعدها يعمل التطبيق بدون إنترنت.</p></div></div>`;
  }
  if ('serviceWorker' in navigator) {
    try { await navigator.serviceWorker.register('sw.js'); } catch (e) {}
  }
})();
