import path from 'node:path';
import crypto from 'node:crypto';
import fs from 'node:fs';
import express from 'express';
import multer from 'multer';
import { db, nowIso, logEvent, UPLOAD_DIR } from './db.js';
import {
  attachUser, requireLogin, requireRole,
  createSession, destroySession, setSessionCookie, clearSessionCookie,
  hashPin, verifyPin,
} from './auth.js';
import { nextRegNo, nextHandoverCode } from './lib/regno.js';
import { notifySlack } from './lib/slack.js';
import { extractFields, ocrConfigured } from './lib/ocr.js';
import { buildWorkbook } from './lib/excel.js';
import { STATUS_LABEL, formatThaiDateTime } from './lib/labels.js';

const PUBLIC_DIR = path.resolve(import.meta.dirname, '../public');
const MAX_PHOTOS = 10;
const ACCEPTED_MIME = new Set([
  'image/jpeg', 'image/png', 'image/gif', 'image/webp', 'image/heic', 'application/pdf',
]);
const EXTENSION = {
  'image/jpeg': '.jpg', 'image/png': '.png', 'image/gif': '.gif',
  'image/webp': '.webp', 'image/heic': '.heic', 'application/pdf': '.pdf',
};

const upload = multer({
  storage: multer.diskStorage({
    destination: (_req, _file, cb) => cb(null, UPLOAD_DIR),
    filename: (_req, file, cb) =>
      cb(null, crypto.randomUUID() + (EXTENSION[file.mimetype] || '')),
  }),
  limits: { fileSize: 15 * 1024 * 1024, files: MAX_PHOTOS },
  fileFilter: (_req, file, cb) =>
    ACCEPTED_MIME.has(file.mimetype)
      ? cb(null, true)
      : cb(Object.assign(new Error(`ไม่รองรับไฟล์ชนิด ${file.mimetype}`), { status: 400 })),
});

const app = express();
app.use(express.json());
app.use(attachUser);

/* ---------------------------------- helpers --------------------------------- */

const fail = (status, message) => Object.assign(new Error(message), { status });
const trim = (v) => (typeof v === 'string' && v.trim() !== '' ? v.trim() : null);

function parseAmount(value) {
  if (value === undefined || value === null || value === '') return null;
  const num = Number(String(value).replace(/,/g, ''));
  if (!Number.isFinite(num) || num < 0) throw fail(400, 'จำนวนเงินไม่ถูกต้อง');
  return num;
}

function parseCopies(value) {
  if (value === undefined || value === null || value === '') return null;
  const num = Number(value);
  if (!Number.isInteger(num) || num < 1) throw fail(400, 'จำนวนฉบับต้องเป็นจำนวนเต็มตั้งแต่ 1 ขึ้นไป');
  return num;
}

function parseDocDate(value) {
  const date = trim(value);
  if (date === null) return null;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) throw fail(400, 'วันที่เอกสารต้องเป็นรูปแบบ YYYY-MM-DD');
  return date;
}

const DOC_SELECT = `
  SELECT d.*, h.code AS handover_code,
         (SELECT COUNT(*) FROM photos p WHERE p.document_id = d.id) AS photo_count
    FROM documents d
    LEFT JOIN handovers h ON h.id = d.handover_id`;

function getDocument(id) {
  const doc = db.prepare(`${DOC_SELECT} WHERE d.id = ?`).get(id);
  if (!doc) throw fail(404, 'ไม่พบเอกสารนี้');
  return doc;
}

// แปลง query string เป็นเงื่อนไข SQL ใช้ร่วมกันระหว่างหน้ารายการและการ export
function buildFilter(query) {
  const clauses = [];
  const params = [];
  if (query.status) {
    const wanted = String(query.status).split(',').filter((s) => s in STATUS_LABEL);
    if (wanted.length === 0) throw fail(400, 'สถานะที่ระบุไม่ถูกต้อง');
    clauses.push(`d.status IN (${wanted.map(() => '?').join(',')})`);
    params.push(...wanted);
  }
  if (trim(query.q)) {
    const like = `%${trim(query.q)}%`;
    clauses.push('(d.reg_no LIKE ? OR d.doc_number LIKE ? OR d.vendor LIKE ? OR d.subject LIKE ?)');
    params.push(like, like, like, like);
  }
  if (trim(query.from)) {
    clauses.push('date(d.intake_at) >= date(?)');
    params.push(trim(query.from));
  }
  if (trim(query.to)) {
    clauses.push('date(d.intake_at) <= date(?)');
    params.push(trim(query.to));
  }
  return { where: clauses.length ? ` WHERE ${clauses.join(' AND ')}` : '', params };
}

