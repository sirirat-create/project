const fs = require('fs');
const path = require('path');
const src = fs.readFileSync(path.join(__dirname, '..', 'Code.gs'), 'utf8');

/* ---------- fake Apps Script services ---------- */
class FakeRange {
  constructor(sheet, r, c, nr, nc) { Object.assign(this, { sheet, r, c, nr, nc }); }
  getValues() {
    const out = [];
    for (let i = 0; i < this.nr; i++) {
      const row = [];
      for (let j = 0; j < this.nc; j++) row.push(this.sheet.cell(this.r + i, this.c + j));
      out.push(row);
    }
    return out;
  }
  setValues(v) {
    v.forEach((row, i) => row.forEach((val, j) => this.sheet.set(this.r + i, this.c + j, val)));
    return this;
  }
  setBackground(color) {
    for (let i = 0; i < this.nr; i++)
      for (let j = 0; j < this.nc; j++) this.sheet.bg[`${this.r + i},${this.c + j}`] = color;
    return this;
  }
  setFontWeight() { return this; }
}
class FakeSheet {
  constructor(name, grid, maxCols) {
    this.name = name; this.grid = grid; this.bg = {};
    this.maxCols = maxCols || Math.max(...grid.map(r => r.length));
    this.hidden = [];
  }
  cell(r, c) { const row = this.grid[r - 1] || []; const v = row[c - 1]; return v === undefined ? '' : v; }
  set(r, c, v) {
    while (this.grid.length < r) this.grid.push([]);
    const row = this.grid[r - 1];
    while (row.length < c) row.push('');
    row[c - 1] = v;
  }
  getName() { return this.name; }
  getLastRow() { return this.grid.length; }
  getLastColumn() { return Math.max(...this.grid.map(r => r.length)); }
  getMaxColumns() { return this.maxCols; }
  getRange(r, c, nr = 1, nc = 1) { return new FakeRange(this, r, c, nr, nc); }
  appendRow(row) { this.grid.push(row.slice()); }
  insertColumnsAfter(after, n) { this.maxCols += n; }
  hideColumns(c) { this.hidden.push(c); }
}
const HEADERS = ['ลำดับที่','วันที่รับเอกสาร/พัสดุ','ประเภทเอกสาร','เลข tracking / เลข INV',
  'ผู้ส่ง','ชื่อผู้รับ','บริษัท','แผนกผู้รับ','มารับเอกสารเรียบร้อย','ลงชื่อ ผู้รับเอกสาร',
  'วันที่เข้ารับ','ส่งเอกสารเรียบร้อย','ลงชื่อ ทีมGM ผู้ตรวจเอกสาร','วันที่ตรวจสอบและส่งมอบเอกสาร','หมายเหตุ'];

let activeSheet;
const fakes = {
  SpreadsheetApp: {
    getActive: () => ({ getSheetByName: n => (activeSheet.getName() === n ? activeSheet : null), getSheets: () => [activeSheet] }),
    getUi: () => { throw new Error('no ui'); },
  },
  Utilities: { formatDate: () => '4-Sep-26', base64Encode: () => 'BASE64' },
  Logger: { log: () => {} },
  PropertiesService: { getScriptProperties: () => ({ getProperty: () => null, setProperty: () => {} }) },
  DriveApp: {}, LockService: {}, ScriptApp: {}, UrlFetchApp: {},
};
const factory = new Function(...Object.keys(fakes), src +
  '; return { parseJson_, padSeq_, shortLabel_, buildNote_, getSheet_, readSheetState_, appendRow_, ensureExtraColumns_, COL, LAST_COL };');
const M = factory(...Object.values(fakes));

/* ---------- assertions ---------- */
let pass = 0, fail = 0;
const eq = (name, got, want) => {
  const ok = JSON.stringify(got) === JSON.stringify(want);
  if (ok) { pass++; console.log('  ok   ' + name); }
  else { fail++; console.log('  FAIL ' + name + '\n        got  ' + JSON.stringify(got) + '\n        want ' + JSON.stringify(want)); }
};
const throws = (name, fn, re) => {
  try { fn(); fail++; console.log('  FAIL ' + name + ' (ไม่ throw)'); }
  catch (e) {
    if (re.test(e.message)) { pass++; console.log('  ok   ' + name); }
    else { fail++; console.log('  FAIL ' + name + ' — ข้อความ: ' + e.message); }
  }
};

