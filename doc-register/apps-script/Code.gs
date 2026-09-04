/**
 * ทะเบียนรับ-ส่งเอกสาร — เติมข้อมูลจากรูปถ่ายเข้า Google Sheets อัตโนมัติ
 *
 * ทำงานคู่กับชีต "รายการรับ-ส่งเอกสาร พัสดุ ประจำวัน" ที่ทีมใช้อยู่ (15 คอลัมน์เดิม
 * ไม่แตะ ไม่ย้าย) โดยเพิ่ม 2 คอลัมน์ท้ายสุดคือ "ลิงก์รูป" กับ "รหัสไฟล์" เท่านั้น
 *
 * รอบการทำงาน: ทุก 5 นาที สแกนโฟลเดอร์ Drive ขาเข้า → อ่านรูปด้วย Claude →
 * เติมแถวใหม่ในชีต → ย้ายไฟล์ไปโฟลเดอร์ "ลงทะเบียนแล้ว" พร้อมเปลี่ยนชื่อไฟล์เป็นเลขลำดับ
 *
 * ติดตั้ง: ดู README.md — สรุปคือวาง ANTHROPIC_API_KEY ใน Script Properties แล้วรัน setup()
 */

// ---------------------------------------------------------------- ตั้งค่าได้

/** ชื่อแท็บที่จะเขียน — ต้องตรงกับแท็บที่ทีมใช้จริง */
var SHEET_NAME = 'รายการรับ-ส่งเอกสาร';

/** หัวคอลัมน์ที่ต้องเจอในชีต ถ้าไม่ตรง สคริปต์จะหยุดทันทีเพื่อไม่ให้เขียนผิดแท็บ */
var EXPECTED_HEADERS = [
  'ลำดับที่',
  'วันที่รับเอกสาร/พัสดุ',
  'ประเภทเอกสาร',
  'เลข tracking / เลข INV',
  'ผู้ส่ง',
  'ชื่อผู้รับ',
  'บริษัท',
  'แผนกผู้รับ'
];

var COL = {
  SEQ: 1, DATE: 2, DOC_TYPE: 3, TRACKING: 4, SENDER: 5, RECIPIENT: 6,
  COMPANY: 7, DEPT: 8, PICKED_UP: 9, PICKER_SIGN: 10, PICKUP_DATE: 11,
  DELIVERED: 12, GM_SIGN: 13, DELIVER_DATE: 14, NOTE: 15,
  PHOTO_URL: 16, FILE_ID: 17
};
var LAST_COL = COL.FILE_ID;

/** จำนวนไฟล์ที่ประมวลผลต่อรอบ และเวลาที่ยอมให้ใช้ (Apps Script ตัดที่ 6 นาที) */
var MAX_FILES_PER_RUN = 12;
var TIME_BUDGET_MS = 4.5 * 60 * 1000;

var MODEL = 'claude-opus-5';
var ALLOWED_IMAGE = ['image/jpeg', 'image/png', 'image/gif', 'image/webp'];

/**
 * โจทย์ที่ส่งให้โมเดล — เขียนตาม SOP ข้อ 4.1 และ 4.2 ของทีมเอง
 * แก้ตรงนี้ได้เลยถ้ากฎการคัดแยกเปลี่ยน
 */