/* ----------------------------------- auth ----------------------------------- */

app.get('/api/config', (_req, res) => res.json({ ocr: ocrConfigured() }));

app.get('/api/users/names', (_req, res) => {
  res.json(db.prepare('SELECT name, role FROM users WHERE active = 1 ORDER BY role, name').all());
});

app.post('/api/login', (req, res) => {
  const name = trim(req.body?.name);
  const pin = trim(req.body?.pin);
  if (!name || !pin) throw fail(400, 'กรุณาระบุชื่อผู้ใช้และรหัส PIN');

  const user = db.prepare('SELECT * FROM users WHERE name = ? AND active = 1').get(name);
  if (!user || !verifyPin(pin, user.pin_hash)) throw fail(401, 'ชื่อผู้ใช้หรือรหัส PIN ไม่ถูกต้อง');

  const { token, expires } = createSession(user.id);
  setSessionCookie(res, token, expires);
  res.json({ id: user.id, name: user.name, role: user.role });
});

app.post('/api/logout', requireLogin, (req, res) => {
  destroySession(req.user.token);
  clearSessionCookie(res);
  res.json({ ok: true });
});

app.get('/api/me', requireLogin, (req, res) => {
  res.json({ id: req.user.id, name: req.user.name, role: req.user.role });
});

app.get('/api/users', requireRole('ADMIN'), (_req, res) => {
  res.json(db.prepare('SELECT id, name, role, active FROM users ORDER BY role, name').all());
});

app.post('/api/users', requireRole('ADMIN'), (req, res) => {
  const name = trim(req.body?.name);
  const role = trim(req.body?.role);
  const pin = trim(req.body?.pin);
  if (!name || !role || !pin) throw fail(400, 'กรุณาระบุชื่อ บทบาท และรหัส PIN');
  if (!['WAREHOUSE', 'GM', 'ACCOUNTING', 'ADMIN'].includes(role)) throw fail(400, 'บทบาทไม่ถูกต้อง');
  if (!/^\d{4,8}$/.test(pin)) throw fail(400, 'รหัส PIN ต้องเป็นตัวเลข 4-8 หลัก');
  if (db.prepare('SELECT 1 FROM users WHERE name = ?').get(name)) throw fail(409, 'มีชื่อผู้ใช้นี้อยู่แล้ว');

  const info = db
    .prepare('INSERT INTO users (name, role, pin_hash) VALUES (?, ?, ?)')
    .run(name, role, hashPin(pin));
  res.status(201).json({ id: Number(info.lastInsertRowid), name, role });
});

/* --------------------------- ขั้นที่ 1: คลังรับเอกสาร --------------------------- */

