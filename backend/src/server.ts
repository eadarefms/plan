import 'dotenv/config';
import express from 'express';
import cors from 'cors';

import authRoutes from './routes/auth.routes';
import referenceRoutes from './routes/reference.routes';
import actionsRoutes from './routes/actions.routes';
import dashboardRoutes from './routes/dashboard.routes';
import importExportRoutes from './routes/importExport.routes';
import adminRoutes from './routes/admin.routes';

const app = express();

app.use(
  cors({
    origin: process.env.CORS_ORIGIN || '*',
  })
);

app.use(express.json());

app.get('/api/health', (_req, res) => {
  res.json({ status: 'ok' });
});

app.use('/api/auth', authRoutes);
app.use('/api', referenceRoutes);
app.use('/api/actions', actionsRoutes);
app.use('/api/dashboard', dashboardRoutes);
app.use('/api', importExportRoutes);
app.use('/api/admin', adminRoutes);

// Gestionnaire d'erreurs global
app.use(
  (
    err: any,
    _req: express.Request,
    res: express.Response,
    _next: express.NextFunction
  ) => {
    console.error(err);
    res.status(500).json({
      message: 'حدث خطأ أثناء معالجة الطلب.',
    });
  }
);

export default app;

// En développement local uniquement.
// En production, Vercel importe directement l'application Express.
if (process.env.NODE_ENV !== 'production') {
  const PORT = process.env.PORT || 4000;

  app.listen(PORT, () => {
    console.log(`✅ AREF Plan Tracker API يعمل على المنفذ ${PORT}`);
  });
}
