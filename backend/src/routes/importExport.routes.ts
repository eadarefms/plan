import { Router } from 'express';
import multer from 'multer';
import ExcelJS from 'exceljs';
import { prisma } from '../prisma';
import { requireAuth, assertDirectorateAccess } from '../middleware/auth';
import { getOrCreateActionPlan, writeAuditLog } from '../services/actionPlan.service';
import { statusFromArabic, statusToArabic } from '../utils/status';
import { includeRelations } from './actions.routes';

const router = Router();
router.use(requireAuth);
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 10 * 1024 * 1024 } });

// ترتيب وأسماء الأعمدة كما في ملف "خطة العمل" الأصلي (يبدأ العنوان من الصف 6)
const HEADER_ROW = 6;
const DATA_START_ROW = 7;
const COLUMNS = ['number', 'title', 'coordinatorName', 'startDate', 'endDate', 'indicator', 'currentValue', 'targetValue', 'achievedValue', 'statusLabel'];

interface ParsedRow {
  rowNumber: number;
  sheetName: string;
  data: Record<string, any>;
  errors: string[];
}

function excelDateToJsDate(value: any): Date | null {
  if (!value) return null;
  if (value instanceof Date) return value;
  if (typeof value === 'number') {
    // تاريخ Excel التسلسلي
    return new Date(Math.round((value - 25569) * 86400 * 1000));
  }
  const parsed = new Date(value);
  return isNaN(parsed.getTime()) ? null : parsed;
}

async function parseWorkbook(buffer: Buffer, allowedDirectorateNames: string[] | null) {
  const workbook = new ExcelJS.Workbook();
  // ExcelJS 4.x typings expect the legacy Node Buffer type.
  // The current @types/node exposes Buffer<ArrayBufferLike>, so cast only at this boundary.
  await workbook.xlsx.load(buffer as any);

  const directorates = await prisma.directorate.findMany();
  const directoratesByName = new Map(directorates.map((d) => [d.name.trim(), d]));

  const parsedRows: ParsedRow[] = [];

  for (const worksheet of workbook.worksheets) {
    const sheetName = worksheet.name.trim();
    const directorate = directoratesByName.get(sheetName);
    if (!directorate) continue; // ورقة لا تطابق اسم مديرية معروفة (مثل Feuil1) — تُتجاهل
    if (allowedDirectorateNames && !allowedDirectorateNames.includes(sheetName)) continue;

    for (let r = DATA_START_ROW; r <= worksheet.rowCount; r++) {
      const row = worksheet.getRow(r);
      const cellA = row.getCell(1).value;
      const cellB = row.getCell(2).value;
      if (cellA === null && cellB === null) continue; // صف فارغ

      const errors: string[] = [];
      const number = typeof cellA === 'number' ? cellA : Number(cellA);
      const title = cellB ? String(cellB).trim() : '';
      const coordinatorName = row.getCell(3).value ? String(row.getCell(3).value).trim() : null;
      const startDate = excelDateToJsDate(row.getCell(4).value);
      const endDate = excelDateToJsDate(row.getCell(5).value);
      const indicator = row.getCell(6).value ? String(row.getCell(6).value).trim() : null;
      const currentValue = row.getCell(7).value != null ? Number(row.getCell(7).value) : null;
      const targetValue = row.getCell(8).value != null ? Number(row.getCell(8).value) : null;
      const achievedValue = row.getCell(9).value != null ? Number(row.getCell(9).value) : null;
      const statusRaw = row.getCell(10).value ? String(row.getCell(10).value).trim() : null;

      if (!number || Number.isNaN(number) || number <= 0) errors.push('رقم العملية مطلوب ويجب أن يكون رقمًا موجبًا.');
      if (!title) errors.push('العملية (الوصف) مطلوب.');
      if (startDate && endDate && endDate.getTime() < startDate.getTime()) errors.push('تاريخ النهاية يجب ألا يكون قبل تاريخ البداية.');
      if (achievedValue !== null && achievedValue < 0) errors.push('القيمة المنجزة لا يجب أن تكون سالبة.');

      let statusEnum: string | null = 'NOT_STARTED';
      if (statusRaw) {
        statusEnum = statusFromArabic(statusRaw);
        if (!statusEnum) errors.push(`وضعية العملية "${statusRaw}" غير معروفة (القيم المقبولة: منجزة، في طور الإنجاز، متأخرة، لم تبدأ، متوقفة).`);
      }

      parsedRows.push({
        rowNumber: r,
        sheetName,
        data: {
          directorateId: directorate.id,
          directorateName: directorate.name,
          number, title, coordinatorName, startDate, endDate, indicator,
          currentValue, targetValue, achievedValue,
          status: statusEnum,
          statusLabel: statusRaw ? statusToArabic(statusEnum || '') : 'لم تبدأ',
          isCompleted: statusEnum === 'DONE',
        },
        errors,
      });
    }
  }

  return parsedRows;
}

