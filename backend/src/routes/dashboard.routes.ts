import { Router } from 'express';
import { prisma } from '../prisma';
import { requireAuth, requireRole, assertDirectorateAccess } from '../middleware/auth';
import { computeEffectiveStatus } from '../utils/status';
import { computeCompletionRate } from '../services/actionPlan.service';

const router = Router();
router.use(requireAuth);

function summarize(actions: { status: string; endDate: Date | null; isCompleted: boolean; achievedValue: number | null; targetValue: number | null; coordinatorName?: string | null }[]) {
  const summary = { total: actions.length, done: 0, inProgress: 0, late: 0, notStarted: 0, stopped: 0 };
  const rates: number[] = [];
  const byCoordinator: Record<string, { name: string; total: number; done: number; late: number }> = {};

  for (const a of actions) {
    const eff = computeEffectiveStatus({ endDate: a.endDate, isCompleted: a.isCompleted, storedStatus: a.status });
    if (eff === 'DONE') summary.done++;
    else if (eff === 'IN_PROGRESS') summary.inProgress++;
    else if (eff === 'LATE') summary.late++;
    else if (eff === 'STOPPED') summary.stopped++;
    else summary.notStarted++;

    const rate = computeCompletionRate(a.achievedValue, a.targetValue);
    if (rate !== null) rates.push(rate);

    const coordName = a.coordinatorName || 'غير محدد';
    if (!byCoordinator[coordName]) byCoordinator[coordName] = { name: coordName, total: 0, done: 0, late: 0 };
    byCoordinator[coordName].total++;
    if (eff === 'DONE') byCoordinator[coordName].done++;
    if (eff === 'LATE') byCoordinator[coordName].late++;
  }

  const avgCompletionRate = rates.length ? Math.round((rates.reduce((s, r) => s + r, 0) / rates.length) * 10) / 10 : 0;

  return { ...summary, avgCompletionRate, byCoordinator: Object.values(byCoordinator) };
}

// ---------------- GET /api/dashboard/provincial ----------------
router.get('/provincial', async (req, res) => {
  const { directorateId, academicYearId } = req.query as Record<string, string>;
  const user = req.user!;
  const targetDirectorateId = user.role === 'PROVINCIAL' ? user.directorateId! : directorateId;

  if (!targetDirectorateId) return res.status(400).json({ message: 'المديرية مطلوبة.' });
  if (!assertDirectorateAccess(user, targetDirectorateId)) {
    return res.status(403).json({ message: 'ليس لديك صلاحية للوصول إلى بيانات هذه المديرية.' });
  }

  const where: any = { directorateId: targetDirectorateId };
  if (academicYearId) where.academicYearId = academicYearId;

  const [directorate, actions] = await Promise.all([
    prisma.directorate.findUnique({ where: { id: targetDirectorateId } }),
    prisma.action.findMany({ where }),
  ]);

  const summary = summarize(actions);

  // المؤشرات: مقارنة مستهدف/منجز لكل مؤشر
  const indicators = actions
    .filter((a) => a.indicator)
    .map((a) => ({
      indicator: a.indicator,
      target: a.targetValue,
      achieved: a.achievedValue,
      rate: computeCompletionRate(a.achievedValue, a.targetValue),
    }));

  // العمليات المتأخرة والعمليات القريبة من الانتهاء (خلال 7 أيام)
  const now = Date.now();
  const sevenDays = 7 * 24 * 60 * 60 * 1000;
  const late = actions.filter((a) => !a.isCompleted && a.endDate && a.endDate.getTime() < now);
  const upcoming = actions.filter((a) => !a.isCompleted && a.endDate && a.endDate.getTime() >= now && a.endDate.getTime() - now <= sevenDays);

  res.json({
    directorate,
    summary,
    indicators,
    lateActions: late.map((a) => ({ id: a.id, number: a.number, title: a.title, endDate: a.endDate })),
    upcomingActions: upcoming.map((a) => ({ id: a.id, number: a.number, title: a.title, endDate: a.endDate })),
  });
});

// ---------------- GET /api/dashboard/regional ----------------
router.get('/regional', requireRole('ADMIN', 'REGIONAL'), async (req, res) => {
  const { academicYearId } = req.query as Record<string, string>;
  const where: any = {};
  if (academicYearId) where.academicYearId = academicYearId;

  const [directorates, actions] = await Promise.all([
    prisma.directorate.findMany({ orderBy: { name: 'asc' } }),
    prisma.action.findMany({ where, include: { directorate: true } }),
  ]);

  const globalSummary = summarize(actions);

  const byDirectorate = directorates.map((d) => {
    const subset = actions.filter((a) => a.directorateId === d.id);
    const s = summarize(subset);
    return { directorateId: d.id, directorateName: d.name, ...s };
  });

  res.json({ globalSummary, byDirectorate });
});

export default router;
