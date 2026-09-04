import crypto from 'node:crypto';
import { db, nowIso } from './db.js';

const SESSION_DAYS = 30;
const COOKIE = 'dr_token';

export function hashPin(pin, salt = crypto.randomBytes(16).toString('hex')) {
  const hash = crypto.scryptSync(String(pin), salt, 32).toString('hex');
  return `${salt}:${hash}`;
}

export function verifyPin(pin, stored) {
  const [salt, hash] = String(stored).split(':');
  if (!salt || !hash) return false;
  const candidate = crypto.scryptSync(String(pin), salt, 32).toString('hex');
  return crypto.timingSafeEqual(Buffer.from(candidate, 'hex'), Buffer.from(hash, 'hex'));
}

export function createSession(userId) {
  const token = crypto.randomBytes(24).toString('hex');
  const expires = new Date(Date.now() + SESSION_DAYS * 864e5).toISOString();
  db.prepare(
    'INSERT INTO sessions (token, user_id, created_at, expires_at) VALUES (?, ?, ?, ?)'
  ).run(token, userId, nowIso(), expires);
  return { token, expires };
}

export function destroySession(token) {
  db.prepare('DELETE FROM sessions WHERE token = ?').run(token);
}

function readCookie(req, name) {
  const raw = req.headers.cookie;
  if (!raw) return null;
  for (const part of raw.split(';')) {
    const [k, ...v] = part.trim().split('=');
    if (k === name) return decodeURIComponent(v.join('='));
  }
  return null;
}

export function setSessionCookie(res, token, expires) {
  res.setHeader(
    'Set-Cookie',
    `${COOKIE}=${token}; Path=/; HttpOnly; SameSite=Lax; Expires=${new Date(expires).toUTCString()}`
  );
}

export function clearSessionCookie(res) {
  res.setHeader('Set-Cookie', `${COOKIE}=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0`);
}

// แนบ req.user ถ้ามี session ที่ยังไม่หมดอายุ
export function attachUser(req, _res, next) {
  const token = readCookie(req, COOKIE);
  if (token) {
    const row = db
      .prepare(
        `SELECT u.id, u.name, u.role, s.token, s.expires_at
           FROM sessions s JOIN users u ON u.id = s.user_id
          WHERE s.token = ? AND u.active = 1`
      )
      .get(token);
    if (row) {
      if (row.expires_at > nowIso()) {
        req.user = { id: row.id, name: row.name, role: row.role, token: row.token };
      } else {
        destroySession(token);
      }
    }
  }
  next();
}

export function requireLogin(req, res, next) {
  if (!req.user) return res.status(401).json({ error: 'กรุณาเข้าสู่ระบบ' });
  next();
}

// ADMIN ทำได้ทุกอย่าง
export function requireRole(...roles) {
  return (req, res, next) => {
    if (!req.user) return res.status(401).json({ error: 'กรุณาเข้าสู่ระบบ' });
    if (req.user.role === 'ADMIN' || roles.includes(req.user.role)) return next();
    return res.status(403).json({ error: 'บทบาทของคุณไม่มีสิทธิ์ทำรายการนี้' });
  };
}
