import React, { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import axios from 'axios';

const API_BASE = process.env.REACT_APP_API_BASE || 'http://localhost:5000/api';

function ResultPage() {
  const { id } = useParams();
  const [participant, setParticipant] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    fetchResult();
  }, [id]);

  const fetchResult = async () => {
    try {
      const response = await axios.get(`${API_BASE}/participants/${id}`);
      setParticipant(response.data);
      setLoading(false);
    } catch (err) {
      setError('ไม่สามารถโหลดผลลัพธ์');
      setLoading(false);
    }
  };

  if (loading) {
    return <div className="container"><p>กำลังโหลด...</p></div>;
  }

  if (error || !participant) {
    return <div className="container"><p className="error-message">{error}</p></div>;
  }

  const type = participant.typeInfo;
  const colorMap = {
    1: '#EF4444', 2: '#F97316', 3: '#EAB308', 4: '#A855F7',
    5: '#06B6D4', 6: '#3B82F6', 7: '#22C55E', 8: '#DC2626', 9: '#8B5CF6'
  };

  return (
    <div className="container">
      <div className="result-container">
        <div className="result-header" style={{ borderColor: colorMap[participant.type] }}>
          <div className="type-badge" style={{ backgroundColor: colorMap[participant.type] }}>
            {participant.type}
          </div>
          <h1>{type.thaiName}</h1>
          <h2>{type.name}</h2>
        </div>

        <div className="result-content">
          <div className="result-section">
            <h3>รายละเอียด</h3>
            <p><strong>ชื่อ:</strong> {participant.name}</p>
            <p><strong>อีเมล:</strong> {participant.email}</p>
            <p><strong>ประเภท Enneagram:</strong> Type {participant.type}</p>
          </div>

          <div className="result-section">
            <h3>คำอธิบาย</h3>
            <p>{type.description}</p>
          </div>

          <div className="result-section">
            <h3>จุดแข็ง</h3>
            <ul className="strengths-list">
              {type.strengths.map((strength, idx) => (
                <li key={idx}>{strength}</li>
              ))}
            </ul>
          </div>

          <div className="result-section">
            <h3>จุดที่ต้องปรับปรุง</h3>
            <ul className="weaknesses-list">
              {type.weaknesses.map((weakness, idx) => (
                <li key={idx}>{weakness}</li>
              ))}
            </ul>
          </div>

          <div className="result-section">
            <h3>คะแนนแต่ละประเภท</h3>
            <div className="scores-bar">
              {[1, 2, 3, 4, 5, 6, 7, 8, 9].map(typeNum => (
                <div key={typeNum} className="score-item">
                  <label>{typeNum}</label>
                  <div className="bar-container">
                    <div
                      className="bar-fill"
                      style={{
                        width: `${Math.max(10, (participant.scores[typeNum] || 0) * 5)}%`,
                        backgroundColor: colorMap[typeNum]
                      }}
                    ></div>
                  </div>
                  <span>{participant.scores[typeNum] || 0}</span>
                </div>
              ))}
            </div>
          </div>

          <div className="result-section tips">
            <h3>💡 คำแนะนำสำหรับ Type {participant.type}</h3>
            <div className="tips-content">
              <p>
                ในกิจกรรมทีมนี้ คุณจะได้เรียนรู้จากคนที่มีประเภท Enneagram ต่างกับคุณ
                และจะได้ร่วมกิจกรรมเพื่อเข้าใจวิธีคิดและวิธีการทำงานของคนอื่น
              </p>
              <p>
                สิ่งที่สำคัญคือ ไม่มีประเภท Enneagram ไหนที่ดีกว่าหรือแย่กว่า
                แต่ละประเภทมีความแข็งแกร่งและความอ่อนแอของตัวเอง
                และการเข้าใจนี้จะช่วยให้เราทำงานเป็นทีมได้ดีขึ้น
              </p>
            </div>
          </div>
        </div>

        <div className="action-buttons">
          <a href="/groups" className="btn btn-secondary">ดูกลุ่มตามประเภท</a>
          <a href="/pairing" className="btn btn-secondary">ดูการจับคู่สำหรับการเรียนรู้</a>
          <a href="/quiz" className="btn btn-secondary">เล่น Quiz</a>
        </div>
      </div>
    </div>
  );
}

export default ResultPage;
