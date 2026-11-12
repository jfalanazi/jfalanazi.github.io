"""يقرأ ملف المقاول (ورقة تقرير الأضرار) ويُخرج register.json موحّدًا.
يعتمد على أسماء الأعمدة لا مواقعها، وعلى عمود «م» كمفتاح ثابت للبند."""
import sys, json, re, datetime, openpyxl

SRC, OUT = sys.argv[1], sys.argv[2]
wb = openpyxl.load_workbook(SRC, data_only=True)
ws = next((wb[n] for n in wb.sheetnames if 'الأضرار' in n and 'تقرير' in n), None) or wb[wb.sheetnames[-1]]

COLS = {'num':['م'], 'section':['القسم'], 'item':['الضرر','الأعمال'], 'status':['الحالة'],
        'note':['ملاحظات','آخر تحديث'], 'date':['تاريخ']}
rows = list(ws.iter_rows(values_only=True))
hi = next(i for i,r in enumerate(rows) if r and str(r[0]).strip()=='م')
hdr = [str(h or '').strip() for h in rows[hi]]
def col(key):
    for j,h in enumerate(hdr):
        if key=='num' and h=='م': return j
        if key!='num' and any(k in h for k in COLS[key]):
            if key=='note' and 'تاريخ' in h: continue
            if key=='date' and 'ملاحظات' in h: continue
            return j
    raise SystemExit('عمود مفقود: '+key)
C = {k: col(k) for k in COLS}
# عنوان «آخر تحديث» من أعلى الورقة
asof = next((str(r[0]) for r in rows[:hi] if r and r[0] and 'آخر تحديث' in str(r[0])), '')

# تعريب المصطلحات الإنجليزية — العرض عربي فقط
REPL = [(r'\s*\([^()]*[A-Za-z][^()]*\)', ''), (r'\s*—\s*BMS', ''), (r'نظام UPS', 'نظام التغذية غير المنقطعة'),
        (r'أسطوانات FM200', 'أسطوانات غاز الإطفاء النظيف'), (r'CO₂', 'ثاني أكسيد الكربون'), (r'\bCO2\b', 'ثاني أكسيد الكربون')]
TYPO = [('النهائييوم','النهائي يوم'), ('بمهلة أفساها','بمهلة أقصاها'), ('أفساها','أقصاها'), ('كشق','كشف'), ('الإضاقية','الإضافية'),
        ('بتارخ','بتاريخ'), ('للبدأ','للبدء'), ('اكشف','كشف'), ('التوريق','التوريق'), ('تمّ','تم'), ('يجرى','يُجرى'),
        ('ارسل تقرير','أُرسل التقرير'), ('بحاجة لاتمام','بحاجة لإتمام'), ('تم انجاز','تم إنجاز'), ('تم الانجاز','تم الإنجاز')]
import os
_G = os.path.join(os.path.dirname(os.path.abspath(__file__)), 'glossary.json')
GLOSS = sorted(json.load(open(_G, encoding='utf-8')), key=lambda x: -len(x[0])) if os.path.exists(_G) else []
def localize(s):
    # تعريب مصطلحات المقاول للعرض فقط — ملف المقاول لا يتغير
    for a,b in GLOSS:
        if a in s and not (a in b and b in s): s = s.replace(a, b)
    return s
def clean(s):
    s = str(s or '').strip()
    for a,b in REPL: s = re.sub(a, b, s)
    for a,b in TYPO: s = s.replace(a, b)
    s = re.sub(r'[ \t]+', ' ', s)
    s = re.sub(r'\n\s+', '\n', s)
    return s.strip()

SYSTEMS = [  # (المفتاح، العنوان، كلمات القسم)
  ('clean','🧹 التنظيف والتجهيز',['التنظيف']),
  ('civil','🧱 البناء والتشطيبات',['البناء والتشطيب','مدني','الإزالة']),
  ('hvac','❄️ التكييف والتبريد',['التكييف','التبريد']),
  ('power','⚡ الكهرباء والطاقة',['الكهرباء','الطاقة الاحتياطية','التغذية','المولد','الإنارة']),
  ('fire','🔥 الحماية من الحريق',['الحريق']),
  ('water','💧 المياه والتدفئة والري',['المياه','التدفئة','الري']),
  ('bldg','🖥️ أنظمة المبنى',['التحكم المركزي','إدارة المبنى','المصاعد']),
]
def system_of(sec):
    for k,_,keys in SYSTEMS:
        if any(x in sec for x in keys): return k
    return 'other'
def floor_of(sec, item):
    t = sec+' '+item
    if 'السفلي' in t: return 'b1'
    if 'الأرضي' in t: return 'g'
    if 'الأول' in t and 'السفلي الأول' not in t: return 'f1'
    return ''

STATUS = {'مكتمل':'done','قيد التنفيذ':'progress','منجز جزئيًا':'partial','منجز جزئيا':'partial','قيد التحقق':'verify','عطل مؤكد':'fault'}
items, unknown = [], set()
for r in rows[hi+1:]:
    if not r or r[C['num']] in (None,''): continue
    try: n = int(r[C['num']])
    except: continue
    sec0, item0, st, note0 = clean(r[C['section']]), clean(r[C['item']]), str(r[C['status']] or '').strip(), clean(r[C['note']])
    sec, item, note = localize(sec0), localize(item0), localize(note0)
    d = r[C['date']]
    if isinstance(d, datetime.datetime): d = d.date().isoformat()
    elif isinstance(d, datetime.date): d = d.isoformat()
    else: d = str(d or '').strip()[:10] or None
    sk = STATUS.get(st)
    if not sk: unknown.add(st); sk = 'verify'
    noupd = (not note) or ('لم يرد تحديث' in note)
    items.append({'n':n,'section':sec,'item':item,'itemOrig':(item0 if item0!=item else ''),'status':sk,'statusRaw':st,'note':note,'date':d,
                  'sys':system_of(sec),'floor':floor_of(sec,item),'noUpdate':noupd})
latin = sorted({w for it in items for w in re.findall(r'[A-Za-z][A-Za-z0-9\-]*', it['section']+' '+it['item']+' '+it['note'])})
out = {'asof':clean(asof), 'source':'ملف المقاول', 'builtAt':datetime.datetime.now(datetime.timezone.utc).isoformat(),
       'systems':[{'key':k,'label':l} for k,l,_ in SYSTEMS], 'items':items}
json.dump(out, open(OUT,'w'), ensure_ascii=False, indent=1)
print('بنود:', len(items), '| أرقام مكررة:', len(items)-len({i['n'] for i in items}), '| حالات غير معروفة:', unknown or '—')
print('كلمات لاتينية متبقية:', latin or '—')
from collections import Counter
print('حسب الحالة:', Counter(i['status'] for i in items))
print('حسب النظام:', Counter(i['sys'] for i in items))
print('حسب الطابق:', Counter(i['floor'] or '—' for i in items))
print('بلا إفادة:', sum(i['noUpdate'] for i in items))
