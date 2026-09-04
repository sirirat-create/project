export const STATUS_LABEL = {
  INTAKE: 'รอลงทะเบียน',
  REGISTERED: 'รอส่งบัญชี',
  IN_TRANSIT: 'รอบัญชีรับ',
  ACCEPTED: 'บัญชีรับแล้ว',
};

export const DOC_TYPES = [
  'ใบกำกับภาษี', 'ใบเสร็จรับเงิน', 'ใบวางบิล', 'ใบส่งของ',
  'ใบแจ้งหนี้', 'สัญญา', 'หนังสือราชการ', 'อื่นๆ',
];

const ACTION_LABEL = {
  INTAKE: 'คลังรับเอกสาร',
  ADD_PHOTOS: 'แนบรูปเพิ่ม',
  OCR: 'อ่านข้อมูลจากรูป',
  REGISTER: 'ลงทะเบียน',
  EDIT: 'แก้ไขข้อมูล',
  HANDOVER: 'ส่งมอบให้บัญชี',
  ACCEPT: 'บัญชีรับเอกสาร',
};

/** เรียก API และโยน Error ที่มีข้อความจากเซิร์ฟเวอร์เมื่อไม่สำเร็จ */
export async function api(url, options = {}) {
  const init = { ...options };
  if (init.body && !(init.body instanceof FormData)) {
    init.headers = { 'Content-Type': 'application/json', ...init.headers };
    init.body = JSON.stringify(init.body);
  }
  const res = await fetch(url, init);
  if (res.status === 401) {
    location.href = '/index.html';
    throw new Error('กรุณาเข้าสู่ระบบ');
  }
  const data = res.headers.get('content-type')?.includes('json') ? await res.json() : null;
  if (!res.ok) throw new Error(data?.error || `เกิดข้อผิดพลาด (${res.status})`);
  return data;
}

/** ตรวจว่าเข้าสู่ระบบแล้ว และบทบาทตรงกับที่หน้านั้นต้องการ */
export async function requireUser(...allowedRoles) {
  const user = await api('/api/me');
  if (allowedRoles.length > 0 && user.role !== 'ADMIN' && !allowedRoles.includes(user.role)) {
    alert('บทบาทของคุณไม่มีสิทธิ์เข้าหน้านี้');
    location.href = '/index.html';
    throw new Error('ไม่มีสิทธิ์');
  }
  const slot = document.querySelector('[data-who]');
  if (slot) slot.textContent = user.name;
  return user;
}

export function showMessage(el, text, kind = 'err') {
  if (!el) return;
  el.className = `msg ${kind}`;
  el.textContent = text;
  if (text) el.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
}

/** ครอบ handler ของฟอร์ม: กันกดซ้ำ + แสดง error ให้ผู้ใช้เห็น */
export function onSubmit(form, messageEl, handler) {
  form.addEventListener('submit', async (event) => {
    event.preventDefault();
    const button = form.querySelector('button[type=submit]');
    const original = button?.textContent;
    if (button) { button.disabled = true; button.textContent = 'กำลังบันทึก...'; }
    showMessage(messageEl, '');
    try {
      await handler();
    } catch (err) {
      showMessage(messageEl, err.message);
    } finally {
      if (button) { button.disabled = false; button.textContent = original; }
    }
  });
}

export const escapeHtml = (value) =>
  String(value ?? '').replace(/[&<>"']/g, (c) =>
    ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

export const formatDateTime = (iso) =>
  iso ? new Date(iso).toLocaleString('th-TH', { dateStyle: 'short', timeStyle: 'short' }) : '';

export const formatAmount = (n) =>
  n == null ? '' : Number(n).toLocaleString('th-TH', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

/** ระยะเวลาที่เอกสารค้างอยู่ในขั้นตอนเดิม */
export function elapsed(iso) {
  if (!iso) return '';
  const hours = Math.floor((Date.now() - new Date(iso)) / 3600e3);
  if (hours < 1) return 'ไม่ถึงชั่วโมง';
  if (hours < 24) return `${hours} ชั่วโมง`;
  return `${Math.floor(hours / 24)} วัน`;
}

export function statusPill(status) {
  return `<span class="pill ${status}">${STATUS_LABEL[status] || status}</span>`;
}

export function photoThumbs(photos) {
  if (!photos?.length) return '';
  const items = photos.map((p) =>
    p.mime === 'application/pdf'
      ? `<a class="pdf" href="/api/photos/${p.id}" target="_blank" rel="noopener">📄 PDF</a>`
      : `<a href="/api/photos/${p.id}" target="_blank" rel="noopener"><img src="/api/photos/${p.id}" alt="รูปเอกสาร" loading="lazy"></a>`
  );
  return `<div class="thumbs">${items.join('')}</div>`;
}

export function timeline(events) {
  if (!events?.length) return '';
  const items = events.map(
    (e) => `<li><b>${escapeHtml(ACTION_LABEL[e.action] || e.action)}</b> — ${escapeHtml(e.actor)} · ${formatDateTime(e.at)}${e.detail ? ` · ${escapeHtml(e.detail)}` : ''}</li>`
  );
  return `<ul class="timeline">${items.join('')}</ul>`;
}

/** การ์ดข้อมูลเอกสาร 1 ฉบับ ใช้ซ้ำทุกหน้า */
export function docCard(doc, extraHtml = '') {
  const fields = [
    ['ประเภท', doc.doc_type],
    ['เลขที่เอกสาร', doc.doc_number],
    ['วันที่เอกสาร', doc.doc_date],
    ['ผู้ส่ง', doc.vendor],
    ['เรื่อง', doc.subject],
    ['จำนวนเงิน', formatAmount(doc.amount)],
    ['จำนวนฉบับ', doc.copies],
    ['ใบส่งมอบ', doc.handover_code],
    ['บัญชีรับโดย', doc.accepted_by && `${doc.accepted_by} · ${formatDateTime(doc.accepted_at)}`],
    ['หมายเหตุ', doc.note],
  ].filter(([, value]) => value !== null && value !== undefined && value !== '');

  return `<div class="doc">
    <div class="doc-head">
      <span class="reg">${escapeHtml(doc.reg_no)}</span>
      ${statusPill(doc.status)}
      <span class="muted" style="font-size:13px">คลังรับ ${formatDateTime(doc.intake_at)} โดย ${escapeHtml(doc.intake_by)}</span>
    </div>
    <dl>${fields.map(([k, v]) => `<dt>${k}</dt><dd>${escapeHtml(v)}</dd>`).join('')}</dl>
    ${extraHtml}
  </div>`;
}

/** แถบหัวเรื่องมาตรฐาน ใช้ทุกหน้าย่อย */
export function pageHeader(title) {
  document.body.insertAdjacentHTML(
    'afterbegin',
    `<header class="bar">
       <a href="/index.html">←</a>
       <h1>${escapeHtml(title)}</h1>
       <span class="who" data-who></span>
     </header>`
  );
}
