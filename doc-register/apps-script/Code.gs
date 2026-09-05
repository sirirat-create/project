/**
 * ทะเบียนรับ-ส่งเอกสาร — เติมข้อมูลจากรูปถ่ายเข้า Google Sheets อัตโนมัติ
 *
 * ทำงานคู่กับชีต "รายการรับ-ส่งเอกสาร พัสดุ ประจำวัน" ที่ทีมใช้อยู่ (15 คอลัมน์เดิม
 * ไม่แตะ ไม่ย้าย) โดยเพิ่ม 2 คอลัมน์ท้ายสุดคือ "ลิงก์รูป" กับ "รหัสไฟล์" เท่านั้น
 *
 * รอบการทำงาน: ทุก 5 นาที ไปหยิบรูปใหม่จากต้นทาง → อ่านรูปด้วย Claude →
 * เติมแถวใหม่ในชีต → เก็บสำเนารูปไว้ใน Drive แล้วใส่ลิงก์ในชีต
 *
 * ต้นทางรูปเลือกได้ 2 แบบที่ตัวแปร SOURCE ด้านล่าง:
 *   'SLACK' = ไปอ่านห้อง Slack ที่ Admin ถ่ายรูปลงอยู่แล้ว (ไม่มีใครต้องเปลี่ยนพฤติกรรม)
 *   'DRIVE' = อ่านจากโฟลเดอร์ Drive ที่คนอัปโหลดรูปเข้าไปเอง
 *
 * ติดตั้ง: ดู README.md
 */

// ---------------------------------------------------------------- ตั้งค่าได้

/** ต้นทางรูป: 'SLACK' หรือ 'DRIVE' */
var SOURCE = 'SLACK';

/** ชื่อแท็บที่จะเขียน — ต้องตรงกับแท็บที่ทีมใช้จริง */
var SHEET_NAME = 'รายการรับเอกสารภายนอกWH300';

/**
 * ชื่อหัวคอลัมน์ที่สคริปต์ต้องใช้ — หาจาก "ชื่อ" ไม่ใช่ตำแหน่ง
 * เพราะแต่ละแท็บของทีมมีจำนวนคอลัมน์ไม่เท่ากัน (WH300 มี 12, แท็บเก่ามี 15)
 * และถ้าใครเพิ่ม/ลบคอลัมน์ในอนาคตก็ยังทำงานถูก
 */
var REQUIRED_HEADERS = {
  seq: 'ลำดับที่',
  date: 'วันที่รับเอกสาร/พัสดุ',
  docType: 'ประเภทเอกสาร',
  tracking: 'เลข tracking / เลข INV',
  sender: 'ผู้ส่ง',
  recipient: 'ชื่อผู้รับ',
  company: 'บริษัท',
  dept: 'แผนกผู้รับ'
};

/** มีก็ใช้ ไม่มีก็ข้าม */
var OPTIONAL_HEADERS = { note: 'หมายเหตุ' };

/** 2 คอลัมน์ที่สคริปต์เพิ่มต่อท้าย ไม่ไปแทรกกลางตาราง */
var EXTRA_HEADERS = { photoUrl: 'ลิงก์รูป', fileId: 'รหัสไฟล์' };

/** จำนวนรูปที่ทำต่อรอบ และเวลาที่ยอมให้ใช้ (Apps Script ตัดที่ 6 นาที) */
var MAX_FILES_PER_RUN = 12;
var TIME_BUDGET_MS = 4.5 * 60 * 1000;

/**
 * ย้อนไปอ่าน Slack เผื่อไว้กี่ชั่วโมงจากรอบล่าสุด
 * เผื่อกรณีมีคนโพสต์ย้อนหลังหรือรอบก่อนทำไม่ทัน — ซ้ำไม่ได้เพราะกันด้วยรหัสไฟล์อยู่แล้ว
 */
var SLACK_LOOKBACK_HOURS = 48;

var MODEL = 'claude-opus-5';
var ALLOWED_IMAGE = ['image/jpeg', 'image/png', 'image/gif', 'image/webp'];

/**
 * โจทย์ที่ส่งให้โมเดล — เขียนตาม SOP ข้อ 4.1 และ 4.2 ของทีมเอง
 * แก้ตรงนี้ได้เลยถ้ากฎการคัดแยกเปลี่ยน
 */
