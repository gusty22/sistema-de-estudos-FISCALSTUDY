import React, { useState, useEffect } from 'react';
import type { ConcursoItem } from '../concursos/MeusConcursos';
import './DigitalTwinView.css';
import { CrossDomainBridgeModal } from '../cognitive/CrossDomainBridgeModal';

interface DigitalTwinViewProps {
  activeConcurso: ConcursoItem | null;
  onNavigateToStudy?: (disciplina?: string, assunto?: string) => void;
}

interface NeuralNode {
  topicoId: string;
  disciplina: string;
  assunto: string;
  peso: number;
  estabilidadeDias: number;
  diasSemContato: number;
  retencaoAtualPct: number;
  probabilidadeAcertoHojePct: number;
  estadoNeural: 'CONSOLIDADO' | 'EM_EQUILIBRIO' | 'RISCO_AMNESIA' | 'VIRGEM_NAO_EXPLORADO';
  minutosAteQuebraSinaptica: number;
  totalTentativas: number;
  totalAcertos: number;
  acuraciaHistoricaPct: number;
}

interface SimulationData {
  timestampSimulacao: string;
  totalQuestoesSimuladas: number;
  notaProjetadaHojePct: number;
  notaCorteConcursoPct: number;
  gapCompetitivoPct: number;
  pontosCriticosFalha: NeuralNode[];
  diagnosticoGeral: string;
}

interface FlightPlanBlock {
  ordem: number;
  tipoIntervencao: string;
  disciplina: string;
  assunto: string;
  topicoId: string;
  duracaoMinutos: number;
  justificativaSinaptica: string;
  passos: string[];
}

interface ShadowTelemetry {
  activePolicy: string;
  shadowPolicy: string;
  totalRuns: number;
  averageDivergencePct: number;
  activeRecommendations: Array<{
    disciplina: string;
    assunto: string;
    prioridade: string;
    motivo: string;
  }>;
  shadowRecommendations: Array<{
    disciplina: string;
    assunto: string;
    prioridade: string;
    motivo: string;
  }>;
  divergenceInsights: string[];
  safetyGuarantee: string;
}

interface DigitalTwinData {
  concursoId: string;
  concursoNome: string;
  totalNos: number;
  nosConsolidados: number;
  nosEmEquilibrio: number;
  nosRiscoAmnesia: number;
  nosVirgens: number;
  saudeNeuralMediaPct: number;
  horasLiquidasAcumuladas: number;
  metaHorasAprovacao: number;
  progressoMetaPct: number;
  velocidadeLeituraMedia: number;
  velocidadeQuestoesMedia: number;
  rendimentoMedioBlocos: number;
  hePercentage: number;
  grafoNos: NeuralNode[];
  simulacaoRecente: SimulationData;
  roteiroDoDia: {
    titulo: string;
    mensagemIA: string;
    blocosSugeridos: FlightPlanBlock[];
  };
}

