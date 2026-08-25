import React, { useState, useEffect } from 'react';
import axios from 'axios';

const API_BASE = process.env.REACT_APP_API_BASE || 'http://localhost:5000/api';

function AdminPage() {
  const [stats, setStats] = useState(null);
  const [participants, setParticipants] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [csvInput, setCsvInput] = useState('');
  const [importing, setImporting] = useState(false);

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      const [statsRes, participantsRes] = await Promise.all([
        axios.get(`${API_BASE}/stats`),
        axios.get(`${API_BASE}/participants`)
      ]);
      setStats(statsRes.data);
      setParticipants(participantsRes.data);
      setLoading(false);
    } catch (err) {
      setError('ไม่สามารถโหลดข้อมูล');
      setLoading(false);
    }
  };

  const handleBatchImport = async () => {
    if (!csvInput.trim()) {
      setError('กรุณากรอกข้อมูล');
      return;
    }

    setImporting(true);
    try {
      const lines = csvInput
        .split('\n')
        .filter(line => line.trim())
        .map(line => {
          const [name, email] = line.split(',').map(s => s.trim());
          return { name, email };
        });

      const response = await axios.post(`${API_BASE}/participants/batch`, {
        participants: lines
      });

      setError('');
      setCsvInput('');
      await fetchData();
      alert(`นำเข้า ${response.data.created} คนสำเร็จ`);
    } catch (err) {
      setError(err.response?.data?.error || 'เกิดข้อผิดพลาด');
    } finally {
      setImporting(false);
    }
  };

  const deleteParticipant = async (id) => {
    if (window.confirm('คุณแน่ใจหรือว่าต้องการลบผู้เข้าร่วมนี้?')) {
      try {
        await axios.delete(`${API_BASE}/participants/${id}`);
        await fetchData();
      } catch (err) {
        setError('ไม่สามารถลบผู้เข้าร่วม');
      }
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
      <div className="admin-container">
        <h1>Admin Panel</h1>
        <p className="subtitle">จัดการข้อมูล Participants</p>

        {error && <div className="error-message">{error}</div>}

        {/* Statistics */}
        {stats && (
          <div className="stats-section">
            <h2>สถิติ</h2>
            <div className="stats-grid">
              <div className="stat-card">
                <h3>จำนวนผู้เข้าร่วมทั้งหมด</h3>
                <p className="stat-value">{stats.totalParticipants}</p>
              </div>
            </div>

            <h3>การกระจายตัวตามประเภท</h3>
            <div className="distribution-chart">
              {Object.keys(stats.distribution)
                .sort((a, b) => a - b)
                .map(typeId => (
                  <div key={typeId} className="distribution-item">
                    <div className="type-label">Type {typeId}</div>
                    <div className="bar-container">
                      <div
                        className="bar"
                        style={{
                          width: `${(stats.distribution[typeId] / stats.totalParticipants) * 100}%`,
                          backgroundColor: colorMap[typeId]
                        }}
                      ></div>
                    </div>
                    <div className="count">{stats.distribution[typeId]}</div>
                  </div>
                ))}
            </div>
          </div>
        )}

        {/* Batch Import */}
        <div className="import-section">
          <h2>นำเข้าข้อมูลเป็นชุด</h2>
          <p className="info">
            รูปแบบ: ชื่อ, อีเมล (หนึ่งคนต่อบรรทัด)
          </p>
          <textarea
            className="csv-input"
            value={csvInput}
            onChange={(e) => setCsvInput(e.target.value)}
            placeholder="สมชาย ใจดี, somchai@example.com&#10;สมหญิง ใจดี, somying@example.com"
            rows="10"
          ></textarea>
          <button
            className="btn btn-primary"
            onClick={handleBatchImport}
            disabled={importing || !csvInput.trim()}>
            {importing ? 'กำลังนำเข้า...' : 'นำเข้าข้อมูล'}
          </button>
        </div>

        {/* Participants List */}
        <div className="participants-section">
          <h2>รายชื่อ Participants</h2>
          <table className="participants-table">
            <thead>
              <tr>
                <th>#</th>
                <th>ชื่อ</th>
                <th>อีเมล</th>
                <th>ประเภท</th>
                <th>การกระทำ</th>
              </tr>
            </thead>
            <tbody>
              {participants.map((p, idx) => (
                <tr key={p.id}>
                  <td>{idx + 1}</td>
                  <td>{p.name}</td>
                  <td>{p.email}</td>
                  <td>
                    {p.type ? (
                      <span
                        className="type-badge"
                        style={{ backgroundColor: colorMap[p.type] }}>
                        Type {p.type}
                      </span>
                    ) : (
                      <span className="no-type">ยังไม่ทดสอบ</span>
                    )}
                  </td>
                  <td>
                    <button
                      className="btn btn-danger"
                      onClick={() => deleteParticipant(p.id)}>
                      ลบ
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>

          {participants.length === 0 && (
            <p className="no-data">ยังไม่มี Participants</p>
          )}
        </div>
      </div>
    </div>
  );
}

export default AdminPage;
