import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../prisma';
import { requireAuth, assertDirectorateAccess } from '../middleware/auth';
import { getOrCreateActionPlan, writeAuditLog, computeCompletionRate } from '../services/actionPlan.service';
import { computeEffectiveStatus, statusToArabic } from '../utils/status';

const router = Router();
router.use(requireAuth);

const actionObjectSchema = z.object({
  directorateId: z.string().min(1, 'المديرية مطلوبة.'),
  academicYearId: z.string().min(1, 'السنة الدراسية مطلوبة.'),
  number: z.number().int().positive('رقم العملية يجب أن يكون رقمًا موجبًا.').optional(),
  title: z.string().min(1, 'العملية مطلوبة.'),
  coordinatorName: z.string().nullable().optional(),
  startDate: z.string().nullable().optional(),
  endDate: z.string().nullable().optional(),
  indicator: z.string().nullable().optional(),
  currentValue: z.number().nullable().optional(),
  targetValue: z.number().nullable().optional(),
  achievedValue: z.number().nullable().optional(),
  isPercentage: z.boolean().optional(),
  status: z.enum(['NOT_STARTED', 'IN_PROGRESS', 'DONE', 'LATE', 'STOPPED']).optional(),
  isCompleted: z.boolean().optional(),
});

// دوال التحقق المشتركة (تُطبَّق سواء عند الإنشاء أو التعديل)
function withCommonRefinements<T extends z.ZodTypeAny>(schema: T) {
  return schema
    .refine((data: any) => {
      if (data.startDate && data.endDate) {
        return new Date(data.endDate).getTime() >= new Date(data.startDate).getTime();
      }
      return true;
    }, { message: 'تاريخ النهاية يجب ألا يكون قبل تاريخ البداية.', path: ['endDate'] })
    .refine((data: any) => data.achievedValue === undefined || data.achievedValue === null || data.achievedValue >= 0,
      { message: 'القيمة المنجزة لا يجب أن تكون سالبة.', path: ['achievedValue'] });
}

// النسخة الكاملة (تُستعمل عند الإنشاء POST)
const actionSchema = withCommonRefinements(actionObjectSchema);

// النسخة الجزئية (تُستعمل عند التعديل PUT) — .partial() يجب أن يُطبَّق على ZodObject
// مباشرة قبل أي .refine()، لأن .refine() يُحوّل النوع إلى ZodEffects الذي لا يملك partial()
const actionUpdateSchema = withCommonRefinements(
  actionObjectSchema.partial({ directorateId: true, academicYearId: true, number: true, title: true })
);

function serializeAction(a: any) {
  const effectiveStatus = computeEffectiveStatus({
    endDate: a.endDate,
    isCompleted: a.isCompleted,
    storedStatus: a.status,
  });
  return {
    id: a.id,
    number: a.number,
    title: a.title,
    directorateId: a.directorateId,
    directorateName: a.directorate?.name,
    academicYearId: a.academicYearId,
    academicYearLabel: a.academicYear?.label,
    coordinatorName: a.coordinatorName ?? null,
    startDate: a.startDate,
    endDate: a.endDate,
    indicator: a.indicator,
    currentValue: a.currentValue,
    targetValue: a.targetValue,
    achievedValue: a.achievedValue,
    isPercentage: a.isPercentage,
    completionRate: computeCompletionRate(a.achievedValue, a.targetValue),
    status: effectiveStatus,
    statusLabel: statusToArabic(effectiveStatus),
    isCompleted: a.isCompleted,
    completedAt: a.completedAt,
    createdAt: a.createdAt,
    updatedAt: a.updatedAt,
  };
}

const includeRelations = { directorate: true, academicYear: true };

// ---------------- GET /api/actions (list + filters + search + pagination) ----------------
router.get('/', async (req, res) => {
  const user = req.user!;
  const {
    academicYearId, directorateId, status, coordinatorName, search,
    page = '1', pageSize = '20', sortBy = 'number', sortDir = 'asc',
  } = req.query as Record<string, string>;

  const where: any = {};

  // فرض العزل حسب المديرية على مستوى الاستعلام نفسه (وليس فقط إخفاء في الواجهة)
  if (user.role === 'PROVINCIAL') {
    where.directorateId = user.directorateId;
  } else if (directorateId) {
    where.directorateId = directorateId;
  }

  if (academicYearId) where.academicYearId = academicYearId;
  if (coordinatorName) where.coordinatorName = { contains: coordinatorName };
  if (status) where.status = status;
  if (search) {
    where.OR = [
      { title: { contains: search } },
      { indicator: { contains: search } },
      { coordinatorName: { contains: search } },
    ];
    const asNumber = Number(search);
    if (!Number.isNaN(asNumber)) where.OR.push({ number: asNumber });
  }

  const take = Math.min(Number(pageSize) || 20, 200);
  const skip = (Math.max(Number(page) || 1, 1) - 1) * take;

  const [total, items] = await Promise.all([
    prisma.action.count({ where }),
    prisma.action.findMany({
      where,
      include: includeRelations,
      orderBy: { [sortBy]: sortDir === 'desc' ? 'desc' : 'asc' },
      skip,
      take,
    }),
  ]);

  res.json({
    items: items.map(serializeAction),
    total,
    page: Number(page) || 1,
    pageSize: take,
    totalPages: Math.max(Math.ceil(total / take), 1),
  });
});