console.log('\n=== parseJson_ ===');
eq('JSON ล้วน', M.parseJson_('{"a":1}'), { a: 1 });
eq('มี code fence', M.parseJson_('```json\n{"a":2}\n```'), { a: 2 });
eq('มีข้อความหุ้ม', M.parseJson_('นี่คือผลลัพธ์ {"a":3} จบ'), { a: 3 });
eq('ค่า null ผ่านได้', M.parseJson_('{"tracking":null}'), { tracking: null });
throws('ขยะ → error', () => M.parseJson_('อ่านไม่ออกเลย'), /อ่านคำตอบ/);

console.log('\n=== padSeq_ / shortLabel_ / buildNote_ ===');
eq('padSeq 7', M.padSeq_(7), '0007');
eq('padSeq 1234', M.padSeq_(1234), '1234');
eq('padSeq 99999', M.padSeq_(99999), '99999');
eq('ตัดอักขระต้องห้ามในชื่อไฟล์', M.shortLabel_({ tracking: 'IV/2023:100*82?' }, { getName: () => 'x' }), 'IV-2023-100-82-');
eq('ไม่มีข้อมูล → ใช้ชื่อไฟล์เดิม', M.shortLabel_(null, { getName: () => 'IMG_001.jpg' }), 'IMG_001.jpg');
eq('อ่านไม่สำเร็จ → บอกให้กรอกมือ', M.buildNote_({}, 'timeout'), 'อ่านรูปไม่สำเร็จ กรุณากรอกมือ (timeout)');
eq('confidence high → ไม่รกหมายเหตุ', M.buildNote_({ confidence: 'high' }, null), '');
eq('confidence low + note', M.buildNote_({ note: 'ซองฉีก', confidence: 'low' }, null), 'ซองฉีก · AI ความมั่นใจ: low');

console.log('\n=== getSheet_ ยอมเขียนเฉพาะแท็บที่หัวตรง ===');
activeSheet = new FakeSheet('รายการรับ-ส่งเอกสาร', [HEADERS.slice()]);
eq('หัวตรง → ผ่าน', M.getSheet_().getName(), 'รายการรับ-ส่งเอกสาร');
activeSheet = new FakeSheet('แท็บอื่น', [['ชื่อ', 'นามสกุล', 'ตำแหน่ง']]);
throws('หัวไม่ตรง → หยุด ไม่เขียนทับ', () => M.getSheet_(), /หัวคอลัมน์ที่ 1/);
const shifted = HEADERS.slice(); shifted.splice(3, 1);
activeSheet = new FakeSheet('รายการรับ-ส่งเอกสาร', [shifted]);
throws('คอลัมน์ถูกลบ → จับได้', () => M.getSheet_(), /หัวคอลัมน์ที่ 4/);

console.log('\n=== readSheetState_ (เลขลำดับ + กันซ้ำ) ===');
const withRows = [HEADERS.slice()];
[[3, 'FILE_C'], [1, 'FILE_A'], [2, 'FILE_B']].forEach(([seq, id]) => {
  const row = new Array(17).fill('');
  row[0] = seq; row[16] = id;
  withRows.push(row);
});
activeSheet = new FakeSheet('รายการรับ-ส่งเอกสาร', withRows, 17);
const state = M.readSheetState_(activeSheet);
eq('เลขลำดับล่าสุด = ค่าสูงสุด ไม่ใช่แถวสุดท้าย', state.seq, 3);
eq('จำรหัสไฟล์ที่ลงแล้ว', Object.keys(state.fileIds).sort(), ['FILE_A', 'FILE_B', 'FILE_C']);
activeSheet = new FakeSheet('รายการรับ-ส่งเอกสาร', [HEADERS.slice()], 17);
eq('ชีตเปล่า → เริ่มที่ 0', M.readSheetState_(activeSheet).seq, 0);

