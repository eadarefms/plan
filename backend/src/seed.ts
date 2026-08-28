import bcrypt from 'bcryptjs';
import { prisma } from './prisma';

const DIRECTORATES: Array<[string, string]> = [
  ['مراكش', 'marrakech'],
  ['الصويرة', 'essaouira'],
  ['قلعة السراغنة', 'kelaa-sraghna'],
  ['اليوسفية', 'youssoufia'],
  ['آسفي', 'safi'],
  ['الرحامنة', 'rehamna'],
  ['الحوز', 'alhaouz'],
  ['شيشاوة', 'chichaoua'],
];

const ACADEMIC_YEARS: Array<[string, number]> = [
  ['2026/2027', 2026],
  ['2027/2028', 2027],
  ['2028/2029', 2028],
  ['2029/2030', 2029],
  ['2030/2031', 2030],
];

const STATUSES = ['NOT_STARTED', 'IN_PROGRESS', 'DONE', 'LATE'] as const;
const SAMPLE_ACTIONS = [
  'تنظيم لقاءات تكوينية لفائدة الأطر الإدارية',
  'تعميم منصة التعلم عن بعد على المؤسسات التعليمية',
  'تكوين المدرسين في استعمال الموارد الرقمية',
  'متابعة تنفيذ مشروع المؤسسة',
  'تنظيم ورشات حول التقويم التربوي',
  'دعم التلاميذ في وضعية إعاقة',
];

async function main() {
  console.log('🌱 بدء التهيئة الأولية (Seed) — بيانات تجريبية يمكن حذفها لاحقًا...');

  const directorateRecords: Record<string, string> = {};
  for (const [name, code] of DIRECTORATES) {
    const d = await prisma.directorate.upsert({ where: { name }, update: {}, create: { name, code } });
    directorateRecords[name] = d.id;
  }

  const yearRecords: Record<string, string> = {};
  for (const [label, startYear] of ACADEMIC_YEARS) {
    const y = await prisma.academicYear.upsert({ where: { label }, update: {}, create: { label, startYear } });
    yearRecords[label] = y.id;
  }

  const passwordHash = await bcrypt.hash('Passer@2026', 10);

  // Admin
  await prisma.user.upsert({
    where: { email: 'admin@aref-ms.ma' },
    update: {},
    create: { email: 'admin@aref-ms.ma', passwordHash, fullName: 'مدير النظام (Demo)', role: 'ADMIN' },
  });

  // المنسق الجهوي
  await prisma.user.upsert({
    where: { email: 'regional@example.com' },
    update: {},
    create: { email: 'regional@example.com', passwordHash, fullName: 'المنسق الجهوي (Demo)', role: 'REGIONAL' },
  });

  const currentYearId = yearRecords['2026/2027'];

  for (const [name, code] of DIRECTORATES) {
    const email = `${code.replace(/-/g, '')}@example.com`;
    await prisma.user.upsert({
      where: { email },
      update: {},
      create: {
        email, passwordHash,
        fullName: `منسق إقليمي ${name} (Demo)`,
        role: 'PROVINCIAL',
        directorateId: directorateRecords[name],
      },
    });

    const coordinatorName = `منسق العمليات - ${name}`;

    const plan = await prisma.actionPlan.upsert({
      where: { directorateId_academicYearId: { directorateId: directorateRecords[name], academicYearId: currentYearId } },
      update: {},
      create: { directorateId: directorateRecords[name], academicYearId: currentYearId },
    });

    for (let i = 0; i < SAMPLE_ACTIONS.length; i++) {
      const status = STATUSES[i % STATUSES.length];
      const target = 100;
      const achieved = status === 'DONE' ? 100 : status === 'IN_PROGRESS' ? 60 : status === 'LATE' ? 30 : 0;
      const start = new Date(2026, 8, 1 + i * 5);
      const end = new Date(2026, 9, 15 + i * 5);

      await prisma.action.upsert({
        where: { directorateId_academicYearId_number: { directorateId: directorateRecords[name], academicYearId: currentYearId, number: i + 1 } },
        update: {},
        create: {
          actionPlanId: plan.id,
          directorateId: directorateRecords[name],
          academicYearId: currentYearId,
          number: i + 1,
          title: SAMPLE_ACTIONS[i],
          coordinatorName,
          startDate: start,
          endDate: end,
          indicator: 'عدد المستفيدين المنجز مقارنة بالمستهدف',
          currentValue: achieved,
          targetValue: target,
          achievedValue: achieved,
          isPercentage: true,
          status,
          isCompleted: status === 'DONE',
          completedAt: status === 'DONE' ? new Date() : null,
        },
      });
    }
  }

  console.log('✅ اكتملت التهيئة الأولية.');
  console.log('---- حسابات الدخول التجريبية (كلمة المرور للجميع: Passer@2026) ----');
  console.log('Admin:        admin@aref-ms.ma');
  console.log('المنسق الجهوي: regional@example.com');
  for (const [name, code] of DIRECTORATES) {
    console.log(`${name}: ${code.replace(/-/g, '')}@example.com`);
  }
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(async () => { await prisma.$disconnect(); });