// ---------------- GET /api/actions/:id ----------------
router.get('/:id', async (req, res) => {
  const action = await prisma.action.findUnique({ where: { id: req.params.id }, include: includeRelations });
  if (!action) return res.status(404).json({ message: 'العملية غير موجودة.' });
  if (!assertDirectorateAccess(req.user!, action.directorateId)) {
    return res.status(403).json({ message: 'ليس لديك صلاحية للوصول إلى هذه البيانات.' });
  }
  res.json(serializeAction(action));
});

// ---------------- POST /api/actions ----------------
router.post('/', async (req, res) => {
  const parsed = actionSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ message: parsed.error.errors[0]?.message || 'بيانات غير صالحة.', errors: parsed.error.errors });
  }
  const data = parsed.data;

  if (!assertDirectorateAccess(req.user!, data.directorateId)) {
    return res.status(403).json({ message: 'لا يمكنك إدخال بيانات لمديرية غير مديرية حسابك.' });
  }

  const plan = await getOrCreateActionPlan(data.directorateId, data.academicYearId);

  // رقم العملية أوتوماتيكي: يُحسب بناءً على عدد العمليات المُبلورة سابقًا في نفس المديرية والسنة الدراسية
  // (ما لم يُرسَل رقم صريح، مثلاً من واجهة إدارية خاصة أو الاستيراد)
  let number = data.number;
  if (!number) {
    const maxNumber = await prisma.action.aggregate({
      where: { directorateId: data.directorateId, academicYearId: data.academicYearId },
      _max: { number: true },
    });
    number = (maxNumber._max.number || 0) + 1;
  } else {
    const duplicate = await prisma.action.findUnique({
      where: { directorateId_academicYearId_number: { directorateId: data.directorateId, academicYearId: data.academicYearId, number } },
    });
    if (duplicate) {
      return res.status(400).json({ message: `رقم العملية ${number} مستعمل مسبقًا في هذه الخطة.` });
    }
  }

  const created = await prisma.action.create({
    data: {
      actionPlanId: plan.id,
      directorateId: data.directorateId,
      academicYearId: data.academicYearId,
      number,
      title: data.title,
      coordinatorName: data.coordinatorName || null,
      startDate: data.startDate ? new Date(data.startDate) : null,
      endDate: data.endDate ? new Date(data.endDate) : null,
      indicator: data.indicator || null,
      currentValue: data.currentValue ?? null,
      targetValue: data.targetValue ?? null,
      achievedValue: data.achievedValue ?? null,
      isPercentage: data.isPercentage ?? true,
      status: 'NOT_STARTED', // في مرحلة البلورة، الوضعية دائمًا "لم تبدأ" — تُغيَّر لاحقًا أثناء التتبع
      isCompleted: false,
      completedAt: null,
      createdById: req.user!.id,
    },
    include: includeRelations,
  });

  await writeAuditLog({ userId: req.user!.id, entityType: 'Action', entityId: created.id, actionType: 'CREATE', after: created });
  res.status(201).json(serializeAction(created));
});

