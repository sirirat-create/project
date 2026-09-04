import { db } from '../db.js';

// เลขทะเบียนรูปแบบ <ปี พ.ศ. 2 หลัก>-<ลำดับ 4 หลัก> เช่น 69-0001
// ลำดับเริ่มใหม่ทุกปี พ.ศ.
export function nextRegNo(date = new Date()) {
  const be = (date.getFullYear() + 543) % 100;
  const prefix = String(be).padStart(2, '0');
  const row = db
    .prepare(
      `SELECT reg_no FROM documents WHERE reg_no LIKE ? ORDER BY reg_no DESC LIMIT 1`
    )
    .get(`${prefix}-%`);
  const last = row ? Number(row.reg_no.split('-')[1]) : 0;
  return `${prefix}-${String(last + 1).padStart(4, '0')}`;
}

// รหัสใบส่งมอบ HO-YYMMDD-NN
export function nextHandoverCode(date = new Date()) {
  const p = (n) => String(n).padStart(2, '0');
  const stamp = `${p((date.getFullYear() + 543) % 100)}${p(date.getMonth() + 1)}${p(date.getDate())}`;
  const row = db
    .prepare(`SELECT code FROM handovers WHERE code LIKE ? ORDER BY code DESC LIMIT 1`)
    .get(`HO-${stamp}-%`);
  const last = row ? Number(row.code.split('-')[2]) : 0;
  return `HO-${stamp}-${p(last + 1)}`;
}