// ---------------- GET /api/import/template (تحميل نموذج Excel فارغ للتعبئة) ----------------
router.get('/import/template', async (req, res) => {
  const user = req.user!;

  const directorates = user.role === 'PROVINCIAL'
    ? await prisma.directorate.findMany({ where: { id: user.directorateId! } })
    : await prisma.directorate.findMany({ orderBy: { name: 'asc' } });

  const workbook = new ExcelJS.Workbook();
  const headers = ['رقم العملية', 'العملية', 'منسق العملية', 'بداية الإنجاز', 'نهاية الإنجاز', 'المؤشر', 'القيمة الحالية', 'القيمة المستهدفة', 'القيمة المنجزة', 'وضعية العملية'];
  const statusChoices = ['لم تبدأ', 'في طور الإنجاز', 'منجزة', 'متأخرة', 'متوقفة'];
  const TEMPLATE_LAST_ROW = 200; // عدد الصفوف الفارغة الجاهزة للتعبئة في كل ورقة

  for (const directorate of directorates) {
    const sheet = workbook.addWorksheet(directorate.name, { views: [{ rightToLeft: true }] });

    // نفس بنية النموذج الأصلي: عنوان مدمج من A1 إلى J5، ثم رؤوس الأعمدة في الصف 6، والبيانات تبدأ من الصف 7
    sheet.mergeCells('A1:J5');
    const titleCell = sheet.getCell('A1');
    titleCell.value = `خطة العمل السنوية - ${directorate.name}`;
    titleCell.font = { bold: true, size: 16 };
    titleCell.alignment = { horizontal: 'center', vertical: 'middle' };

    const headerRow = sheet.getRow(6);
    headers.forEach((h, idx) => { headerRow.getCell(idx + 1).value = h; });
    headerRow.font = { bold: true };
    headerRow.eachCell((cell) => {
      cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFEFF6FF' } };
      cell.alignment = { horizontal: 'center' };
    });

    sheet.columns = [
      { width: 10 }, { width: 45 }, { width: 22 }, { width: 16 }, { width: 16 },
      { width: 33 }, { width: 16 }, { width: 16 }, { width: 16 }, { width: 20 },
    ];

    // تنسيق أعمدة التاريخ والقيم على كل الصفوف الفارغة الجاهزة + قائمة منسدلة لوضعية العملية
    for (let r = 7; r <= TEMPLATE_LAST_ROW; r++) {
      sheet.getCell(`D${r}`).numFmt = 'yyyy-mm-dd';
      sheet.getCell(`E${r}`).numFmt = 'yyyy-mm-dd';
      sheet.getCell(`G${r}`).numFmt = '0%';
      sheet.getCell(`H${r}`).numFmt = '0%';
      sheet.getCell(`I${r}`).numFmt = '0%';
      sheet.getCell(`J${r}`).dataValidation = {
        type: 'list',
        allowBlank: true,
        formulae: [`"${statusChoices.join(',')}"`],
        showErrorMessage: true,
        errorTitle: 'وضعية غير صحيحة',
        error: 'يرجى اختيار وضعية من القائمة المقترحة.',
      };
    }

    sheet.getCell('A' + (TEMPLATE_LAST_ROW + 3)).value =
      'ملاحظة: أعمدة القيمة الحالية/المستهدفة/المنجزة منسّقة كنسبة مئوية افتراضيًا. إذا كان مؤشرك عددًا مطلقًا (وليس نسبة)، أدخل الرقم عاديًا (مثال: 25) وسيتم التعرف عليه كعدد عند الاستيراد إذا اخترت ذلك لاحقًا داخل التطبيق.';
    sheet.getCell('A' + (TEMPLATE_LAST_ROW + 3)).font = { italic: true, size: 10, color: { argb: 'FF6B7280' } };
  }

  if (directorates.length === 0) workbook.addWorksheet('لا توجد مديرية متاحة');

  res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
  res.setHeader('Content-Disposition', 'attachment; filename="نموذج-استيراد-خطة-العمل.xlsx"');
  await workbook.xlsx.write(res);
  res.end();
});