export const DigitalTwinView: React.FC<DigitalTwinViewProps> = ({
  activeConcurso,
  onNavigateToStudy,
}) => {
  const [data, setData] = useState<DigitalTwinData | null>(null);
  const [loading, setLoading] = useState(false);
  const [nodeFilter, setNodeFilter] = useState<'TODOS' | 'CONSOLIDADO' | 'EM_EQUILIBRIO' | 'RISCO_AMNESIA' | 'VIRGEM_NAO_EXPLORADO'>('TODOS');
  const [isSimulating, setIsSimulating] = useState(false);
  const [shadowTelemetry, setShadowTelemetry] = useState<ShadowTelemetry | null>(null);
  const [showCrossDomainModal, setShowCrossDomainModal] = useState(false);

  const loadDigitalTwin = async () => {
    if (!activeConcurso?.id) return;
    setLoading(true);
    try {
      const res = await fetch(`/api/v1/digital-twin/status?concursoId=${encodeURIComponent(activeConcurso.id)}&concursoNome=${encodeURIComponent(activeConcurso.nome)}`);
      if (res.ok) {
        setData(await res.json());
      }
      const shadowRes = await fetch(`/api/v1/shadow-mode/telemetry?concursoId=${encodeURIComponent(activeConcurso.id)}`);
      if (shadowRes.ok) {
        setShadowTelemetry(await shadowRes.json());
      }
    } catch (e) {
      console.error('Falha ao carregar Gêmeo Digital:', e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadDigitalTwin();
  }, [activeConcurso?.id]);

  const handleStartBlock = (disciplina: string, assunto: string) => {
    sessionStorage.setItem('fiscalstudy_filter_discipline', disciplina);
    sessionStorage.setItem('fiscalstudy_filter_assunto', assunto);
    sessionStorage.setItem('fiscalstudy_auto_start', 'true');
    if (onNavigateToStudy) {
      onNavigateToStudy(disciplina, assunto);
    } else {
      window.location.hash = '#study';
    }
  };

  const handleRunSimulation = () => {
    setIsSimulating(true);
    setTimeout(() => {
      loadDigitalTwin();
      setIsSimulating(false);
    }, 700);
  };

  const filteredNodes = (data?.grafoNos || []).filter((n) => {
    if (nodeFilter === 'TODOS') return true;
    return n.estadoNeural === nodeFilter;
  });

  return (
    <div className="digital-twin-container animate-fade-in">
      {loading && (
        <div style={{ textAlign: 'center', color: '#94a3b8', fontSize: '0.85rem' }}>
          Calculando conexões sinápticas e simulando provas...
        </div>
      )}
      {/* Header */}
      <div className="dt-header glass">
        <div>
          <h2>
            <span>🧠</span> Gêmeo Digital Cognitivo (Digital Twin)
          </h2>
          <p className="dt-subtitle">
            Simulação algorítmica do seu cérebro baseada no método de alto rendimento: grafo de conexões sinápticas, Curva de Ebbinghaus, micro-telemetria de 3.100h e simulação noturna preditiva de prova.
          </p>
        </div>

        <div style={{ display: 'flex', gap: '0.6rem', flexWrap: 'wrap' }}>
          <button
            type="button"
            className="btn"
            style={{ background: 'rgba(56, 189, 248, 0.15)', color: '#38bdf8', border: '1px solid #38bdf8', padding: '0.6rem 1.2rem', fontWeight: 700, borderRadius: '8px', cursor: 'pointer' }}
            onClick={() => setShowCrossDomainModal(true)}
          >
            ⚡ Colisão de Domínios
          </button>

          <button
            type="button"
            className="btn"
            style={{ background: '#7c3aed', color: '#fff', border: 'none', padding: '0.6rem 1.2rem', fontWeight: 700, borderRadius: '8px', cursor: 'pointer' }}
            onClick={handleRunSimulation}
            disabled={isSimulating}
          >
            {isSimulating ? '⚡ Executando...' : '⚡ Reexecutar Simulação Noturna'}
          </button>
        </div>
      </div>

      {/* 1. Micro-Telemetria de Estudo (Método Lucas — Rumo ao Limiar Estatístico de 3.100 Horas) */}
      <div className="lucas-telemetry-card glass">
        <div className="telemetry-progress-header">
          <div>
            <span className="telemetry-badge-title">📈 Limiar Estatístico de Aprovação (Método Lucas)</span>
            <div style={{ color: '#94a3b8', fontSize: '0.82rem', marginTop: '2px' }}>
              Ao atingir aproximadamente 3.100 horas líquidas ativas (HE), a aprovação torna-se uma consequência estatística.
            </div>
          </div>
          <div className="telemetry-hours-stat">
            <strong>{data?.horasLiquidasAcumuladas ?? 0}h</strong>
            <span style={{ color: '#64748b', fontSize: '0.95rem' }}> / {data?.metaHorasAprovacao ?? 3100}h Líquidas</span>
            <span style={{ color: '#10b981', fontSize: '0.88rem', marginLeft: '8px', fontWeight: 700 }}>
              ({data?.progressoMetaPct ?? 0}%)
            </span>
          </div>
        </div>

        <div className="telemetry-bar-wrap">
          <div
            className="telemetry-bar-fill"
            style={{ width: `${Math.min(100, data?.progressoMetaPct ?? 0)}%` }}
          />
        </div>

        {/* 4 Caixas de Telemetria de Lucas */}
        <div className="telemetry-grid">
          <div className="telemetry-box">
            <span className="telemetry-box-num text-cyan">
              {data?.velocidadeLeituraMedia ? `${data.velocidadeLeituraMedia}` : '0'}
              <span style={{ fontSize: '0.85rem', fontWeight: 600, color: '#94a3b8' }}> pág/h</span>
            </span>
            <span className="telemetry-box-label">Velocidade Média de Leitura</span>
            <span className="telemetry-box-sub">Páginas de teoria líquidas por hora</span>
          </div>

          <div className="telemetry-box">
            <span className="telemetry-box-num text-yellow">
              {data?.velocidadeQuestoesMedia ? `${data.velocidadeQuestoesMedia}` : '0'}
              <span style={{ fontSize: '0.85rem', fontWeight: 600, color: '#94a3b8' }}> quest/h</span>
            </span>
            <span className="telemetry-box-label">Velocidade de Resolução</span>
            <span className="telemetry-box-sub">Ritmo de processamento de itens</span>
          </div>

          <div className="telemetry-box">
            <span className="telemetry-box-num text-green">
              {data?.rendimentoMedioBlocos ? `${data.rendimentoMedioBlocos}%` : '0%'}
            </span>
            <span className="telemetry-box-label">Rendimento Médio ("Nota")</span>
            <span className="telemetry-box-sub">Acurácia média obtida em cada bloco</span>
          </div>

          <div className="telemetry-box">
            <span className="telemetry-box-num text-purple">
              {data?.saudeNeuralMediaPct ? `${data.saudeNeuralMediaPct}%` : '0%'}
            </span>
            <span className="telemetry-box-label">Saúde Neural Média (Retenção)</span>
            <span className="telemetry-box-sub">Curva de Ebbinghaus ponderada por peso</span>
          </div>
        </div>
      </div>

      {/* 2. Simulação Noturna (Nightly Simulation de 100 Questões) */}
      {data?.simulacaoRecente && (
        <div className="simulation-card glass">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '1rem' }}>
            <div>
              <span style={{ fontSize: '0.75rem', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.08em', color: '#10b981' }}>
                🌙 Simulação da Madrugada (Nightly Simulation)
              </span>
              <h3 style={{ color: '#f8fafc', fontSize: '1.25rem', margin: '0.2rem 0' }}>
                Prova Virtual de 100 Questões contra seu Gêmeo Digital
              </h3>
              <p style={{ color: '#cbd5e1', fontSize: '0.85rem', margin: 0, maxWidth: '850px' }}>
                {data.simulacaoRecente.diagnosticoGeral}
              </p>
            </div>
          </div>

          <div className="sim-score-banner">
            <div className="sim-score-item">
              <span className="sim-score-val" style={{ color: data.simulacaoRecente.gapCompetitivoPct >= 0 ? '#10b981' : '#f59e0b' }}>
                {data.simulacaoRecente.notaProjetadaHojePct}%
              </span>
              <span className="sim-score-label">Nota Projetada Hoje</span>
            </div>

            <div className="sim-score-item">
              <span className="sim-score-val" style={{ color: '#94a3b8' }}>
                {data.simulacaoRecente.notaCorteConcursoPct}%
              </span>
              <span className="sim-score-label">Nota de Corte Fiscal</span>
            </div>

            <div className="sim-score-item">
              <span
                className="sim-score-val"
                style={{ color: data.simulacaoRecente.gapCompetitivoPct >= 0 ? '#10b981' : '#ef4444' }}
              >
                {data.simulacaoRecente.gapCompetitivoPct > 0 ? `+${data.simulacaoRecente.gapCompetitivoPct}%` : `${data.simulacaoRecente.gapCompetitivoPct}%`}
              </span>
              <span className="sim-score-label">Gap Competitivo</span>
            </div>

            <div className="sim-score-item">
              <span className="sim-score-val" style={{ color: '#38bdf8' }}>
                {data.nosRiscoAmnesia} nós
              </span>
              <span className="sim-score-label">Pontos em Risco de Amnésia</span>
            </div>
          </div>

          {/* Pontos Críticos de Falha Neural */}
          {data.simulacaoRecente.pontosCriticosFalha && data.simulacaoRecente.pontosCriticosFalha.length > 0 && (
            <div>
              <h4 style={{ color: '#f8fafc', fontSize: '0.92rem', marginBottom: '0.6rem' }}>
                🚨 Pontos Críticos de Falha Neural Identificados na Simulação:
              </h4>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '0.75rem' }}>
                {data.simulacaoRecente.pontosCriticosFalha.map((crit, idx) => (
                  <div
                    key={crit.topicoId || idx}
                    style={{
                      background: '#0a0f1d',
                      border: '1px solid rgba(239, 68, 68, 0.3)',
                      borderRadius: '8px',
                      padding: '0.85rem',
                    }}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.3rem' }}>
                      <span style={{ fontSize: '0.72rem', color: '#38bdf8', fontWeight: 700, textTransform: 'uppercase' }}>
                        {crit.disciplina}
                      </span>
                      <span style={{ fontSize: '0.72rem', background: 'rgba(239, 68, 68, 0.2)', color: '#ef4444', padding: '1px 6px', borderRadius: '4px', fontWeight: 700 }}>
                        {crit.retencaoAtualPct}% retenção
                      </span>
                    </div>
                    <strong style={{ color: '#f8fafc', fontSize: '0.85rem', display: 'block', marginBottom: '0.4rem' }}>
                      {crit.assunto}
                    </strong>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <span style={{ fontSize: '0.72rem', color: '#94a3b8' }}>
                        Peso: {crit.peso}x • Prob. Acerto: {crit.probabilidadeAcertoHojePct}%
                      </span>
                      <button
                        type="button"
                        className="btn btn-sm"
                        style={{ background: '#ef4444', color: '#fff', border: 'none', padding: '3px 8px', fontSize: '0.72rem', borderRadius: '4px', cursor: 'pointer' }}
                        onClick={() => handleStartBlock(crit.disciplina, crit.assunto)}
                      >
                        Intervir
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* 3. Roteiro Dinâmico do Dia (Plano de Voo Preditivo) */}
      {data?.roteiroDoDia && data.roteiroDoDia.blocosSugeridos && data.roteiroDoDia.blocosSugeridos.length > 0 && (
        <div className="flight-plan-card glass">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '0.5rem' }}>
            <div>
              <span style={{ fontSize: '0.75rem', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.08em', color: '#38bdf8' }}>
                🚀 Plano de Voo do Dia — Zero Fadiga Decisória
              </span>
              <h3 style={{ color: '#f8fafc', fontSize: '1.25rem', margin: '0.2rem 0' }}>
                {data.roteiroDoDia.titulo}
              </h3>
              <p style={{ color: '#94a3b8', fontSize: '0.85rem', margin: 0 }}>
                {data.roteiroDoDia.mensagemIA}
              </p>
            </div>
          </div>

          <div className="flight-plan-grid">
            {data.roteiroDoDia.blocosSugeridos.map((block) => (
              <div key={block.ordem} className="flight-block-card">
                <div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
                    <span style={{ background: '#0284c7', color: '#fff', fontSize: '0.72rem', fontWeight: 800, padding: '2px 8px', borderRadius: '4px' }}>
                      BLOCO #{block.ordem} • {block.tipoIntervencao}
                    </span>
                    <span style={{ color: '#38bdf8', fontSize: '0.85rem', fontWeight: 700 }}>
                      ⏱️ {block.duracaoMinutos} min
                    </span>
                  </div>

                  <span style={{ fontSize: '0.75rem', color: '#94a3b8', textTransform: 'uppercase', fontWeight: 600 }}>
                    {block.disciplina}
                  </span>
                  <h4 style={{ color: '#f8fafc', fontSize: '1.05rem', margin: '0.2rem 0 0.5rem 0' }}>
                    {block.assunto}
                  </h4>

                  <p style={{ color: '#cbd5e1', fontSize: '0.8rem', background: 'rgba(56, 189, 248, 0.05)', padding: '6px 8px', borderRadius: '6px', borderLeft: '3px solid #38bdf8', margin: '0.5rem 0 0.75rem 0' }}>
                    💡 {block.justificativaSinaptica}
                  </p>

                  <ul style={{ margin: 0, paddingLeft: '1.1rem', color: '#94a3b8', fontSize: '0.78rem', lineHeight: 1.5 }}>
                    {block.passos.map((step, sIdx) => (
                      <li key={sIdx}>{step}</li>
                    ))}
                  </ul>
                </div>

                <div style={{ marginTop: '1.25rem' }}>
                  <button
                    type="button"
                    className="btn"
                    style={{
                      width: '100%',
                      background: 'linear-gradient(135deg, #0284c7 0%, #0369a1 100%)',
                      color: '#fff',
                      border: 'none',
                      padding: '0.55rem',
                      fontWeight: 700,
                      fontSize: '0.85rem',
                      borderRadius: '6px',
                      cursor: 'pointer',
                    }}
                    onClick={() => handleStartBlock(block.disciplina, block.assunto)}
                  >
                    ▶ Iniciar Este Bloco Agora ({block.duracaoMinutos} min)
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* 3.5 Arquitetura de "Shadow Mode" para Algoritmos de Planejamento */}
      {shadowTelemetry && (
        <div className="glass" style={{ padding: '1.25rem 1.5rem', borderRadius: '12px', border: '1px solid rgba(139, 92, 246, 0.3)', background: 'rgba(15, 23, 42, 0.65)', marginBottom: '1.5rem' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '0.6rem', marginBottom: '0.85rem' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
              <span style={{ fontSize: '1.35rem' }}>🚗</span>
              <div>
                <h3 style={{ margin: 0, color: '#f8fafc', fontSize: '1.15rem' }}>
                  Arquitetura de "Shadow Mode" Ativa (Simulação Silenciosa de Algoritmos)
                </h3>
                <span style={{ color: '#c4b5fd', fontSize: '0.78rem' }}>
                  {shadowTelemetry.safetyGuarantee}
                </span>
              </div>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
              <span style={{ background: 'rgba(139, 92, 246, 0.2)', border: '1px solid #8b5cf6', color: '#c4b5fd', padding: '3px 9px', borderRadius: '20px', fontSize: '0.75rem', fontWeight: 700 }}>
                {shadowTelemetry.averageDivergencePct}% de Divergência Média
              </span>
              <span style={{ color: '#94a3b8', fontSize: '0.75rem' }}>
                {shadowTelemetry.totalRuns} execuções registradas
              </span>
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '1rem', marginTop: '1rem' }}>
            {/* Política Ativa */}
            <div style={{ background: 'rgba(30, 41, 59, 0.4)', border: '1px solid rgba(255, 255, 255, 0.08)', borderRadius: '8px', padding: '0.9rem' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
                <strong style={{ fontSize: '0.82rem', color: '#38bdf8' }}>🟢 Política Ativa em Produção</strong>
                <span style={{ fontSize: '0.7rem', color: '#94a3b8' }}>{shadowTelemetry.activePolicy}</span>
              </div>
              <p style={{ fontSize: '0.75rem', color: '#cbd5e1', margin: '0 0 0.6rem' }}>
                Planejamento em execução real baseado na Curva de Ebbinghaus padrão.
              </p>
              {shadowTelemetry.activeRecommendations.map((rec, i) => (
                <div key={i} style={{ padding: '0.35rem 0.5rem', background: 'rgba(15, 23, 42, 0.6)', borderRadius: '4px', marginBottom: '0.35rem', fontSize: '0.75rem' }}>
                  <strong style={{ color: '#f8fafc' }}>{rec.assunto}</strong>
                  <span style={{ display: 'block', color: '#94a3b8', fontSize: '0.7rem' }}>{rec.motivo}</span>
                </div>
              ))}
            </div>

            {/* Política Sombra */}
            <div style={{ background: 'rgba(139, 92, 246, 0.08)', border: '1px solid rgba(139, 92, 246, 0.35)', borderRadius: '8px', padding: '0.9rem' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
                <strong style={{ fontSize: '0.82rem', color: '#a78bfa' }}>🟣 Política Sombra Experimental</strong>
                <span style={{ fontSize: '0.7rem', color: '#c4b5fd' }}>{shadowTelemetry.shadowPolicy}</span>
              </div>
              <p style={{ fontSize: '0.75rem', color: '#cbd5e1', margin: '0 0 0.6rem' }}>
                Antecipa revisões com base em telemetria biométrica (hesitação e fricção cognitiva).
              </p>
              {shadowTelemetry.shadowRecommendations.map((rec, i) => (
                <div key={i} style={{ padding: '0.35rem 0.5rem', background: 'rgba(15, 23, 42, 0.6)', borderRadius: '4px', marginBottom: '0.35rem', fontSize: '0.75rem' }}>
                  <strong style={{ color: '#f8fafc' }}>{rec.assunto}</strong>
                  <span style={{ display: 'block', color: '#a78bfa', fontSize: '0.7rem' }}>{rec.motivo}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Divergência e Insights */}
          {shadowTelemetry.divergenceInsights && shadowTelemetry.divergenceInsights.length > 0 && (
            <div style={{ marginTop: '0.85rem', padding: '0.65rem 0.9rem', background: 'rgba(15, 23, 42, 0.5)', borderRadius: '6px', borderLeft: '3px solid #8b5cf6' }}>
              <span style={{ fontSize: '0.72rem', color: '#c4b5fd', fontWeight: 700, textTransform: 'uppercase' }}>
                Insights do Motor Sombra:
              </span>
              <ul style={{ margin: '0.3rem 0 0', paddingLeft: '1.2rem', color: '#cbd5e1', fontSize: '0.76rem', lineHeight: '1.45' }}>
                {shadowTelemetry.divergenceInsights.map((ins, idx) => (
                  <li key={idx}>{ins}</li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}

      {/* 4. Grafo Sináptico de Conhecimento (Todos os Nós do Edital) */}
      <div className="neural-graph-card glass">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem', flexWrap: 'wrap', gap: '0.75rem' }}>
          <div>
            <h3 style={{ color: '#f8fafc', fontSize: '1.2rem', margin: 0 }}>
              🌐 Grafo de Conhecimento Neural ({filteredNodes.length} nós)
            </h3>
            <p style={{ color: '#94a3b8', fontSize: '0.82rem', margin: '0.2rem 0 0 0' }}>
              Estado sináptico em tempo real de cada nó do edital calculado pela Curva de Ebbinghaus e histórico real.
            </p>
          </div>

          {/* Filtros de Estado Neural */}
          <div style={{ display: 'flex', gap: '0.4rem', flexWrap: 'wrap' }}>
            {[
              { id: 'TODOS', label: `Todos (${data?.totalNos ?? 0})` },
              { id: 'CONSOLIDADO', label: `🟢 Consolidados (${data?.nosConsolidados ?? 0})` },
              { id: 'EM_EQUILIBRIO', label: `🟡 Em Equilíbrio (${data?.nosEmEquilibrio ?? 0})` },
              { id: 'RISCO_AMNESIA', label: `🔴 Risco Amnésia (${data?.nosRiscoAmnesia ?? 0})` },
              { id: 'VIRGEM_NAO_EXPLORADO', label: `⚪ Virgens (${data?.nosVirgens ?? 0})` },
            ].map((f) => (
              <button
                key={f.id}
                type="button"
                style={{
                  background: nodeFilter === f.id ? '#0284c7' : '#0a0f1d',
                  color: nodeFilter === f.id ? '#fff' : '#94a3b8',
                  border: '1px solid #1e293b',
                  padding: '4px 8px',
                  borderRadius: '6px',
                  fontSize: '0.75rem',
                  fontWeight: 600,
                  cursor: 'pointer',
                }}
                onClick={() => setNodeFilter(f.id as any)}
              >
                {f.label}
              </button>
            ))}
          </div>
        </div>

        {filteredNodes.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '2rem', color: '#94a3b8' }}>
            <p style={{ fontSize: '0.9rem', color: '#f8fafc' }}>
              Nenhum nó neural encontrado para o filtro selecionado.
            </p>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
            {filteredNodes.map((node) => {
              const retentionColor = node.retencaoAtualPct >= 85
                ? '#10b981'
                : node.retencaoAtualPct >= 70
                ? '#f59e0b'
                : '#ef4444';

              return (
                <div key={node.topicoId} className="neural-node-row">
                  <div style={{ flex: 1, minWidth: '220px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.15rem' }}>
                      <span style={{ fontSize: '0.72rem', color: '#38bdf8', fontWeight: 700, textTransform: 'uppercase' }}>
                        {node.disciplina}
                      </span>
                      <span style={{ fontSize: '0.7rem', color: '#64748b' }}>• Peso: {node.peso}x</span>
                    </div>
                    <strong style={{ color: '#f8fafc', fontSize: '0.88rem' }}>{node.assunto}</strong>
                    <div style={{ color: '#94a3b8', fontSize: '0.72rem', marginTop: '2px' }}>
                      {node.totalTentativas > 0
                        ? `${node.totalTentativas} resoluções (${node.totalAcertos} acertos • ${node.acuraciaHistoricaPct}%) • Último contato: ${node.diasSemContato} dias atrás`
                        : 'Nenhuma questão ou sessão registrada ainda neste nó.'}
                    </div>
                  </div>

                  <div style={{ display: 'flex', alignItems: 'center', gap: '1.25rem' }}>
                    {/* Retenção Ebbinghaus */}
                    <div>
                      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.75rem', color: '#cbd5e1' }}>
                        <span>Retenção:</span>
                        <strong style={{ color: retentionColor }}>{node.retencaoAtualPct}%</strong>
                      </div>
                      <div className="node-retention-bar">
                        <div
                          className="node-retention-fill"
                          style={{ width: `${node.retencaoAtualPct}%`, background: retentionColor }}
                        />
                      </div>
                    </div>

                    {/* Estabilidade Sináptica */}
                    <div style={{ textAlign: 'right', minWidth: '85px' }}>
                      <span style={{ display: 'block', fontSize: '0.85rem', color: '#f8fafc', fontWeight: 700 }}>
                        {node.estabilidadeDias} dias
                      </span>
                      <span style={{ fontSize: '0.68rem', color: '#64748b' }}>Estabilidade (S)</span>
                    </div>

                    {/* Previsão de Quebra */}
                    <div style={{ textAlign: 'right', minWidth: '100px' }}>
                      <span style={{ display: 'block', fontSize: '0.82rem', color: node.minutosAteQuebraSinaptica <= 0 ? '#ef4444' : '#fbbf24', fontWeight: 700 }}>
                        {node.minutosAteQuebraSinaptica <= 0 ? 'Sinapse Rota' : `${Math.round(node.minutosAteQuebraSinaptica / 60)}h restantes`}
                      </span>
                      <span style={{ fontSize: '0.68rem', color: '#64748b' }}>Até Queda a 70%</span>
                    </div>

                    <button
                      type="button"
                      className="btn btn-sm"
                      style={{
                        background: '#0284c7',
                        color: '#fff',
                        border: 'none',
                        padding: '0.4rem 0.8rem',
                        fontSize: '0.78rem',
                        fontWeight: 600,
                        borderRadius: '6px',
                        cursor: 'pointer',
                      }}
                      onClick={() => handleStartBlock(node.disciplina, node.assunto)}
                    >
                      ▶ Praticar
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Modal de Colisão de Domínios */}
      <CrossDomainBridgeModal
        isOpen={showCrossDomainModal}
        onClose={() => setShowCrossDomainModal(false)}
        sessionId="digital-twin"
      />
    </div>
  );
};

export default DigitalTwinView;
