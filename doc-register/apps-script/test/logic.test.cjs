const fs = require('fs');
const path = require('path');
const src = fs.readFileSync(path.join(__dirname, '..', 'Code.gs'), 'utf8');

/* ---------- จำลอง Google Sheets / Drive ---------- */
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
  setValue(v) { this.sheet.set(this.r, this.c, v); return this; }
  setBackground(color) {
    for (let i = 0; i < this.nr; i++)
      for (let j = 0; j < this.nc; j++) this.sheet.bg[`${this.r + i},${this.c + j}`] = color;
    return this;
  }
  setFontWeight() { return this; }
  getDataValidation() { return this.sheet.validation[`${this.r},${this.c}`] || null; }
}
class FakeSheet {
  constructor(name, grid) {
    this.name = name; this.grid = grid; this.bg = {}; this.validation = {}; this.hidden = [];
    this.maxCols = Math.max(...grid.map(r => r.length));
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
  setDropdown(r, c, options) { this.validation[`${r},${c}`] = { getCriteriaValues: () => [options] }; }
}

// หัวคอลัมน์จริงของแท็บที่ทีมใช้ (12 คอลัมน์)
const WH300 = ['ลำดับที่', 'วันที่รับเอกสาร/พัสดุ', 'ประเภทเอกสาร', 'เลข tracking / เลข INV',
  'ผู้ส่ง', 'ชื่อผู้รับ', 'บริษัท', 'แผนกผู้รับ', 'มารับเอกสารเรียบร้อย',
  'ลงชื่อ ผู้รับเอกสาร', 'วันที่เข้ารับ', 'หมายเหตุ'];
// แท็บเก่าที่มี 15 คอลัมน์ ต้องใช้ได้เหมือนกัน
const OLD15 = WH300.slice(0, 11).concat(
  ['ส่งเอกสารเรียบร้อย', 'ลงชื่อ ทีมGM ผู้ตรวจเอกสาร', 'วันที่ตรวจสอบและส่งมอบเอกสาร', 'หมายเหตุ']);

let sheets = {};
const fakes = {
  SpreadsheetApp: {
    getActive: () => ({
      getSheetByName: n => sheets[n] || null,
      getSheets: () => Object.values(sheets),
    }),
    getUi: () => { throw new Error('no ui'); },
  },
  Utilities: { formatDate: () => '5-Sep-26', base64Encode: () => 'BASE64' },
  Logger: { log: () => {} },
  PropertiesService: { getScriptProperties: () => ({ getProperty: () => null, setProperty: () => {} }) },
  DriveApp: {}, LockService: {}, ScriptApp: {}, UrlFetchApp: {},
};
const factory = new Function(...Object.keys(fakes), src +
  '; return { parseJson_, padSeq_, shortLabel_, buildNote_, resolveSheet_, ensureExtraColumns_,' +
  ' readSheetState_, appendRow_, buildPrompt_, readDropdownOptions_, SHEET_NAME, BASE_PROMPT };');
const M = factory(...Object.values(fakes));

/* ---------- ตัวช่วยเช็ค ---------- */
let pass = 0, fail = 0;
const eq = (name, got, want) => {
  if (JSON.stringify(got) === JSON.stringify(want)) { pass++; console.log('  ok   ' + name); }
  else { fail++; console.log('  FAIL ' + name + '\n        ได้  ' + JSON.stringify(got) + '\n        ควรได้ ' + JSON.stringify(want)); }
};
const throws = (name, fn, re) => {
  try { fn(); fail++; console.log('  FAIL ' + name + ' (ไม่ throw)'); }
  catch (e) {
    if (re.test(e.message)) { pass++; console.log('  ok   ' + name); }
    else { fail++; console.log('  FAIL ' + name + ' — ข้อความ: ' + e.message); }
  }
};
const useTab = (name, headers, rows = []) => {
  sheets = {}; sheets[name] = new FakeSheet(name, [headers.slice()].concat(rows));
  return sheets[name];
};

console.log('\n=== แท็บที่ตั้งไว้ต้องเป็นแท็บที่ทีมใช้จริง ===');
eq('SHEET_NAME', M.SHEET_NAME, 'รายการรับเอกสารภายนอกWH300');

console.log('\n=== parseJson_ ===');
eq('JSON ล้วน', M.parseJson_('{"a":1}'), { a: 1 });
eq('มี code fence', M.parseJson_('```json\n{"a":2}\n```'), { a: 2 });
eq('มีข้อความหุ้ม', M.parseJson_('นี่คือผลลัพธ์ {"a":3} จบ'), { a: 3 });
eq('ค่า null ผ่านได้', M.parseJson_('{"tracking":null}'), { tracking: null });
throws('ขยะ → error', () => M.parseJson_('อ่านไม่ออกเลย'), /อ่านคำตอบ/);

console.log('\n=== padSeq_ / shortLabel_ / buildNote_ ===');
eq('padSeq 7', M.padSeq_(7), '0007');
eq('padSeq 4457 (เลขจริงของทีม)', M.padSeq_(4457), '4457');
eq('padSeq 99999', M.padSeq_(99999), '99999');
eq('ตัดอักขระต้องห้ามในชื่อไฟล์', M.shortLabel_({ tracking: 'W-IN/17:6908*15?' }, { name: 'x' }), 'W-IN-17-6908-15-');
eq('ไม่มีข้อมูล → ใช้ชื่อไฟล์เดิม', M.shortLabel_(null, { name: 'IMG_001.jpg' }), 'IMG_001.jpg');
eq('อ่านไม่สำเร็จ → บอกให้กรอกมือ', M.buildNote_({}, 'timeout'), 'อ่านรูปไม่สำเร็จ กรุณากรอกมือ (timeout)');
eq('confidence high → ไม่รกหมายเหตุ', M.buildNote_({ confidence: 'high' }, null), '');
eq('confidence low + note', M.buildNote_({ note: 'ซองฉีก', confidence: 'low' }, null), 'ซองฉีก · AI ความมั่นใจ: low');

console.log('\n=== resolveSheet_ หาคอลัมน์จากชื่อหัวตาราง ===');
useTab('รายการรับเอกสารภายนอกWH300', WH300);
let found = M.resolveSheet_();
eq('แท็บ 12 คอลัมน์: ลำดับที่ = A', found.cols.seq, 1);
eq('แท็บ 12 คอลัมน์: แผนกผู้รับ = H', found.cols.dept, 8);
eq('แท็บ 12 คอลัมน์: หมายเหตุ = L (ไม่ใช่ O)', found.cols.note, 12);

useTab('รายการรับเอกสารภายนอกWH300', OLD15);
eq('แท็บ 15 คอลัมน์: หมายเหตุ = O', M.resolveSheet_().cols.note, 15);
eq('แท็บ 15 คอลัมน์: แผนกผู้รับ ยังเป็น H', M.resolveSheet_().cols.dept, 8);

useTab('รายการรับเอกสารภายนอกWH300', ['ชื่อ', 'นามสกุล', 'ตำแหน่ง']);
throws('หัวคอลัมน์ที่จำเป็นหาย → หยุด', () => M.resolveSheet_(), /ไม่มีหัวคอลัมน์/);

sheets = { 'แท็บอื่น': new FakeSheet('แท็บอื่น', [WH300.slice()]) };
throws('ไม่เจอแท็บที่ตั้งชื่อไว้ → บอกว่ามีแท็บอะไรบ้าง', () => M.resolveSheet_(), /ไม่พบแท็บชื่อ.*แท็บที่มีคือ/);

console.log('\n=== ensureExtraColumns_ เพิ่มต่อท้าย ไม่แทรกกลาง ===');
const s12 = useTab('รายการรับเอกสารภายนอกWH300', WH300);
let cols = M.ensureExtraColumns_(M.resolveSheet_());
eq('ลิงก์รูปไปอยู่คอลัมน์ 13', cols.photoUrl, 13);
eq('รหัสไฟล์ไปอยู่คอลัมน์ 14', cols.fileId, 14);
eq('ซ่อนคอลัมน์รหัสไฟล์', s12.hidden, [14]);
eq('ไม่แตะหัว 12 คอลัมน์เดิม', s12.grid[0].slice(0, 12), WH300);
const before = JSON.stringify(s12.grid[0]);
M.ensureExtraColumns_(M.resolveSheet_());
eq('รันซ้ำไม่เพิ่มซ้ำ', JSON.stringify(s12.grid[0]), before);

console.log('\n=== readSheetState_ (เลขลำดับ + กันซ้ำ) ===');
const withRows = [[3, '', '', '', '', '', '', '', '', '', '', '', '', 'slack:F3'],
                  [1, '', '', '', '', '', '', '', '', '', '', '', '', 'slack:F1'],
                  [2, '', '', '', '', '', '', '', '', '', '', '', '', 'slack:F2']];
useTab('รายการรับเอกสารภายนอกWH300', WH300.concat(['ลิงก์รูป', 'รหัสไฟล์']), withRows);
found = M.resolveSheet_();
const state = M.readSheetState_(found.sheet, found.cols);
eq('เลขลำดับล่าสุด = ค่าสูงสุด ไม่ใช่แถวสุดท้าย', state.seq, 3);
eq('จำรหัสไฟล์ Slack ที่ลงแล้ว', Object.keys(state.fileIds).sort(), ['slack:F1', 'slack:F2', 'slack:F3']);
useTab('รายการรับเอกสารภายนอกWH300', WH300.concat(['ลิงก์รูป', 'รหัสไฟล์']));
found = M.resolveSheet_();
eq('ชีตเปล่า → เริ่มที่ 0', M.readSheetState_(found.sheet, found.cols).seq, 0);

console.log('\n=== appendRow_ ลงตรงช่องบนแท็บ 12 คอลัมน์ ===');
const sheet = useTab('รายการรับเอกสารภายนอกWH300', WH300);
cols = M.ensureExtraColumns_(M.resolveSheet_());
M.appendRow_(sheet, cols, 4457, 'slack:F99', 'https://drive/A', {
  doc_type: 'ซองจดหมาย', tracking: 'EM307635063TH', sender: 'บริษัท ไทยเม็ททอล อลูมิเนียม จำกัด',
  recipient: 'บัญชี', company: 'TD', dept: 'Accounting', confidence: 'high',
}, null);
const r = sheet.grid[1];
eq('ลำดับที่', r[0], 4457);
eq('วันที่รับ รูปแบบเดียวกับที่ทีมใช้', r[1], '5-Sep-26');
eq('ประเภทเอกสาร = ชนิดซอง', r[2], 'ซองจดหมาย');
eq('เลข tracking', r[3], 'EM307635063TH');
eq('ผู้ส่ง', r[4], 'บริษัท ไทยเม็ททอล อลูมิเนียม จำกัด');
eq('ชื่อผู้รับ = ชื่อแผนกภาษาไทย', r[5], 'บัญชี');
eq('บริษัท', r[6], 'TD');
eq('แผนกผู้รับ', r[7], 'Accounting');
eq('ไม่แตะช่องติ๊กรับ/ลงชื่อ/วันที่เข้ารับ (I-K)', r.slice(8, 11), ['', '', '']);
eq('ลิงก์รูป', r[12], 'https://drive/A');
eq('รหัสไฟล์', r[13], 'slack:F99');
eq('ข้อมูลครบ + มั่นใจ → ไม่ไฮไลต์', Object.keys(sheet.bg).length, 0);

const sheet2 = useTab('รายการรับเอกสารภายนอกWH300', WH300);
cols = M.ensureExtraColumns_(M.resolveSheet_());
M.appendRow_(sheet2, cols, 4458, 'slack:F98', 'https://drive/B',
  { doc_type: 'ซองน้ำตาล', sender: 'SCB', confidence: 'high' }, null);
eq('ช่องที่อ่านไม่ได้ถูกไฮไลต์เหลือง',
  [4, 6, 7, 8].map(c => sheet2.bg[`2,${c}`]),
  ['#fff4d6', '#fff4d6', '#fff4d6', '#fff4d6']);
eq('ช่องที่อ่านได้ไม่ถูกไฮไลต์', sheet2.bg['2,3'], undefined);

const sheet3 = useTab('รายการรับเอกสารภายนอกWH300', WH300);
cols = M.ensureExtraColumns_(M.resolveSheet_());
M.appendRow_(sheet3, cols, 4459, 'slack:F97', 'https://drive/C', null, 'Claude API ตอบ 529');
eq('อ่านไม่สำเร็จ → ยังบันทึกแถว ไม่ทำเอกสารหาย', sheet3.grid[1][0], 4459);
eq('อ่านไม่สำเร็จ → ยังมีลิงก์รูปให้ตามได้', sheet3.grid[1][12], 'https://drive/C');
eq('อ่านไม่สำเร็จ → ไฮไลต์แดงทั้งแถว', sheet3.bg['2,1'], '#fde8e6');
eq('อ่านไม่สำเร็จ → หมายเหตุบอกให้กรอกมือ',
  sheet3.grid[1][11].indexOf('กรุณากรอกมือ') !== -1, true);

console.log('\n=== อ่านตัวเลือก dropdown จากชีตจริง ===');
const s4 = useTab('รายการรับเอกสารภายนอกWH300', WH300, [new Array(12).fill('')]);
s4.setDropdown(2, 7, ['TD', 'CW', 'BG', 'DH', 'SP']);
s4.setDropdown(2, 8, ['Accounting', 'HR/GM', 'Operation', 'Others']);
eq('อ่านตัวเลือกบริษัทได้', M.readDropdownOptions_(s4, 7), ['TD', 'CW', 'BG', 'DH', 'SP']);
eq('อ่านตัวเลือกแผนกได้', M.readDropdownOptions_(s4, 8), ['Accounting', 'HR/GM', 'Operation', 'Others']);
eq('ไม่มี dropdown → คืนค่าว่าง', M.readDropdownOptions_(s4, 5), []);
eq('ไม่ส่งคอลัมน์มา → คืนค่าว่าง', M.readDropdownOptions_(s4, undefined), []);

console.log('\n=== buildPrompt_ ต่อรายการตัวเลือกจริงเข้าไปในโจทย์ ===');
const prompt = M.buildPrompt_(['TD', 'CW'], ['Accounting', 'HR/GM']);
eq('บอกโมเดลว่าบริษัทมีอะไรบ้าง', prompt.indexOf('TD | CW') !== -1, true);
eq('บอกโมเดลว่าแผนกมีอะไรบ้าง', prompt.indexOf('Accounting | HR/GM') !== -1, true);
eq('อ่าน dropdown ไม่ได้ → ใช้โจทย์ตั้งต้นเฉยๆ', M.buildPrompt_([], []), M.BASE_PROMPT);
eq('โจทย์บอกว่า ประเภทเอกสาร คือชนิดซอง', M.BASE_PROMPT.indexOf('ชนิดของซอง') !== -1, true);

console.log(`\n${pass} ผ่าน / ${fail} ไม่ผ่าน`);
process.exit(fail ? 1 : 0);
