import { prisma } from './prisma';

// أسماء البريد الإلكتروني للحسابات التجريبية التي أُنشئت بواسطة seed.ts (باستثناء admin@aref-ms.ma الذي نُبقيه لتتمكن من الدخول)
const DEMO_PROVINCIAL_AND_REGIONAL_EMAILS = [
  'regional@example.com',
  'marrakech@example.com',
  'essaouira@example.com',
  'kelaasraghna@example.com',
  'youssoufia@example.com',
  'safi@example.com',
  'rehamna@example.com',
  'alhaouz@example.com',
  'chichaoua@example.com',
];

async function main() {
  console.log('🧹 حذف جميع بيانات العمليات التجريبية (Actions, ActionPlans, AuditLogs)...');
  await prisma.auditLog.deleteMany({});
  await prisma.action.deleteMany({});
  await prisma.actionPlan.deleteMany({});

  console.log('🧹 حذف حسابات المستخدمين التجريبية (باستثناء admin@aref-ms.ma)...');
  const { count } = await prisma.user.deleteMany({
    where: { email: { in: DEMO_PROVINCIAL_AND_REGIONAL_EMAILS } },
  });

  console.log(`✅ تم حذف ${count} حساب تجريبي.`);
  console.log('✅ تم الاحتفاظ بـ: المديريات الثمانية، السنوات الدراسية، وحساب admin@aref-ms.ma.');
  console.log('');
  console.log('الخطوات التالية:');
  console.log('1) سجّل الدخول بحساب admin@aref-ms.ma (غيّر كلمة مروره فورًا من صفحة "المستخدمون" أو عبر npx prisma studio).');
  console.log('2) أنشئ حسابات المنسقين الحقيقيين من صفحة "المستخدمون".');
  console.log('3) استورد ملف Excel الحقيقي الخاص بكل مديرية من صفحة "استيراد البيانات"، أو أدخل العمليات يدويًا.');
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(async () => { await prisma.$disconnect(); });
