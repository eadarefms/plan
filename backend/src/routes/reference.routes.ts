import { Router } from 'express';
import { prisma } from '../prisma';
import { requireAuth, requireRole } from '../middleware/auth';

const router = Router();
router.use(requireAuth);

// ---------- المديريات (قراءة متاحة للجميع، تعديل للـ Admin فقط) ----------
router.get('/directorates', async (_req, res) => {
  const list = await prisma.directorate.findMany({ orderBy: { name: 'asc' } });
  res.json(list);
});

router.post('/directorates', requireRole('ADMIN'), async (req, res) => {
  const { name, code } = req.body || {};
  if (!name || !code) return res.status(400).json({ message: 'اسم المديرية ورمزها مطلوبان.' });
  const created = await prisma.directorate.create({ data: { name, code } });
  res.status(201).json(created);
});

// ---------- السنوات الدراسية ----------
router.get('/academic-years', async (_req, res) => {
  const list = await prisma.academicYear.findMany({ orderBy: { startYear: 'asc' } });
  res.json(list);
});

router.post('/academic-years', requireRole('ADMIN', 'REGIONAL'), async (req, res) => {
  const { label, startYear } = req.body || {};
  if (!label || !startYear) return res.status(400).json({ message: 'تسمية السنة الدراسية وسنة البداية مطلوبتان.' });
  const created = await prisma.academicYear.create({ data: { label, startYear: Number(startYear) } });
  res.status(201).json(created);
});

// ---------- اقتراحات أسماء منسقي العمليات (Autocomplete) ----------
// "منسق العملية" حقل نصي حر (كما في نموذج Excel الأصلي)، وليس قائمة مُدارة.
// هذا المسار يقترح فقط الأسماء المستعملة سابقًا في نفس المديرية لتسهيل الإدخال، دون فرض قائمة مغلقة.
router.get('/coordinator-suggestions', async (req, res) => {
  const { directorateId } = req.query as Record<string, string>;
  const where: any = { coordinatorName: { not: null } };
  if (req.user!.role === 'PROVINCIAL') where.directorateId = req.user!.directorateId;
  else if (directorateId) where.directorateId = directorateId;

  const rows = await prisma.action.findMany({ where, select: { coordinatorName: true }, distinct: ['coordinatorName'] });
  res.json(rows.map((r) => r.coordinatorName).filter(Boolean));
});

export default router;
