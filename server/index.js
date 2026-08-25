const express = require('express');
const cors = require('cors');
const dotenv = require('dotenv');
const { enneagramTypes, testQuestions } = require('./data/enneagram');
const { participantStore } = require('./models/Participant');

dotenv.config();
const app = express();

// Middleware
app.use(cors());
app.use(express.json());

// Routes

// 1. ดึงข้อมูลคำถาม Enneagram Test
app.get('/api/test', (req, res) => {
  res.json({
    questions: testQuestions,
    totalQuestions: testQuestions.length
  });
});

// 2. บันทึกผลการทดสอบ
app.post('/api/test/submit', (req, res) => {
  try {
    const { name, email, answers } = req.body;

    if (!name || !email || !answers) {
      return res.status(400).json({ error: 'กรุณากรอกข้อมูลให้ครบถ้วน' });
    }

    // คำนวณคะแนนแต่ละประเภท
    const scores = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0, 6: 0, 7: 0, 8: 0, 9: 0 };

    // คำตอบแต่ละข้อจะให้คะแนนตามค่า (0-4)
    testQuestions.forEach((question, index) => {
      const answerIndex = answers[index];
      if (answerIndex !== undefined && answerIndex >= 0 && answerIndex < 5) {
        const typeScore = question.scores[0]; // ประเภท Enneagram
        const points = answerIndex; // 0 = ไม่เห็นด้วยเลย, 4 = เห็นด้วยมากเลย
        scores[typeScore] += points;
      }
    });

    // สร้าง/อัปเดต participant
    let participant = participantStore.findByEmail(email);
    if (!participant) {
      participant = participantStore.create(name, email);
    } else {
      participant = participantStore.update(participant.id, { name, email, scores });
    }
    participant.setTestResults(scores);

    res.json({
      success: true,
      participantId: participant.id,
      type: participant.type,
      scores: scores,
      typeInfo: enneagramTypes[participant.type]
    });
  } catch (error) {
    console.error('Error:', error);
    res.status(500).json({ error: 'เกิดข้อผิดพลาด' });
  }
});

// 3. ดึงข้อมูล Enneagram Type
app.get('/api/types', (req, res) => {
  res.json(enneagramTypes);
});

// 4. ดึงข้อมูล Type เดียว
app.get('/api/types/:typeId', (req, res) => {
  const type = enneagramTypes[parseInt(req.params.typeId)];
  if (type) {
    res.json(type);
  } else {
    res.status(404).json({ error: 'ไม่พบประเภท' });
  }
});

// 5. ดึงข้อมูล Participant
app.get('/api/participants/:id', (req, res) => {
  const participant = participantStore.findById(parseInt(req.params.id));
  if (participant) {
    res.json({
      ...participant.toJSON(),
      typeInfo: enneagramTypes[participant.type]
    });
  } else {
    res.status(404).json({ error: 'ไม่พบผู้เข้าร่วม' });
  }
});

// 6. ดึงรายชื่อ Participants ทั้งหมด
app.get('/api/participants', (req, res) => {
  const all = participantStore.getAll().map(p => ({
    ...p.toJSON(),
    typeInfo: enneagramTypes[p.type]
  }));
  res.json(all);
});

// 7. จัดกลุ่มตามประเภท Enneagram
app.get('/api/groups/by-type', (req, res) => {
  const grouped = participantStore.getGroupedByType();
  const result = {};

  for (let i = 1; i <= 9; i++) {
    result[i] = {
      type: i,
      typeInfo: enneagramTypes[i],
      members: grouped[i].map(p => p.toJSON()),
      count: grouped[i].length
    };
  }

  res.json(result);
});

// 8. จับคู่คนสำหรับกิจกรรม Learning
app.get('/api/groups/pairing', (req, res) => {
  const pairs = participantStore.getPairingForLearning();
  res.json({
    pairs: pairs.map(pair => ({
      person1: {
        ...pair.person1,
        typeInfo: enneagramTypes[pair.person1.type]
      },
      person2: pair.person2 ? {
        ...pair.person2,
        typeInfo: enneagramTypes[pair.person2.type]
      } : null,
      typeDifference: pair.typeDifference,
      learningPrompt: pair.person2 ?
        `${pair.person1.name} (${enneagramTypes[pair.person1.type].thaiName}) และ ${pair.person2.name} (${enneagramTypes[pair.person2.type].thaiName}) คุณจะสามารถเข้าใจกันได้ดีขึ้นได้อย่างไร?`
        : `${pair.person1.name} ขอแบ่งปันความรู้ของคุณกับกลุ่มอื่น`
    })),
    totalPairs: pairs.length
  });
});

// 9. Quiz/Game API
app.get('/api/quiz', (req, res) => {
  const quizzes = [
    {
      id: 1,
      title: 'รู้จักประเภท Enneagram',
      description: 'ตอบคำถามเกี่ยวกับลักษณะของแต่ละประเภท',
      questions: [
        {
          id: 1,
          question: 'ประเภท Enneagram ไหนที่อยากให้ทุกอย่างถูกต้อง?',
          options: ['Type 1', 'Type 2', 'Type 3', 'Type 4'],
          correct: 0
        },
        {
          id: 2,
          question: 'ประเภท Enneagram ไหนที่เห็นอกเห็นใจ?',
          options: ['Type 1', 'Type 2', 'Type 3', 'Type 4'],
          correct: 1
        },
        {
          id: 3,
          question: 'ประเภท Enneagram ไหนที่มีเป้าหมายสูง?',
          options: ['Type 1', 'Type 2', 'Type 3', 'Type 4'],
          correct: 2
        }
      ]
    }
  ];
  res.json(quizzes);
});

// 10. บันทึกผลการทำ Quiz
app.post('/api/quiz/submit', (req, res) => {
  const { participantId, quizId, score } = req.body;
  res.json({
    success: true,
    message: 'บันทึกผลการทำ Quiz สำเร็จ',
    participantId,
    quizId,
    score
  });
});

// 11. สร้าง/ลบ Participant (สำหรับการจัดการ)
app.post('/api/participants', (req, res) => {
  const { name, email } = req.body;
  if (!name || !email) {
    return res.status(400).json({ error: 'กรุณากรอกชื่อและอีเมล' });
  }
  const participant = participantStore.create(name, email);
  res.json(participant.toJSON());
});

app.delete('/api/participants/:id', (req, res) => {
  participantStore.delete(parseInt(req.params.id));
  res.json({ success: true, message: 'ลบผู้เข้าร่วมสำเร็จ' });
});

// 12. สถิติ
app.get('/api/stats', (req, res) => {
  const all = participantStore.getAll();
  const grouped = participantStore.getGroupedByType();
  const distribution = {};

  for (let i = 1; i <= 9; i++) {
    distribution[i] = grouped[i].length;
  }

  res.json({
    totalParticipants: all.length,
    distribution,
    typeInfo: enneagramTypes
  });
});

// 13. Batch import participants
app.post('/api/participants/batch', (req, res) => {
  const { participants: newParticipants } = req.body;

  if (!Array.isArray(newParticipants)) {
    return res.status(400).json({ error: 'กรุณาให้ array ของ participants' });
  }

  const created = [];
  newParticipants.forEach(({ name, email }) => {
    if (name && email) {
      const participant = participantStore.create(name, email);
      created.push(participant.toJSON());
    }
  });

  res.json({
    success: true,
    created: created.length,
    participants: created
  });
});

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  console.log(`🚀 Server running on port ${PORT}`);
});
