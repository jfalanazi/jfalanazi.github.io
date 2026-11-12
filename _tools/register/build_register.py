"""يحقن register.json في القالب ويُخرج صفحتين: جزء صفحة (Artifact) ومستند كامل (GitHub)."""
import sys, json, re
tpl, data, frag_out = sys.argv[1], sys.argv[2], sys.argv[3]
full_out = sys.argv[4] if len(sys.argv) > 4 else None
h = open(tpl, encoding='utf-8').read()
d = json.load(open(data, encoding='utf-8'))
import os
_r = os.path.join(os.path.dirname(os.path.abspath(data)), 'readiness.json')
if os.path.exists(_r):
    R = json.load(open(_r, encoding='utf-8'))
    for it in d['items']:
        x = R.get(str(it['n']))
        if x: it['ready'] = x['cls']; it['cond'] = x.get('cond','')
d['asof'] = d.get('asof','').replace('تشرين الثاني','نوفمبر').replace('آخر تحديث وفق الملف: ','آخر تحديث: ').replace('الساعة ','').replace('بعد الظهر','م')
blob = json.dumps(d, ensure_ascii=False).replace('</', '<\\/')
h2, n = re.subn(r'/\* ==REG_START== \*/.*?/\* ==REG_END== \*/', lambda m: '/* ==REG_START== */\n  var REG = ' + blob + ';\n  /* ==REG_END== */', h, flags=re.S)
assert n == 1, 'علامة البيانات مفقودة'
_m = os.path.join(os.path.dirname(os.path.abspath(data)), 'readiness_matrix.json')
if '==RDY_START==' in h2 and os.path.exists(_m):
    mblob = json.dumps(json.load(open(_m, encoding='utf-8')), ensure_ascii=False).replace('</','<\\/')
    h2, k = re.subn(r'/\* ==RDY_START== \*/.*?/\* ==RDY_END== \*/', lambda m: '/* ==RDY_START== */\n  var RDY = ' + mblob + ';\n  /* ==RDY_END== */', h2, flags=re.S)
    assert k == 1
open(frag_out, 'w', encoding='utf-8').write(h2)
if full_out:
    open(full_out, 'w', encoding='utf-8').write('<!doctype html>\n<html lang="ar" dir="rtl">\n<head>\n<meta charset="utf-8">\n'
      '<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">\n'
      '<meta name="robots" content="noindex, nofollow, noarchive">\n</head>\n<body>\n' + h2 + '\n</body>\n</html>\n')
print('✅', frag_out, '| بنود:', len(d['items']), '|', d['asof'])
