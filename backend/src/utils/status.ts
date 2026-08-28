// تحويل بين قيمة enum الداخلية (إنجليزية) والتسمية العربية المعروضة للمستخدم
// هذا هو المكان الوحيد الذي يعرّف هذا الربط — أي تعديل مستقبلي على الحالات يمر من هنا فقط

export const STATUS_LABELS_AR: Record<string, string> = {
  NOT_STARTED: 'لم تبدأ',
  IN_PROGRESS: 'في طور الإنجاز',
  DONE: 'منجزة',
  LATE: 'متأخرة',
  STOPPED: 'متوقفة',
};

export const STATUS_FROM_AR: Record<string, string> = Object.fromEntries(
  Object.entries(STATUS_LABELS_AR).map(([k, v]) => [v, k])
);

// دعم التسميات البديلة الموجودة في ملف Excel الأصلي (Feuil1)
STATUS_FROM_AR['لم تبدأ بعد'] = 'NOT_STARTED';

export function statusToArabic(status: string): string {
  return STATUS_LABELS_AR[status] ?? status;
}

export function statusFromArabic(label: string): string | null {
  const trimmed = (label || '').trim();
  return STATUS_FROM_AR[trimmed] ?? null;
}

/**
 * منطق تحديد "العملية المتأخرة":
 * العملية تعتبر متأخرة إذا كان تاريخ نهاية الإنجاز المخطط قد مضى (< اليوم)
 * والعملية ليست منجزة (isCompleted = false).
 * هذا المنطق محسوب ديناميكيًا عند القراءة (وليس مخزنًا) حتى يبقى صحيحًا مع مرور الوقت،
 * لكنه أيضًا يُطبّق كمزامنة عند إنشاء/تعديل العملية لتحديث الحالة المخزنة فعليًا في status.
 */
export function computeEffectiveStatus(params: {
  endDate: Date | null;
  isCompleted: boolean;
  storedStatus: string;
}): string {
  const { endDate, isCompleted, storedStatus } = params;
  if (isCompleted) return 'DONE';
  if (storedStatus === 'STOPPED') return 'STOPPED';
  if (endDate && endDate.getTime() < Date.now()) return 'LATE';
  return storedStatus;
}
