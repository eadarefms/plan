import { Router } from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { prisma } from '../prisma';
import { requireAuth, JWT_SECRET } from '../middleware/auth';

const router = Router();

router.post('/login', async (req, res) => {
  const { email, password } = req.body || {};
  if (!email || !password) {
    return res.status(400).json({ message: 'البريد الإلكتروني وكلمة المرور مطلوبان.' });
  }

  const user = await prisma.user.findUnique({ where: { email: String(email).toLowerCase().trim() } });
  if (!user || !user.isActive) {
    return res.status(401).json({ message: 'البريد الإلكتروني أو كلمة المرور غير صحيحة.' });
  }

  const valid = await bcrypt.compare(password, user.passwordHash);
  if (!valid) {
    return res.status(401).json({ message: 'البريد الإلكتروني أو كلمة المرور غير صحيحة.' });
  }

  const payload = {
    id: user.id,
    email: user.email,
    fullName: user.fullName,
    role: user.role,
    directorateId: user.directorateId,
  };

  const token = jwt.sign(payload, JWT_SECRET, { expiresIn: (process.env.JWT_EXPIRES_IN || '8h') as any });
  res.json({ token, user: payload });
});

router.get('/me', requireAuth, (req, res) => {
  res.json({ user: req.user });
});

// ---------------- POST /api/auth/change-password ----------------
// يسمح لأي مستخدم مسجَّل الدخول (منسق إقليمي، منسق جهوي، أو Admin) بتغيير كلمة مروره الخاصة
router.post('/change-password', requireAuth, async (req, res) => {
  const { currentPassword, newPassword } = req.body || {};
  if (!currentPassword || !newPassword) {
    return res.status(400).json({ message: 'كلمة المرور الحالية والجديدة مطلوبتان.' });
  }
  if (String(newPassword).length < 6) {
    return res.status(400).json({ message: 'يجب أن تتكون كلمة المرور الجديدة من 6 أحرف على الأقل.' });
  }

  const user = await prisma.user.findUnique({ where: { id: req.user!.id } });
  if (!user) return res.status(404).json({ message: 'المستخدم غير موجود.' });

  const valid = await bcrypt.compare(currentPassword, user.passwordHash);
  if (!valid) {
    return res.status(401).json({ message: 'كلمة المرور الحالية غير صحيحة.' });
  }

  const passwordHash = await bcrypt.hash(newPassword, 10);
  await prisma.user.update({ where: { id: user.id }, data: { passwordHash } });

  res.json({ message: 'تم تغيير كلمة المرور بنجاح.' });
});

export default router;
