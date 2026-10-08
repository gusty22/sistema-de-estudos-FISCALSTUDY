import React, { useState, useEffect, useRef } from 'react';
import './QuestionViewer.css';

interface Option {
  label?: string;
  text?: string;
}

interface Question {
  questionId: string;
  statement: string;
  options: any; // Can be array of string or objects
  metadata: {
    discipline: string;
    topic: string;
    board: string;
    year: number;
  };
}

const QuestionViewer: React.FC = () => {
  const [question, setQuestion] = useState<Question | null>(null);
  const [loading, setLoading] = useState(true);
  const [selectedOption, setSelectedOption] = useState<string | null>(null);
  const [confidence, setConfidence] = useState<number>(0);
  const [feedback, setFeedback] = useState<{ isCorrect: boolean } | null>(null);
  
  const [startTime, setStartTime] = useState<number>(0);
  const sessionId = useRef('session-' + Date.now()).current;

  const fetchNextQuestion = async () => {
    setLoading(true);
    setFeedback(null);
    setSelectedOption(null);
    setConfidence(0);
    try {
      const response = await fetch(`http://localhost:8080/api/v1/questions/next?sessionId=${sessionId}`);
      if (response.ok) {
        const data = await response.json();
        setQuestion(data);
        setStartTime(Date.now());
      } else {
        console.error("No questions found");
      }
    } catch (error) {
      console.error("Failed to fetch question:", error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchNextQuestion();
  }, []);

  const handleSubmit = async () => {
    if (!question || !selectedOption || confidence === 0) return;

    const activeTimeMs = Date.now() - startTime;
    
    // extrair apenas a letra se vier no formato 'A) ...'
    const optionLetter = selectedOption.match(/^([A-E])\)?/)?.[1] || selectedOption.charAt(0);

    try {
      const response = await fetch(`http://localhost:8080/api/v1/questions/${question.questionId}/attempts`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          selectedOption: optionLetter,
          confidenceLevel: confidence,
          activeTimeMs,
          sessionId
        })
      });

      if (response.ok) {
        const result = await response.json();
        setFeedback(result);
      }
    } catch (error) {
      console.error("Failed to submit attempt:", error);
    }
  };

  if (loading) {
    return (
      <div className="viewer-container loading">
        <div className="spinner"></div>
        <p>Buscando questão...</p>
      </div>
    );
  }

  if (!question) {
    return (
      <div className="viewer-container empty">
        <div className="glass empty-state">
          <h2>Você concluiu todas as questões disponíveis!</h2>
          <button className="btn mt-4" onClick={fetchNextQuestion}>Tentar Novamente</button>
        </div>
      </div>
    );
  }

  let optionsList: string[] = [];
  if (Array.isArray(question.options)) {
    if (typeof question.options[0] === 'string') {
      optionsList = question.options;
    } else {
      // Se for object
      optionsList = question.options.map(o => `${o.label}) ${o.text}`);
    }
  }

  return (
    <div className="viewer-container animate-fade-in">
      <header className="viewer-header">
        <div className="metadata-tags">
          <span className="tag">{question.metadata.board}</span>
          <span className="tag">{question.metadata.discipline}</span>
          <span className="tag">{question.metadata.year}</span>
        </div>
      </header>

      <main className="question-content glass">
        <div className="statement">
          {question.statement.split('\\n').map((line, i) => <p key={i}>{line}</p>)}
        </div>

        <div className="options">
          {optionsList.map((opt, idx) => {
            const isSelected = selectedOption === opt;
            const letter = opt.match(/^([A-E])\)?/)?.[1] || opt.charAt(0);
            return (
              <div 
                key={idx} 
                className={`option-card ${isSelected ? 'selected' : ''} ${feedback && isSelected ? (feedback.isCorrect ? 'correct' : 'incorrect') : ''} ${feedback ? 'disabled' : ''}`}
                onClick={() => !feedback && setSelectedOption(opt)}
              >
                <div className="option-marker">{letter}</div>
                <div className="option-text">{opt.replace(/^([A-E])\)?\s*/, '')}</div>
              </div>
            );
          })}
        </div>
      </main>

      {!feedback ? (
        <div className="interaction-bar glass animate-fade-in">
          <div className="confidence-section">
            <span>Nível de Confiança:</span>
            <div className="confidence-buttons">
              {[1, 2, 3, 4, 5].map(level => (
                <button 
                  key={level} 
                  className={`conf-btn ${confidence === level ? 'active' : ''}`}
                  onClick={() => setConfidence(level)}
                >
                  {level}
                </button>
              ))}
            </div>
          </div>
          <button 
            className="btn submit-btn" 
            disabled={!selectedOption || confidence === 0}
            onClick={handleSubmit}
          >
            Responder
          </button>
        </div>
      ) : (
        <div className={`feedback-bar glass animate-fade-in ${feedback.isCorrect ? 'feedback-correct' : 'feedback-error'}`}>
          <div className="feedback-message">
            {feedback.isCorrect ? (
              <h3>✅ Resposta Correta!</h3>
            ) : (
              <h3>❌ Resposta Incorreta</h3>
            )}
            <p>Confiança registrada: {confidence}/5</p>
          </div>
          <button className="btn" onClick={fetchNextQuestion}>
            Próxima Questão ➔
          </button>
        </div>
      )}
    </div>
  );
};

export default QuestionViewer;