// ---------------- POST /api/import/preview ----------------
router.post('/import/preview', upload.single('file'), async (req, res) => {
  if (!req.file) return res.status(400).json({ message: 'لم يتم إرفاق أي ملف.' });

  const user = req.user!;
  const allowedNames = user.role === 'PROVINCIAL'
    ? [(await prisma.directorate.findUnique({ where: { id: user.directorateId! } }))?.name || '']
    : null;

  try {
    const rows = await parseWorkbook(req.file.buffer, allowedNames);
    const validRows = rows.filter((r) => r.errors.length === 0);
    const invalidRows = rows.filter((r) => r.errors.length > 0);
    res.json({
      totalRows: rows.length,
      validCount: validRows.length,
      invalidCount: invalidRows.length,
      preview: rows.slice(0, 200), // عرض أول 200 صف كمعاينة
    });
  } catch (e: any) {
    res.status(400).json({ message: 'تعذّرت قراءة الملف. تأكد أنه بصيغة Excel صحيحة ومطابق للنموذج.', detail: e.message });
  }
});

// ---------------- POST /api/import/commit ----------------
router.post('/import/commit', upload.single('file'), async (req, res) => {
  if (!req.file) return res.status(400).json({ message: 'لم يتم إرفاق أي ملف.' });
  const { academicYearId } = req.body;
  if (!academicYearId) return res.status(400).json({ message: 'السنة الدراسية مطلوبة قبل الاستيراد.' });

  const academicYear = await prisma.academicYear.findUnique({ where: { id: academicYearId } });
  if (!academicYear) return res.status(400).json({ message: 'السنة الدراسية غير موجودة.' });

  const user = req.user!;
  const allowedNames = user.role === 'PROVINCIAL'
    ? [(await prisma.directorate.findUnique({ where: { id: user.directorateId! } }))?.name || '']
    : null;

  const rows = await parseWorkbook(req.file.buffer, allowedNames);
  const validRows = rows.filter((r) => r.errors.length === 0);
  const invalidRows = rows.filter((r) => r.errors.length > 0);

  let created = 0;
  let skippedDuplicates = 0;
  const commitErrors: any[] = [];

  for (const row of validRows) {
    const d = row.data;
    try {
      const plan = await getOrCreateActionPlan(d.directorateId, academicYearId);

      const duplicate = await prisma.action.findUnique({
        where: { directorateId_academicYearId_number: { directorateId: d.directorateId, academicYearId, number: d.number } },
      });
      if (duplicate) { skippedDuplicates++; continue; }

      const createdAction = await prisma.action.create({
        data: {
          actionPlanId: plan.id,
          directorateId: d.directorateId,
          academicYearId,
          number: d.number,
          title: d.title,
          coordinatorName: d.coordinatorName || null,
          startDate: d.startDate,
          endDate: d.endDate,
          indicator: d.indicator,
          currentValue: d.currentValue,
          targetValue: d.targetValue,
          achievedValue: d.achievedValue,
          status: d.status || 'NOT_STARTED',
          isCompleted: d.isCompleted,
          completedAt: d.isCompleted ? new Date() : null,
          createdById: user.id,
        },
      });
      await writeAuditLog({ userId: user.id, entityType: 'Action', entityId: createdAction.id, actionType: 'CREATE', after: createdAction });
      created++;
    } catch (e: any) {
      commitErrors.push({ row: row.rowNumber, sheet: row.sheetName, reason: e.message });
    }
  }

  res.json({
    message: 'تم استيراد البيانات بنجاح.',
    created, skippedDuplicates,
    invalidCount: invalidRows.length,
    invalidRows,
    commitErrors,
  });
});