var SYSTEM_PROMPT = [
  'คุณคือผู้ช่วยงานสารบรรณของ TDFB หน้าที่คืออ่านรูปถ่ายซองเอกสาร/พัสดุที่บริษัทได้รับ',
  'แล้วดึงข้อมูลลงทะเบียนตามกฎของทีม',
  '',
  'ตอบเป็น JSON ล้วน ไม่ต้องมีคำอธิบายหรือ code fence คีย์ที่ต้องมี:',
  '{',
  '  "doc_type": "ชนิด/ชื่อเอกสารโดยย่อ เช่น ใบกำกับภาษี | ใบเสร็จรับเงิน | ใบวางบิล | Statement | หนังสือราชการ | พัสดุสินค้า",',
  '  "tracking": "เลข tracking ที่พิมพ์บนซอง ถ้าไม่มีให้ใส่เลขที่เอกสารหรือเลขที่ INV แทน ถ้าเป็นใบเขียว ปณ. ให้ใส่เลข EMS",',
  '  "sender": "ชื่อผู้ส่งตามที่ปรากฏบนซอง",',
  '  "recipient": "ชื่อผู้รับหรือบริษัทผู้รับตามที่ปรากฏบนซอง",',
  '  "company": "รหัสบริษัทผู้รับ เลือกจาก TD | CW | BG | DH | SP ถ้าเดาไม่ได้ใส่ null",',
  '  "dept": "แผนกผู้รับ เลือกจาก Accounting | HR/GM | Operation | Others",',
  '  "note": "ข้อสังเกตที่ควรบอกคนตรวจ เช่น ซองฉีก อ่านไม่ชัด มีหลายฉบับในซอง ถ้าไม่มีใส่ null",',
  '  "confidence": "high | medium | low ตามความชัดของรูป"',
  '}',
  '',
  'กฎการเลือกแผนก:',
  '- เอกสารการเงิน/ภาษี/ใบกำกับ/ใบเสร็จ/ใบวางบิล/Statement/ใบแจ้งหนี้ จากคู่ค้าหรือธนาคาร → Accounting',
  '- เอกสารประกันสังคม กรมสรรพากร ทะเบียนพาณิชย์ สัญญาจ้าง เอกสารพนักงาน → HR/GM',
  '- ตัวอย่างสินค้า วัตถุดิบ บรรจุภัณฑ์ อุปกรณ์โรงงาน → Operation',
  '- อ่านไม่ออกหรือไม่เข้าข้อใด → Others',
  '',
  'กฎการเลือกรหัสบริษัท (ดูจากชื่อผู้รับบนซอง):',
  '- "ทีดี ฟู้ดแอนด์เบอเวอเรจ" หรือ TDFB → TD',
  '- "Began" หรือ บีแกน → BG',
  '- "Daily Happiness" → DH',
  '- "Superfood Products" → SP',
  '- CW → CW',
  '',
  'ห้ามเดาหรือแต่งข้อมูลที่ไม่ปรากฏบนรูป อ่านไม่ได้ให้ใส่ null'
].join('\n');

// ---------------------------------------------------------------- เมนูในชีต

function onOpen() {
  SpreadsheetApp.getUi()
    .createMenu('ทะเบียนเอกสาร')
    .addItem('ดึงเอกสารใหม่เดี๋ยวนี้', 'processInbox')
    .addItem('ตรวจการตั้งค่า', 'checkSetup')
    .addSeparator()
    .addItem('ติดตั้ง / ตั้งค่าครั้งแรก', 'setup')
    .addToUi();
}

// ---------------------------------------------------------------- ติดตั้ง

/**
 * รันครั้งเดียวตอนติดตั้ง: สร้างโฟลเดอร์ Drive สองใบ เพิ่ม 2 คอลัมน์ท้ายชีต
 * และตั้ง trigger ให้ทำงานทุก 5 นาที
 */
function setup() {
  var props = PropertiesService.getScriptProperties();
  if (!props.getProperty('ANTHROPIC_API_KEY')) {
    throw new Error('ยังไม่ได้ใส่ ANTHROPIC_API_KEY ใน Project Settings → Script Properties');
  }

  var root = getOrCreateFolder_(DriveApp.getRootFolder(), 'ทะเบียนเอกสาร');
  var inbox = getOrCreateFolder_(root, '01_รอลงทะเบียน');
  var done = getOrCreateFolder_(root, '02_ลงทะเบียนแล้ว');
  props.setProperty('INBOX_FOLDER_ID', inbox.getId());
  props.setProperty('DONE_FOLDER_ID', done.getId());

  ensureExtraColumns_(getSheet_());

  ScriptApp.getProjectTriggers().forEach(function (t) {
    if (t.getHandlerFunction() === 'processInbox') ScriptApp.deleteTrigger(t);
  });
  ScriptApp.newTrigger('processInbox').timeBased().everyMinutes(5).create();

  var message = [
    'ติดตั้งเรียบร้อย',
    '',
    'โฟลเดอร์อัปโหลดรูป: ' + inbox.getUrl(),
    'โฟลเดอร์เก็บรูปที่ลงทะเบียนแล้ว: ' + done.getUrl(),
    '',
    'ระบบจะดึงรูปใหม่ทุก 5 นาที'
  ].join('\n');
  Logger.log(message);
  try {
    SpreadsheetApp.getUi().alert(message);
  } catch (e) { /* รันจาก editor ไม่มี UI */ }
}

