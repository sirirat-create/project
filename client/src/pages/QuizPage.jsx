import React, { useState, useEffect } from 'react';
import axios from 'axios';

const API_BASE = process.env.REACT_APP_API_BASE || 'http://localhost:5000/api';

function QuizPage() {
  const [quizzes, setQuizzes] = useState([]);
  const [selectedQuiz, setSelectedQuiz] = useState(null);
  const [answers, setAnswers] = useState([]);
  const [score, setScore] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    fetchQuizzes();
  }, []);

  const fetchQuizzes = async () => {
    try {
      const response = await axios.get(`${API_BASE}/quiz`);
      setQuizzes(response.data);
      setLoading(false);
    } catch (err) {
      setError('ไม่สามารถโหลดข้อมูล Quiz');
      setLoading(false);
    }
  };

  const startQuiz = (quiz) => {
    setSelectedQuiz(quiz);
    setAnswers(new Array(quiz.questions.length).fill(null));
    setScore(null);
  };

  const handleAnswer = (qIdx, optIdx) => {
    const newAnswers = [...answers];
    newAnswers[qIdx] = optIdx;
    setAnswers(newAnswers);
  };

  const submitQuiz = () => {
    if (answers.includes(null)) {
      setError('กรุณาตอบคำถามให้ครบทั้งหมด');
      return;
    }

    let correctCount = 0;
    selectedQuiz.questions.forEach((question, idx) => {
      if (answers[idx] === question.correct) {
        correctCount++;
      }
    });

    const scorePercentage = Math.round(
      (correctCount / selectedQuiz.questions.length) * 100
    );
    setScore({
      correct: correctCount,
      total: selectedQuiz.questions.length,
      percentage: scorePercentage
    });
  };

  if (loading) {
    return <div className="container"><p>กำลังโหลด...</p></div>;
  }

  if (error && !selectedQuiz) {
    return <div className="container"><p className="error-message">{error}</p></div>;
  }

  return (
    <div className="container">
      <div className="quiz-container">
        {!selectedQuiz ? (
          <>
            <h1>เล่น Quiz</h1>
            <p className="subtitle">ทดสอบความรู้ของคุณเกี่ยวกับ Enneagram</p>

            <div className="quizzes-list">
              {quizzes.map(quiz => (
                <div key={quiz.id} className="quiz-card">
                  <h3>{quiz.title}</h3>
                  <p>{quiz.description}</p>
                  <p className="question-count">
                    จำนวนคำถาม: {quiz.questions.length}
                  </p>
                  <button
                    className="btn btn-primary"
                    onClick={() => startQuiz(quiz)}
                  >
                    เริ่ม Quiz นี้
                  </button>
                </div>
              ))}
            </div>
          </>
        ) : !score ? (
          <>
            <div className="quiz-header">
              <h1>{selectedQuiz.title}</h1>
              <button
                className="btn btn-secondary"
                onClick={() => {
                  setSelectedQuiz(null);
                  setScore(null);
                }}>
                ย้อนกลับ
              </button>
            </div>

            <div className="quiz-content">
              <div className="progress">
                <div
                  className="progress-bar"
                  style={{
                    width: `${(answers.filter(a => a !== null).length / selectedQuiz.questions.length) * 100}%`
                  }}
                ></div>
              </div>

              {selectedQuiz.questions.map((question, qIdx) => (
                <div key={question.id} className="quiz-question">
                  <h3>
                    {qIdx + 1}. {question.question}
                  </h3>
                  <div className="quiz-options">
                    {question.options.map((option, optIdx) => (
                      <label key={optIdx} className="quiz-option">
                        <input
                          type="radio"
                          name={`quiz-${qIdx}`}
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
                className="btn btn-primary"
                onClick={submitQuiz}
                disabled={answers.includes(null)}
              >
                ส่งคำตอบ
              </button>
            </div>
          </>
        ) : (
          <>
            <div className="quiz-result">
              <h1>ผลการทำ Quiz</h1>

              <div className="score-display">
                <div className="score-circle">
                  <div className="score-percentage">{score.percentage}%</div>
                  <p>คะแนนของคุณ</p>
                </div>
              </div>

              <div className="score-details">
                <p>
                  คุณตอบถูก <strong>{score.correct}</strong> จาก{' '}
                  <strong>{score.total}</strong> คำถาม
                </p>

                {score.percentage >= 80 && (
                  <div className="congratulation">
                    🎉 ยินดีด้วย! คุณรู้เรื่อง Enneagram ดีมากเลย
                  </div>
                )}
                {score.percentage >= 60 && score.percentage < 80 && (
                  <div className="congratulation">
                    👍 ดีครับ! คุณมีความรู้ Enneagram ที่เป็นมาตรฐาน
                  </div>
                )}
                {score.percentage < 60 && (
                  <div className="congratulation">
                    💪 จงพยายามต่อไป! ศึกษา Enneagram เพิ่มเติมจากกิจกรรมนี้
                  </div>
                )}

                <div className="answer-review">
                  <h3>รายละเอียดคำตอบ:</h3>
                  {selectedQuiz.questions.map((question, qIdx) => (
                    <div
                      key={question.id}
                      className={`answer-item ${
                        answers[qIdx] === question.correct
                          ? 'correct'
                          : 'incorrect'
                      }`}>
                      <h4>{question.question}</h4>
                      <p>
                        คำตอบของคุณ:{' '}
                        <strong>{question.options[answers[qIdx]]}</strong>
                      </p>
                      {answers[qIdx] !== question.correct && (
                        <p>
                          คำตอบที่ถูก:{' '}
                          <strong>{question.options[question.correct]}</strong>
                        </p>
                      )}
                      <span className={answers[qIdx] === question.correct ? 'badge correct' : 'badge incorrect'}>
                        {answers[qIdx] === question.correct ? 'ถูก' : 'ผิด'}
                      </span>
                    </div>
                  ))}
                </div>
              </div>

              <button
                className="btn btn-primary"
                onClick={() => {
                  setSelectedQuiz(null);
                  setScore(null);
                }}>
                เล่น Quiz อื่น
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

export default QuizPage;
