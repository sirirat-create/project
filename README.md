# Enneagram Activity - Team Building Application

แอปพลิเคชันสำหรับจัดการกิจกรรม Team Building ที่ใช้ Enneagram เป็นเครื่องมือในการเข้าใจบุคลิกภาพ และช่วยให้พนักงานเข้าใจกันมากขึ้น

## ✨ ฟีเจอร์หลัก

1. **Enneagram Test** - แบบทดสอบ 18 คำถาม เพื่อหาประเภท Enneagram ของแต่ละคน
2. **Group Management** - จัดกลุ่มตามประเภท Enneagram และแสดงรายละเอียดของแต่ละประเภท
3. **Learning Pairing** - จับคู่คนที่มี Enneagram ต่างกัน เพื่อให้เรียนรู้จากกันและกัน
4. **Quiz Game** - เล่น Quiz เพื่อทดสอบความรู้เกี่ยวกับ Enneagram
5. **Admin Dashboard** - จัดการข้อมูล participants และดูสถิติการกระจายตัว

## 🎯 วัตถุประสงค์

- ให้พนักงาน 80 คน รู้จักประเภท Enneagram ของตัวเอง
- ช่วยให้พนักงานเข้าใจวิธีคิดของผู้อื่น
- สร้างความเข้าใจและเห็นอกเห็นใจระหว่างสมาชิกทีม
- พัฒนาทักษะการสื่อสารและความร่วมมือ
- ใช้เวลาไม่เกิน 2 ชั่วโมง

## 🏗️ โครงสร้างโปรเจ็ค

```
/
├── server/                 # Backend (Node.js + Express)
│   ├── data/
│   │   └── enneagram.js   # Enneagram data & questions
│   ├── models/
│   │   └── Participant.js # Data model
│   └── index.js           # Main server
├── client/                 # Frontend (React)
│   ├── public/
│   │   └── index.html
│   ├── src/
│   │   ├── pages/         # Page components
│   │   ├── App.jsx
│   │   ├── App.css
│   │   └── index.js
│   └── package.json
└── package.json
```

## 🚀 วิธีการติดตั้ง

### ส่วนของ Backend

1. ติดตั้ง dependencies
```bash
npm install
```

2. เริ่มต้น server
```bash
npm run dev  # หรือ node server/index.js
```

Server จะทำงานที่ `http://localhost:5000`

### ส่วนของ Frontend

1. ไปที่ client directory
```bash
cd client
```

2. ติดตั้ง dependencies
```bash
npm install
```

3. เริ่มต้น development server
```bash
npm start
```

Frontend จะทำงานที่ `http://localhost:3000`

## 📋 API Endpoints

### Test Management
- `GET /api/test` - ดึงข้อมูลคำถาม Enneagram
- `POST /api/test/submit` - ส่งผลการทดสอบ

### Types
- `GET /api/types` - ดึงข้อมูล 9 ประเภท Enneagram
- `GET /api/types/:typeId` - ดึงข้อมูลประเภท เดียว

### Participants
- `GET /api/participants` - ดึงรายชื่อ participants ทั้งหมด
- `GET /api/participants/:id` - ดึงข้อมูล participant คนเดียว
- `POST /api/participants` - สร้าง participant ใหม่
- `POST /api/participants/batch` - นำเข้อมูลเป็นชุด
- `DELETE /api/participants/:id` - ลบ participant

### Groups
- `GET /api/groups/by-type` - จัดกลุ่มตามประเภท
- `GET /api/groups/pairing` - ดึงข้อมูลการจับคู่สำหรับการเรียนรู้

### Quiz
- `GET /api/quiz` - ดึงข้อมูล Quiz
- `POST /api/quiz/submit` - ส่งผลการทำ Quiz

### Statistics
- `GET /api/stats` - ดึงสถิติการกระจายตัว

## 💻 วิธีการใช้งาน

### ขั้นตอนที่ 1: นำเข้าข้อมูล Participants
1. เข้าไปที่ Admin Panel (/admin)
2. กรอกข้อมูลเป็นรูปแบบ: `ชื่อ, อีเมล` (หนึ่งคนต่อบรรทัด)
3. คลิกปุ่ม "นำเข้าข้อมูล"

### ขั้นตอนที่ 2: ทำแบบทดสอบ
1. เข้าไปที่หน้า "เริ่มทำแบบทดสอบ Enneagram"
2. กรอกชื่อและอีเมล
3. ตอบคำถามทั้ง 18 ข้อตามความรู้สึก
4. ส่งแบบทดสอบ
5. ดูผลลัพธ์ของคุณ

### ขั้นตอนที่ 3: ดูกลุ่มและการจับคู่
1. คลิก "ดูกลุ่มตามประเภท" เพื่อเห็นรายชื่อคนในแต่ละประเภท
2. คลิก "ดูการจับคู่สำหรับการเรียนรู้" เพื่อเห็นการจับคู่

### ขั้นตอนที่ 4: เล่น Quiz
1. เข้าไปที่ Quiz Page
2. เลือก Quiz ที่ต้องการเล่น
3. ตอบคำถามทั้งหมด
4. ดูคะแนนและรายละเอียดคำตอบ

## 📊 Enneagram Types

```
Type 1: The Reformer (ผู้ปฏิรูป)
Type 2: The Helper (ผู้ช่วยเหลือ)
Type 3: The Achiever (ผู้บรรลุเป้าหมาย)
Type 4: The Individualist (บุคคลที่เป็นตัวตน)
Type 5: The Investigator (ผู้ศึกษาค้นคว้า)
Type 6: The Loyalist (ผู้สัตย์ซื่อ)
Type 7: The Enthusiast (ผู้กระตือรือร้น)
Type 8: The Challenger (ผู้ท้าทายอำนาจ)
Type 9: The Peacemaker (ผู้ทำให้เกิดสันติภาพ)
```

## 🎨 Design

- **Color Palette**: สีต่างๆ สำหรับแต่ละประเภท Enneagram
- **Responsive**: ใช้งานได้ดีบนอุปกรณ์ต่างๆ
- **User-friendly**: ง่ายต่อการใช้งาน

## 🔧 Technologies

### Backend
- Node.js
- Express.js
- CORS
- dotenv

### Frontend
- React
- React Router DOM
- Axios
- CSS3

## 📝 Logging & CSV Import

สามารถนำเข้าข้อมูล participants จาก CSV โดยใช้รูปแบบ:

```
สมชาย ใจดี, somchai@example.com
สมหญิง ใจดี, somying@example.com
ทดสอบ คน, test@example.com
```

## 🎯 วัตถุประสงค์การเรียนรู้

หลังจากเข้าร่วมกิจกรรมนี้ พนักงานจะได้เรียนรู้:
- ทำความเข้าใจตัวตนของตัวเองมากขึ้น
- เข้าใจเพื่อนร่วมงานจากมุมมองที่แตกต่าง
- รู้วิธีการสื่อสารที่เหมาะสมกับแต่ละประเภท
- พัฒนาทักษะ soft skills เช่น การเห็นอกเห็นใจและการสื่อสาร

## 📞 Support

สำหรับปัญหาหรือข้อเสนอแนะ กรุณาติดต่อผู้ดูแลระบบ

## 📄 License

ISC
