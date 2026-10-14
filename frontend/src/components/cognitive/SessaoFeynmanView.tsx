import React, { useState, useEffect, useRef } from 'react';
import './SessaoFeynmanView.css';

interface FeynmanSession {
  id: string;
  disciplina: string;
  topico: string;
  explicacao: string;
  lacunasIdentificadas: string;
  tempoGastoSegundos: number;
  createdAt: string;
}

export const SessaoFeynmanView: React.FC = () => {
  const [sessions, setSessions] = useState<FeynmanSession[]>([]);
  const [disciplines, setDisciplines] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [isSessionActive, setIsSessionActive] = useState(false);

  // Form / Session state
  const [selectedDiscipline, setSelectedDiscipline] = useState('');
  const [topico, setTopico] = useState('');
  const [explicacao, setExplicacao] = useState('');
  const [lacunas, setLacunas] = useState('');
  const [step, setStep] = useState<'CANVAS' | 'CONFRONTACAO'>('CANVAS');
  const [secondsElapsed, setSecondsElapsed] = useState(0);
  const [feedbackMsg, setFeedbackMsg] = useState<string | null>(null);

  const timerRef = useRef<number | null>(null);

  const loadData = async () => {
    try {
      setLoading(true);
      const [resSess, resDisc] = await Promise.all([
        fetch('/api/v1/cognitive/feynman'),
        fetch('/api/v1/questions/disciplines')
      ]);
      if (resSess.ok) {
        setSessions(await resSess.json());
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

  useEffect(() => {
    if (isSessionActive) {
      timerRef.current = window.setInterval(() => {
        setSecondsElapsed(prev => prev + 1);
      }, 1000);
    } else if (timerRef.current) {
      clearInterval(timerRef.current);
    }
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [isSessionActive]);

  const handleStartSession = () => {
    if (!topico.trim()) return;
    setIsSessionActive(true);
    setStep('CANVAS');
    setSecondsElapsed(0);
    setExplicacao('');
    setLacunas('');
  };

  const handleInsertGap = () => {
    setExplicacao(prev => prev + ' [? LACUNA] ');
  };

  const handleAdvanceToConfrontacao = () => {
    setStep('CONFRONTACAO');
  };

  const handleSaveSession = async () => {
    if (!explicacao.trim()) return;

    try {
      const res = await fetch('/api/v1/cognitive/feynman', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          disciplina: selectedDiscipline || 'Geral',
          topico: topico.trim(),
          explicacao: explicacao.trim(),
          lacunasIdentificadas: lacunas.trim(),
          tempoGastoSegundos: secondsElapsed
        })
      });

      if (res.ok) {
        setFeedbackMsg('✓ Sessão Feynman gravada com sucesso no Event Log.');
        setIsSessionActive(false);
        setStep('CANVAS');
        setTopico('');
        setExplicacao('');
        setLacunas('');
        loadData();
        setTimeout(() => setFeedbackMsg(null), 3500);
      } else {
        setFeedbackMsg('Erro ao salvar sessão Feynman.');
      }
    } catch (e) {
      console.error(e);
      setFeedbackMsg('Falha de conexão.');
    }
  };

  const formatTime = (secs: number) => {
    const m = Math.floor(secs / 60);
    const s = secs % 60;
    return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  };

  return (
    <div className="feynman-container animate-fade-in">
      {/* Hero Feynman */}
      <div className="feynman-hero">
        <h2>🔬 Sessão Feynman em Tela Limpa (Modo Monge)</h2>
        <p>
          A verdadeira retenção decorre de extrair a informação de dentro para fora.
          Abra uma <strong>folha em branco</strong> e reconstrua de cabeça a árvore conceitual do assunto como se estivesse
          ensinando a um leigo. Coloque <strong>[? LACUNA]</strong> onde a memória falhar antes de consultar a fonte para expor
          e eliminar pontos de ilusão de competência.
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

      {/* Seção de Início ou Sessão Ativa */}
      {!isSessionActive ? (
        <div className="glass feynman-canvas-card">
          <h3 style={{ margin: 0, color: '#f8fafc', fontSize: '1.2rem' }}>
            Configurar Prática Feynman
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
                Tópico ou Instituto a Explicar
              </label>
              <input
                type="text"
                className="form-control"
                placeholder="Ex.: Imunidade Recíproca das Autarquias e Empresas Públicas"
                value={topico}
                onChange={(e) => setTopico(e.target.value)}
                style={{ width: '100%' }}
              />
            </div>
          </div>

          <button
            className="btn btn-primary"
            onClick={handleStartSession}
            disabled={!topico.trim()}
            style={{ alignSelf: 'flex-start', padding: '10px 24px' }}
          >
            🚀 Iniciar Tela Limpa
          </button>
        </div>
      ) : (
        <div className="glass feynman-canvas-card feynman-monk-mode animate-fade-in">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div>
              <span style={{ color: '#818cf8', fontSize: '0.82rem', fontWeight: 700, textTransform: 'uppercase' }}>
                {selectedDiscipline} • MODO MONGE ATIVADO
              </span>
              <h3 style={{ margin: '0.2rem 0 0', color: '#f8fafc', fontSize: '1.25rem' }}>
                {topico}
              </h3>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
              <span style={{
                fontSize: '1.2rem',
                fontFamily: 'monospace',
                fontWeight: 700,
                color: '#38bdf8',
                background: 'rgba(56, 189, 248, 0.1)',
                padding: '4px 12px',
                borderRadius: '8px'
              }}>
                ⏱️ {formatTime(secondsElapsed)}
              </span>
              <button
                className="btn btn-secondary"
                onClick={() => setIsSessionActive(false)}
                style={{ padding: '6px 12px', fontSize: '0.8rem' }}
              >
                Cancelar
              </button>
            </div>
          </div>

          {step === 'CANVAS' ? (
            <>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <p style={{ margin: 0, fontSize: '0.88rem', color: '#94a3b8' }}>
                  Escreva e desenhe a árvore do conceito de memória pura. Não olhe materiais de apoio.
                </p>
                <button
                  type="button"
                  className="btn btn-secondary"
                  onClick={handleInsertGap}
                  style={{ padding: '4px 12px', fontSize: '0.8rem', borderColor: '#f87171', color: '#fca5a5' }}
                  title="Insere marcação de dúvida para checar no caderno depois"
                >
                  ❓ Marcar [? LACUNA]
                </button>
              </div>

              <textarea
                className="feynman-clean-textarea"
                rows={12}
                placeholder="Comece explicando a regra geral, o fundamento lógico, os princípios e ramificações. Ex:&#10;1. O que é este instituto?&#10;2. Qual é a regra geral?&#10;3. Quais são as exceções clássicas cobradas pelas bancas?&#10;4. Prazos ou detalhes que não lembro [? LACUNA]"
                value={explicacao}
                onChange={(e) => setExplicacao(e.target.value)}
              />

              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontSize: '0.85rem', color: '#64748b' }}>
                  {explicacao.split(/\s+/).filter(Boolean).length} palavras escritas
                </span>
                <button
                  className="btn btn-primary"
                  onClick={handleAdvanceToConfrontacao}
                  disabled={!explicacao.trim()}
                  style={{ padding: '10px 20px' }}
                >
                  Confrontar com a Teoria →
                </button>
              </div>
            </>
          ) : (
            <div className="animate-fade-in" style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              <div style={{ background: 'rgba(99, 102, 241, 0.1)', padding: '1rem', borderRadius: '10px', border: '1px solid rgba(99, 102, 241, 0.3)' }}>
                <h4 style={{ margin: '0 0 0.5rem', color: '#a5b4fc' }}>
                  Etapa 2: Confrontação com a Fonte Primária
                </h4>
                <p style={{ margin: 0, fontSize: '0.88rem', color: '#cbd5e1' }}>
                  Abra seu PDF, Lei Seca ou Caderno e compare com o que você escreveu. Quais detalhes, exceções ou prazos foram esquecidos ou distorcidos?
                </p>
              </div>

              <div className="form-group">
                <label style={{ color: '#cbd5e1', fontSize: '0.9rem', marginBottom: '4px', display: 'block' }}>
                  Lacunas e Distorções Identificadas (Diagnóstico):
                </label>
                <textarea
                  className="form-control"
                  rows={4}
                  placeholder="Ex.: Esqueci que a imunidade recíproca não se estende às empresas públicas que exploram atividade econômica em concorrência; confundi prazo prescricional com decadencial."
                  value={lacunas}
                  onChange={(e) => setLacunas(e.target.value)}
                  style={{ width: '100%', background: '#1e293b', color: '#f8fafc', border: '1px solid #334155' }}
                />
              </div>

              <div style={{ display: 'flex', gap: '1rem' }}>
                <button
                  className="btn btn-secondary"
                  onClick={() => setStep('CANVAS')}
                  style={{ padding: '10px 18px' }}
                >
                  ← Voltar ao Canvas
                </button>
                <button
                  className="btn btn-primary"
                  onClick={handleSaveSession}
                  style={{ padding: '10px 24px' }}
                >
                  Salvar Sessão Feynman no Histórico
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Histórico de Sessões Feynman */}
      <div>
        <h3 style={{ color: '#f8fafc', marginBottom: '1rem', fontSize: '1.25rem' }}>
          📜 Histórico de Sessões Feynman
        </h3>

        {loading ? (
          <div style={{ color: '#94a3b8', padding: '2rem', textAlign: 'center' }}>
            Carregando histórico...
          </div>
        ) : sessions.length === 0 ? (
          <div className="glass" style={{ padding: '2.5rem', textAlign: 'center', borderRadius: '12px' }}>
            <p style={{ color: '#94a3b8', margin: 0, fontSize: '0.95rem' }}>
              Nenhuma sessão Feynman registrada ainda. Escolha um tópico acima e pratique a reconstrução em tela limpa.
            </p>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            {sessions.map(s => (
              <div key={s.id} className="feynman-history-card">
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div>
                    <span className="tag" style={{ background: 'rgba(99, 102, 241, 0.2)', color: '#a5b4fc', borderColor: 'rgba(99, 102, 241, 0.4)' }}>
                      {s.disciplina}
                    </span>
                    <h4 style={{ margin: '0.4rem 0 0', color: '#f8fafc', fontSize: '1.05rem' }}>
                      {s.topico}
                    </h4>
                  </div>
                  <div style={{ textAlign: 'right', fontSize: '0.8rem', color: '#64748b' }}>
                    <div>⏱️ {Math.round(s.tempoGastoSegundos / 60)} min</div>
                    <div>{new Date(s.createdAt).toLocaleDateString('pt-BR')}</div>
                  </div>
                </div>

                <div style={{ background: 'rgba(15, 23, 42, 0.5)', padding: '0.75rem', borderRadius: '8px', color: '#94a3b8', fontSize: '0.88rem', whiteSpace: 'pre-wrap', maxHeight: '120px', overflowY: 'auto' }}>
                  {s.explicacao}
                </div>

                {s.lacunasIdentificadas && (
                  <div style={{ background: 'rgba(239, 68, 68, 0.08)', border: '1px solid rgba(239, 68, 68, 0.25)', padding: '0.65rem 0.85rem', borderRadius: '8px', fontSize: '0.85rem', color: '#fca5a5' }}>
                    <strong>Lacunas diagnosticadas:</strong> {s.lacunasIdentificadas}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};
