# التقرير الجديد (v2): ملخص · جاهزية التشغيل · السجل التفصيلي

المصدر الأساسي: ملف المقاول (إكسل). لا يُعدَّل — الترجمة والتصنيف طبقات عرض فقط.

| الملف | الدور |
|---|---|
| `parse_register.py` | يقرأ ورقة «تقرير الأضرار» → `register.json` (بالأسماء لا المواقع، مفتاح البند = «م») |
| `glossary.json` | تعريب مصطلحات المقاول للعرض |
| `readiness_matrix.json` | مصفوفة المناطق × الخدمات (يقيّمها Claude ويعتمدها المدير) |
| `build_register.py` | يحقن البيانات في `proto-template.html` → `b2-7f3a9c2e/v2/index.html` |

```
python3 parse_register.py <contractor.xlsx> register.json
python3 build_register.py proto-template.html register.json out.html ../../b2-7f3a9c2e/v2/index.html
```
