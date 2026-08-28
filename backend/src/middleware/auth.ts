import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';

export interface AuthUser {
  id: string;
  email: string;
  fullName: string;
  role: 'ADMIN' | 'REGIONAL' | 'PROVINCIAL';
  directorateId: string | null;
}

declare global {
  namespace Express {
    interface Request {
      user?: AuthUser;
    }
  }
}

const JWT_SECRET = process.env.JWT_SECRET || 'dev-secret-change-me';

export function requireAuth(req: Request, res: Response, next: NextFunction) {
  const header = req.headers.authorization;
  if (!header || !header.startsWith('Bearer ')) {
    return res.status(401).json({ message: 'يجب تسجيل الدخول للوصول إلى هذا المورد.' });
  }
  const token = header.substring('Bearer '.length);
  try {
    const payload = jwt.verify(token, JWT_SECRET) as AuthUser;
    req.user = payload;
    next();
  } catch {
    return res.status(401).json({ message: 'جلسة غير صالحة أو منتهية الصلاحية، يرجى تسجيل الدخول من جديد.' });
  }
}

export function requireRole(...roles: Array<AuthUser['role']>) {
  return (req: Request, res: Response, next: NextFunction) => {
    if (!req.user || !roles.includes(req.user.role)) {
      return res.status(403).json({ message: 'ليس لديك صلاحية للوصول إلى هذه البيانات.' });
    }
    next();
  };
}

/**
 * نقطة الحماية الأساسية ضد تسرب البيانات بين المديريات.
 * تُستعمل من داخل الـ controllers للتحقق أن المستخدم (إن كان PROVINCIAL)
 * لا يحاول الوصول إلا إلى directorateId الخاص بحسابه، بغض النظر عمّا أُرسل في الطلب.
 * المنسق الجهوي والـ Admin غير مقيّدين.
 */
export function assertDirectorateAccess(user: AuthUser, requestedDirectorateId: string | undefined | null) {
  if (user.role === 'REGIONAL' || user.role === 'ADMIN') return true;
  if (user.role === 'PROVINCIAL') {
    if (!requestedDirectorateId) return false;
    return requestedDirectorateId === user.directorateId;
  }
  return false;
}

export { JWT_SECRET };
