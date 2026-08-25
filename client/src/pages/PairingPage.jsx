import React, { useState, useEffect } from 'react';
import axios from 'axios';

const API_BASE = process.env.REACT_APP_API_BASE || 'http://localhost:5000/api';

function PairingPage() {
  const [pairs, setPairs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    fetchPairing();
  }, []);

  const fetchPairing = async () => {
    try {
      const response = await axios.get(`${API_BASE}/groups/pairing`);
      setPairs(response.data.pairs);
      setLoading(false);
    } catch (err) {
      setError('ไม่สามารถโหลดข้อมูลการจับคู่');
      setLoading(false);
    }
  };

  if (loading) {
    return <div className="container"><p>กำลังโหลด...</p></div>;
  }

  const colorMap = {
    1: '#EF4444', 2: '#F97316', 3: '#EAB308', 4: '#A855F7',
    5: '#06B6D4', 6: '#3B82F6', 7: '#22C55E', 8: '#DC2626', 9: '#8B5CF6'
  };

  return (
    <div className="container">
      <div className="pairing-container">
        <h1>การจับคู่สำหรับการเรียนรู้</h1>
        <p className="subtitle">
          เรียนรู้จากคนที่มี Enneagram ต่างกัน เพื่อเข้าใจวิธีคิดของผู้อื่น
        </p>

        {error && <div className="error-message">{error}</div>}

        <div className="pairs-list">
          {pairs.length === 0 ? (
            <p className="no-pairs">ยังไม่มีข้อมูลการจับคู่</p>
          ) : (
            pairs.map((pair, idx) => (
              <div key={idx} className="pair-card">
                <div className="pair-number">#{idx + 1}</div>

                <div className="pair-content">
                  <div className="person person1" style={{ borderColor: colorMap[pair.person1.type] }}>
                    <div className="type-badge" style={{ backgroundColor: colorMap[pair.person1.type] }}>
                      Type {pair.person1.type}
                    </div>
                    <h3>{pair.person1.name}</h3>
                    <p className="type-name">{pair.person1.typeInfo.thaiName}</p>
                    <p className="email">{pair.person1.email}</p>
                  </div>

                  {pair.person2 ? (
                    <>
                      <div className="vs-badge">vs</div>

                      <div className="person person2" style={{ borderColor: colorMap[pair.person2.type] }}>
                        <div className="type-badge" style={{ backgroundColor: colorMap[pair.person2.type] }}>
                          Type {pair.person2.type}
                        </div>
                        <h3>{pair.person2.name}</h3>
                        <p className="type-name">{pair.person2.typeInfo.thaiName}</p>
                        <p className="email">{pair.person2.email}</p>
                      </div>
                    </>
                  ) : (
                    <div className="person person-solo">
                      <p className="solo-text">ไม่มี Partner (จำนวนคนเป็นเลขคี่)</p>
                    </div>
                  )}
                </div>

                <div className="learning-prompt">
                  <strong>💡 หัวข้อการเรียนรู้:</strong>
                  <p>{pair.learningPrompt}</p>
                </div>

                {pair.person2 && (
                  <div className="learning-guide">
                    <p>
                      <strong>{pair.person1.typeInfo.thaiName}</strong> มีลักษณะเป็นคนที่
                      {pair.person1.typeInfo.strengths[0].toLowerCase()}
                      {' '} ขณะที่ <strong>{pair.person2.typeInfo.thaiName}</strong> มีลักษณะเป็นคนที่
                      {pair.person2.typeInfo.strengths[0].toLowerCase()}
                    </p>
                    <p>
                      คุณทั้งคู่สามารถเรียนรู้จากกันได้ โดยศึกษาและเข้าใจวิธีคิด วิธีรู้สึก
                      และวิธีการทำงานของคนอื่นให้ลึกซึ้งยิ่งขึ้น
                    </p>
                  </div>
                )}
              </div>
            ))
          )}
        </div>

        <div className="info-section">
          <h2>วิธีการเล่นกิจกรรม</h2>
          <ol>
            <li>นั่งเป็นคู่ตามการจับคู่ที่แสดง</li>
            <li>สัมภาษณ์กันเรื่องที่ต้องการเรียนรู้ (5-10 นาที)</li>
            <li>แชร์ความเห็นกับกลุ่มใหญ่ (3-5 นาที)</li>
            <li>ทำให้เป็นการดำเนินการ: ยอมรับความแตกต่างและใช้ประโยชน์จากมัน</li>
          </ol>
        </div>
      </div>
    </div>
  );
}

export default PairingPage;
