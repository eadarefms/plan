import { Router } from 'express';
import crypto from 'crypto';
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


// ---------------- POST /api/auth/forgot-password ----------------
// يرسل رابطًا مؤقتًا لإعادة تعيين كلمة المرور. لا يتم كشف ما إذا كان البريد مسجلاً.
router.post('/forgot-password', async (req, res) => {
  const email = String(req.body?.email || '').toLowerCase().trim();
  const genericMessage = 'إذا كان البريد الإلكتروني مسجلاً في النظام، فسيتم إرسال رابط استعادة كلمة المرور.';

  if (!email) return res.status(400).json({ message: 'البريد الإلكتروني مطلوب.' });

  try {
    const user = await prisma.user.findUnique({ where: { email } });
    if (!user || !user.isActive) {
      return res.json({ message: genericMessage });
    }

    const rawToken = crypto.randomBytes(32).toString('hex');
    const tokenHash = crypto.createHash('sha256').update(rawToken).digest('hex');
    const expiresAt = new Date(Date.now() + 30 * 60 * 1000);

    await prisma.passwordResetToken.deleteMany({
      where: { userId: user.id, usedAt: null },
    });

    await prisma.passwordResetToken.create({
      data: { tokenHash, userId: user.id, expiresAt },
    });

    const frontendUrl = (process.env.FRONTEND_URL || '').replace(/\/$/, '');
    const apiKey = process.env.RESEND_API_KEY;
    const from = process.env.EMAIL_FROM;

    if (!frontendUrl || !apiKey || !from) {
      console.error('Password reset email is not configured. Required: FRONTEND_URL, RESEND_API_KEY, EMAIL_FROM');
      await prisma.passwordResetToken.deleteMany({ where: { tokenHash } });
      return res.json({ message: genericMessage });
    }

    const resetUrl = `${frontendUrl}/reset-password?token=${encodeURIComponent(rawToken)}`;
    const emailResponse = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from,
        to: [user.email],
        subject: 'استعادة كلمة المرور - نظام تتبع خطط العمل',
        html: `
          <div dir="rtl" style="font-family:Arial,sans-serif;line-height:1.8;color:#1e293b;max-width:620px;margin:auto">
            <h2 style="color:#1d4ed8">استعادة كلمة المرور</h2>
            <p>مرحبًا ${escapeHtml(user.fullName)},</p>
            <p>تم طلب إعادة تعيين كلمة المرور لحسابك في نظام تتبع خطط العمل.</p>
            <p>اضغط على الزر التالي لتعيين كلمة مرور جديدة. الرابط صالح لمدة <strong>30 دقيقة</strong> ويُستخدم مرة واحدة فقط.</p>
            <p style="margin:28px 0"><a href="${resetUrl}" style="background:#2563eb;color:white;padding:12px 22px;border-radius:8px;text-decoration:none;display:inline-block">إعادة تعيين كلمة المرور</a></p>
            <p style="font-size:13px;color:#64748b">إذا لم تطلب ذلك، يمكنك تجاهل هذه الرسالة.</p>
          </div>
        `,
      }),
    });

    if (!emailResponse.ok) {
      const details = await emailResponse.text();
      console.error('Resend email error:', details);
      await prisma.passwordResetToken.deleteMany({ where: { tokenHash } });
    }

    return res.json({ message: genericMessage });
  } catch (error) {
    console.error('Forgot password error:', error);
    return res.json({ message: genericMessage });
  }
});

// ---------------- POST /api/auth/reset-password ----------------
router.post('/reset-password', async (req, res) => {
  const token = String(req.body?.token || '');
  const newPassword = String(req.body?.newPassword || '');

  if (!token || !newPassword) {
    return res.status(400).json({ message: 'رمز الاستعادة وكلمة المرور الجديدة مطلوبان.' });
  }
  if (newPassword.length < 6) {
    return res.status(400).json({ message: 'يجب أن تتكون كلمة المرور الجديدة من 6 أحرف على الأقل.' });
  }

  try {
    const tokenHash = crypto.createHash('sha256').update(token).digest('hex');
    const resetToken = await prisma.passwordResetToken.findUnique({
      where: { tokenHash },
      include: { user: true },
    });

    if (!resetToken || resetToken.usedAt || resetToken.expiresAt <= new Date() || !resetToken.user.isActive) {
      return res.status(400).json({ message: 'رابط استعادة كلمة المرور غير صالح أو انتهت صلاحيته.' });
    }

    const passwordHash = await bcrypt.hash(newPassword, 10);
    const now = new Date();

    await prisma.$transaction([
      prisma.user.update({ where: { id: resetToken.userId }, data: { passwordHash } }),
      prisma.passwordResetToken.update({ where: { id: resetToken.id }, data: { usedAt: now } }),
      prisma.passwordResetToken.updateMany({
        where: { userId: resetToken.userId, usedAt: null, id: { not: resetToken.id } },
        data: { usedAt: now },
      }),
    ]);

    return res.json({ message: 'تم تغيير كلمة المرور بنجاح، يمكنك الآن تسجيل الدخول.' });
  } catch (error) {
    console.error('Reset password error:', error);
    return res.status(500).json({ message: 'حدث خطأ أثناء إعادة تعيين كلمة المرور.' });
  }
});

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

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
