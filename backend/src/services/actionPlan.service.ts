import { prisma } from '../prisma';

export async function getOrCreateActionPlan(directorateId: string, academicYearId: string) {
  const existing = await prisma.actionPlan.findUnique({
    where: { directorateId_academicYearId: { directorateId, academicYearId } },
  });
  if (existing) return existing;
  return prisma.actionPlan.create({ data: { directorateId, academicYearId } });
}

export async function writeAuditLog(params: {
  userId?: string | null;
  entityType: string;
  entityId: string;
  actionType: 'CREATE' | 'UPDATE' | 'DELETE';
  before?: unknown;
  after?: unknown;
}) {
  await prisma.auditLog.create({
    data: {
      userId: params.userId || null,
      entityType: params.entityType,
      entityId: params.entityId,
      actionType: params.actionType,
      beforeJson: params.before ? JSON.stringify(params.before) : null,
      afterJson: params.after ? JSON.stringify(params.after) : null,
    },
  });
}

/** نسبة الإنجاز = القيمة المنجزة / القيمة المستهدفة × 100، مع معالجة القسمة على صفر */
export function computeCompletionRate(achieved: number | null, target: number | null): number | null {
  if (achieved === null || achieved === undefined) return null;
  if (!target || target === 0) return null; // لا يمكن حساب نسبة بدون هدف صالح
  return Math.round((achieved / target) * 1000) / 10; // خانة عشرية واحدة
}
