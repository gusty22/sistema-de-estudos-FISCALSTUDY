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
  const [sessionStarted, setSessionStarted] = useState(false);
  const [sessionEnded, setSessionEnded] = useState(false);
  const [question, setQuestion] = useState<Question | null>(null);
  const [loading, setLoading] = useState(false);
  const [selectedOption, setSelectedOption] = useState<string | null>(null);
  const [confidence, setConfidence] = useState<number>(0);
  const [feedback, setFeedback] = useState<{ isCorrect: boolean } | null>(null);
  
  const [activeTimeMs, setActiveTimeMs] = useState<number>(0);
  const [lastFocusTime, setLastFocusTime] = useState<number>(0);
  
  // Create a unique session ID
  const sessionId = useRef('session-' + crypto.randomUUID()).current;

  const startSession = async () => {
    try {
      await fetch(`http://localhost:8080/api/v1/sessions/start`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sessionId })
      });
      setSessionStarted(true);
      fetchNextQuestion();
    } catch (err) {
      console.error("Failed to start session", err);
    }
  };

  const endSession = async () => {
    try {
      await fetch(`http://localhost:8080/api/v1/sessions/end`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sessionId })
      });
      setSessionEnded(true);
    } catch (err) {
      console.error("Failed to end session", err);
    }
  };

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
        
        // Registrar a apresentação explicitamente (Alternativa D)
        await fetch(`http://localhost:8080/api/v1/questions/${data.questionId}/presented`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ sessionId })
        });

        // Iniciar cronômetro só após registrar apresentação com sucesso
        setActiveTimeMs(0);
        setLastFocusTime(Date.now());
      } else {
        console.error("No questions found");
        setQuestion(null);
      }
    } catch (error) {
      console.error("Failed to fetch question:", error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    const handleVisibilityChange = () => {
      if (!sessionStarted || sessionEnded) return;
      
      if (document.visibilityState === 'hidden') {
        if (lastFocusTime > 0) {
          setActiveTimeMs(prev => prev + (Date.now() - lastFocusTime));
        }
      } else {
        setLastFocusTime(Date.now());
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => document.removeEventListener('visibilitychange', handleVisibilityChange);
  }, [lastFocusTime, sessionStarted, sessionEnded]);

  const handleSubmit = async () => {
    if (!question || !selectedOption || confidence === 0) return;

    let finalActiveTime = activeTimeMs;
    if (document.visibilityState === 'visible' && lastFocusTime > 0) {
      finalActiveTime += (Date.now() - lastFocusTime);
    }
    
    // extrair apenas a letra se vier no formato 'A) ...'
    const optionLetter = selectedOption.match(/^([A-E])\)?/)?.[1] || selectedOption.charAt(0);

    try {
      const response = await fetch(`http://localhost:8080/api/v1/questions/${question.questionId}/attempts`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          selectedOption: optionLetter,
          confidenceLevel: confidence,
          activeTimeMs: finalActiveTime,
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

  if (!sessionStarted) {
    return (
      <div className="viewer-container empty">
        <div className="glass empty-state">
          <h2>Pronto para começar?</h2>
          <button className="btn mt-4" onClick={startSession}>Iniciar Estudo</button>
        </div>
      </div>
    );
  }

  if (sessionEnded) {
    return (
      <div className="viewer-container empty">
        <div className="glass empty-state">
          <h2>Sessão Finalizada. Obrigado!</h2>
        </div>
      </div>
    );
  }

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
          <button className="btn mt-4" style={{marginLeft: '10px'}} onClick={endSession}>Encerrar Sessão</button>
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
      <header className="viewer-header" style={{display: 'flex', justifyContent: 'space-between', alignItems: 'center'}}>
        <div className="metadata-tags">
          <span className="tag">{question.metadata.board}</span>
          <span className="tag">{question.metadata.discipline}</span>
          <span className="tag">{question.metadata.year}</span>
        </div>
        <button className="btn" style={{padding: '5px 15px', fontSize: '0.9em', background: 'transparent', border: '1px solid #fff', color: '#fff'}} onClick={endSession}>Encerrar Sessão</button>
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