/** ตรวจว่าตั้งค่าครบและชี้ถูกที่ ก่อนปล่อยให้ทีมใช้ */
function checkSetup() {
  var props = PropertiesService.getScriptProperties();
  var lines = [];
  lines.push('API key: ' + (props.getProperty('ANTHROPIC_API_KEY') ? 'ตั้งแล้ว' : 'ยังไม่ตั้ง'));

  ['INBOX_FOLDER_ID', 'DONE_FOLDER_ID'].forEach(function (key) {
    var id = props.getProperty(key);
    if (!id) { lines.push(key + ': ยังไม่ตั้ง — รัน setup()'); return; }
    try {
      lines.push(key + ': ' + DriveApp.getFolderById(id).getName());
    } catch (e) {
      lines.push(key + ': เปิดโฟลเดอร์ไม่ได้ (' + e.message + ')');
    }
  });

  try {
    var sheet = getSheet_();
    lines.push('แท็บ: ' + sheet.getName() + ' (' + sheet.getLastRow() + ' แถว)');
    lines.push('หัวคอลัมน์: ตรงตามที่คาดไว้');
  } catch (e) {
    lines.push('แท็บ: ' + e.message);
  }

  var triggers = ScriptApp.getProjectTriggers().filter(function (t) {
    return t.getHandlerFunction() === 'processInbox';
  });
  lines.push('ตัวตั้งเวลา: ' + (triggers.length ? 'ทำงานอยู่' : 'ยังไม่ได้ตั้ง'));

  var report = lines.join('\n');
  Logger.log(report);
  try {
    SpreadsheetApp.getUi().alert(report);
  } catch (e) { /* ไม่มี UI */ }
  return report;
}

// ---------------------------------------------------------------- งานหลัก

/**
 * สแกนโฟลเดอร์ขาเข้า อ่านรูปที่ยังไม่เคยลงทะเบียน แล้วเติมแถวในชีต
 * ปลอดภัยต่อการรันซ้อน (ใช้ LockService) และไม่เคยทำเอกสารหาย —
 * ถ้าอ่านรูปไม่สำเร็จก็ยังบันทึกแถวพร้อมลิงก์รูปและหมายเหตุให้กรอกมือ
 */
function processInbox() {
  var lock = LockService.getScriptLock();
  if (!lock.tryLock(5000)) {
    Logger.log('รอบก่อนยังทำงานอยู่ ข้ามรอบนี้');
    return;
  }
  try {
    var started = Date.now();
    var props = PropertiesService.getScriptProperties();
    var inbox = DriveApp.getFolderById(requireProp_(props, 'INBOX_FOLDER_ID'));
    var done = DriveApp.getFolderById(requireProp_(props, 'DONE_FOLDER_ID'));
    var sheet = getSheet_();
    ensureExtraColumns_(sheet);

    var state = readSheetState_(sheet);
    var files = inbox.getFiles();
    var added = 0;
    var skipped = 0;

    while (files.hasNext() && added < MAX_FILES_PER_RUN) {
      if (Date.now() - started > TIME_BUDGET_MS) {
        Logger.log('ใกล้หมดเวลาที่จัดไว้ หยุดรอบนี้ ที่เหลือจะทำรอบถัดไป');
        break;
      }
      var file = files.next();

      if (state.fileIds[file.getId()]) {
        moveFile_(file, done);
        skipped += 1;
        continue;
      }

      var extracted = null;
      var failure = null;
      try {
        extracted = extractFromFile_(file);
      } catch (err) {
        failure = err.message;
        Logger.log('อ่านไม่สำเร็จ ' + file.getName() + ': ' + err.message);
      }

      state.seq += 1;
      appendRow_(sheet, state.seq, file, extracted, failure);
      state.fileIds[file.getId()] = true;

      file.setName(padSeq_(state.seq) + '_' + shortLabel_(extracted, file));
      moveFile_(file, done);
      added += 1;
    }

    Logger.log('ลงทะเบียนใหม่ ' + added + ' รายการ, ข้ามที่ลงแล้ว ' + skipped + ' รายการ');
    if (added > 0) notifySlack_(added);
    return added;
  } finally {
    lock.releaseLock();
  }
}

// ---------------------------------------------------------------- อ่านรูป

