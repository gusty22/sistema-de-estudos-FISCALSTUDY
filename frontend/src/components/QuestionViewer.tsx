import React, { useState, useEffect, useRef, useCallback } from 'react';
import './QuestionViewer.css';

interface Option {
  label?: string;
  text?: string;
}

interface Question {
  questionId: string;
  statement: string;
  options: string[] | Option[];
  metadata: {
    discipline: string;
    topic: string;
    board: string;
    year: number;
  };
}

interface SessionSummary {
  totalAnswered: number;
  correctCount: number;
  accuracy: number;
  averageTimeMs: number;
  overconfidenceCount: number;
}

const QuestionViewer: React.FC = () => {
  const [sessionStarted, setSessionStarted] = useState(() => sessionStorage.getItem('fiscalstudy_sessionStarted') === 'true');
  const [sessionEnded, setSessionEnded] = useState(false);
  const [summary, setSummary] = useState<SessionSummary | null>(null);
  const [question, setQuestion] = useState<Question | null>(null);
  const [loading, setLoading] = useState(false);
  const [selectedOption, setSelectedOption] = useState<string | null>(null);
  const [confidence, setConfidence] = useState<number>(0);
  const [feedback, setFeedback] = useState<{ isCorrect: boolean | null; gabaritoStatus?: string } | null>(null);
  
  const [disciplines, setDisciplines] = useState<string[]>([]);
  const [selectedDiscipline, setSelectedDiscipline] = useState<string>('');

  const [activeTimeMs, setActiveTimeMs] = useState<number>(0);
  const [lastFocusTime, setLastFocusTime] = useState<number>(0);
  
  // Create or retrieve session ID with persistence across page reloads
  const getInitialSessionId = () => {
    let stored = sessionStorage.getItem('fiscalstudy_sessionId');
    if (!stored) {
      stored = 'session-' + crypto.randomUUID();
      sessionStorage.setItem('fiscalstudy_sessionId', stored);
    }
    return stored;
  };
  const sessionId = useRef(getInitialSessionId()).current;

  const fetchNextQuestion = useCallback(async () => {
    setLoading(true);
    setFeedback(null);
    setSelectedOption(null);
    setConfidence(0);
    try {
      let url = `http://localhost:8080/api/v1/questions/next?sessionId=${sessionId}`;
      if (selectedDiscipline) {
        url += `&disciplina=${encodeURIComponent(selectedDiscipline)}`;
      }
      const response = await fetch(url);
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
        setQuestion(null);
      }
    } catch (error) {
      console.error("Failed to fetch question:", error);
    } finally {
      setLoading(false);
    }
  }, [sessionId, selectedDiscipline]);

  useEffect(() => {
    fetch('http://localhost:8080/api/v1/questions/disciplines')
      .then(res => res.ok ? res.json() : [])
      .then(data => setDisciplines(data))
      .catch(() => {});
  }, []);

  useEffect(() => {
    if (sessionStarted && !question && !sessionEnded) {
      const timer = setTimeout(() => {
        fetchNextQuestion();
      }, 0);
      return () => clearTimeout(timer);
    }
  }, [sessionStarted, question, sessionEnded, fetchNextQuestion]);

  const startSession = async () => {
    try {
      await fetch(`http://localhost:8080/api/v1/sessions/start`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sessionId })
      });
      sessionStorage.setItem('fiscalstudy_sessionStarted', 'true');
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
      
      const res = await fetch(`http://localhost:8080/api/v1/sessions/${sessionId}/summary`);
      if (res.ok) {
        setSummary(await res.json());
      }
      
      sessionStorage.removeItem('fiscalstudy_sessionStarted');
      sessionStorage.removeItem('fiscalstudy_sessionId');
      setSessionEnded(true);
    } catch (err) {
      console.error("Failed to end session", err);
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
        <div className="glass empty-state" style={{ maxWidth: '480px', width: '100%' }}>
          <h2>Pronto para começar?</h2>
          <p style={{ color: '#94a3b8', marginTop: '8px' }}>Selecione uma disciplina ou faça um simulado geral:</p>
          <div style={{ marginTop: '16px', marginBottom: '20px' }}>
            <select
              value={selectedDiscipline}
              onChange={(e) => setSelectedDiscipline(e.target.value)}
              style={{
                width: '100%',
                padding: '10px 14px',
                borderRadius: '8px',
                background: 'rgba(255, 255, 255, 0.08)',
                color: '#fff',
                border: '1px solid rgba(255, 255, 255, 0.2)',
                fontSize: '1em',
                outline: 'none'
              }}
            >
              <option value="" style={{ background: '#1e293b', color: '#fff' }}>Todas as Disciplinas (Geral)</option>
              {disciplines.map((d) => (
                <option key={d} value={d} style={{ background: '#1e293b', color: '#fff' }}>{d}</option>
              ))}
            </select>
          </div>
          <button className="btn" onClick={startSession}>Iniciar Estudo</button>
        </div>
      </div>
    );
  }

  if (sessionEnded) {
    return (
      <div className="viewer-container empty">
        <div className="glass empty-state" style={{maxWidth: '500px', width: '100%'}}>
          <h2 style={{borderBottom: '1px solid rgba(255,255,255,0.1)', paddingBottom: '15px', marginBottom: '20px'}}>Sessão Finalizada</h2>
          {summary ? (
             <div style={{textAlign: 'left', fontSize: '1.1em'}}>
               <p style={{display: 'flex', justifyContent: 'space-between'}}><span>Questões Respondidas:</span> <strong>{summary.totalAnswered}</strong></p>
               <p style={{display: 'flex', justifyContent: 'space-between'}}><span>Acertos:</span> <strong>{summary.correctCount} ({summary.accuracy.toFixed(1)}%)</strong></p>
               <p style={{display: 'flex', justifyContent: 'space-between'}}><span>Tempo Médio por Questão:</span> <strong>{(summary.averageTimeMs / 1000).toFixed(1)}s</strong></p>
               {summary.overconfidenceCount > 0 && (
                 <div style={{marginTop: '25px', padding: '15px', background: 'rgba(255,50,50,0.15)', border: '1px solid rgba(255,50,50,0.5)', borderRadius: '8px'}}>
                   <h4 style={{color: '#ff6b6b', margin: '0 0 8px 0'}}>⚠️ Atenção</h4>
                   <p style={{margin: 0, fontSize: '0.9em', lineHeight: '1.4'}}>Você demonstrou falsa fluência (confiança máxima em respostas erradas) em <strong>{summary.overconfidenceCount}</strong> questões nesta sessão.</p>
                 </div>
               )}
             </div>
          ) : (
             <p>Carregando resumo...</p>
          )}
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
          <h2>Você concluiu todas as questões disponíveis{selectedDiscipline ? ` de ${selectedDiscipline}` : ''}!</h2>
          <button className="btn mt-4" onClick={fetchNextQuestion}>Tentar Novamente</button>
          <button className="btn mt-4" style={{marginLeft: '10px'}} onClick={endSession}>Encerrar Sessão</button>
        </div>
      </div>
    );
  }

  let optionsList: string[] = [];
  if (Array.isArray(question.options)) {
    if (typeof question.options[0] === 'string') {
      optionsList = [...(question.options as string[])];
    } else {
      optionsList = (question.options as Option[]).map((o: Option) => `${o.label}) ${o.text}`);
    }
    // Garante ordenação alfabética estrita das alternativas (A, B, C, D, E)
    optionsList.sort((a, b) => {
      const letterA = a.match(/^([A-E])\)?/i)?.[1]?.toUpperCase() || '';
      const letterB = b.match(/^([A-E])\)?/i)?.[1]?.toUpperCase() || '';
      return letterA.localeCompare(letterB);
    });
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
            const isUnverifiedGabarito = feedback?.gabaritoStatus === 'AUSENTE' || feedback?.gabaritoStatus === 'SOB_REVISAO';
            return (
              <div 
                key={idx} 
                className={`option-card ${isSelected ? 'selected' : ''} ${feedback && isSelected ? (isUnverifiedGabarito ? 'selected' : (feedback.isCorrect ? 'correct' : 'incorrect')) : ''} ${feedback ? 'disabled' : ''}`}
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
        <div 
          className={`feedback-bar glass animate-fade-in ${
            feedback.gabaritoStatus === 'ANULADA' ? 'feedback-correct' :
            (feedback.gabaritoStatus === 'AUSENTE' || feedback.gabaritoStatus === 'SOB_REVISAO') ? '' :
            (feedback.isCorrect ? 'feedback-correct' : 'feedback-error')
          }`}
          style={
            (feedback.gabaritoStatus === 'AUSENTE' || feedback.gabaritoStatus === 'SOB_REVISAO')
              ? { background: 'rgba(234, 179, 8, 0.15)', border: '1px solid rgba(234, 179, 8, 0.5)' }
              : undefined
          }
        >
          <div className="feedback-message">
            {feedback.gabaritoStatus === 'ANULADA' ? (
              <h3>✅ Questão Anulada pela Banca (ponto atribuído)</h3>
            ) : feedback.gabaritoStatus === 'AUSENTE' ? (
              <h3 style={{ color: '#facc15' }}>ℹ️ Resposta Registrada (Gabarito Ausente)</h3>
            ) : feedback.gabaritoStatus === 'SOB_REVISAO' ? (
              <h3 style={{ color: '#facc15' }}>⚠️ Resposta Registrada (Gabarito sob Revisão)</h3>
            ) : feedback.isCorrect ? (
              <h3>✅ Resposta Correta! {feedback.gabaritoStatus === 'RETIFICADO' ? '(Gabarito Retificado)' : ''}</h3>
            ) : (
              <h3>❌ Resposta Incorreta {feedback.gabaritoStatus === 'RETIFICADO' ? '(Gabarito Retificado)' : ''}</h3>
            )}
            <p>
              Confiança registrada: {confidence}/5
              {(feedback.gabaritoStatus === 'AUSENTE' || feedback.gabaritoStatus === 'SOB_REVISAO') && ' — Não impacta cálculo de acurácia.'}
            </p>
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
