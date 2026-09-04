import fs from 'node:fs';
import path from 'node:path';
import Anthropic from '@anthropic-ai/sdk';
import { UPLOAD_DIR } from '../db.js';

const MODEL = 'claude-opus-5';
const ALLOWED_MEDIA = new Set(['image/jpeg', 'image/png', 'image/gif', 'image/webp']);

const SYSTEM = `คุณคือผู้ช่วยงานสารบรรณของบริษัท หน้าที่คือดึงข้อมูลจากรูปถ่ายเอกสารที่บริษัทได้รับ

ตอบกลับเป็น JSON เพียงอย่างเดียว ไม่ต้องมีคำอธิบายหรือ markdown code fence โดยมีคีย์ต่อไปนี้:
{
  "doc_type": "ประเภทเอกสาร เลือกจาก: ใบกำกับภาษี | ใบเสร็จรับเงิน | ใบวางบิล | ใบส่งของ | ใบแจ้งหนี้ | สัญญา | หนังสือราชการ | อื่นๆ",
  "doc_number": "เลขที่เอกสารตามที่พิมพ์บนเอกสาร",
  "doc_date": "วันที่บนเอกสาร รูปแบบ YYYY-MM-DD (แปลง พ.ศ. เป็น ค.ศ. ให้เรียบร้อย)",
  "vendor": "ชื่อผู้ออกเอกสาร / บริษัทคู่ค้า",
  "subject": "เรื่อง หรือรายการสินค้า/บริการโดยย่อ",
  "amount": ยอดรวมสุทธิเป็นตัวเลข ไม่ใส่คอมมาหรือสัญลักษณ์สกุลเงิน,
  "confidence": "high | medium | low — ความมั่นใจโดยรวมจากความคมชัดของรูป"
}

กฎ: ถ้าอ่านค่าใดไม่ได้หรือไม่ปรากฏบนเอกสาร ให้ใส่ null ห้ามเดาหรือแต่งข้อมูลขึ้นมาเอง`;

export function ocrConfigured() {
  return Boolean(process.env.ANTHROPIC_API_KEY);
}

/**
 * อ่านข้อมูลจากรูปเอกสารเป็นข้อมูลตั้งต้นให้ผู้ลงทะเบียนตรวจทานก่อนบันทึก
 * @param {{filename: string, mime: string}[]} photos รูปของเอกสารฉบับนั้น
 * @returns {Promise<object>} ฟิลด์ที่อ่านได้ (ยังไม่บันทึกลงฐานข้อมูล)
 */
export async function extractFields(photos) {
  if (!ocrConfigured()) {
    const err = new Error('ยังไม่ได้ตั้งค่า ANTHROPIC_API_KEY จึงยังใช้การอ่านข้อมูลจากรูปไม่ได้');
    err.status = 400;
    throw err;
  }
  const usable = photos.filter((p) => ALLOWED_MEDIA.has(p.mime)).slice(0, 4);
  if (usable.length === 0) {
    const err = new Error('ไม่พบรูปที่อ่านได้ (รองรับ JPEG, PNG, GIF, WebP)');
    err.status = 400;
    throw err;
  }

  const client = new Anthropic();
  const content = usable.map((p) => ({
    type: 'image',
    source: {
      type: 'base64',
      media_type: p.mime,
      data: fs.readFileSync(path.join(UPLOAD_DIR, p.filename)).toString('base64'),
    },
  }));
  content.push({ type: 'text', text: 'ดึงข้อมูลจากเอกสารในรูปนี้ตามรูปแบบ JSON ที่กำหนด' });

  const response = await client.beta.messages.create({
    model: MODEL,
    max_tokens: 4000,
    system: SYSTEM,
    output_config: { effort: 'low' },
    betas: ['server-side-fallback-2026-07-01'],
    fallbacks: 'default',
    messages: [{ role: 'user', content }],
  });

  if (response.stop_reason === 'refusal') {
    const err = new Error('โมเดลปฏิเสธการอ่านรูปนี้ กรุณากรอกข้อมูลด้วยตนเอง');
    err.status = 422;
    throw err;
  }

  const text = response.content
    .filter((b) => b.type === 'text')
    .map((b) => b.text)
    .join('')
    .trim();

  return { ...parseJson(text), model: response.model };
}

// โมเดลถูกสั่งให้ตอบ JSON ล้วน แต่กันเผื่อมี code fence หรือข้อความหุ้มมาด้วย
function parseJson(text) {
  const stripped = text.replace(/^```(?:json)?\s*/i, '').replace(/```\s*$/, '').trim();
  try {
    return JSON.parse(stripped);
  } catch {
    const start = stripped.indexOf('{');
    const end = stripped.lastIndexOf('}');
    if (start !== -1 && end > start) {
      try {
        return JSON.parse(stripped.slice(start, end + 1));
      } catch { /* ตกไปที่ error ด้านล่าง */ }
    }
    const err = new Error('อ่านคำตอบจากโมเดลไม่สำเร็จ กรุณาลองอีกครั้งหรือกรอกข้อมูลด้วยตนเอง');
    err.status = 502;
    throw err;
  }
}
