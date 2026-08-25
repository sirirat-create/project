# Enneagram Activity - Implementation Guide

คู่มือการติดตั้งและใช้งานแอปพลิเคชัน Enneagram Activity สำหรับกิจกรรม Team Building

## 📋 Table of Contents

1. [ติดตั้งอย่างรวดเร็ว (Quick Start)](#quick-start)
2. [ระบบความต้องการ](#requirements)
3. [ขั้นตอนการติดตั้งรายละเอียด](#detailed-installation)
4. [ปฏิทินกิจกรรม](#activity-timeline)
5. [คำแนะนำการดำเหนิน](#operational-guide)
6. [Troubleshooting](#troubleshooting)

## Quick Start

### ขั้นตอนที่ 1: ติดตั้ง Dependencies

```bash
# ติดตั้ง backend + client dependencies
npm run install-all
```

### ขั้นตอนที่ 2: เริ่มต้น Server

ในอีกหนึ่ง terminal window:

```bash
npm run dev
# Server จะทำงานที่ http://localhost:5000
```

### ขั้นตอนที่ 3: เริ่มต้น Client

ในอีกหนึ่ง terminal window:

```bash
npm run client
# Frontend จะทำงานที่ http://localhost:3000
```

### ขั้นตอนที่ 4: เปิดแอปพลิเคชัน

เปิดเบราว์เซอร์ไปที่: `http://localhost:3000`

---

## Requirements

### System Requirements
- Node.js 14.0 หรือสูงกว่า
- npm 6.0 หรือสูงกว่า
- Modern web browser (Chrome, Firefox, Safari, Edge)

### Hardware
- Minimum 2GB RAM
- Internet connection สำหรับการพัฒนา
- 1GB free disk space

---

## Detailed Installation

### 1. Clone Repository

```bash
git clone https://github.com/sirirat-create/project.git
cd project
```

### 2. ติดตั้ง Backend Dependencies

```bash
npm install
```

### 3. ติดตั้ง Frontend Dependencies

```bash
cd client
npm install
cd ..
```

### 4. ตั้งค่า Environment Variables

สร้างไฟล์ `.env` ที่ root:

```
PORT=5000
NODE_ENV=development
```

### 5. เริ่มต้นแอปพลิเคชัน

**Terminal 1 - Backend:**
```bash
npm run dev
```

**Terminal 2 - Frontend:**
```bash
npm run client
```

---

## Activity Timeline

### เวลา: 2 ชั่วโมง | ผู้เข้าร่วม: 80 คน | สถานที่: ห้องประชุมใหญ่

### ⏰ การแบ่งเวลา (2:00 - 4:00 น.)

#### 13:00 - 13:05 (5 นาที) - Kick-off
- สวัสดีต้อนรับและอธิบายจุดประสงค์ของกิจกรรม
- แสดง Enneagram overview

#### 13:05 - 13:35 (30 นาที) - Enneagram Test
- แต่ละคน QR code หรือ link เข้าแอปพลิเคชัน
- ทำแบบทดสอบ 18 คำถาม
- ดูผลลัพธ์ของตัวเอง

#### 13:35 - 14:00 (25 นาที) - Group Discussion
- ผู้เข้าร่วมแต่ละประเภท นั่งลงเป็นกลุ่มตามผลลัพธ์
- แชร์ลักษณะเฉพาะและประสบการณ์ของกลุ่มตนเอง
- ผู้ประสานงาน: ใช้ Admin Dashboard เพื่อแสดงกลุ่มต่างๆ

#### 14:00 - 14:35 (35 นาที) - Learning Pair Activity
- จับคู่ตามการแสดง "Learning Pairing" ในแอปพลิเคชัน
- สัมภาษณ์กันเรื่อง:
  - วิธีคิดของแต่ละคน
  - สิ่งที่พึงพอใจในการทำงาน
  - วิธีการที่จะเข้าใจกันได้ดีขึ้น
- แต่ละคู่ (3-5 นาที) x 9 ประเภท = ~45 นาที

#### 14:35 - 14:50 (15 นาที) - Quiz Activity
- ให้ผู้เข้าร่วมเล่น Quiz เพื่อทดสอบความรู้
- คนที่ได้คะแนนสูงสุด อาจได้รางวัลเล็กน้อย

#### 14:50 - 15:00 (10 นาที) - Closing
- สรุปสิ่งที่เรียนรู้
- ชื่นชมความร่วมมือ
- ขอบคุณทุกคนที่เข้าร่วม

---

## Operational Guide

### ขั้นตอนก่อนกิจกรรม (1 วันก่อน)

#### 1. เตรียมข้อมูล Participants

สร้างไฟล์ CSV ที่มีรูปแบบ:

```
สมชาย ใจดี,somchai@company.com
สมหญิง ใจดี,somying@company.com
ทดสอบ คน,test@company.com
```

#### 2. นำเข้าข้อมูล

1. เข้าไปที่ `http://localhost:3000/admin`
2. ไปที่ส่วน "นำเข้าข้อมูลเป็นชุด"
3. คัดลอกข้อมูล CSV และแล้วคลิก "นำเข้าข้อมูล"

#### 3. ตรวจสอบการนำเข้า

- ดูตัวเลขผู้เข้าร่วมในแดชบอร์ด
- ตรวจสอบว่านำเข้า 80 คนแล้ว

### ขั้นตอนระหว่างกิจกรรม

#### 1. Kick-off (13:00)
```
ขึ้นเวทีตัน:
- ต้องการให้ทุกคนเข้าใจว่า Enneagram คืออะไร
- เพราะเหตุใดจึงมีประโยชน์สำหรับการทำงานเป็นทีม
- QR code / link ชี้ไปที่ http://localhost:3000
```

#### 2. Test Phase (13:05 - 13:35)
```
ตรวจสอบ:
- ทุกคนสามารถเข้าหน้าแอปพลิเคชันได้
- สามารถทำแบบทดสอบได้
- ดูผลลัพธ์ได้

Tips:
- ให้ 30 นาที เพื่อให้ทุกคนทำเสร็จ
- บอกให้ตอบตามความรู้สึกจริงๆ ไม่ต้องคิดว่า "คำตอบไหนถูก"
```

#### 3. Group Discussion (13:35 - 14:00)
```
การใช้ Admin Dashboard:
1. เข้าไป http://localhost:3000/admin
2. ดูการกระจายตัวของแต่ละประเภท
3. ขอให้ผู้เข้าร่วมแต่ละประเภท นั่งลงเป็นกลุ่ม
4. กลุ่มแต่ละกลุ่มแชร์ลักษณะของตนเอง

ตัวอย่างคำถาม:
- ลักษณะเฉพาะของกลุ่ม Type X มีอะไร?
- ความท้าทายหลักของกลุ่ม Type X คืออะไร?
- กลุ่มอื่นๆ จะเข้าใจกลุ่ม Type X ได้ดีขึ้นได้อย่างไร?
```

#### 4. Learning Pair Activity (14:00 - 14:35)
```
ขั้นตอน:
1. แสดง Pairing Page: http://localhost:3000/pairing
2. แต่ละคู่นั่งคุยกัน
3. ตั้งคำถาม:
   - คุณมีความแตกต่างอย่างไร?
   - วิธีไหนที่ทำให้เข้าใจกันได้ดี?
   - เรียนรู้อะไรจากกันและกัน?
4. หลังจากนั้น กลับมากลุ่มใหญ่แชร์ insights

เวลา: 3-5 นาที ต่อคู่
```

#### 5. Quiz Phase (14:35 - 14:50)
```
ขั้นตอน:
1. แนะนำ Quiz: http://localhost:3000/quiz
2. ให้ผู้เข้าร่วมเล่น
3. แสดงผลลัพธ์

ตัวเลือก:
- เล่นแบบ individual
- หรือเล่นแบบทีมถ้าต้องการ
```

#### 6. Closing (14:50 - 15:00)
```
สรุป:
- Enneagram เป็นเครื่องมือเพื่อเข้าใจตัวเองและผู้อื่น
- ไม่มีประเภทที่ดีหรือแย่
- แต่ละคนมี strength และ weakness ของตัวเอง
- ยอมรับความแตกต่างจะช่วยให้ทำงานเป็นทีมได้ดีขึ้น

ขอบคุณและเชิญชวนให้ติดตามการเรียนรู้ต่อไป
```

### Admin Controls During Activity

#### Monitoring
```
Admin Dashboard (/admin):
- ดูจำนวนคนที่ทำแบบทดสอบแล้ว
- ดูการกระจายตัวของแต่ละประเภท
- ตรวจสอบรายชื่อ participants
```

#### Troubleshooting
```
ถ้ามีคนทำแบบทดสอบผิด:
1. เข้าไป Admin Page
2. ลบผู้เข้าร่วมนั้นออก
3. ให้ทำแบบทดสอบใหม่
```

---

## Troubleshooting

### Server Issues

#### ❌ Port 5000 ถูกใช้งานแล้ว

```bash
# วิธีแก้: เปลี่ยน port
PORT=5001 npm run dev
# แล้วอัปเดต .env ในไฟล์ client/src/.env
```

#### ❌ Cannot GET /api/...

```
สาเหตุ: Server ไม่ได้ทำงาน
วิธีแก้: 
1. ตรวจสอบว่า npm run dev ทำงานในหน้าต่าง terminal ตัวแรก
2. ตรวจสอบพอร์ต 5000
```

### Client Issues

#### ❌ Blank Page แล้วไม่มี Error

```
สาเหตุ: Frontend ยังโหลดไม่เสร็จ หรือ network error
วิธีแก้:
1. เปิด DevTools (F12)
2. ดูว่า API calls ส่วน /api/* ส่งสัญญาณอะไร
3. ถ้า 404 แสดงว่า backend ไม่ทำงาน
4. ถ้า CORS error แล้วตรวจสอบ server/index.js บรรทัด cors()
```

#### ❌ Cannot read properties of undefined

```
สาเหตุ: Data ยังไม่โหลดแต่เรียกใช้งาน
วิธีแก้: โปรดรอให้ loading จบและดูบน DevTools ว่า error ที่บรรทัดไหน
```

### Data Issues

#### ❌ Participants ไม่แสดง

```
สาเหตุ: ยังไม่ได้นำเข้าข้อมูล
วิธีแก้:
1. ไปที่ Admin Page
2. นำเข้าข้อมูล CSV ใหม่
3. รีเฟรชหน้าแอปพลิเคชัน
```

#### ❌ คนบางคนไม่มีประเภท Enneagram

```
สาเหตุ: ยังไม่ได้ทำแบบทดสอบ
วิธีแก้: ให้คนนั้นกลับไปทำแบบทดสอบใหม่ หรือลบและนำเข้าใหม่
```

### Network Issues

#### ❌ Cannot connect to localhost:3000 หรือ :5000

```
สาเหตุ: Firewall หรือ process ไม่ได้ทำงาน
วิธีแก้:
1. ตรวจสอบว่าไม่มี error ในหน้า terminal
2. ลองเปิด http://127.0.0.1:5000/api/types ในเบราว์เซอร์
3. ถ้าไม่ได้ให้ลองรีสตาร์ท server และ client
```

---

## Performance Tips

### สำหรับ 80 Participants

1. **Memory Optimization**
   - ใช้ in-memory storage เพื่อความเร็ว
   - ไม่จำเป็นต้องใช้ database

2. **Network Optimization**
   - หากมี WiFi ร้อย ตรวจสอบความเสถียรก่อน
   - ให้ participants ทำแบบทดสอบพร้อมๆ อาจใช้ 2-3 นาที

3. **Browser Cache**
   - ให้ participants ใช้ incognito หรือ private mode ถ้ามี issue
   - ลบ cache ของเบราว์เซอร์หากมี issue

---

## Customization

### เปลี่ยนข้อมูล Enneagram

แก้ไข `server/data/enneagram.js`:

```javascript
const enneagramTypes = {
  1: {
    name: 'ชื่อ Type',
    thaiName: 'ชื่อไทย',
    description: 'คำอธิบาย',
    strengths: ['จุดแข็ง1', 'จุดแข็ง2'],
    weaknesses: ['จุดอ่อน1', 'จุดอ่อน2'],
    color: '#HEX_COLOR'
  },
  // ...
}
```

### เปลี่ยนคำถาม Test

แก้ไข `server/data/enneagram.js` - `testQuestions` array

### เปลี่ยน Port

```bash
PORT=3001 npm run dev  # Backend
# และ client/.env: REACT_APP_API_BASE=http://localhost:3001/api
```

---

## Support & Contacts

- **Technical Issues**: ตรวจสอบ section Troubleshooting
- **Data Issues**: ลบและนำเข้าข้อมูลใหม่จาก Admin Page
- **Activity Planning**: ดูส่วน Activity Timeline

---

## Checklist ก่อนกิจกรรม

- [ ] ติดตั้ง dependencies เสร็จ
- [ ] Backend server ทำงานได้
- [ ] Frontend สามารถเข้าถึงได้
- [ ] ทดสอบ test flow (ทำแบบทดสอบ)
- [ ] นำเข้า participant data 80 คน
- [ ] ตรวจสอบ Admin Dashboard
- [ ] ตรวจสอบ Group Page
- [ ] ตรวจสอบ Pairing Page
- [ ] ตรวจสอบ Quiz
- [ ] เตรียม QR code หรือ link สำหรับผู้เข้าร่วม
- [ ] ตรวจสอบ WiFi ในห้องประชุม
- [ ] เตรียมเอกสารอธิบาย Enneagram

---

**Last Updated**: 2024
**Version**: 1.0.0