app.post(
  '/api/documents',
  requireRole('WAREHOUSE', 'GM'),
  upload.array('photos', MAX_PHOTOS),
  async (req, res) => {
    if (!req.files?.length) throw fail(400, 'กรุณาแนบรูปถ่ายเอกสารอย่างน้อย 1 รูป');

    const at = nowIso();
    const fields = {
      doc_type: trim(req.body.doc_type),
      doc_number: trim(req.body.doc_number),
      doc_date: parseDocDate(req.body.doc_date),
      vendor: trim(req.body.vendor),
      subject: trim(req.body.subject),
      amount: parseAmount(req.body.amount),
      copies: parseCopies(req.body.copies),
      note: trim(req.body.note),
    };

    db.exec('BEGIN');
    let docId;
    let regNo;
    try {
      regNo = nextRegNo();
      const info = db
        .prepare(
          `INSERT INTO documents
             (reg_no, status, doc_type, doc_number, doc_date, vendor, subject, amount, copies, note,
              intake_by, intake_at, updated_at)
           VALUES (?, 'INTAKE', ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
        )
        .run(
          regNo, fields.doc_type, fields.doc_number, fields.doc_date, fields.vendor,
          fields.subject, fields.amount, fields.copies, fields.note,
          req.user.name, at, at
        );
      docId = Number(info.lastInsertRowid);

      const insertPhoto = db.prepare(
        'INSERT INTO photos (document_id, filename, mime, created_at) VALUES (?, ?, ?, ?)'
      );
      for (const file of req.files) insertPhoto.run(docId, file.filename, file.mimetype, at);

      logEvent(docId, 'INTAKE', req.user.name, `คลังรับเอกสาร แนบรูป ${req.files.length} รูป`);
      db.exec('COMMIT');
    } catch (err) {
      db.exec('ROLLBACK');
      throw err;
    }

    await notifySlack(
      `📥 รับเอกสารใหม่ *${regNo}*\n` +
        `ผู้ส่ง: ${fields.vendor || '-'} | ประเภท: ${fields.doc_type || '-'}\n` +
        `รับโดย: ${req.user.name} เวลา ${formatThaiDateTime(at)} — รอทีม GM ลงทะเบียน`
    );
    res.status(201).json(getDocument(docId));
  }
);

app.post(
  '/api/documents/:id/photos',
  requireLogin,
  upload.array('photos', MAX_PHOTOS),
  (req, res) => {
    const doc = getDocument(Number(req.params.id));
    if (!req.files?.length) throw fail(400, 'กรุณาแนบรูปอย่างน้อย 1 รูป');

    const at = nowIso();
    const insertPhoto = db.prepare(
      'INSERT INTO photos (document_id, filename, mime, created_at) VALUES (?, ?, ?, ?)'
    );
    for (const file of req.files) insertPhoto.run(doc.id, file.filename, file.mimetype, at);
    logEvent(doc.id, 'ADD_PHOTOS', req.user.name, `แนบรูปเพิ่ม ${req.files.length} รูป`);
    res.json(getDocument(doc.id));
  }
);

/* -------------------------- ขั้นที่ 2: GM ลงทะเบียน -------------------------- */

app.post('/api/documents/:id/ocr', requireRole('GM'), async (req, res) => {
  const doc = getDocument(Number(req.params.id));
  const photos = db
    .prepare('SELECT filename, mime FROM photos WHERE document_id = ? ORDER BY id')
    .all(doc.id);
  const suggestion = await extractFields(photos);
  logEvent(doc.id, 'OCR', req.user.name, 'อ่านข้อมูลจากรูปด้วย AI');
  res.json(suggestion);
});

app.patch('/api/documents/:id', requireRole('GM'), async (req, res) => {
  const doc = getDocument(Number(req.params.id));
  if (doc.status !== 'INTAKE' && doc.status !== 'REGISTERED') {
    throw fail(409, `เอกสาร ${doc.reg_no} ส่งให้บัญชีแล้ว แก้ไขไม่ได้`);
  }

  // ส่งฟิลด์ไหนมาก็แก้ฟิลด์นั้น — ค่าว่างคือสั่งล้างข้อมูล ไม่ใช่ "คงค่าเดิม"
  // (ผู้ลงทะเบียนต้องลบข้อมูลที่ทีมคลังกรอกผิดได้)
  const pick = (key, parse) =>
    key in req.body ? parse(req.body[key]) : doc[key];
  const next = {
    doc_type: pick('doc_type', trim),
    doc_number: pick('doc_number', trim),
    doc_date: pick('doc_date', parseDocDate),
    vendor: pick('vendor', trim),
    subject: pick('subject', trim),
    amount: pick('amount', parseAmount),
    copies: pick('copies', parseCopies),
    note: pick('note', trim),
  };
  if (!next.doc_type) throw fail(400, 'กรุณาระบุประเภทเอกสาร');
  if (!next.vendor) throw fail(400, 'กรุณาระบุผู้ส่ง / บริษัท');

  const at = nowIso();
  const firstTime = doc.status === 'INTAKE';
  db.prepare(
    `UPDATE documents SET doc_type = ?, doc_number = ?, doc_date = ?, vendor = ?, subject = ?,
            amount = ?, copies = ?, note = ?, status = 'REGISTERED',
            registered_by = COALESCE(registered_by, ?), registered_at = COALESCE(registered_at, ?),
            updated_at = ?
      WHERE id = ?`
  ).run(
    next.doc_type, next.doc_number, next.doc_date, next.vendor, next.subject,
    next.amount, next.copies, next.note, req.user.name, at, at, doc.id
  );
  logEvent(doc.id, firstTime ? 'REGISTER' : 'EDIT', req.user.name,
    firstTime ? 'ลงทะเบียนเอกสาร' : 'แก้ไขข้อมูลเอกสาร');

  if (firstTime) {
    await notifySlack(
      `📝 ลงทะเบียนแล้ว *${doc.reg_no}* — ${next.vendor} / ${next.doc_type}` +
        `${next.doc_number ? ` เลขที่ ${next.doc_number}` : ''}\n` +
        `โดย: ${req.user.name} เวลา ${formatThaiDateTime(at)}`
    );
  }
  res.json(getDocument(doc.id));
});

/* ------------------- ขั้นที่ 3-4: ส่งมอบให้บัญชี และบัญชีรับ ------------------- */

app.post('/api/handovers', requireRole('GM'), async (req, res) => {
  const ids = Array.isArray(req.body?.document_ids) ? req.body.document_ids.map(Number) : [];
  if (ids.length === 0) throw fail(400, 'กรุณาเลือกเอกสารที่จะส่งมอบอย่างน้อย 1 ฉบับ');

  const docs = ids.map(getDocument);
  const notReady = docs.filter((d) => d.status !== 'REGISTERED');
  if (notReady.length > 0) {
    throw fail(409, `เอกสารเหล่านี้ยังส่งมอบไม่ได้: ${notReady.map((d) => d.reg_no).join(', ')}`);
  }

  const at = nowIso();
  db.exec('BEGIN');
  let handoverId;
  let code;
  try {
    code = nextHandoverCode();
    const info = db
      .prepare('INSERT INTO handovers (code, to_team, created_by, created_at) VALUES (?, ?, ?, ?)')
      .run(code, 'ACCOUNTING', req.user.name, at);
    handoverId = Number(info.lastInsertRowid);

    const link = db.prepare(
      `UPDATE documents SET handover_id = ?, status = 'IN_TRANSIT', updated_at = ? WHERE id = ?`
    );
    for (const doc of docs) {
      link.run(handoverId, at, doc.id);
      logEvent(doc.id, 'HANDOVER', req.user.name, `ส่งมอบให้ทีมบัญชี ตามใบส่งมอบ ${code}`);
    }
    db.exec('COMMIT');
  } catch (err) {
    db.exec('ROLLBACK');
    throw err;
  }

  await notifySlack(
    `📤 ใบส่งมอบ *${code}* — เอกสาร ${docs.length} ฉบับถึงทีมบัญชี\n` +
      `${docs.map((d) => `• ${d.reg_no} ${d.vendor || ''}`).join('\n')}\n` +
      `ส่งโดย: ${req.user.name} เวลา ${formatThaiDateTime(at)} — รอทีมบัญชีกดรับ`
  );
  res.status(201).json(getHandover(handoverId));
});

function getHandover(id) {
  const handover = db.prepare('SELECT * FROM handovers WHERE id = ?').get(id);
  if (!handover) throw fail(404, 'ไม่พบใบส่งมอบนี้');
  handover.documents = db
    .prepare(`${DOC_SELECT} WHERE d.handover_id = ? ORDER BY d.reg_no`)
    .all(id);
  return handover;
}

app.get('/api/handovers', requireLogin, (req, res) => {
  const pendingOnly = req.query.pending === '1';
  const rows = db
    .prepare(
      `SELECT h.*, COUNT(d.id) AS document_count
         FROM handovers h LEFT JOIN documents d ON d.handover_id = h.id
        ${pendingOnly ? 'WHERE h.accepted_at IS NULL' : ''}
        GROUP BY h.id ORDER BY h.created_at DESC LIMIT 200`
    )
    .all();
  res.json(rows);
});

app.get('/api/handovers/:id', requireLogin, (req, res) => {
  res.json(getHandover(Number(req.params.id)));
});

app.post('/api/handovers/:id/accept', requireRole('ACCOUNTING'), async (req, res) => {
  const handover = getHandover(Number(req.params.id));
  if (handover.accepted_at) throw fail(409, `ใบส่งมอบ ${handover.code} ถูกรับไปแล้ว`);

  const pending = handover.documents.filter((d) => d.status === 'IN_TRANSIT');
  if (pending.length === 0) throw fail(409, 'ไม่มีเอกสารที่รออยู่ในใบส่งมอบนี้');

  const note = trim(req.body?.note);
  const at = nowIso();
  db.exec('BEGIN');
  try {
    db.prepare('UPDATE handovers SET accepted_by = ?, accepted_at = ?, accepted_note = ? WHERE id = ?')
      .run(req.user.name, at, note, handover.id);
    const accept = db.prepare(
      `UPDATE documents SET status = 'ACCEPTED', accepted_by = ?, accepted_at = ?, updated_at = ?
        WHERE id = ?`
    );
    for (const doc of pending) {
      accept.run(req.user.name, at, at, doc.id);
      logEvent(doc.id, 'ACCEPT', req.user.name, `ทีมบัญชีรับเอกสารตามใบส่งมอบ ${handover.code}`);
    }
    db.exec('COMMIT');
  } catch (err) {
    db.exec('ROLLBACK');
    throw err;
  }

  await notifySlack(
    `✅ ทีมบัญชีรับเอกสารแล้ว ใบส่งมอบ *${handover.code}* (${pending.length} ฉบับ)\n` +
      `รับโดย: ${req.user.name} เวลา ${formatThaiDateTime(at)}${note ? `\nหมายเหตุ: ${note}` : ''}`
  );
  res.json(getHandover(handover.id));
});

/* ----------------------------- รายการ / ค้นหา / รูป ---------------------------- */

app.get('/api/documents', requireLogin, (req, res) => {
  const { where, params } = buildFilter(req.query);
  const limit = Math.min(Number(req.query.limit) || 200, 1000);
  res.json(
    db.prepare(`${DOC_SELECT}${where} ORDER BY d.intake_at DESC, d.id DESC LIMIT ?`)
      .all(...params, limit)
  );
});

app.get('/api/documents/:id', requireLogin, (req, res) => {
  const doc = getDocument(Number(req.params.id));
  doc.photos = db
    .prepare('SELECT id, mime, created_at FROM photos WHERE document_id = ? ORDER BY id')
    .all(doc.id);
  doc.events = db
    .prepare('SELECT action, actor, detail, at FROM events WHERE document_id = ? ORDER BY id')
    .all(doc.id);
  res.json(doc);
});

app.get('/api/photos/:id', requireLogin, (req, res) => {
  const photo = db.prepare('SELECT * FROM photos WHERE id = ?').get(Number(req.params.id));
  if (!photo) throw fail(404, 'ไม่พบรูปนี้');
  const file = path.join(UPLOAD_DIR, photo.filename);
  if (!fs.existsSync(file)) throw fail(404, 'ไฟล์รูปหายไปจากเซิร์ฟเวอร์');
  res.type(photo.mime).sendFile(file);
});

/* -------------------------------- สรุป / export ------------------------------- */

app.get('/api/stats', requireLogin, (_req, res) => {
  const byStatus = Object.fromEntries(
    db.prepare('SELECT status, COUNT(*) AS n FROM documents GROUP BY status').all()
      .map((r) => [r.status, r.n])
  );
  const oldest = db
    .prepare(
      `SELECT status, MIN(updated_at) AS since FROM documents
        WHERE status != 'ACCEPTED' GROUP BY status`
    )
    .all();
  res.json({
    by_status: { INTAKE: 0, REGISTERED: 0, IN_TRANSIT: 0, ACCEPTED: 0, ...byStatus },
    oldest_pending: Object.fromEntries(oldest.map((r) => [r.status, r.since])),
    intake_today: db
      .prepare(`SELECT COUNT(*) AS n FROM documents WHERE date(intake_at) = date('now','localtime')`)
      .get().n,
    pending_handovers: db
      .prepare('SELECT COUNT(*) AS n FROM handovers WHERE accepted_at IS NULL').get().n,
  });
});

app.get('/api/export.xlsx', requireLogin, (req, res) => {
  const { where, params } = buildFilter(req.query);
  const documents = db
    .prepare(`${DOC_SELECT}${where} ORDER BY d.reg_no`)
    .all(...params);
  const stamp = new Date().toISOString().slice(0, 10);
  res
    .type('application/vnd.openxmlformats-officedocument.spreadsheetml.sheet')
    .setHeader('Content-Disposition', `attachment; filename="doc-register-${stamp}.xlsx"`);
  res.send(buildWorkbook(documents));
});

/* ---------------------------------- static ---------------------------------- */

app.use(express.static(PUBLIC_DIR));

app.use((req, res) => {
  if (req.path.startsWith('/api/')) return res.status(404).json({ error: 'ไม่พบ endpoint นี้' });
  res.sendFile(path.join(PUBLIC_DIR, 'index.html'));
});

app.use((err, _req, res, _next) => {
  const status = err.status || (err instanceof multer.MulterError ? 400 : 500);
  if (status >= 500) console.error(err);
  res.status(status).json({ error: err.message || 'เกิดข้อผิดพลาดภายในระบบ' });
});

const PORT = Number(process.env.PORT) || 3000;
app.listen(PORT, () => console.log(`ระบบลงทะเบียนเอกสารพร้อมใช้งานที่ http://localhost:${PORT}`));
