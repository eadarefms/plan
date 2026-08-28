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