/** ส่งรูป/PDF ให้ Claude อ่าน แล้วคืนฟิลด์ที่ดึงได้ */
function extractFromFile_(file) {
  var mime = file.getMimeType();
  var block;
  if (ALLOWED_IMAGE.indexOf(mime) !== -1) {
    block = {
      type: 'image',
      source: { type: 'base64', media_type: mime, data: Utilities.base64Encode(file.getBlob().getBytes()) }
    };
  } else if (mime === 'application/pdf') {
    block = {
      type: 'document',
      source: { type: 'base64', media_type: 'application/pdf', data: Utilities.base64Encode(file.getBlob().getBytes()) }
    };
  } else {
    throw new Error('ชนิดไฟล์ไม่รองรับ: ' + mime);
  }

  var payload = {
    model: MODEL,
    max_tokens: 4000,
    system: SYSTEM_PROMPT,
    output_config: { effort: 'low' },
    fallbacks: 'default',
    messages: [{
      role: 'user',
      content: [block, { type: 'text', text: 'ดึงข้อมูลลงทะเบียนจากรูปนี้ตามรูปแบบ JSON ที่กำหนด' }]
    }]
  };

  var response = UrlFetchApp.fetch('https://api.anthropic.com/v1/messages', {
    method: 'post',
    contentType: 'application/json',
    headers: {
      'x-api-key': PropertiesService.getScriptProperties().getProperty('ANTHROPIC_API_KEY'),
      'anthropic-version': '2023-06-01',
      'anthropic-beta': 'server-side-fallback-2026-07-01'
    },
    payload: JSON.stringify(payload),
    muteHttpExceptions: true
  });

  var code = response.getResponseCode();
  if (code !== 200) {
    throw new Error('Claude API ตอบ ' + code + ': ' + response.getContentText().slice(0, 300));
  }

  var body = JSON.parse(response.getContentText());
  if (body.stop_reason === 'refusal') {
    throw new Error('โมเดลปฏิเสธการอ่านรูปนี้');
  }

  var text = (body.content || [])
    .filter(function (b) { return b.type === 'text'; })
    .map(function (b) { return b.text; })
    .join('')
    .trim();

  return parseJson_(text);
}

/** โมเดลถูกสั่งให้ตอบ JSON ล้วน แต่กันเผื่อมี code fence หรือข้อความหุ้มมา */
function parseJson_(text) {
  var cleaned = text.replace(/^```(?:json)?\s*/i, '').replace(/```\s*$/, '').trim();
  try {
    return JSON.parse(cleaned);
  } catch (e) {
    var start = cleaned.indexOf('{');
    var end = cleaned.lastIndexOf('}');
    if (start !== -1 && end > start) {
      return JSON.parse(cleaned.slice(start, end + 1));
    }
    throw new Error('อ่านคำตอบจากโมเดลไม่ได้');
  }
}

// ---------------------------------------------------------------- เขียนชีต

/** เติมแถวใหม่ 1 แถว และไฮไลต์ช่องที่ต้องให้คนตรวจ */
function appendRow_(sheet, seq, file, extracted, failure) {
  var data = extracted || {};
  var row = new Array(LAST_COL).fill('');
  row[COL.SEQ - 1] = seq;
  row[COL.DATE - 1] = Utilities.formatDate(new Date(), 'Asia/Bangkok', 'd-MMM-yy');
  row[COL.DOC_TYPE - 1] = data.doc_type || '';
  row[COL.TRACKING - 1] = data.tracking || '';
  row[COL.SENDER - 1] = data.sender || '';
  row[COL.RECIPIENT - 1] = data.recipient || '';
  row[COL.COMPANY - 1] = data.company || '';
  row[COL.DEPT - 1] = data.dept || '';
  row[COL.NOTE - 1] = buildNote_(data, failure);
  row[COL.PHOTO_URL - 1] = file.getUrl();
  row[COL.FILE_ID - 1] = file.getId();

  sheet.appendRow(row);
  var rowIndex = sheet.getLastRow();

  // ไฮไลต์เหลืองเฉพาะช่องที่อ่านไม่ได้ หรือทั้งแถวถ้า AI ไม่มั่นใจ
  var needsCheck = [COL.DOC_TYPE, COL.TRACKING, COL.SENDER, COL.RECIPIENT, COL.COMPANY, COL.DEPT]
    .filter(function (c) { return !row[c - 1]; });
  if (failure || data.confidence === 'low') {
    sheet.getRange(rowIndex, 1, 1, LAST_COL).setBackground('#fde8e6');
  } else {
    needsCheck.forEach(function (c) { sheet.getRange(rowIndex, c).setBackground('#fff4d6'); });
    if (data.confidence === 'medium') sheet.getRange(rowIndex, COL.DEPT).setBackground('#fff4d6');
  }
  return rowIndex;
}

function buildNote_(data, failure) {
  var parts = [];
  if (failure) parts.push('อ่านรูปไม่สำเร็จ กรุณากรอกมือ (' + failure + ')');
  if (data.note) parts.push(data.note);
  if (!failure && data.confidence && data.confidence !== 'high') {
    parts.push('AI ความมั่นใจ: ' + data.confidence);
  }
  return parts.join(' · ');
}

/**
 * อ่านสถานะชีตครั้งเดียวต่อรอบ: เลขลำดับล่าสุด และรหัสไฟล์ที่ลงทะเบียนแล้ว
 * (รหัสไฟล์คือกันซ้ำ เผื่อย้ายไฟล์ไม่สำเร็จหลังเขียนแถวไปแล้ว)
 */
