import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';

const API_BASE = process.env.REACT_APP_API_BASE || 'http://localhost:5000/api';

function TestPage({ setCurrentParticipant }) {
  const navigate = useNavigate();
  const [formData, setFormData] = useState({
    name: '',
    email: ''
  });
  const [questions, setQuestions] = useState([]);
  const [answers, setAnswers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [testStarted, setTestStarted] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    fetchQuestions();
  }, []);

  const fetchQuestions = async () => {
    try {
      const response = await axios.get(`${API_BASE}/test`);
      setQuestions(response.data.questions);
      setAnswers(new Array(response.data.questions.length).fill(null));
      setLoading(false);
    } catch (err) {
      setError('ไม่สามารถโหลดคำถาม');
      setLoading(false);
    }
  };

  const handleFormChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value
    }));
  };

  const handleStartTest = (e) => {
    e.preventDefault();
    if (!formData.name.trim() || !formData.email.trim()) {
      setError('กรุณากรอกชื่อและอีเมล');
      return;
    }
    setError('');
    setTestStarted(true);
  };

  const handleAnswer = (questionIndex, optionIndex) => {
    const newAnswers = [...answers];
    newAnswers[questionIndex] = optionIndex;
    setAnswers(newAnswers);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (answers.includes(null)) {
      setError('กรุณาตอบคำถามให้ครบทั้งหมด');
      return;
    }

    setSubmitting(true);
    try {
      const response = await axios.post(`${API_BASE}/test/submit`, {
        name: formData.name,
        email: formData.email,
        answers
      });

      setCurrentParticipant({
        id: response.data.participantId,
        name: formData.name,
        email: formData.email,
        type: response.data.type
      });

      navigate(`/result/${response.data.participantId}`);
    } catch (err) {
      setError(err.response?.data?.error || 'เกิดข้อผิดพลาดในการส่งแบบทดสอบ');
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return <div className="container"><p>กำลังโหลด...</p></div>;
  }

  if (!testStarted) {
    return (
      <div className="container">
        <div className="form-container">
          <h1>ทำแบบทดสอบ Enneagram</h1>
          <p className="subtitle">กรุณากรอกข้อมูลของคุณเพื่อเริ่มแบบทดสอบ</p>

          <form onSubmit={handleStartTest}>
            <div className="form-group">
              <label htmlFor="name">ชื่อ:</label>
              <input
                type="text"
                id="name"
                name="name"
                value={formData.name}
                onChange={handleFormChange}
                placeholder="กรุณากรอกชื่อของคุณ"
                required
              />
            </div>

            <div className="form-group">
              <label htmlFor="email">อีเมล:</label>
              <input
                type="email"
                id="email"
                name="email"
                value={formData.email}
                onChange={handleFormChange}
                placeholder="กรุณากรอกอีเมลของคุณ"
                required
              />
            </div>

            {error && <div className="error-message">{error}</div>}

            <button type="submit" className="btn btn-primary">
              เริ่มแบบทดสอบ
            </button>
          </form>
        </div>
      </div>
    );
  }

  return (
    <div className="container">
      <div className="test-container">
        <h1>แบบทดสอบ Enneagram</h1>
        <div className="progress-bar">
          <div
            className="progress-fill"
            style={{ width: `${((answers.filter(a => a !== null).length) / questions.length) * 100}%` }}
          ></div>
        </div>
        <p className="progress-text">
          ตอบแล้ว {answers.filter(a => a !== null).length} / {questions.length}
        </p>

        <form onSubmit={handleSubmit}>
          {questions.map((question, qIdx) => (
            <div key={question.id} className="question-card">
              <h3>
                {qIdx + 1}. {question.question}
              </h3>
              <div className="options">
                {question.options.map((option, optIdx) => (
                  <label key={optIdx} className="option-label">
                    <input
                      type="radio"
                      name={`question-${qIdx}`}
                      value={optIdx}
                      checked={answers[qIdx] === optIdx}
                      onChange={() => handleAnswer(qIdx, optIdx)}
                    />
                    <span>{option}</span>
                  </label>
                ))}
              </div>
            </div>
          ))}

          {error && <div className="error-message">{error}</div>}

          <button
            type="submit"
            className="btn btn-primary"
            disabled={submitting || answers.includes(null)}
          >
            {submitting ? 'กำลังส่ง...' : 'ส่งแบบทดสอบ'}
          </button>
        </form>
      </div>
    </div>
  );
}

export default TestPage;
