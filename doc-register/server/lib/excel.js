import XLSX from 'xlsx';
import { STATUS_LABEL, formatThaiDateTime } from './labels.js';

const COLUMNS = [
  ['เลขทะเบียน', 12, (d) => d.reg_no],
  ['สถานะ', 24, (d) => STATUS_LABEL[d.status] || d.status],
  ['วันเวลาที่คลังรับ', 18, (d) => formatThaiDateTime(d.intake_at)],
  ['ผู้รับที่คลัง', 16, (d) => d.intake_by],
  ['ประเภทเอกสาร', 18, (d) => d.doc_type],
  ['เลขที่เอกสาร', 18, (d) => d.doc_number],
  ['วันที่เอกสาร', 14, (d) => d.doc_date],
  ['ผู้ส่ง / บริษัท', 28, (d) => d.vendor],
  ['เรื่อง / รายการ', 34, (d) => d.subject],
  ['จำนวนเงิน', 14, (d) => (d.amount == null ? '' : d.amount)],
  ['จำนวนฉบับ', 10, (d) => (d.copies == null ? '' : d.copies)],
  ['ผู้ลงทะเบียน', 16, (d) => d.registered_by],
  ['วันเวลาที่ลงทะเบียน', 18, (d) => formatThaiDateTime(d.registered_at)],
  ['เลขใบส่งมอบ', 16, (d) => d.handover_code],
  ['ผู้รับฝ่ายบัญชี', 16, (d) => d.accepted_by],
  ['วันเวลาที่บัญชีรับ', 18, (d) => formatThaiDateTime(d.accepted_at)],
  ['จำนวนรูปแนบ', 12, (d) => d.photo_count],
  ['หมายเหตุ', 30, (d) => d.note],
];

/** สร้างไฟล์ .xlsx ของทะเบียนเอกสาร (หน้าตาเทียบเท่าชีตเดิม เอาไปเก็บ/ส่งต่อได้) */
export function buildWorkbook(documents) {
  const rows = [
    COLUMNS.map(([header]) => header),
    ...documents.map((doc) => COLUMNS.map(([, , read]) => read(doc) ?? '')),
  ];
  const sheet = XLSX.utils.aoa_to_sheet(rows);
  sheet['!cols'] = COLUMNS.map(([, width]) => ({ wch: width }));
  sheet['!autofilter'] = { ref: XLSX.utils.encode_range({ s: { r: 0, c: 0 }, e: { r: rows.length - 1, c: COLUMNS.length - 1 } }) };
  sheet['!freeze'] = { xSplit: 1, ySplit: 1 };

  const book = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(book, sheet, 'ทะเบียนเอกสาร');
  return XLSX.write(book, { type: 'buffer', bookType: 'xlsx' });
}
