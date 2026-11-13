"""Compare two snapshots of the contractor sheet and print the changes per item.
usage: python3 diff_sheet.py OLD NEW          (each: .xlsx export or .json snapshot)
       python3 diff_sheet.py --snap X.xlsx   (print a JSON snapshot to stdout)"""
import sys, json, hashlib, openpyxl
COLS = {4: 'الحالة', 5: 'الملاحظات', 6: 'التاريخ', 7: 'الطابق', 8: 'مطلوب توضيح'}
def load(p):
    if p.endswith('.json'):
        d = json.load(open(p, encoding='utf-8'))
        d = d.get('items', d)
        return {(int(k) if str(k).isdigit() else k): v for k, v in d.items()}
    ws = openpyxl.load_workbook(p, data_only=True)['تقرير الأضرار']
    out = {}
    for r in range(7, ws.max_row + 1):
        k = ws.cell(r, 1).value
        if k is None: continue
        k = int(k) if isinstance(k, float) else k
        out[k] = {'desc': ws.cell(r, 3).value, **{n: (str(ws.cell(r, c).value).strip() if ws.cell(r, c).value not in (None, '') else '') for c, n in COLS.items()}}
    return out
if sys.argv[1] == '--snap':
    items = load(sys.argv[2])
    h = hashlib.sha1(json.dumps(items, ensure_ascii=False, sort_keys=True).encode()).hexdigest()[:12]
    print(json.dumps({'hash': h, 'items': {str(k): v for k, v in items.items()}}, ensure_ascii=False))
    sys.exit()
a, b = load(sys.argv[1]), load(sys.argv[2])
n = 0
for k in sorted(set(a) | set(b), key=lambda x: (str(type(x)), x)):
    if k not in a: print(f'➕ بند جديد {k}: {b[k]["desc"]}'); n += 1; continue
    if k not in b: print(f'➖ بند محذوف {k}: {a[k]["desc"]}'); n += 1; continue
    ch = [(f, a[k][f], b[k][f]) for f in COLS.values() if a[k][f] != b[k][f]]
    if ch:
        n += 1
        print(f'• بند {k} — {b[k]["desc"]}')
        for f, o, v in ch: print(f'    {f}: «{o[:120]}» ← «{v[:120]}»')
print(f'\nعدد البنود المتغيرة: {n}')
