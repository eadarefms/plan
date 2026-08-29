# AREF Plan Tracker — Backend

## Vercel + Neon

Le backend est préparé pour être déployé comme API Express sur Vercel.

### Local
```bash
npm install
npx prisma generate
npm run build
npm run dev
```

Test :
`http://localhost:4000/api/health`

### Variables Vercel
- `DATABASE_URL` : URL PostgreSQL Neon
- `JWT_SECRET` : secret JWT long et aléatoire
- `JWT_EXPIRES_IN` : `8h`
- `CORS_ORIGIN` : URL publique du frontend

### Migration PostgreSQL
Après avoir configuré `DATABASE_URL` localement :
```bash
npx prisma migrate dev --name init_postgres
```

Puis, en production :
```bash
npx prisma migrate deploy
```

Important : le dossier `prisma/migrations` doit être commité dans GitHub avant le déploiement de production.

### Déploiement Vercel
Si le dépôt contient `frontend/` et `backend/`, choisissez `backend` comme Root Directory dans Vercel.

Le point d'entrée Vercel est :
`api/index.ts`

## استعادة كلمة المرور عبر البريد الإلكتروني

تمت إضافة:
- `POST /api/auth/forgot-password`
- `POST /api/auth/reset-password`
- صفحة frontend: `/forgot-password`
- صفحة frontend: `/reset-password?token=...`

يتم إنشاء رمز عشوائي، تخزين بصمته فقط في قاعدة البيانات، وصلاحية الرابط 30 دقيقة ويُستخدم مرة واحدة فقط.

### إعداد البريد الإلكتروني في Vercel

أضف في **Environment Variables → Production**:
- `RESEND_API_KEY` = مفتاح API من Resend
- `EMAIL_FROM` = عنوان مرسل من نطاق تم التحقق منه في Resend، مثال: `نظام تتبع خطط العمل <noreply@aref-ms.ma>`
- `FRONTEND_URL` = `https://arefplan.vercel.app`

بعد إضافة المتغيرات، أعد نشر الـ backend.

### تطبيق تعديل قاعدة البيانات

من مجلد `backend`:
```bash
npx prisma generate
npx prisma migrate deploy
npm run build
```

ثم ادفع التغييرات إلى GitHub، وسيتم نشرها على Vercel.
