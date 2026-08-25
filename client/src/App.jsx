import React, { useState, useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route, Link } from 'react-router-dom';
import TestPage from './pages/TestPage';
import ResultPage from './pages/ResultPage';
import GroupPage from './pages/GroupPage';
import PairingPage from './pages/PairingPage';
import QuizPage from './pages/QuizPage';
import AdminPage from './pages/AdminPage';
import './App.css';

function App() {
  const [currentParticipant, setCurrentParticipant] = useState(null);

  return (
    <Router>
      <div className="App">
        <nav className="navbar">
          <div className="container">
            <Link to="/" className="logo">
              🧠 Enneagram Activity
            </Link>
            <div className="nav-links">
              {currentParticipant && (
                <span className="current-user">
                  {currentParticipant.name} ({currentParticipant.type})
                </span>
              )}
            </div>
          </div>
        </nav>

        <Routes>
          <Route path="/" element={<HomePage />} />
          <Route
            path="/test"
            element={<TestPage setCurrentParticipant={setCurrentParticipant} />}
          />
          <Route
            path="/result/:id"
            element={<ResultPage currentParticipant={currentParticipant} />}
          />
          <Route path="/groups" element={<GroupPage />} />
          <Route path="/pairing" element={<PairingPage />} />
          <Route path="/quiz" element={<QuizPage />} />
          <Route path="/admin" element={<AdminPage />} />
        </Routes>
      </div>
    </Router>
  );
}

function HomePage() {
  return (
    <div className="home-page">
      <div className="container">
        <div className="hero">
          <h1>ยินดีต้อนรับสู่กิจกรรม Enneagram Activity</h1>
          <p className="subtitle">เข้าใจตัวตนและผู้อื่นให้ลึกยิ่งขึ้น ผ่านระบบ Enneagram</p>

          <div className="action-buttons">
            <Link to="/test" className="btn btn-primary">
              เริ่มทำแบบทดสอบ Enneagram
            </Link>
            <Link to="/groups" className="btn btn-secondary">
              ดูกลุ่มตามประเภท
            </Link>
            <Link to="/pairing" className="btn btn-secondary">
              ดูการจับคู่สำหรับการเรียนรู้
            </Link>
            <Link to="/quiz" className="btn btn-secondary">
              เล่น Quiz
            </Link>
            <Link to="/admin" className="btn btn-secondary">
              Admin
            </Link>
          </div>
        </div>

        <div className="info-section">
          <h2>Enneagram คืออะไร?</h2>
          <p>
            Enneagram เป็นระบบการแบ่งประเภทบุคลิกภาพที่มี 9 ประเภท
            แต่ละประเภทมีลักษณะเฉพาะ วิธีคิด และวิธีทำงานที่แตกต่างกัน
          </p>
          <p>
            การเข้าใจประเภท Enneagram ของตัวเองและผู้อื่น
            จะช่วยให้เราเข้าใจกันมากขึ้น สื่อสารได้ดีขึ้น และทำงานเป็นทีมได้มีประสิทธิภาพมากขึ้น
          </p>
        </div>
      </div>
    </div>
  );
}

export default App;