// ---------------- GET /api/export/excel | /api/export/csv ----------------
async function fetchFilteredActions(req: any) {
  const user = req.user;
  const { academicYearId, directorateId, status, coordinatorName, search } = req.query as Record<string, string>;
  const where: any = {};
  if (user.role === 'PROVINCIAL') where.directorateId = user.directorateId;
  else if (directorateId) where.directorateId = directorateId;
  if (academicYearId) where.academicYearId = academicYearId;
  if (coordinatorName) where.coordinatorName = { contains: coordinatorName };
  if (status) where.status = status;
  if (search) where.OR = [{ title: { contains: search } }, { indicator: { contains: search } }];

  return prisma.action.findMany({ where, include: includeRelations, orderBy: [{ directorateId: 'asc' }, { number: 'asc' }] });
}

router.get('/export/excel', async (req, res) => {
  const actions = await fetchFilteredActions(req);
  const workbook = new ExcelJS.Workbook();

  const byDirectorate = new Map<string, typeof actions>();
  for (const a of actions) {
    const key = a.directorate.name;
    if (!byDirectorate.has(key)) byDirectorate.set(key, [] as any);
    (byDirectorate.get(key) as any).push(a);
  }

  const headers = ['رقم العملية', 'العملية', 'منسق العملية', 'بداية الإنجاز', 'نهاية الإنجاز', 'المؤشر', 'القيمة الحالية', 'القيمة المستهدفة', 'القيمة المنجزة', 'وضعية العملية'];

  for (const [directorateName, rows] of byDirectorate) {
    const sheet = workbook.addWorksheet(directorateName, { views: [{ rightToLeft: true }] });
    sheet.addRow(headers).font = { bold: true };
    for (const a of rows as any[]) {
      sheet.addRow([
        a.number, a.title, a.coordinatorName || '',
        a.startDate ? a.startDate.toISOString().slice(0, 10) : '',
        a.endDate ? a.endDate.toISOString().slice(0, 10) : '',
        a.indicator || '', a.currentValue ?? '', a.targetValue ?? '', a.achievedValue ?? '',
        statusToArabic(a.status),
      ]);
    }
    sheet.columns.forEach((c) => (c.width = 22));
  }
  if (byDirectorate.size === 0) workbook.addWorksheet('لا توجد بيانات');

  res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
  res.setHeader('Content-Disposition', 'attachment; filename="export.xlsx"');
  await workbook.xlsx.write(res);
  res.end();
});

router.get('/export/csv', async (req, res) => {
  const actions = await fetchFilteredActions(req);
  const headers = ['رقم العملية', 'العملية', 'المديرية', 'منسق العملية', 'بداية الإنجاز', 'نهاية الإنجاز', 'المؤشر', 'القيمة الحالية', 'القيمة المستهدفة', 'القيمة المنجزة', 'وضعية العملية'];
  const lines = [headers.join(',')];
  for (const a of actions) {
    lines.push([
      a.number, `"${a.title.replace(/"/g, '""')}"`, a.directorate.name, a.coordinatorName || '',
      a.startDate ? a.startDate.toISOString().slice(0, 10) : '',
      a.endDate ? a.endDate.toISOString().slice(0, 10) : '',
      `"${(a.indicator || '').replace(/"/g, '""')}"`, a.currentValue ?? '', a.targetValue ?? '', a.achievedValue ?? '',
      statusToArabic(a.status),
    ].join(','));
  }
  res.setHeader('Content-Type', 'text/csv; charset=utf-8');
  res.setHeader('Content-Disposition', 'attachment; filename="export.csv"');
  res.send('\uFEFF' + lines.join('\n'));
});

export default router;