function readSheetState_(sheet) {
  var lastRow = sheet.getLastRow();
  var state = { seq: 0, fileIds: {} };
  if (lastRow < 2) return state;

  var values = sheet.getRange(2, 1, lastRow - 1, LAST_COL).getValues();
  for (var i = 0; i < values.length; i++) {
    var seq = Number(values[i][COL.SEQ - 1]);
    if (!isNaN(seq) && seq > state.seq) state.seq = seq;
    var id = values[i][COL.FILE_ID - 1];
    if (id) state.fileIds[String(id)] = true;
  }
  return state;
}

/**
 * หาแท็บที่ถูกต้องและตรวจหัวคอลัมน์ก่อนคืนค่า
 * ถ้าหัวไม่ตรง ให้ error ทันที ดีกว่าเขียนข้อมูลลงผิดแท็บ
 */
function getSheet_() {
  var book = SpreadsheetApp.getActive();
  var sheet = book.getSheetByName(SHEET_NAME) || book.getSheets()[0];
  var width = Math.max(sheet.getLastColumn(), EXPECTED_HEADERS.length);
  var headers = sheet.getRange(1, 1, 1, width).getValues()[0].map(function (h) {
    return String(h).trim();
  });

  for (var i = 0; i < EXPECTED_HEADERS.length; i++) {
    if (headers[i] !== EXPECTED_HEADERS[i]) {
      throw new Error(
        'หัวคอลัมน์ที่ ' + (i + 1) + ' ของแท็บ "' + sheet.getName() + '" คือ "' + headers[i] +
        '" แต่คาดว่าเป็น "' + EXPECTED_HEADERS[i] + '" — แก้ SHEET_NAME ให้ชี้แท็บที่ถูกต้องก่อนใช้งาน'
      );
    }
  }
  return sheet;
}

/** เพิ่มคอลัมน์ ลิงก์รูป และ รหัสไฟล์ ต่อท้าย (ไม่ขยับคอลัมน์เดิม 15 คอลัมน์) */
function ensureExtraColumns_(sheet) {
  if (sheet.getMaxColumns() < LAST_COL) {
    sheet.insertColumnsAfter(sheet.getMaxColumns(), LAST_COL - sheet.getMaxColumns());
  }
  var labels = [['ลิงก์รูป', 'รหัสไฟล์']];
  var current = sheet.getRange(1, COL.PHOTO_URL, 1, 2).getValues()[0];
  if (String(current[0]).trim() !== 'ลิงก์รูป') {
    sheet.getRange(1, COL.PHOTO_URL, 1, 2).setValues(labels).setFontWeight('bold');
    sheet.hideColumns(COL.FILE_ID);
  }
}

// ---------------------------------------------------------------- ตัวช่วย

function requireProp_(props, key) {
  var value = props.getProperty(key);
  if (!value) throw new Error('ยังไม่ได้ตั้งค่า ' + key + ' — รัน setup() ก่อน');
  return value;
}

function getOrCreateFolder_(parent, name) {
  var existing = parent.getFoldersByName(name);
  return existing.hasNext() ? existing.next() : parent.createFolder(name);
}

function moveFile_(file, folder) {
  try {
    file.moveTo(folder);
  } catch (e) {
    Logger.log('ย้ายไฟล์ไม่สำเร็จ ' + file.getName() + ': ' + e.message);
  }
}

function padSeq_(seq) {
  var s = String(seq);
  while (s.length < 4) s = '0' + s;
  return s;
}

/** ชื่อไฟล์ใหม่ให้ค้นเจอง่ายจาก Drive */
function shortLabel_(extracted, file) {
  var data = extracted || {};
  var label = data.tracking || data.sender || data.doc_type;
  if (!label) return file.getName();
  return String(label).replace(/[\\/:*?"<>|]/g, '-').slice(0, 60);
}

/** ทีมมีระบบแจ้งเตือน Slack ต่อแผนกอยู่แล้ว ตัวนี้เป็นตัวเสริม ไม่ตั้งก็ไม่ส่ง */
function notifySlack_(count) {
  var url = PropertiesService.getScriptProperties().getProperty('SLACK_WEBHOOK_URL');
  if (!url) return;
  try {
    UrlFetchApp.fetch(url, {
      method: 'post',
      contentType: 'application/json',
      payload: JSON.stringify({
        text: 'ลงทะเบียนเอกสารใหม่อัตโนมัติ ' + count + ' รายการ — รอทีม GM ตรวจแถวที่ไฮไลต์'
      }),
      muteHttpExceptions: true
    });
  } catch (e) {
    Logger.log('ส่ง Slack ไม่สำเร็จ: ' + e.message);
  }
}
