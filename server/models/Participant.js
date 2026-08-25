// Simple in-memory store (ในกรณีจริงจะใช้ database)
let participants = [];
let nextId = 1;

class Participant {
  constructor(name, email) {
    this.id = nextId++;
    this.name = name;
    this.email = email;
    this.type = null;
    this.scores = {};
    this.createdAt = new Date();
  }

  setTestResults(scores) {
    this.scores = scores;
    // คำนวณประเภท Enneagram จากคะแนนสูงสุด
    const maxScore = Math.max(...Object.values(scores));
    for (let i = 1; i <= 9; i++) {
      if (scores[i] === maxScore) {
        this.type = i;
        break;
      }
    }
  }

  toJSON() {
    return {
      id: this.id,
      name: this.name,
      email: this.email,
      type: this.type,
      scores: this.scores,
      createdAt: this.createdAt
    };
  }
}

const participantStore = {
  create(name, email) {
    const participant = new Participant(name, email);
    participants.push(participant);
    return participant;
  },

  findById(id) {
    return participants.find(p => p.id === id);
  },

  findByEmail(email) {
    return participants.find(p => p.email === email);
  },

  getAll() {
    return participants;
  },

  update(id, data) {
    const participant = this.findById(id);
    if (participant) {
      if (data.name) participant.name = data.name;
      if (data.email) participant.email = data.email;
      if (data.scores) participant.setTestResults(data.scores);
    }
    return participant;
  },

  getByType(type) {
    return participants.filter(p => p.type === type);
  },

  getGroupedByType() {
    const grouped = {};
    for (let i = 1; i <= 9; i++) {
      grouped[i] = participants.filter(p => p.type === i);
    }
    return grouped;
  },

  getPairingForLearning() {
    // จับคู่คนที่มี Enneagram ต่างกันเพื่อสร้างความเข้าใจ
    const paired = [];
    const availableIndices = participants.map((_, i) => i);

    while (availableIndices.length >= 2) {
      const idx1 = availableIndices.shift();
      let bestIdx = null;
      let maxTypeDiff = 0;

      // หา partner ที่มี type ต่างกันมากที่สุด
      for (let i = 0; i < availableIndices.length; i++) {
        const idx2 = availableIndices[i];
        const typeDiff = Math.abs(participants[idx1].type - participants[idx2].type);
        if (typeDiff > maxTypeDiff) {
          maxTypeDiff = typeDiff;
          bestIdx = i;
        }
      }

      if (bestIdx !== null) {
        const idx2 = availableIndices[bestIdx];
        paired.push({
          person1: participants[idx1].toJSON(),
          person2: participants[idx2].toJSON(),
          typeDifference: maxTypeDiff
        });
        availableIndices.splice(bestIdx, 1);
      }
    }

    // ถ้ามีคนที่เหลือ (จำนวนคนเป็นเลขคี่)
    if (availableIndices.length > 0) {
      paired.push({
        person1: participants[availableIndices[0]].toJSON(),
        person2: null,
        typeDifference: 0
      });
    }

    return paired;
  },

  delete(id) {
    participants = participants.filter(p => p.id !== id);
    return true;
  },

  clear() {
    participants = [];
    nextId = 1;
  }
};

module.exports = { Participant, participantStore };
