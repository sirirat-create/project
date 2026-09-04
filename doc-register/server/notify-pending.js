// สรุปเอกสารค้างส่งเข้า Slack — ตั้ง cron ให้รันวันละครั้ง เช่น
//   0 9 * * 1-5  cd /path/to/doc-register && npm run notify
import { db } from './db.js';
import { notifySlack } from './lib/slack.js';
import { STATUS_LABEL, STATUS_ORDER, formatThaiDateTime } from './lib/labels.js';

const STALE_HOURS = Number(process.env.STALE_HOURS) || 24;

const pending = db
  .prepare(
    `SELECT reg_no, status, vendor, updated_at FROM documents
      WHERE status != 'ACCEPTED' ORDER BY updated_at`
  )
  .all();

if (pending.length === 0) {
  console.log('ไม่มีเอกสารค้าง — ไม่ต้องแจ้งเตือน');
  process.exit(0);
}

const cutoff = new Date(Date.now() - STALE_HOURS * 3600e3).toISOString();
const stale = pending.filter((d) => d.updated_at < cutoff);

const lines = STATUS_ORDER.filter((s) => s !== 'ACCEPTED')
  .map((status) => {
    const count = pending.filter((d) => d.status === status).length;
    return count > 0 ? `• ${STATUS_LABEL[status]}: ${count} ฉบับ` : null;
  })
  .filter(Boolean);

let text = `📋 สรุปเอกสารค้าง ${pending.length} ฉบับ\n${lines.join('\n')}`;
if (stale.length > 0) {
  text +=
    `\n\n⏰ ค้างเกิน ${STALE_HOURS} ชม. ${stale.length} ฉบับ:\n` +
    stale
      .slice(0, 10)
      .map((d) => `• ${d.reg_no} ${d.vendor || '-'} — ${STATUS_LABEL[d.status]} ตั้งแต่ ${formatThaiDateTime(d.updated_at)}`)
      .join('\n');
}

await notifySlack(text);
console.log(text);