console.log('\n=== appendRow_ (คอลัมน์ถูกช่อง + ไฮไลต์) ===');
const file = { getUrl: () => 'https://drive/FILE1', getId: () => 'FILE1', getName: () => 'a.jpg' };
activeSheet = new FakeSheet('รายการรับ-ส่งเอกสาร', [HEADERS.slice()], 17);
M.appendRow_(activeSheet, 494, file, {
  doc_type: 'ใบกำกับภาษี', tracking: 'IV-2026001', sender: 'Hikawa',
  recipient: 'บริษัท ทีดี ฟู้ดแอนด์เบอเวอเรจ จำกัด', company: 'TD', dept: 'Accounting', confidence: 'high',
}, null);
const r = activeSheet.grid[1];
eq('ลำดับที่', r[M.COL.SEQ - 1], 494);
eq('ประเภทเอกสาร', r[M.COL.DOC_TYPE - 1], 'ใบกำกับภาษี');
eq('เลข tracking', r[M.COL.TRACKING - 1], 'IV-2026001');
eq('บริษัท', r[M.COL.COMPANY - 1], 'TD');
eq('แผนกผู้รับ', r[M.COL.DEPT - 1], 'Accounting');
eq('ลิงก์รูป', r[M.COL.PHOTO_URL - 1], 'https://drive/FILE1');
eq('รหัสไฟล์', r[M.COL.FILE_ID - 1], 'FILE1');
eq('ไม่แตะคอลัมน์ที่ทีมกรอกเอง (9-14)', r.slice(8, 14), ['', '', '', '', '', '']);
eq('ข้อมูลครบ+มั่นใจ → ไม่ไฮไลต์', Object.keys(activeSheet.bg).length, 0);

activeSheet = new FakeSheet('รายการรับ-ส่งเอกสาร', [HEADERS.slice()], 17);
M.appendRow_(activeSheet, 495, file, { doc_type: 'พัสดุ', sender: 'Hikawa', confidence: 'high' }, null);
eq('ช่องที่อ่านไม่ได้ถูกไฮไลต์เหลือง',
  [M.COL.TRACKING, M.COL.RECIPIENT, M.COL.COMPANY, M.COL.DEPT].map(c => activeSheet.bg[`2,${c}`]),
  ['#fff4d6', '#fff4d6', '#fff4d6', '#fff4d6']);
eq('ช่องที่อ่านได้ไม่ถูกไฮไลต์', activeSheet.bg[`2,${M.COL.DOC_TYPE}`], undefined);

activeSheet = new FakeSheet('รายการรับ-ส่งเอกสาร', [HEADERS.slice()], 17);
M.appendRow_(activeSheet, 496, file, null, 'Claude API ตอบ 529');
eq('อ่านไม่สำเร็จ → ยังบันทึกแถว ไม่ทำเอกสารหาย', activeSheet.grid[1][M.COL.SEQ - 1], 496);
eq('อ่านไม่สำเร็จ → ยังมีลิงก์รูปให้ตามได้', activeSheet.grid[1][M.COL.PHOTO_URL - 1], 'https://drive/FILE1');
eq('อ่านไม่สำเร็จ → ไฮไลต์แดงทั้งแถว', activeSheet.bg[`2,1`], '#fde8e6');

console.log('\n=== ensureExtraColumns_ ===');
activeSheet = new FakeSheet('รายการรับ-ส่งเอกสาร', [HEADERS.slice()], 15);
M.ensureExtraColumns_(activeSheet);
eq('เพิ่มหัว 2 คอลัมน์ท้าย', activeSheet.grid[0].slice(15, 17), ['ลิงก์รูป', 'รหัสไฟล์']);
eq('ซ่อนคอลัมน์รหัสไฟล์', activeSheet.hidden, [17]);
eq('ไม่แตะหัว 15 คอลัมน์เดิม', activeSheet.grid[0].slice(0, 15), HEADERS);
const before = JSON.stringify(activeSheet.grid[0]);
M.ensureExtraColumns_(activeSheet);
eq('รันซ้ำแล้วไม่เพิ่มซ้ำ', JSON.stringify(activeSheet.grid[0]), before);

console.log(`\n${pass} ผ่าน / ${fail} ไม่ผ่าน`);
process.exit(fail ? 1 : 0);
