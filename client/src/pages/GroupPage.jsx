import React, { useState, useEffect } from 'react';
import axios from 'axios';

const API_BASE = process.env.REACT_APP_API_BASE || 'http://localhost:5000/api';

function GroupPage() {
  const [groups, setGroups] = useState({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [expandedType, setExpandedType] = useState(null);

  useEffect(() => {
    fetchGroups();
  }, []);

  const fetchGroups = async () => {
    try {
      const response = await axios.get(`${API_BASE}/groups/by-type`);
      setGroups(response.data);
      setLoading(false);
    } catch (err) {
      setError('ไม่สามารถโหลดข้อมูลกลุ่ม');
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
      <div className="groups-container">
        <h1>กลุ่มตามประเภท Enneagram</h1>
        <p className="subtitle">ดูรายชื่อคนในแต่ละประเภท</p>

        {error && <div className="error-message">{error}</div>}

        <div className="groups-grid">
          {Object.keys(groups).map(typeId => {
            const group = groups[typeId];
            const isExpanded = expandedType === parseInt(typeId);

            return (
              <div
                key={typeId}
                className="group-card"
                style={{ borderColor: colorMap[typeId] }}
              >
                <div
                  className="group-header"
                  onClick={() => setExpandedType(isExpanded ? null : parseInt(typeId))}
                  style={{ cursor: 'pointer', backgroundColor: colorMap[typeId] }}
                >
                  <div className="type-info">
                    <h2>Type {typeId}</h2>
                    <h3>{group.typeInfo.thaiName}</h3>
                  </div>
                  <div className="count-badge">
                    {group.count} คน
                  </div>
                </div>

                {isExpanded && (
                  <div className="group-content">
                    <p className="description">{group.typeInfo.description}</p>

                    <div className="members">
                      <h4>สมาชิกในกลุ่ม:</h4>
                      {group.members.length > 0 ? (
                        <ul className="members-list">
                          {group.members.map(member => (
                            <li key={member.id}>
                              <strong>{member.name}</strong>
                              <span className="email">{member.email}</span>
                            </li>
                          ))}
                        </ul>
                      ) : (
                        <p className="no-members">ยังไม่มีสมาชิกในกลุ่มนี้</p>
                      )}
                    </div>

                    <div className="characteristics">
                      <div className="strengths">
                        <h4>จุดแข็ง:</h4>
                        <ul>
                          {group.typeInfo.strengths.map((strength, idx) => (
                            <li key={idx}>{strength}</li>
                          ))}
                        </ul>
                      </div>
                      <div className="weaknesses">
                        <h4>จุดที่ต้องปรับปรุง:</h4>
                        <ul>
                          {group.typeInfo.weaknesses.map((weakness, idx) => (
                            <li key={idx}>{weakness}</li>
                          ))}
                        </ul>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

export default GroupPage;
