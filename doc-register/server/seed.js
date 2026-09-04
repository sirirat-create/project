// สร้างผู้ใช้ตั้งต้นสำหรับเริ่มใช้งาน — รันครั้งเดียวด้วย `npm run seed`
// ผู้ใช้ที่มีชื่อซ้ำอยู่แล้วจะถูกข้าม (รันซ้ำได้ปลอดภัย)
import { db } from './db.js';
import { hashPin } from './auth.js';

const SEED_USERS = [
  { name: 'คลังสินค้า', role: 'WAREHOUSE', pin: '1111' },
  { name: 'ป๊อป', role: 'GM', pin: '2222' },
  { name: 'บัญชี', role: 'ACCOUNTING', pin: '3333' },
  { name: 'แอดมิน', role: 'ADMIN', pin: '9999' },
];

const insert = db.prepare('INSERT INTO users (name, role, pin_hash) VALUES (?, ?, ?)');
const exists = db.prepare('SELECT 1 FROM users WHERE name = ?');

for (const user of SEED_USERS) {
  if (exists.get(user.name)) {
    console.log(`- ข้าม ${user.name} (มีอยู่แล้ว)`);
    continue;
  }
  insert.run(user.name, user.role, hashPin(user.pin));
  console.log(`+ สร้าง ${user.name} (${user.role}) PIN ${user.pin}`);
}

console.log('\n⚠️  PIN ตั้งต้นข้างบนเป็นค่าสำหรับทดลองใช้ — เปลี่ยนก่อนใช้งานจริง');
