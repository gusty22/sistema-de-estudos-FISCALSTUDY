import React, { useState, useEffect, useRef } from 'react';
import './MetodoEraView.css';

interface EraSessionRecord {
  id: string;
  disciplina: string;
  topico: string;
  tempoExplorarSegundos: number;
  tempoEstudoSegundos: number;
  resumoAbstracao: string;
  questoesFeitas: number;
  questoesAcertadas: number;
  createdAt: string;
}

export const MetodoEraView: React.FC = () => {
  const [sessions, setSessions] = useState<EraSessionRecord[]>([]);
  const [disciplines, setDisciplines] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [isSessionActive, setIsSessionActive] = useState(false);

  // Wizard state
  const [currentStep, setCurrentStep] = useState<1 | 2 | 3 | 4>(1);
  const [selectedDiscipline, setSelectedDiscipline] = useState('');
  const [topico, setTopico] = useState('');

  // Step 1: Explorar
  const [explorarSecondsLeft, setExplorarSecondsLeft] = useState(120); // 2 minutos
  const [explorarTimerRunning, setExplorarTimerRunning] = useState(false);
  const [metaPaginas, setMetaPaginas] = useState(15);

  // Step 2: Estudar
  const [estudarSeconds, setEstudarSeconds] = useState(0);
  const [estudarRunning, setEstudarRunning] = useState(false);

  // Step 3: Revisar
  const [resumoAbstracao, setResumoAbstracao] = useState('');

  // Step 4: Avaliar
  const [questoesFeitas, setQuestoesFeitas] = useState(10);
  const [questoesAcertadas, setQuestoesAcertadas] = useState(8);

  const [feedbackMsg, setFeedbackMsg] = useState<string | null>(null);

  const timerRef = useRef<number | null>(null);

  const loadData = async () => {
    try {
      setLoading(true);
      const [resEra, resDisc] = await Promise.all([
        fetch('/api/v1/cognitive/metodo-era'),
        fetch('/api/v1/questions/disciplines')
      ]);
      if (resEra.ok) {
        setSessions(await resEra.json());
      }
      if (resDisc.ok) {
        const discs = await resDisc.json();
        setDisciplines(discs || []);
        if (discs.length > 0 && !selectedDiscipline) {
          setSelectedDiscipline(discs[0]);
        }
      }
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  // Timer loop para Explorar (countdown) e Estudar (countup)
  useEffect(() => {
    if (explorarTimerRunning) {
      timerRef.current = window.setInterval(() => {
        setExplorarSecondsLeft(prev => {
          if (prev <= 1) {
            setExplorarTimerRunning(false);
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
    } else if (estudarRunning) {
      timerRef.current = window.setInterval(() => {
        setEstudarSeconds(prev => prev + 1);
      }, 1000);
    } else if (timerRef.current) {
      clearInterval(timerRef.current);
    }

    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [explorarTimerRunning, estudarRunning]);

  const handleStartEra = () => {
    if (!topico.trim()) return;
    setIsSessionActive(true);
    setCurrentStep(1);
    setExplorarSecondsLeft(120);
    setExplorarTimerRunning(true);
    setEstudarSeconds(0);
    setEstudarRunning(false);
    setResumoAbstracao('');
  };

  const handleAdvanceToEstudo = () => {
    setExplorarTimerRunning(false);
    setCurrentStep(2);
    setEstudarRunning(true);
  };

  const handleAdvanceToRevisar = () => {
    setEstudarRunning(false);
    setCurrentStep(3);
  };

  const handleAdvanceToAvaliar = () => {
    setCurrentStep(4);
  };

  const handleSaveEraSession = async () => {
    try {
      const res = await fetch('/api/v1/cognitive/metodo-era', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          disciplina: selectedDiscipline || 'Geral',
          topico: topico.trim(),
          tempoExplorarSegundos: 120 - explorarSecondsLeft,
          tempoEstudoSegundos: estudarSeconds,
          resumoAbstracao: resumoAbstracao.trim(),
          questoesFeitas,
          questoesAcertadas
        })
      });

      if (res.ok) {
        setFeedbackMsg('✓ Sessão do Método ERA concluída e registrada no Event Log.');
        setIsSessionActive(false);
        setCurrentStep(1);
        setTopico('');
        loadData();
        setTimeout(() => setFeedbackMsg(null), 3500);
      } else {
        setFeedbackMsg('Erro ao registrar sessão ERA.');
      }
    } catch (e) {
      console.error(e);
      setFeedbackMsg('Erro de conexão ao salvar.');
    }
  };

  const formatMinSec = (secs: number) => {
    const m = Math.floor(secs / 60);
    const s = secs % 60;
    return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  };

  return (
    <div className="era-container animate-fade-in">
      {/* Hero Método ERA */}
      <div className="era-hero">
        <h2>⚡ Método ERA (Explorar, Estudar, Revisar, Avaliar)</h2>
        <p>
          O método estruturado para sessões teóricas de alta retenção (Caderno Preparação para Concursos):
          <strong> 1. Explorar</strong> (2 min escaneando títulos e subtítulos para ativar a atenção seletiva) →
          <strong> 2. Estudar</strong> (leitura ativa focando em 70–80% de retenção e marcando exceções em vermelho) →
          <strong> 3. Revisar</strong> ("Espremer as lêndeas" com resumo por abstração sem olhar a fonte) →
          <strong> 4. Avaliar</strong> (validação imediata por bateria de questões).
        </p>
      </div>

      {feedbackMsg && (
        <div style={{
          padding: '10px 16px',
          borderRadius: '8px',
          background: feedbackMsg.startsWith('✓') ? 'rgba(16, 185, 129, 0.2)' : 'rgba(239, 68, 68, 0.2)',
          color: feedbackMsg.startsWith('✓') ? '#34d399' : '#fca5a5',
          border: `1px solid ${feedbackMsg.startsWith('✓') ? '#10b981' : '#ef4444'}`
        }}>
          {feedbackMsg}
        </div>
      )}

      {!isSessionActive ? (
        <div className="era-card">
          <h3 style={{ margin: 0, color: '#f8fafc', fontSize: '1.2rem' }}>
            Nova Sessão Teórica no Método ERA
          </h3>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
            <div className="form-group">
              <label style={{ color: '#cbd5e1', fontSize: '0.9rem', marginBottom: '4px', display: 'block' }}>
                Disciplina
              </label>
              <select
                className="form-control"
                value={selectedDiscipline}
                onChange={(e) => setSelectedDiscipline(e.target.value)}
                style={{ width: '100%', background: '#1e293b', color: '#f8fafc', border: '1px solid #334155' }}
              >
                {disciplines.map(d => (
                  <option key={d} value={d}>{d}</option>
                ))}
              </select>
            </div>

            <div className="form-group">
              <label style={{ color: '#cbd5e1', fontSize: '0.9rem', marginBottom: '4px', display: 'block' }}>
                Capítulo / Tópico Teórico
              </label>
              <input
                type="text"
                className="form-control"
                placeholder="Ex.: Direito Tributário - Competência Tributária e Limitações"
                value={topico}
                onChange={(e) => setTopico(e.target.value)}
                style={{ width: '100%' }}
              />
            </div>
          </div>

          <button
            className="btn btn-primary"
            onClick={handleStartEra}
            disabled={!topico.trim()}
            style={{ alignSelf: 'flex-start', padding: '10px 24px' }}
          >
            🚀 Iniciar Passo 1: Explorar (2 min)
          </button>
        </div>
      ) : (
        <div className="era-card animate-fade-in">
          {/* Indicador visual das 4 etapas */}
          <div className="era-steps-indicator">
            <div className={`era-step-pill ${currentStep === 1 ? 'active' : currentStep > 1 ? 'completed' : ''}`}>
              <span className="era-step-title">1. Explorar</span>
              <span className="era-step-subtitle">2 min pré-estudo</span>
            </div>
            <div className={`era-step-pill ${currentStep === 2 ? 'active' : currentStep > 2 ? 'completed' : ''}`}>
              <span className="era-step-title">2. Estudar</span>
              <span className="era-step-subtitle">70-80% retenção</span>
            </div>
            <div className={`era-step-pill ${currentStep === 3 ? 'active' : currentStep > 3 ? 'completed' : ''}`}>
              <span className="era-step-title">3. Revisar</span>
              <span className="era-step-subtitle">Resumo por abstração</span>
            </div>
            <div className={`era-step-pill ${currentStep === 4 ? 'active' : ''}`}>
              <span className="era-step-title">4. Avaliar</span>
              <span className="era-step-subtitle">Fixação por questões</span>
            </div>
          </div>

          {/* PASSO 1: EXPLORAR */}
          {currentStep === 1 && (
            <div className="animate-fade-in" style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <h3 style={{ margin: 0, color: '#6ee7b7' }}>Etapa 1: Pré-Estudo e Escaneamento Rápido</h3>
                <span className="era-timer-big" style={{ padding: '4px 16px', fontSize: '1.5rem' }}>
                  ⏳ {formatMinSec(explorarSecondsLeft)}
                </span>
              </div>
              <p style={{ margin: 0, fontSize: '0.92rem', color: '#cbd5e1', lineHeight: '1.5' }}>
                Abra o PDF ou livro. Escaneie rapidamente em 2 a 3 minutos os <strong>títulos, subtítulos, tabelas e esquemas</strong>.
                Não tente ler o texto corrido agora. Essa etapa prepara o cérebro e cria os ganchos mentais de ancoragem.
              </p>

              <div className="form-group" style={{ maxWidth: '300px' }}>
                <label style={{ color: '#cbd5e1', fontSize: '0.85rem' }}>Meta de Páginas da Sessão:</label>
                <input
                  type="number"
                  className="form-control"
                  value={metaPaginas}
                  onChange={(e) => setMetaPaginas(Number(e.target.value))}
                />
              </div>

              <div style={{ display: 'flex', gap: '1rem', marginTop: '0.5rem' }}>
                <button
                  className="btn btn-primary"
                  onClick={handleAdvanceToEstudo}
                  style={{ padding: '10px 20px' }}
                >
                  Concluir Pré-Estudo → Ir para Etapa 2: Estudar
                </button>
              </div>
            </div>
          )}

          {/* PASSO 2: ESTUDAR */}
          {currentStep === 2 && (
            <div className="animate-fade-in" style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <h3 style={{ margin: 0, color: '#60a5fa' }}>Etapa 2: Leitura Ativa e Destaques Rigorosos</h3>
                <span className="era-timer-big" style={{ padding: '4px 16px', fontSize: '1.5rem', color: '#60a5fa', background: 'rgba(59, 130, 246, 0.1)', borderColor: 'rgba(59, 130, 246, 0.3)' }}>
                  📖 {formatMinSec(estudarSeconds)}
                </span>
              </div>

              <div className="era-rule-box">
                <strong>Regra Inegociável da Leitura (Caderno 2):</strong>
                <ul style={{ margin: '4px 0 0', paddingLeft: '1.25rem' }}>
                  <li>Mire <strong>70% a 80% de retenção</strong> na primeira passada. Não trave tentando decorar 100% de primeira.</li>
                  <li>Destaque em <strong>vermelho</strong> exclusivamente exceções e palavras restritivas: <em>salvo disposição em contrário, exceto, jamais, nunca</em>.</li>
                  <li>Sinalize pontos de alta incidência (IPC) e pegadinhas mapeadas.</li>
                </ul>
              </div>

              <button
                className="btn btn-primary"
                onClick={handleAdvanceToRevisar}
                style={{ padding: '10px 24px', alignSelf: 'flex-start' }}
              >
                Finalizei Leitura → Ir para Etapa 3: Revisar ("Espremer as Lêndeas")
              </button>
            </div>
          )}

          {/* PASSO 3: REVISAR */}
          {currentStep === 3 && (
            <div className="animate-fade-in" style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              <h3 style={{ margin: 0, color: '#f59e0b' }}>
                Etapa 3: Revisão por Abstração ("Espremer as Lêndeas")
              </h3>
              <p style={{ margin: 0, fontSize: '0.92rem', color: '#cbd5e1' }}>
                Oculte o texto do PDF. Olhe apenas para os títulos e subtítulos e faça a <strong>recordação ativa de cabeça</strong>
                (Resumo Raiz por abstração). Jamais copie olhando para o texto (Resumo Nutella).
              </p>

              <textarea
                className="form-control"
                rows={6}
                placeholder="Escreva em tópicos sintéticos o que seu cérebro resgatou sem olhar para o material: regras centrais, prazos, exceções..."
                value={resumoAbstracao}
                onChange={(e) => setResumoAbstracao(e.target.value)}
                style={{ width: '100%', background: '#1e293b', color: '#f8fafc', border: '1px solid #334155' }}
              />

              <button
                className="btn btn-primary"
                onClick={handleAdvanceToAvaliar}
                disabled={!resumoAbstracao.trim()}
                style={{ padding: '10px 24px', alignSelf: 'flex-start' }}
              >
                Avançar para Etapa 4: Avaliar (Questões de Fixação) →
              </button>
            </div>
          )}

          {/* PASSO 4: AVALIAR */}
          {currentStep === 4 && (
            <div className="animate-fade-in" style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              <h3 style={{ margin: 0, color: '#34d399' }}>
                Etapa 4: Avaliar e Validar por Resolução de Questões
              </h3>
              <p style={{ margin: 0, fontSize: '0.92rem', color: '#cbd5e1' }}>
                Valide imediatamente o aprendizado resolvendo uma bateria de questões de fixação do assunto estudado.
              </p>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', maxWidth: '400px' }}>
                <div className="form-group">
                  <label style={{ color: '#cbd5e1', fontSize: '0.85rem' }}>Questões Resolvidas:</label>
                  <input
                    type="number"
                    min="1"
                    className="form-control"
                    value={questoesFeitas}
                    onChange={(e) => setQuestoesFeitas(Number(e.target.value))}
                  />
                </div>
                <div className="form-group">
                  <label style={{ color: '#cbd5e1', fontSize: '0.85rem' }}>Acertos:</label>
                  <input
                    type="number"
                    min="0"
                    max={questoesFeitas}
                    className="form-control"
                    value={questoesAcertadas}
                    onChange={(e) => setQuestoesAcertadas(Number(e.target.value))}
                  />
                </div>
              </div>

              <div style={{ color: '#38bdf8', fontSize: '0.95rem', fontWeight: 600 }}>
                Aproveitamento: {questoesFeitas > 0 ? Math.round((questoesAcertadas / questoesFeitas) * 100) : 0}%
                {questoesFeitas > 0 && (questoesAcertadas / questoesFeitas) >= 0.8 && ' 🎯 Meta de Retenção Atingida (≥ 80%)'}
              </div>

              <button
                className="btn btn-primary"
                onClick={handleSaveEraSession}
                style={{ padding: '10px 24px', alignSelf: 'flex-start' }}
              >
                Finalizar e Registrar Sessão ERA no Histórico
              </button>
            </div>
          )}
        </div>
      )}

      {/* Histórico das Sessões do Método ERA */}
      <div>
        <h3 style={{ color: '#f8fafc', marginBottom: '1rem', fontSize: '1.25rem' }}>
          📊 Sessões Teóricas ERA Registradas
        </h3>

        {loading ? (
          <div style={{ color: '#94a3b8', padding: '2rem', textAlign: 'center' }}>
            Carregando sessões...
          </div>
        ) : sessions.length === 0 ? (
          <div className="glass" style={{ padding: '2.5rem', textAlign: 'center', borderRadius: '12px' }}>
            <p style={{ color: '#94a3b8', margin: 0, fontSize: '0.95rem' }}>
              Nenhuma sessão do Método ERA concluída ainda. Inicie sua próxima sessão teórica seguindo os 4 passos estruturados.
            </p>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            {sessions.map(s => {
              const perc = s.questoesFeitas > 0 ? Math.round((s.questoesAcertadas / s.questoesFeitas) * 100) : 0;
              return (
                <div key={s.id} className="era-card" style={{ padding: '1.25rem' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <div>
                      <span className="tag" style={{ background: 'rgba(16, 185, 129, 0.2)', color: '#34d399', borderColor: 'rgba(16, 185, 129, 0.4)' }}>
                        {s.disciplina}
                      </span>
                      <h4 style={{ margin: '0.4rem 0 0', color: '#f8fafc', fontSize: '1.05rem' }}>
                        {s.topico}
                      </h4>
                    </div>
                    <div style={{ textAlign: 'right', fontSize: '0.8rem', color: '#64748b' }}>
                      <div>Estudo: {Math.round(s.tempoEstudoSegundos / 60)} min</div>
                      <div>{new Date(s.createdAt).toLocaleDateString('pt-BR')}</div>
                    </div>
                  </div>

                  {s.resumoAbstracao && (
                    <div style={{ background: 'rgba(15, 23, 42, 0.5)', padding: '0.75rem', borderRadius: '8px', color: '#cbd5e1', fontSize: '0.88rem', whiteSpace: 'pre-wrap' }}>
                      <strong style={{ color: '#f59e0b', display: 'block', marginBottom: '4px' }}>Resumo Raiz (Abstração de Cabeça):</strong>
                      {s.resumoAbstracao}
                    </div>
                  )}

                  <div style={{ display: 'flex', gap: '1rem', fontSize: '0.85rem', color: '#94a3b8' }}>
                    <span>Questões: {s.questoesAcertadas}/{s.questoesFeitas} ({perc}%)</span>
                    <span>Explorar: {s.tempoExplorarSegundos}s</span>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
};
