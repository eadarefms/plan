import { Router } from 'express';
import bcrypt from 'bcryptjs';
import { prisma } from '../prisma';
import { requireAuth, requireRole } from '../middleware/auth';

const router = Router();
router.use(requireAuth, requireRole('ADMIN'));

router.get('/users', async (_req, res) => {
  const users = await prisma.user.findMany({
    include: { directorate: true },
    orderBy: { createdAt: 'asc' },
  });
  res.json(users.map((u) => ({ id: u.id, email: u.email, fullName: u.fullName, role: u.role, directorateId: u.directorateId, directorateName: (u as any).directorate?.name, isActive: u.isActive })));
});

router.post('/users', async (req, res) => {
  const { email, password, fullName, role, directorateId } = req.body || {};
  if (!email || !password || !fullName || !role) {
    return res.status(400).json({ message: 'جميع الحقول (البريد، كلمة المرور، الاسم، الدور) مطلوبة.' });
  }
  if (role === 'PROVINCIAL' && !directorateId) {
    return res.status(400).json({ message: 'يجب تحديد مديرية للمنسق الإقليمي.' });
  }
  const passwordHash = await bcrypt.hash(password, 10);
  try {
    const user = await prisma.user.create({
      data: { email: email.toLowerCase().trim(), passwordHash, fullName, role, directorateId: role === 'PROVINCIAL' ? directorateId : null },
    });
    res.status(201).json({ id: user.id, email: user.email, fullName: user.fullName, role: user.role, directorateId: user.directorateId });
  } catch {
    res.status(400).json({ message: 'هذا البريد الإلكتروني مستعمل مسبقًا.' });
  }
});

router.put('/users/:id', async (req, res) => {
  const { fullName, role, directorateId, isActive, password } = req.body || {};
  const data: any = { fullName, role, directorateId: role === 'PROVINCIAL' ? directorateId : null, isActive };
  if (password) data.passwordHash = await bcrypt.hash(password, 10);
  const updated = await prisma.user.update({ where: { id: req.params.id }, data });
  res.json({ id: updated.id, email: updated.email, fullName: updated.fullName, role: updated.role, directorateId: updated.directorateId, isActive: updated.isActive });
});

router.delete('/users/:id', async (req, res) => {
  await prisma.user.delete({ where: { id: req.params.id } });
  res.json({ message: 'تم حذف المستخدم بنجاح.' });
});

// سجل التغييرات
router.get('/audit-logs', async (req, res) => {
  const { entityId, page = '1', pageSize = '50' } = req.query as Record<string, string>;
  const where: any = {};
  if (entityId) where.entityId = entityId;
  const take = Math.min(Number(pageSize) || 50, 200);
  const skip = (Math.max(Number(page) || 1, 1) - 1) * take;
  const [total, logs] = await Promise.all([
    prisma.auditLog.count({ where }),
    prisma.auditLog.findMany({ where, include: { user: true }, orderBy: { createdAt: 'desc' }, skip, take }),
  ]);
  res.json({
    total,
    items: logs.map((l) => ({
      id: l.id,
      userName: l.user?.fullName || 'غير معروف',
      entityType: l.entityType,
      entityId: l.entityId,
      actionType: l.actionType,
      before: l.beforeJson ? JSON.parse(l.beforeJson) : null,
      after: l.afterJson ? JSON.parse(l.afterJson) : null,
      createdAt: l.createdAt,
    })),
  });
});

export default router;