var BASE_PROMPT = [
  'คุณคือผู้ช่วยงานสารบรรณของ TDFB หน้าที่คืออ่านรูปถ่ายซองเอกสาร/พัสดุที่บริษัทได้รับ',
  'แล้วดึงข้อมูลลงทะเบียนตามกฎของทีม',
  '',
  'ตอบเป็น JSON ล้วน ไม่ต้องมีคำอธิบายหรือ code fence คีย์ที่ต้องมี:',
  '{',
  '  "doc_type": "ชนิดของซองหรือหุ้มห่อที่เห็นในรูป เช่น ซองจดหมาย | ซองน้ำตาล | ซองพลาสติก | ซองเอกสาร | กล่องพัสดุ | ใบเขียว ปณ.",',
  '  "tracking": "เลข tracking ที่พิมพ์บนซอง ถ้าไม่มีให้ใส่เลขที่เอกสารหรือเลขที่ INV แทน ถ้าเป็นใบเขียว ปณ. ให้ใส่เลข EMS",',
  '  "sender": "ชื่อผู้ส่งตามที่ปรากฏบนซอง ใส่ชื่อเต็มอย่างที่พิมพ์ไว้",',
  '  "recipient": "ชื่อผู้รับหรือแผนกที่ระบุบนซอง ถ้าบนซองระบุแผนกให้ใส่ชื่อแผนกเป็นภาษาไทย เช่น บัญชี",',
  '  "company": "รหัสบริษัทผู้รับ",',
  '  "dept": "แผนกผู้รับ",',
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

/**
 * ต่อรายการตัวเลือกจริงจาก dropdown ในชีตเข้าไปในโจทย์
 * ทีมเพิ่มบริษัทหรือแผนกใหม่ในชีต โมเดลจะรู้เองโดยไม่ต้องแก้โค้ด
 */
function buildPrompt_(companyOptions, deptOptions) {
  var extra = [];
  if (companyOptions.length > 0) {
    extra.push('ค่า "company" ต้องเลือกจากรายการนี้เท่านั้น: ' + companyOptions.join(' | ') + ' (เดาไม่ได้ใส่ null)');
  }
  if (deptOptions.length > 0) {
    extra.push('ค่า "dept" ต้องเลือกจากรายการนี้เท่านั้น: ' + deptOptions.join(' | '));
  }
  return extra.length > 0 ? BASE_PROMPT + '\n\n' + extra.join('\n') : BASE_PROMPT;
}

// ---------------------------------------------------------------- เมนูในชีต

function onOpen() {
  SpreadsheetApp.getUi()
    .createMenu('ทะเบียนเอกสาร')
    .addItem('ดึงเอกสารใหม่เดี๋ยวนี้', 'processQueue')
    .addItem('ตรวจการตั้งค่า', 'checkSetup')
    .addSeparator()
    .addItem('ติดตั้ง / ตั้งค่าครั้งแรก', 'setup')
    .addToUi();
}

// ---------------------------------------------------------------- ติดตั้ง

/**
 * รันครั้งเดียวตอนติดตั้ง: สร้างโฟลเดอร์เก็บรูปใน Drive เพิ่ม 2 คอลัมน์ท้ายชีต
 * และตั้งให้ทำงานเองทุก 5 นาที
 */
function setup() {
  var props = PropertiesService.getScriptProperties();
  requireProp_(props, 'ANTHROPIC_API_KEY');
  if (SOURCE === 'SLACK') {
    requireProp_(props, 'SLACK_BOT_TOKEN');
    requireProp_(props, 'SLACK_CHANNEL_ID');
  }

  var root = getOrCreateFolder_(DriveApp.getRootFolder(), 'ทะเบียนเอกสาร');
  var done = getOrCreateFolder_(root, '02_ลงทะเบียนแล้ว');
  props.setProperty('DONE_FOLDER_ID', done.getId());
  var inbox = getOrCreateFolder_(root, '01_รอลงทะเบียน');
  props.setProperty('INBOX_FOLDER_ID', inbox.getId());

  ensureExtraColumns_(resolveSheet_());

  ScriptApp.getProjectTriggers().forEach(function (t) {
    if (t.getHandlerFunction() === 'processQueue' || t.getHandlerFunction() === 'processInbox') {
      ScriptApp.deleteTrigger(t);
    }
  });
  ScriptApp.newTrigger('processQueue').timeBased().everyMinutes(5).create();

  var message = [
    'ติดตั้งเรียบร้อย',
    '',
    'ต้นทางรูป: ' + SOURCE,
    'โฟลเดอร์เก็บสำเนารูป: ' + done.getUrl(),
    SOURCE === 'DRIVE' ? 'โฟลเดอร์อัปโหลดรูป: ' + inbox.getUrl() : '',
    '',
    'ระบบจะดึงรูปใหม่ทุก 5 นาที'
  ].filter(String).join('\n');
  Logger.log(message);
  try {
    SpreadsheetApp.getUi().alert(message);
  } catch (e) { /* รันจาก editor ไม่มี UI */ }
}

/** ตรวจว่าตั้งค่าครบและชี้ถูกที่ ก่อนปล่อยให้ทีมใช้ */
function checkSetup() {
  var props = PropertiesService.getScriptProperties();
  var lines = ['ต้นทางรูป: ' + SOURCE];
  lines.push('API key ของ Claude: ' + (props.getProperty('ANTHROPIC_API_KEY') ? 'ตั้งแล้ว' : 'ยังไม่ตั้ง'));

  if (SOURCE === 'SLACK') {
    lines.push('Slack token: ' + (props.getProperty('SLACK_BOT_TOKEN') ? 'ตั้งแล้ว' : 'ยังไม่ตั้ง'));
    lines.push('Slack channel: ' + (props.getProperty('SLACK_CHANNEL_ID') || 'ยังไม่ตั้ง'));
    try {
      var probe = slackCall_('conversations.info', { channel: requireProp_(props, 'SLACK_CHANNEL_ID') });
      lines.push('เชื่อมต่อ Slack ได้: ห้อง #' + probe.channel.name +
        (probe.channel.is_member ? ' (bot อยู่ในห้องแล้ว)' : ' — ยังไม่ได้เชิญ bot เข้าห้อง!'));
    } catch (e) {
      lines.push('เชื่อมต่อ Slack ไม่ได้: ' + e.message);
    }
  } else {
    var inboxId = props.getProperty('INBOX_FOLDER_ID');
    lines.push('โฟลเดอร์ขาเข้า: ' + (inboxId ? DriveApp.getFolderById(inboxId).getName() : 'ยังไม่ตั้ง'));
  }

  var doneId = props.getProperty('DONE_FOLDER_ID');
  lines.push('โฟลเดอร์เก็บสำเนา: ' + (doneId ? DriveApp.getFolderById(doneId).getName() : 'ยังไม่ตั้ง'));

  try {
    var found = resolveSheet_();
    lines.push('แท็บ: ' + found.sheet.getName() + ' (' + found.sheet.getLastRow() + ' แถว) หัวคอลัมน์ครบ');
    var companies = readDropdownOptions_(found.sheet, found.cols.company);
    var depts = readDropdownOptions_(found.sheet, found.cols.dept);
    lines.push('ตัวเลือกบริษัทในชีต: ' + (companies.length ? companies.join(', ') : 'อ่านไม่ได้ (จะใช้รายการตั้งต้น)'));
    lines.push('ตัวเลือกแผนกในชีต: ' + (depts.length ? depts.join(', ') : 'อ่านไม่ได้ (จะใช้รายการตั้งต้น)'));
  } catch (e) {
    lines.push('แท็บ: ' + e.message);
  }

  var triggers = ScriptApp.getProjectTriggers().filter(function (t) {
    return t.getHandlerFunction() === 'processQueue';
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
 * หยิบรูปใหม่จากต้นทาง อ่านข้อมูล แล้วเติมแถวในชีต
 * ปลอดภัยต่อการรันซ้อน (LockService) และไม่เคยทำเอกสารหาย —
 * ถ้าอ่านรูปไม่สำเร็จก็ยังบันทึกแถวพร้อมลิงก์รูปและหมายเหตุให้กรอกมือ
 */
function processQueue() {
  var lock = LockService.getScriptLock();
  if (!lock.tryLock(5000)) {
    Logger.log('รอบก่อนยังทำงานอยู่ ข้ามรอบนี้');
    return;
  }
  try {
    var started = Date.now();
    var props = PropertiesService.getScriptProperties();
    var found = resolveSheet_();
    var sheet = found.sheet;
    var cols = ensureExtraColumns_(found);
    var prompt = buildPrompt_(
      readDropdownOptions_(sheet, cols.company),
      readDropdownOptions_(sheet, cols.dept)
    );

    var state = readSheetState_(sheet, cols);
    var done = DriveApp.getFolderById(requireProp_(props, 'DONE_FOLDER_ID'));
    var items = SOURCE === 'SLACK' ? collectFromSlack_(props) : collectFromDrive_(props);

    var added = 0;
    var skipped = 0;

    for (var i = 0; i < items.length; i++) {
      if (added >= MAX_FILES_PER_RUN) break;
      if (Date.now() - started > TIME_BUDGET_MS) {
        Logger.log('ใกล้หมดเวลาที่จัดไว้ หยุดรอบนี้ ที่เหลือจะทำรอบถัดไป');
        break;
      }
      var item = items[i];

      if (state.fileIds[item.id]) {
        skipped += 1;
        continue;
      }

      var extracted = null;
      var failure = null;
      try {
        extracted = extractFields_(item, prompt);
      } catch (err) {
        failure = err.message;
        Logger.log('อ่านไม่สำเร็จ ' + item.name + ': ' + err.message);
      }

      state.seq += 1;
      var saved = saveCopy_(item, done, state.seq, extracted);
      appendRow_(sheet, cols, state.seq, item.id, saved.getUrl(), extracted, failure);
      state.fileIds[item.id] = true;
      added += 1;
    }

    if (SOURCE === 'SLACK' && items.length > 0) {
      props.setProperty('SLACK_LAST_TS', String(Math.floor(Date.now() / 1000)));
    }

    Logger.log('ลงทะเบียนใหม่ ' + added + ' รายการ, ข้ามที่ลงแล้ว ' + skipped + ' รายการ');
    if (added > 0) notifySlack_(added);
    return added;
  } finally {
    lock.releaseLock();
  }
}

// ---------------------------------------------------------------- ต้นทาง: Slack

/**
 * อ่านข้อความล่าสุดในห้อง Slack แล้วคืนรายการรูปที่แนบมา
 * ย้อนหลังตาม SLACK_LOOKBACK_HOURS เผื่อโพสต์ย้อนหลัง — ซ้ำไม่ได้เพราะกันด้วยรหัสไฟล์
 */
function collectFromSlack_(props) {
  var lastTs = Number(props.getProperty('SLACK_LAST_TS') || 0);
  var lookback = Math.floor(Date.now() / 1000) - SLACK_LOOKBACK_HOURS * 3600;
  var oldest = lastTs > 0 ? Math.min(lastTs, lookback) : lookback;

  var body = slackCall_('conversations.history', {
    channel: requireProp_(props, 'SLACK_CHANNEL_ID'),
    oldest: String(oldest),
    limit: '200'
  });

  var items = [];
  (body.messages || []).forEach(function (message) {
    (message.files || []).forEach(function (file) {
      if (!isSupportedMime_(file.mimetype)) return;
      items.push({
        id: 'slack:' + file.id,
        name: file.name || file.id,
        mime: file.mimetype,
        downloadUrl: file.url_private_download || file.url_private,
        postedAt: Number(message.ts)
      });
    });
  });

  // เก่าไปใหม่ เพื่อให้เลขลำดับในชีตเรียงตามเวลาที่ Admin ถ่ายรูป
  items.sort(function (a, b) { return a.postedAt - b.postedAt; });
  return items;
}

/** เรียก Slack API พร้อมแปลง error ให้อ่านรู้เรื่อง */
function slackCall_(method, params) {
  var token = requireProp_(PropertiesService.getScriptProperties(), 'SLACK_BOT_TOKEN');
  var query = Object.keys(params).map(function (k) {
    return encodeURIComponent(k) + '=' + encodeURIComponent(params[k]);
  }).join('&');

  var response = UrlFetchApp.fetch('https://slack.com/api/' + method + '?' + query, {
    headers: { Authorization: 'Bearer ' + token },
    muteHttpExceptions: true
  });
  var body = JSON.parse(response.getContentText());
  if (!body.ok) throw new Error(explainSlackError_(method, body.error));
  return body;
}

/** แปลงรหัส error ของ Slack เป็นภาษาที่บอกได้ว่าต้องไปแก้อะไร */
function explainSlackError_(method, error) {
  var hints = {
    not_in_channel: 'bot ยังไม่ได้อยู่ในห้อง — ไปที่ห้องนั้นใน Slack แล้วพิมพ์ /invite @ชื่อแอป',
    channel_not_found: 'หา channel ไม่เจอ — เช็ค SLACK_CHANNEL_ID (ต้องขึ้นต้นด้วย C) และ bot ต้องอยู่ในห้อง',
    missing_scope: 'สิทธิ์ของ bot ไม่ครบ — ต้องมี channels:history, groups:history, files:read แล้วกด Reinstall',
    invalid_auth: 'token ไม่ถูกต้อง — copy Bot User OAuth Token (ขึ้นต้น xoxb-) มาใส่ใหม่',
    account_inactive: 'แอปถูกปิดใช้งานใน workspace'
  };
  return 'Slack ' + method + ' ผิดพลาด: ' + error + (hints[error] ? ' — ' + hints[error] : '');
}

/** ดาวน์โหลดไฟล์จาก Slack (ต้องแนบ token ไม่งั้นได้หน้า login กลับมา) */
function fetchSlackBlob_(item) {
  var token = requireProp_(PropertiesService.getScriptProperties(), 'SLACK_BOT_TOKEN');
  var response = UrlFetchApp.fetch(item.downloadUrl, {
    headers: { Authorization: 'Bearer ' + token },
    muteHttpExceptions: true,
    followRedirects: true
  });
  if (response.getResponseCode() !== 200) {
    throw new Error('ดาวน์โหลดรูปจาก Slack ไม่ได้ (' + response.getResponseCode() + ')');
  }
  var blob = response.getBlob();
  var type = blob.getContentType() || '';
  if (type.indexOf('text/html') === 0) {
    throw new Error('Slack ส่งหน้า login กลับมาแทนรูป — สิทธิ์ files:read ยังไม่ครบ');
  }
  return blob.setName(item.name);
}

// ---------------------------------------------------------------- ต้นทาง: Drive

/** อ่านรูปจากโฟลเดอร์ Drive (ใช้เมื่อ SOURCE = 'DRIVE') */
function collectFromDrive_(props) {
  var inbox = DriveApp.getFolderById(requireProp_(props, 'INBOX_FOLDER_ID'));
  var files = inbox.getFiles();
  var items = [];
  while (files.hasNext()) {
    var file = files.next();
    items.push({
      id: 'drive:' + file.getId(),
      name: file.getName(),
      mime: file.getMimeType(),
      driveFile: file,
      postedAt: file.getDateCreated().getTime() / 1000
    });
  }
  items.sort(function (a, b) { return a.postedAt - b.postedAt; });
  return items;
}

// ---------------------------------------------------------------- อ่านรูป

function isSupportedMime_(mime) {
  return ALLOWED_IMAGE.indexOf(mime) !== -1 || mime === 'application/pdf';
}

/** ดึง blob ของรูปจากต้นทางไหนก็ได้ */
function blobOf_(item) {
  return item.driveFile ? item.driveFile.getBlob() : fetchSlackBlob_(item);
}

/** ส่งรูป/PDF ให้ Claude อ่าน แล้วคืนฟิลด์ที่ดึงได้ */
function extractFields_(item, prompt) {
  if (!isSupportedMime_(item.mime)) {
    throw new Error('ชนิดไฟล์ไม่รองรับ: ' + item.mime);
  }
  var data = Utilities.base64Encode(blobOf_(item).getBytes());
  var block = item.mime === 'application/pdf'
    ? { type: 'document', source: { type: 'base64', media_type: 'application/pdf', data: data } }
    : { type: 'image', source: { type: 'base64', media_type: item.mime, data: data } };

  var payload = {
    model: MODEL,
    max_tokens: 4000,
    system: prompt,
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
      'x-api-key': requireProp_(PropertiesService.getScriptProperties(), 'ANTHROPIC_API_KEY'),
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

// ---------------------------------------------------------------- เก็บสำเนารูป

/**
 * เก็บสำเนารูปไว้ใน Drive เพื่อให้ลิงก์ในชีตใช้ได้ตลอด ไม่ผูกกับอายุข้อความใน Slack
 * ตั้งชื่อไฟล์เป็นเลขลำดับ เพื่อให้ค้นจากชีตไปหารูปได้ง่าย
 */
function saveCopy_(item, folder, seq, extracted) {
  var name = padSeq_(seq) + '_' + shortLabel_(extracted, item);
  if (item.driveFile) {
    item.driveFile.setName(name);
    moveFile_(item.driveFile, folder);
    return item.driveFile;
  }
  return folder.createFile(blobOf_(item).setName(name));
}

// ---------------------------------------------------------------- เขียนชีต

/**
 * หาแท็บที่ถูกต้อง แล้วบอกว่าข้อมูลแต่ละอย่างอยู่คอลัมน์ที่เท่าไหร่
 * ถ้าหัวคอลัมน์ที่จำเป็นหายไปแม้แต่ช่องเดียว จะหยุดทันที
 * ดีกว่าเขียนข้อมูลลงผิดช่องแล้วไปรู้ทีหลัง
 */
function resolveSheet_() {
  var book = SpreadsheetApp.getActive();
  var sheet = book.getSheetByName(SHEET_NAME);
  if (!sheet) {
    var names = book.getSheets().map(function (s) { return s.getName(); });
    throw new Error('ไม่พบแท็บชื่อ "' + SHEET_NAME + '" — แท็บที่มีคือ: ' + names.join(', '));
  }

  var width = Math.max(sheet.getLastColumn(), 1);
  var headers = sheet.getRange(1, 1, 1, width).getValues()[0].map(function (h) {
    return String(h).trim();
  });

  var cols = {};
  var missing = [];
  Object.keys(REQUIRED_HEADERS).forEach(function (key) {
    var at = headers.indexOf(REQUIRED_HEADERS[key]);
    if (at === -1) missing.push(REQUIRED_HEADERS[key]);
    else cols[key] = at + 1;
  });
  if (missing.length > 0) {
    throw new Error('แท็บ "' + sheet.getName() + '" ไม่มีหัวคอลัมน์: ' + missing.join(', ') +
      ' — เช็คว่า SHEET_NAME ชี้แท็บถูกไหม');
  }

  Object.keys(OPTIONAL_HEADERS).forEach(function (key) {
    var at = headers.indexOf(OPTIONAL_HEADERS[key]);
    if (at !== -1) cols[key] = at + 1;
  });
  Object.keys(EXTRA_HEADERS).forEach(function (key) {
    var at = headers.indexOf(EXTRA_HEADERS[key]);
    if (at !== -1) cols[key] = at + 1;
  });

  return { sheet: sheet, cols: cols, width: width };
}

/** เพิ่มคอลัมน์ ลิงก์รูป และ รหัสไฟล์ ต่อท้ายตาราง ไม่แทรกกลาง ไม่ขยับของเดิม */
function ensureExtraColumns_(found) {
  var sheet = found.sheet;
  var cols = found.cols;
  if (cols.photoUrl && cols.fileId) return cols;

  var at = found.width;
  var keys = ['photoUrl', 'fileId'];
  keys.forEach(function (key) {
    if (cols[key]) return;
    at += 1;
    if (sheet.getMaxColumns() < at) sheet.insertColumnsAfter(sheet.getMaxColumns(), 1);
    sheet.getRange(1, at).setValue(EXTRA_HEADERS[key]).setFontWeight('bold');
    cols[key] = at;
  });
  if (cols.fileId) sheet.hideColumns(cols.fileId);
  return cols;
}

/**
 * อ่านสถานะชีตครั้งเดียวต่อรอบ: เลขลำดับล่าสุด และรหัสไฟล์ที่ลงทะเบียนแล้ว
 * รหัสไฟล์คือตัวกันซ้ำหลัก ทำให้อ่าน Slack ย้อนหลังซ้ำได้โดยไม่เกิดแถวซ้ำ
 */
function readSheetState_(sheet, cols) {
  var lastRow = sheet.getLastRow();
  var state = { seq: 0, fileIds: {} };
  if (lastRow < 2) return state;

  var width = Math.max(cols.seq, cols.fileId);
  var values = sheet.getRange(2, 1, lastRow - 1, width).getValues();
  for (var i = 0; i < values.length; i++) {
    var seq = Number(values[i][cols.seq - 1]);
    if (!isNaN(seq) && seq > state.seq) state.seq = seq;
    var id = values[i][cols.fileId - 1];
    if (id) state.fileIds[String(id)] = true;
  }
  return state;
}

/** เติมแถวใหม่ 1 แถว และไฮไลต์ช่องที่ต้องให้คนตรวจ */
function appendRow_(sheet, cols, seq, fileId, photoUrl, extracted, failure) {
  var data = extracted || {};
  var values = {
    seq: seq,
    date: Utilities.formatDate(new Date(), 'Asia/Bangkok', 'd-MMM-yy'),
    docType: data.doc_type || '',
    tracking: data.tracking || '',
    sender: data.sender || '',
    recipient: data.recipient || '',
    company: data.company || '',
    dept: data.dept || '',
    note: buildNote_(data, failure),
    photoUrl: photoUrl,
    fileId: fileId
  };

  var width = 0;
  Object.keys(cols).forEach(function (k) { if (cols[k] > width) width = cols[k]; });
  var row = new Array(width).fill('');
  Object.keys(values).forEach(function (key) {
    if (cols[key]) row[cols[key] - 1] = values[key];
  });

  sheet.appendRow(row);
  var rowIndex = sheet.getLastRow();

  // ไฮไลต์เหลืองเฉพาะช่องที่อ่านไม่ได้ หรือทั้งแถวถ้าอ่านไม่สำเร็จ/AI ไม่มั่นใจ
  if (failure || data.confidence === 'low') {
    sheet.getRange(rowIndex, 1, 1, width).setBackground('#fde8e6');
  } else {
    ['docType', 'tracking', 'sender', 'recipient', 'company', 'dept'].forEach(function (key) {
      if (cols[key] && !values[key]) sheet.getRange(rowIndex, cols[key]).setBackground('#fff4d6');
    });
    if (data.confidence === 'medium' && cols.dept) {
      sheet.getRange(rowIndex, cols.dept).setBackground('#fff4d6');
    }
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
 * อ่านตัวเลือกใน dropdown ของคอลัมน์ (บริษัท / แผนกผู้รับ) จากแถวล่าสุดที่มีข้อมูล
 * เพื่อให้บอกโมเดลได้ว่าทีมมีตัวเลือกอะไรจริงๆ ไม่ต้องมาแก้โค้ดเวลาทีมเพิ่มบริษัทใหม่
 * อ่านไม่ได้ก็ไม่เป็นไร คืนค่าว่างแล้วใช้รายการตั้งต้นในโจทย์แทน
 */
function readDropdownOptions_(sheet, column) {
  if (!column) return [];
  try {
    var lastRow = sheet.getLastRow();
    for (var row = lastRow; row >= 2 && row > lastRow - 50; row--) {
      var rule = sheet.getRange(row, column).getDataValidation();
      if (!rule) continue;
      var criteria = rule.getCriteriaValues();
      if (criteria && criteria.length > 0 && criteria[0] && criteria[0].length) {
        return criteria[0].map(String).filter(String);
      }
    }
  } catch (e) {
    Logger.log('อ่าน dropdown ไม่ได้: ' + e.message);
  }
  return [];
}

// ---------------------------------------------------------------- ตัวช่วย

function requireProp_(props, key) {
  var value = props.getProperty(key);
  if (!value) throw new Error('ยังไม่ได้ตั้งค่า ' + key + ' ใน Script Properties');
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
function shortLabel_(extracted, item) {
  var data = extracted || {};
  var label = data.tracking || data.sender || data.doc_type;
  if (!label) return item.name;
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
