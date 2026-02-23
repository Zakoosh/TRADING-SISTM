# تحديثات قاعدة البيانات - جدول الأسهم

## نظرة عامة
تم إضافة جدول `stocks` لتخزين جميع الأسهم المتاحة في قاعدة البيانات بدلاً من استخدام القيم الثابتة في الكود.

## التحديثات المطلوبة

### 1. تحديث Schema
قم بتشغيل ملف `schema.sql` الجديد على قاعدة بيانات Supabase:
```bash
psql -h <your-supabase-host> -U postgres -d postgres -f supabase/schema.sql
```

أو من لوحة تحكم Supabase:
1. افتح SQL Editor
2. انسخ محتوى ملف `supabase/schema.sql`
3. نفذ الاستعلام

### 2. إدخال البيانات الأولية
بعد إنشاء الجدول، قم بتشغيل ملف `seed.sql` لإضافة الأسهم:
```bash
psql -h <your-supabase-host> -U postgres -d postgres -f supabase/seed.sql
```

أو من SQL Editor في Supabase:
1. انسخ محتوى ملف `supabase/seed.sql`
2. نفذ الاستعلام

### 3. التحقق من البيانات
تحقق من إضافة الأسهم بنجاح:
```sql
SELECT market, COUNT(*) as count FROM stocks GROUP BY market;
```

يجب أن ترى:
- US: 40 سهم
- TR: 25 سهم
- CRYPTO: 20 عملة
- COMMODITY: 12 سلعة
- INDEX: 13 مؤشر

ويمكنك التحقق من الإجمالي:
```sql
SELECT COUNT(*) FROM stocks;
```

المتوقع بعد تشغيل `seed.sql`: **110** رمز.

## الميزات الجديدة

### 1. جدول الأسهم (stocks)
- تخزين جميع الأسهم المتاحة
- تصنيف حسب السوق (US, TR, CRYPTO, COMMODITY, INDEX)
- إمكانية إضافة/تعطيل الأسهم
- البحث السريع

### 2. واجهة قائمة المتابعة المحدثة
- **Combobox قابل للبحث**: بدلاً من Input بسيط، أصبح لديك قائمة منسدلة ذكية
- **البحث المباشر**: ابحث في الأسهم أثناء الكتابة
- **تصنيف حسب السوق**: اختر السوق ثم ابحث عن السهم
- **استبعاد الأسهم المضافة**: لا تظهر الأسهم الموجودة بالفعل في قائمة المتابعة

### 3. الدوال الجديدة في Supabase
- `fetchAllStocks()`: جلب جميع الأسهم
- `fetchStocksByMarket(market)`: جلب أسهم سوق معين
- `searchStocks(query, market?)`: البحث في الأسهم

## إضافة أسهم جديدة

يمكنك إضافة أسهم جديدة مباشرة إلى قاعدة البيانات:
```sql
INSERT INTO stocks (symbol, name, market, currency) VALUES
('ORCL', 'Oracle Corporation', 'US', 'USD')
ON CONFLICT (symbol) DO NOTHING;
```

أو من Supabase Dashboard:
1. افتح Table Editor
2. اختر جدول `stocks`
3. أضف صف جديد

## مزامنة الأسهم مباشرة من Twelve Data (مع مراعاة API limit)

بدل إدخال الأسهم يدويًا، يمكنك مزامنتها من Twelve Data لتتطابق الرموز مع مصدر الأسعار.

### 1) تجهيز المتغيرات
أضف في `.env`:

```dotenv
TWELVE_DATA_API_KEY=...
SUPABASE_URL=...
SUPABASE_SERVICE_ROLE_KEY=...

# اختياري: التحكم بالحدود
TWELVE_SYNC_INTERVAL_MS=8500
TWELVE_SYNC_MAX_REQUESTS=20
TWELVE_SYNC_MAX_US=400
TWELVE_SYNC_MAX_TR=250
TWELVE_SYNC_MAX_CRYPTO=300
TWELVE_SYNC_MAX_COMMODITY=80
TWELVE_SYNC_MAX_INDEX=120
```

### 2) تشغيل المزامنة
```bash
npm run sync:stocks
```

### 3) ماذا يفعل السكربت؟
- يجلب الرموز من Twelve Data حسب الفئات (`stocks`, `cryptocurrencies`, `indices`, `commodities`).
- يطبق تأخير بين الطلبات (افتراضي ~8.5 ثانية ≈ 7 طلب/دقيقة).
- يلتزم بميزانية طلبات لكل تشغيل (افتراضي 20 طلب).
- ينفذ `upsert` على جدول `stocks` بدون حذف البيانات الحالية.

### 4) إذا لم تضع `SUPABASE_SERVICE_ROLE_KEY`
السكربت ينشئ ملف:

`supabase/generated_twelve_stocks.sql`

ثم يمكنك تشغيله يدويًا في SQL Editor.

## الملاحظات
- جميع الأسهم لها وصول عام للقراءة (RLS Policy)
- الأسهم غير النشطة (`is_active = false`) لا تظهر في النتائج
- يمكن إضافة المزيد من الأسهم حسب الحاجة

## حل مشكلة "الأسهم لا تظهر في الموقع"
إذا كانت الأسهم موجودة في قاعدة البيانات ولا تظهر في الواجهة، تحقق من التالي:

1. تأكد من صحة متغيرات البيئة:
	- `VITE_SUPABASE_URL`
	- `VITE_SUPABASE_ANON_KEY`
2. تأكد أن الجدول `stocks` يحتوي أسهمًا فعالة:
	```sql
	SELECT symbol, market, is_active FROM stocks WHERE is_active = true LIMIT 20;
	```
3. تأكد من تفعيل RLS Policy للقراءة العامة على `stocks`.
4. أعد تشغيل واجهة Vite بعد تحديث المتغيرات (`npm run dev`).
