import React, { useState, useEffect } from 'react';
import './PreMortemView.css';

interface PreMortemRecord {
  id: string;
  concursoId?: string;
  cenarioDesastre: string;
  causasProvaveis: string;
  planosContingencia: string;
  createdAt: string;
}

interface Concurso {
  id: string;
  nome: string;
  orgao: string;
  cargo: string;
}

export const PreMortemView: React.FC = () => {
  const [records, setRecords] = useState<PreMortemRecord[]>([]);
  const [concursos, setConcursos] = useState<Concurso[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [showForm, setShowForm] = useState(false);

  // Form State
  const [selectedConcursoId, setSelectedConcursoId] = useState('');
  const [cenarioDesastre, setCenarioDesastre] = useState('');
  const [causa1, setCausa1] = useState('');
  const [causa2, setCausa2] = useState('');
  const [causa3, setCausa3] = useState('');
  const [plano1, setPlano1] = useState('');
  const [plano2, setPlano2] = useState('');
  const [plano3, setPlano3] = useState('');
  const [feedbackMsg, setFeedbackMsg] = useState<string | null>(null);

  const loadData = async () => {
    try {
      setLoading(true);
      const [resPm, resConc] = await Promise.all([
        fetch('/api/v1/cognitive/pre-mortem'),
        fetch('/api/v1/concursos')
      ]);
      if (resPm.ok) {
        setRecords(await resPm.json());
      }
      if (resConc.ok) {
        const concData = await resConc.json();
        setConcursos(concData || []);
        if (concData.length > 0 && !selectedConcursoId) {
          setSelectedConcursoId(concData[0].id);
        }
      }
    } catch (e) {
      console.error('Falha ao carregar pré-mortems', e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!cenarioDesastre.trim()) return;

    setSubmitting(true);
    const causasArr = [causa1.trim(), causa2.trim(), causa3.trim()].filter(Boolean);
    const planosArr = [plano1.trim(), plano2.trim(), plano3.trim()].filter(Boolean);

    try {
      const res = await fetch('/api/v1/cognitive/pre-mortem', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          concursoId: selectedConcursoId || null,
          cenarioDesastre: cenarioDesastre.trim(),
          causasProvaveis: causasArr.join(' | '),
          planosContingencia: planosArr.join(' | ')
        })
      });

      if (res.ok) {
        setFeedbackMsg('✓ Pré-Mortem registrado com sucesso no Event Log.');
        setCenarioDesastre('');
        setCausa1('');
        setCausa2('');
        setCausa3('');
        setPlano1('');
        setPlano2('');
        setPlano3('');
        setShowForm(false);
        loadData();
        setTimeout(() => setFeedbackMsg(null), 3500);
      } else {
        setFeedbackMsg('Falha ao registrar Pré-Mortem.');
      }
    } catch (err) {
      console.error(err);
      setFeedbackMsg('Erro de conexão ao salvar.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="pre-mortem-container animate-fade-in">
      {/* Hero explicativo da técnica de Gary Klein */}
      <div className="pre-mortem-hero">
        <h2>🔮 Pré-Mortem Cognitivo (Técnica de Gary Klein)</h2>
        <p>
          Antes de fechar ciclos críticos ou ir para a prova, imagine deliberadamente que a prova ocorreu e você
          <strong> fracassou miseravelmente</strong>. Listar previamente as causas prováveis desse desastre e montar planos
          de contingência neutraliza o viés de excesso de confiança e revela pontos cegos fatais na sua preparação.
        </p>
        <div style={{ marginTop: '1rem', display: 'flex', gap: '0.75rem' }}>
          <button
            className="btn btn-primary"
            onClick={() => setShowForm(!showForm)}
            style={{ padding: '8px 18px', fontSize: '0.9rem' }}
          >
            {showForm ? 'Fechar Formulário' : '✍️ Executar Novo Pré-Mortem'}
          </button>
        </div>
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

      {/* Formulário de Execução de Pré-Mortem */}
      {showForm && (
        <form onSubmit={handleSubmit} className="pre-mortem-form-card animate-fade-in">
          <h3 style={{ margin: 0, color: '#f8fafc', fontSize: '1.2rem' }}>
            Simulação de Fracasso Hipotético e Vacina Mental
          </h3>

          <div className="form-group">
            <label style={{ color: '#cbd5e1', fontSize: '0.9rem', marginBottom: '4px', display: 'block' }}>
              Concurso Alvo Vinculado
            </label>
            <select
              className="form-control"
              value={selectedConcursoId}
              onChange={(e) => setSelectedConcursoId(e.target.value)}
              style={{ width: '100%', background: '#1e293b', color: '#f8fafc', border: '1px solid #334155' }}
            >
              <option value="">Geral / Sem concurso específico</option>
              {concursos.map(c => (
                <option key={c.id} value={c.id}>
                  {c.nome} ({c.cargo || c.orgao})
                </option>
              ))}
            </select>
          </div>

          <div className="form-group">
            <label style={{ color: '#cbd5e1', fontSize: '0.9rem', marginBottom: '4px', display: 'block' }}>
              Cenário do Desastre (Imagine que você abriu o Diário Oficial e não viu seu nome):
            </label>
            <textarea
              className="form-control"
              rows={3}
              placeholder="Ex.: Reprovei no concurso pretendido porque fui eliminado no mínimo de uma disciplina e não concluí a discursiva a tempo..."
              value={cenarioDesastre}
              onChange={(e) => setCenarioDesastre(e.target.value)}
              required
              style={{ width: '100%', background: '#1e293b', color: '#f8fafc', border: '1px solid #334155' }}
            />
          </div>

          <div className="pm-input-grid">
            <div>
              <div className="pm-section-title">
                ⚠️ As 3 Causas Prováveis do Desastre
              </div>
              <input
                type="text"
                className="form-control"
                placeholder="Causa 1: Excesso de horas passivas assistindo vídeos de TI"
                value={causa1}
                onChange={(e) => setCausa1(e.target.value)}
                style={{ width: '100%', marginBottom: '8px' }}
              />
              <input
                type="text"
                className="form-control"
                placeholder="Causa 2: Não treinar esqueleto de redação contra o relógio"
                value={causa2}
                onChange={(e) => setCausa2(e.target.value)}
                style={{ width: '100%', marginBottom: '8px' }}
              />
              <input
                type="text"
                className="form-control"
                placeholder="Causa 3: Esquecer prazos de decadência e prescrição de Tributário"
                value={causa3}
                onChange={(e) => setCausa3(e.target.value)}
                style={{ width: '100%' }}
              />
            </div>

            <div>
              <div className="pm-section-title">
                🛡️ Os 3 Planos de Contingência Imediatos
              </div>
              <input
                type="text"
                className="form-control"
                placeholder="Plano 1: Aplicar Lei de Robin Hood e transferir 4h/sem de Direito para TI"
                value={plano1}
                onChange={(e) => setPlano1(e.target.value)}
                style={{ width: '100%', marginBottom: '8px' }}
              />
              <input
                type="text"
                className="form-control"
                placeholder="Plano 2: Fazer 2 discursivas por semana iniciando pelo espelho de correção"
                value={plano2}
                onChange={(e) => setPlano2(e.target.value)}
                style={{ width: '100%', marginBottom: '8px' }}
              />
              <input
                type="text"
                className="form-control"
                placeholder="Plano 3: Cadastrar cloze cards e fazer revisão D-4 com pontos-chave"
                value={plano3}
                onChange={(e) => setPlano3(e.target.value)}
                style={{ width: '100%' }}
              />
            </div>
          </div>

          <button
            type="submit"
            className="btn btn-primary"
            disabled={submitting}
            style={{ marginTop: '0.5rem', padding: '10px 20px', alignSelf: 'flex-start' }}
          >
            {submitting ? 'Gravando...' : 'Salvar Diagnóstico no Histórico Imutável'}
          </button>
        </form>
      )}

      {/* Histórico de Pré-Mortems Gravados */}
      <div>
        <h3 style={{ color: '#f8fafc', marginBottom: '1rem', fontSize: '1.25rem' }}>
          📋 Diagnósticos de Pré-Mortem Ativos
        </h3>

        {loading ? (
          <div style={{ color: '#94a3b8', padding: '2rem', textAlign: 'center' }}>
            Carregando diagnósticos...
          </div>
        ) : records.length === 0 ? (
          <div className="glass" style={{ padding: '2.5rem', textAlign: 'center', borderRadius: '12px' }}>
            <p style={{ color: '#94a3b8', margin: 0, fontSize: '0.95rem' }}>
              Nenhum Pré-Mortem registrado ainda. Clique no botão acima para antecipar falhas e blindar sua rota de estudos.
            </p>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            {records.map((pm) => {
              const causas = pm.causasProvaveis ? pm.causasProvaveis.split(' | ') : [];
              const planos = pm.planosContingencia ? pm.planosContingencia.split(' | ') : [];
              const conc = concursos.find(c => c.id === pm.concursoId);

              return (
                <div key={pm.id} className="pm-list-card">
                  <div className="pm-header-row">
                    <div>
                      <span className="pm-badge-danger">DESASTRE HIPOTÉTICO</span>
                      {conc && (
                        <span style={{ marginLeft: '8px', color: '#60a5fa', fontSize: '0.82rem', fontWeight: 600 }}>
                          {conc.nome}
                        </span>
                      )}
                      <h4 style={{ margin: '0.5rem 0 0', color: '#f8fafc', fontSize: '1.05rem' }}>
                        {pm.cenarioDesastre}
                      </h4>
                    </div>
                    <span style={{ color: '#64748b', fontSize: '0.78rem' }}>
                      {new Date(pm.createdAt).toLocaleDateString('pt-BR')}
                    </span>
                  </div>

                  <div className="pm-input-grid" style={{ marginTop: '0.25rem' }}>
                    <div style={{ background: 'rgba(239, 68, 68, 0.05)', padding: '0.85rem', borderRadius: '8px' }}>
                      <strong style={{ color: '#fca5a5', fontSize: '0.85rem', display: 'block', marginBottom: '4px' }}>
                        Causas Mapeadas:
                      </strong>
                      <ul style={{ margin: 0, paddingLeft: '1.25rem', color: '#cbd5e1', fontSize: '0.85rem' }}>
                        {causas.map((c, i) => (
                          <li key={i}>{c}</li>
                        ))}
                      </ul>
                    </div>

                    <div className="pm-contingency-box">
                      <strong style={{ color: '#34d399', fontSize: '0.85rem', display: 'block', marginBottom: '4px' }}>
                        Planos de Ação e Vacinas:
                      </strong>
                      <ul style={{ margin: 0, paddingLeft: '1.25rem', color: '#cbd5e1', fontSize: '0.85rem' }}>
                        {planos.map((p, i) => (
                          <li key={i}>{p}</li>
                        ))}
                      </ul>
                    </div>
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