// ---------------- PUT /api/actions/:id ----------------
router.put('/:id', async (req, res) => {
  const existing = await prisma.action.findUnique({ where: { id: req.params.id } });
  if (!existing) return res.status(404).json({ message: 'العملية غير موجودة.' });
  if (!assertDirectorateAccess(req.user!, existing.directorateId)) {
    return res.status(403).json({ message: 'لا يمكنك تعديل بيانات مديرية غير مديرية حسابك.' });
  }

  const parsed = actionUpdateSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ message: parsed.error.errors[0]?.message || 'بيانات غير صالحة.', errors: parsed.error.errors });
  }
  const data = parsed.data;

  if (data.number && data.number !== existing.number) {
    const duplicate = await prisma.action.findUnique({
      where: { directorateId_academicYearId_number: { directorateId: existing.directorateId, academicYearId: existing.academicYearId, number: data.number } },
    });
    if (duplicate) return res.status(400).json({ message: `رقم العملية ${data.number} مستعمل مسبقًا في هذه الخطة.` });
  }

  // منطق زر "تم الإنجاز": عند التفعيل تصبح الوضعية "منجزة" تلقائيًا ويُسجَّل تاريخ الإنجاز
  let statusUpdate: any = {};
  if (data.isCompleted === true && !existing.isCompleted) {
    statusUpdate = { status: 'DONE', completedAt: new Date() };
  } else if (data.isCompleted === false && existing.isCompleted) {
    statusUpdate = { completedAt: null }; // تبقى الوضعية كما اختارها المستخدم يدويًا بعد ذلك
  }

  const updated = await prisma.action.update({
    where: { id: existing.id },
    data: {
      title: data.title ?? undefined,
      coordinatorName: data.coordinatorName !== undefined ? (data.coordinatorName || null) : undefined,
      startDate: data.startDate !== undefined ? (data.startDate ? new Date(data.startDate) : null) : undefined,
      endDate: data.endDate !== undefined ? (data.endDate ? new Date(data.endDate) : null) : undefined,
      indicator: data.indicator !== undefined ? data.indicator : undefined,
      currentValue: data.currentValue !== undefined ? data.currentValue : undefined,
      targetValue: data.targetValue !== undefined ? data.targetValue : undefined,
      achievedValue: data.achievedValue !== undefined ? data.achievedValue : undefined,
      isPercentage: data.isPercentage !== undefined ? data.isPercentage : undefined,
      status: data.status ?? statusUpdate.status ?? undefined,
      isCompleted: data.isCompleted !== undefined ? data.isCompleted : undefined,
      completedAt: 'completedAt' in statusUpdate ? statusUpdate.completedAt : undefined,
    },
    include: includeRelations,
  });

  await writeAuditLog({ userId: req.user!.id, entityType: 'Action', entityId: updated.id, actionType: 'UPDATE', before: existing, after: updated });
  res.json(serializeAction(updated));
});

// ---------------- DELETE /api/actions/:id ----------------
router.delete('/:id', async (req, res) => {
  const existing = await prisma.action.findUnique({ where: { id: req.params.id } });
  if (!existing) return res.status(404).json({ message: 'العملية غير موجودة.' });
  if (!assertDirectorateAccess(req.user!, existing.directorateId)) {
    return res.status(403).json({ message: 'ليس لديك صلاحية للوصول إلى هذه البيانات.' });
  }
  await prisma.action.delete({ where: { id: existing.id } });
  await writeAuditLog({ userId: req.user!.id, entityType: 'Action', entityId: existing.id, actionType: 'DELETE', before: existing });
  res.json({ message: 'تم حذف العملية بنجاح.' });
});

// ---------------- POST /api/actions/:id/duplicate (نسخ عملية) ----------------
router.post('/:id/duplicate', async (req, res) => {
  const existing = await prisma.action.findUnique({ where: { id: req.params.id } });
  if (!existing) return res.status(404).json({ message: 'العملية غير موجودة.' });
  if (!assertDirectorateAccess(req.user!, existing.directorateId)) {
    return res.status(403).json({ message: 'ليس لديك صلاحية للوصول إلى هذه البيانات.' });
  }
  const maxNumber = await prisma.action.aggregate({
    where: { directorateId: existing.directorateId, academicYearId: existing.academicYearId },
    _max: { number: true },
  });
  const created = await prisma.action.create({
    data: {
      actionPlanId: existing.actionPlanId,
      directorateId: existing.directorateId,
      academicYearId: existing.academicYearId,
      number: (maxNumber._max.number || 0) + 1,
      title: existing.title + ' (نسخة)',
      coordinatorName: existing.coordinatorName,
      startDate: existing.startDate,
      endDate: existing.endDate,
      indicator: existing.indicator,
      currentValue: existing.currentValue,
      targetValue: existing.targetValue,
      achievedValue: null,
      isPercentage: existing.isPercentage,
      status: 'NOT_STARTED',
      isCompleted: false,
      createdById: req.user!.id,
    },
    include: includeRelations,
  });
  await writeAuditLog({ userId: req.user!.id, entityType: 'Action', entityId: created.id, actionType: 'CREATE', after: created });
  res.status(201).json(serializeAction(created));
});

export default router;
export { serializeAction, includeRelations };
