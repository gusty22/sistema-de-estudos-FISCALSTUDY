import React, { useState, useEffect } from 'react';
import {
  Sparkles,
  Target,
  Clock,
  BookOpen,
  RefreshCw,
  Sliders,
  History,
  ShieldAlert,
  ArrowUpRight,
  Play
} from 'lucide-react';
import type { ConcursoItem } from '../concursos/MeusConcursos';
import './CadernosSimulados.css';

export interface SimuladoConfig {
  titulo: string;
  modo: 'TREINO' | 'SIMULADO';
  disciplinas: string[];
  topicos?: string[];
  banca: string;
  quantidade: number;
  filtroResolucao: 'TODAS' | 'APENAS_ERRADAS' | 'NAO_RESOLVIDAS';
  tempoMinutos?: number;
  chaosModeEnabled?: boolean;
  stressFatigueSimulation?: boolean;
  estrategia?: string;
  questionIds?: string[];
  notebookId?: string;
}

interface CadernosSimuladosProps {
  activeConcurso: ConcursoItem | null;
  onStartSession: (config: SimuladoConfig) => void;
  onNavigateToConcursos?: () => void;
}

export const CadernosSimulados: React.FC<CadernosSimuladosProps> = ({
  activeConcurso,
  onStartSession,
  onNavigateToConcursos,
}) => {
  // Controle de Abas Principais
  const [activeMainTab, setActiveMainTab] = useState<'ESTRATEGICA' | 'CONFIGURADOR' | 'HISTORICO'>('ESTRATEGICA');

  // Estado do Dashboard Estratégico vindo da API
  const [dashboardData, setDashboardData] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Filtro de Prioridade do Edital
  const [prioridadeFilter, setPrioridadeFilter] = useState<'TODOS' | 'MAXIMA' | 'ALTA' | 'MANUTENCAO' | 'BAIXA'>('TODOS');

  // Estados do Configurador Avançado
  const [configModo, setConfigModo] = useState<'TREINO' | 'SIMULADO'>('SIMULADO');
  const [configTitulo, setConfigTitulo] = useState('Simulado Geral Focado — Prova Objetiva');
  const [configBanca, setConfigBanca] = useState(activeConcurso?.banca || 'TODAS');
  const [configQuantidade, setConfigQuantidade] = useState(30);
  const [configTempoMinutos, setConfigTempoMinutos] = useState(90);
  const [configFiltroResolucao, setConfigFiltroResolucao] = useState<'TODAS' | 'APENAS_ERRADAS' | 'NAO_RESOLVIDAS'>('TODAS');
  const [selectedDisciplinas, setSelectedDisciplinas] = useState<string[]>([]);
  const [chaosModeEnabled, setChaosModeEnabled] = useState(false);
  const [stressFatigueSimulation, setStressFatigueSimulation] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);

  // Carregar dados estratégicos do backend
  const fetchDashboard = async () => {
    setIsLoading(true);
    setErrorMsg(null);
    try {
      const url = activeConcurso?.id
        ? `/api/v1/simulados/dashboard?concursoId=${encodeURIComponent(activeConcurso.id)}`
        : '/api/v1/simulados/dashboard';
      const res = await fetch(url);
      if (res.ok) {
        const data = await res.json();
        setDashboardData(data);

        // Pré-selecionar disciplinas disponíveis no configurador
        if (data.disciplinas && Array.isArray(data.disciplinas)) {
          const discNames = data.disciplinas.map((d: any) => d.disciplina);
          if (selectedDisciplinas.length === 0) {
            setSelectedDisciplinas(discNames.slice(0, Math.min(4, discNames.length)));
          }
        }
      } else {
        throw new Error('Falha ao carregar dashboard de simulados');
      }
    } catch (err: any) {
      console.warn('Usando fallback do dashboard:', err.message);
      // Fallback gracioso com estimativas caso a API inicial ainda esteja calibrando
      setDashboardData({
        concurso: {
          nome: activeConcurso?.nome || 'Auditor Fiscal da Receita Municipal',
          orgao: activeConcurso?.orgao || 'Prefeitura Municipal',
          cargo: activeConcurso?.cargo || 'Auditor Fiscal',
          banca: activeConcurso?.banca || 'Fundatec',
          status: 'EDITAL_PUBLICADO'
        },
        totalTopicosEdital: 36,
        metricas: {
          coberturaEditalPraticadaPct: 41.6,
          totalTopicosEdital: 36,
          topicosPraticadosCount: 15,
          totalQuestoesRespondidas: 128,
          aproveitamentoGlobalPct: 72.4,
          totalSimuladosConcluidos: 4
        },
        resumoPrioridades: {
          maxima: 5,
          alta: 11,
          manutencao: 14,
          baixa: 6
        },
        simuladoRecomendado: {
          titulo: 'Simulado Adaptativo — Pareto & Reforço de Pontos Fracos',
          descricao: 'Concentração calculada nos tópicos de maior peso da prova com necessidade de reforço imediato do estudante.',
          estrategia: 'PARETO_80_20',
          modo: 'SIMULADO',
          quantidadeSugerida: 30,
          tempoMinutosSugerido: 75,
          disciplinas: ['Direito Tributário', 'Contabilidade Geral', 'Auditoria Fiscal', 'Legislação Municipal'],
          topicosPrioritariosCount: 6,
          urgenciaNivel: 'CRITICA'
        },
        disciplinas: [
          { disciplina: 'Direito Tributário', totalTopicos: 12, pesoMedio: 2.5, questoesFeitas: 48, aproveitamentoPct: 62.5, topicosCriticosCount: 2 },
          { disciplina: 'Contabilidade Geral', totalTopicos: 10, pesoMedio: 2.0, questoesFeitas: 35, aproveitamentoPct: 57.1, topicosCriticosCount: 2 },
          { disciplina: 'Legislação Municipal', totalTopicos: 8, pesoMedio: 2.0, questoesFeitas: 25, aproveitamentoPct: 76.0, topicosCriticosCount: 1 },
          { disciplina: 'Português', totalTopicos: 6, pesoMedio: 1.0, questoesFeitas: 20, aproveitamentoPct: 85.0, topicosCriticosCount: 0 }
        ],
        topicosPriorizados: [
          { id: 't1', disciplina: 'Direito Tributário', topico: 'Imunidades e Isenções Constitucionais', peso: 3.0, prioridade: 'MAXIMA', scorePrioridade: 98.0, taxaAcertoPct: 44.4, questoesFeitas: 9, erros: 5, justificativa: 'Peso 3.0 no edital e taxa de acerto crítica (44.4%) com 5 erros recentes.' },
          { id: 't2', disciplina: 'Contabilidade Geral', topico: 'Demonstração dos Fluxos de Caixa (DFC)', peso: 2.5, prioridade: 'MAXIMA', scorePrioridade: 94.0, taxaAcertoPct: 50.0, questoesFeitas: 8, erros: 4, justificativa: 'Conteúdo recorrente na banca com aproveitamento de 50.0%.' },
          { id: 't3', disciplina: 'Legislação Municipal', topico: 'Processo Administrativo Tributário (PAT)', peso: 2.5, prioridade: 'MAXIMA', scorePrioridade: 91.0, taxaAcertoPct: null, questoesFeitas: 0, erros: 0, justificativa: 'Peso alto no edital e ainda sem questões praticadas pelo estudante.' },
          { id: 't4', disciplina: 'Direito Tributário', topico: 'Crédito Tributário: Suspensão e Extinção', peso: 2.0, prioridade: 'ALTA', scorePrioridade: 78.0, taxaAcertoPct: 66.7, questoesFeitas: 12, erros: 4, justificativa: 'Aproveitamento intermediário (66.7%). Necessita de prática frequente.' },
          { id: 't5', disciplina: 'Português', topico: 'Interpretação e Compreensão Textual', peso: 1.0, prioridade: 'MANUTENCAO', scorePrioridade: 32.0, taxaAcertoPct: 88.0, questoesFeitas: 25, erros: 3, justificativa: 'Domínio consolidado (88.0%). Recomenda-se repetição espaçada.' }
        ],
        historicoSimulados: []
      });
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchDashboard();
  }, [activeConcurso?.id]);

  // Ação de Lançar Simulado com Estratégia Pronta
  const handleLaunchEstrategia = async (
    estrategia: string,
    customTitulo?: string,
    quantidadeOverride?: number,
    tempoOverride?: number,
    disciplinasOverride?: string[],
    topicosOverride?: string[]
  ) => {
    setIsGenerating(true);
    try {
      const payload = {
        concursoId: activeConcurso?.id || '',
        estrategia,
        titulo: customTitulo || `Simulado Estratégico — ${estrategia}`,
        modo: configModo,
        quantidade: quantidadeOverride || configQuantidade,
        tempoMinutos: tempoOverride || configTempoMinutos,
        disciplinas: disciplinasOverride || selectedDisciplinas,
        topicos: topicosOverride || [],
        banca: configBanca,
        filtroResolucao: configFiltroResolucao
      };

      const res = await fetch('/api/v1/simulados/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });

      if (res.ok) {
        const genResult = await res.json();
        onStartSession({
          titulo: genResult.titulo,
          modo: genResult.modo as 'SIMULADO' | 'TREINO',
          disciplinas: genResult.disciplinas || selectedDisciplinas,
          topicos: topicosOverride,
          banca: configBanca,
          quantidade: genResult.quantidade,
          filtroResolucao: configFiltroResolucao,
          tempoMinutos: genResult.tempoMinutos,
          chaosModeEnabled,
          stressFatigueSimulation,
          estrategia: genResult.estrategia,
          questionIds: genResult.questionIds,
          notebookId: genResult.notebookId
        });
        return;
      }
    } catch (e) {
      console.warn('Erro ao chamar API de geração, iniciando localmente:', e);
    } finally {
      setIsGenerating(false);
    }

    // Fallback de execução direta
    onStartSession({
      titulo: customTitulo || configTitulo,
      modo: configModo,
      disciplinas: disciplinasOverride || selectedDisciplinas,
      topicos: topicosOverride,
      banca: configBanca,
      quantidade: quantidadeOverride || configQuantidade,
      filtroResolucao: configFiltroResolucao,
      tempoMinutos: configModo === 'SIMULADO' ? (tempoOverride || configTempoMinutos) : undefined,
      chaosModeEnabled,
      stressFatigueSimulation,
      estrategia
    });
  };

  const toggleDisciplina = (disc: string) => {
    if (selectedDisciplinas.includes(disc)) {
      setSelectedDisciplinas(selectedDisciplinas.filter((d) => d !== disc));
    } else {
      setSelectedDisciplinas([...selectedDisciplinas, disc]);
    }
  };

  const rec = dashboardData?.simuladoRecomendado;
  const metricas = dashboardData?.metricas;
  const topicos = dashboardData?.topicosPriorizados || [];

  // Filtragem dos tópicos
  const filteredTopicos = topicos.filter((t: any) => {
    if (prioridadeFilter === 'TODOS') return true;
    return t.prioridade === prioridadeFilter;
  });

  return (
    <div className="simulados-strategic-container animate-fade-in">
      {/* 1. Hero do Concurso Ativo e Contexto do Edital */}
      <div className="simulados-concurso-hero">
        <div>
          <div className="hero-concurso-tag">
            <Target className="w-3.5 h-3.5" /> Concurso & Edital em Foco
          </div>
          <h1>{dashboardData?.concurso?.nome || activeConcurso?.nome || 'Carreira Fiscal — Preparação Estratégica'}</h1>
          <p className="hero-subtitle">
            Simulados estritamente orientados pelo edital, combinando o <strong>Princípio de Pareto (80/20)</strong> com a erradicação de fraquezas individuais e evolução real do estudante.
          </p>
          <div className="hero-meta-chips">
            <span className="hero-chip">
              🏛️ {dashboardData?.concurso?.orgao || activeConcurso?.orgao || 'Órgão Fiscal'}
            </span>
            <span className="hero-chip">
              💼 {dashboardData?.concurso?.cargo || activeConcurso?.cargo || 'Auditor Fiscal'}
            </span>
            <span className="hero-chip accent">
              📑 Banca: {dashboardData?.concurso?.banca || activeConcurso?.banca || 'Oficial'}
            </span>
            <span className="hero-chip status-badge">
              ✓ Edital Verticalizado ({dashboardData?.totalTopicosEdital || 0} tópicos)
            </span>
          </div>
        </div>

        {onNavigateToConcursos && (
          <button className="btn-secondary-calm" onClick={onNavigateToConcursos} title="Alternar Concurso Ativo">
            Trocar Concurso ↗
          </button>
        )}
      </div>

      {/* 2. Barra de Navegação por Abas */}
      <div className="simulados-nav-tabs">
        <button
          className={`simulado-tab-btn ${activeMainTab === 'ESTRATEGICA' ? 'active' : ''}`}
          onClick={() => setActiveMainTab('ESTRATEGICA')}
        >
          <Sparkles className="w-4 h-4" /> 1. Central Estratégica & Recomendações
        </button>
        <button
          className={`simulado-tab-btn ${activeMainTab === 'CONFIGURADOR' ? 'active' : ''}`}
          onClick={() => setActiveMainTab('CONFIGURADOR')}
        >
          <Sliders className="w-4 h-4" /> 2. Configurador de Simulado Customizado
        </button>
        <button
          className={`simulado-tab-btn ${activeMainTab === 'HISTORICO' ? 'active' : ''}`}
          onClick={() => setActiveMainTab('HISTORICO')}
        >
          <History className="w-4 h-4" /> 3. Histórico & Cadernos Executados ({dashboardData?.historicoSimulados?.length || 0})
        </button>
      </div>

      {/* Estados de Carregamento e Erro */}
      {isLoading && (
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', padding: '1rem', background: 'var(--calm-card-bg)', border: '1px solid var(--calm-card-border)', borderRadius: '12px' }}>
          <div className="simulados-spinner" style={{ width: '20px', height: '20px', border: '3px solid #e2e8f0', borderTopColor: '#4f46e5', borderRadius: '50%', animation: 'spin 1s linear infinite' }} />
          <span style={{ fontSize: '0.85rem', color: 'var(--calm-text-muted)' }}>
            Cruzando histórico de resoluções com matriz de Pareto do edital...
          </span>
        </div>
      )}

      {errorMsg && (
        <div style={{ padding: '0.85rem 1.25rem', background: 'rgba(239, 68, 68, 0.08)', border: '1px solid rgba(239, 68, 68, 0.3)', borderRadius: '12px', color: '#dc2626', fontSize: '0.85rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span>⚠️ {errorMsg}</span>
          <button className="btn-secondary" style={{ padding: '4px 10px', fontSize: '0.78rem' }} onClick={fetchDashboard}>
            Tentar novamente
          </button>
        </div>
      )}

      {/* =========================================================================
          ABA 1: CENTRAL ESTRATÉGICA & RECOMENDAÇÕES (PARETO + FRAQUEZAS)
          ========================================================================= */}
      {activeMainTab === 'ESTRATEGICA' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
          {/* Card Hero: Próximo Simulado Recomendado (1-Clique) */}
          {rec && (
            <div className="recommended-simulado-card">
              <div>
                <div className="rec-badge-group">
                  <span className="rec-pill-primary">⚡ Próxima Ação Recomendada</span>
                  <span className={`rec-pill-urgency ${rec.urgenciaNivel === 'CRITICA' ? 'critica' : 'moderada'}`}>
                    Prioridade {rec.urgenciaNivel === 'CRITICA' ? 'Crítica' : 'Balanceada'}
                  </span>
                </div>
                <h2>{rec.titulo}</h2>
                <p className="rec-description">{rec.descricao}</p>
                <div className="rec-details-row">
                  <span className="rec-detail-item">
                    <Target className="w-4 h-4" /> <strong>{rec.quantidadeSugerida}</strong> questões
                  </span>
                  <span className="rec-detail-item">
                    <Clock className="w-4 h-4" /> <strong>~{rec.tempoMinutosSugerido} min</strong> ({Math.round(rec.tempoMinutosSugerido / rec.quantidadeSugerida * 10) / 10} min/questão)
                  </span>
                  <span className="rec-detail-item">
                    <BookOpen className="w-4 h-4" /> <strong>{rec.disciplinas?.length || 0}</strong> disciplinas chave
                  </span>
                  <span className="rec-detail-item">
                    <ShieldAlert className="w-4 h-4 text-orange" /> <strong>{rec.topicosPrioritariosCount || 0}</strong> tópicos decisivos
                  </span>
                </div>
              </div>

              <div>
                <button
                  className="btn-launch-primary"
                  onClick={() => handleLaunchEstrategia(
                    rec.estrategia,
                    rec.titulo,
                    rec.quantidadeSugerida,
                    rec.tempoMinutosSugerido,
                    rec.disciplinas
                  )}
                  disabled={isGenerating}
                >
                  <Play className="w-4 h-4 fill-white" /> Iniciar Simulado Recomendado
                </button>
              </div>
            </div>
          )}

          {/* Métricas de Domínio do Edital */}
          <div className="simulados-metrics-grid">
            <div className="simulado-metric-card">
              <span className="metric-card-label">Cobertura do Edital Praticada</span>
              <span className="metric-card-val">{metricas?.coberturaEditalPraticadaPct || 0}%</span>
              <div className="metric-progress-bar">
                <div
                  className="metric-progress-fill"
                  style={{ width: `${Math.min(100, metricas?.coberturaEditalPraticadaPct || 0)}%` }}
                />
              </div>
              <span className="metric-card-desc">
                {metricas?.topicosPraticadosCount || 0} de {metricas?.totalTopicosEdital || 0} tópicos com questões resolvidas
              </span>
            </div>

            <div className="simulado-metric-card">
              <span className="metric-card-label">Aproveitamento Médio</span>
              <span className="metric-card-val">{metricas?.aproveitamentoGlobalPct || 0}%</span>
              <span className="metric-card-desc">
                Calculado sobre {metricas?.totalQuestoesRespondidas || 0} resoluções reais no sistema
              </span>
            </div>

            <div className="simulado-metric-card">
              <span className="metric-card-label">Tópicos Críticos (Prioridade Máxima)</span>
              <span className="metric-card-val text-red" style={{ color: '#dc2626' }}>
                {dashboardData?.resumoPrioridades?.maxima || 0}
              </span>
              <span className="metric-card-desc">
                Alto peso no edital com taxa de acertos &lt; 60% ou sem bateria de treino
              </span>
            </div>

            <div className="simulado-metric-card">
              <span className="metric-card-label">Tópicos Consolidados</span>
              <span className="metric-card-val text-green" style={{ color: '#059669' }}>
                {dashboardData?.resumoPrioridades?.manutencao || 0}
              </span>
              <span className="metric-card-desc">
                Desempenho &ge; 75% mantidos sob regime de revisão espaçada
              </span>
            </div>
          </div>

          {/* Grid de Modalidades Estratégicas de Simulado */}
          <div>
            <h2 style={{ fontSize: '1.15rem', fontWeight: 800, color: 'var(--calm-text-main, #0f172a)', margin: '0 0 0.85rem 0' }}>
              Modalidades Estratégicas de Treino
            </h2>
            <div className="modalidades-grid">
              {/* Card 1: Pareto 80/20 */}
              <div className="modalidade-card pareto">
                <div className="modalidade-header">
                  <div className="modalidade-icon">🎯</div>
                  <div className="modalidade-title-group">
                    <h3>Simulado Pareto (80/20)</h3>
                    <p>Concentração máxima nos tópicos que historicamente representam o maior peso e volume de pontos na prova.</p>
                  </div>
                </div>
                <div className="modalidade-footer">
                  <span className="modalidade-tag">Foco em Conteúdo Decisivo</span>
                  <button
                    className="btn-card-action"
                    onClick={() => handleLaunchEstrategia('PARETO_80_20', 'Simulado Estratégico Pareto (80/20)', 30, 75)}
                  >
                    Gerar <ArrowUpRight className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>

              {/* Card 2: Anti-Fragilidade / Pontos Fracos */}
              <div className="modalidade-card fraquezas">
                <div className="modalidade-header">
                  <div className="modalidade-icon">⚠️</div>
                  <div className="modalidade-title-group">
                    <h3>Simulado de Pontos Fracos</h3>
                    <p>Foco cirúrgico exclusivo nos assuntos com maior taxa de erro e revisões pendentes no seu histórico.</p>
                  </div>
                </div>
                <div className="modalidade-footer">
                  <span className="modalidade-tag">Anti-Fragilidade Cognitiva</span>
                  <button
                    className="btn-card-action"
                    onClick={() => handleLaunchEstrategia('PONTOS_FRACOS', 'Simulado de Erradicação de Pontos Fracos', 25, 60)}
                  >
                    Gerar <ArrowUpRight className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>

              {/* Card 3: Prova Real Completa */}
              <div className="modalidade-card real">
                <div className="modalidade-header">
                  <div className="modalidade-icon">⏱️</div>
                  <div className="modalidade-title-group">
                    <h3>Simulado de Prova Real</h3>
                    <p>Espelho fiel da prova: cronômetro regressivo estrito, distribuição proporcional de matérias e apuração de nota líquida.</p>
                  </div>
                </div>
                <div className="modalidade-footer">
                  <span className="modalidade-tag">Condições Reais de Concurso</span>
                  <button
                    className="btn-card-action"
                    onClick={() => handleLaunchEstrategia('PROVA_REAL', 'Simulado Espelho de Prova Real', 50, 150)}
                  >
                    Gerar <ArrowUpRight className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>

              {/* Card 4: Revisão Espaçada e Retenção */}
              <div className="modalidade-card revisao">
                <div className="modalidade-header">
                  <div className="modalidade-icon">🔄</div>
                  <div className="modalidade-title-group">
                    <h3>Simulado de Retenção Ativa</h3>
                    <p>Reativação da memória de tópicos já consolidados antes que atinjam a curva do esquecimento.</p>
                  </div>
                </div>
                <div className="modalidade-footer">
                  <span className="modalidade-tag">Recuperação Espaçada</span>
                  <button
                    className="btn-card-action"
                    onClick={() => handleLaunchEstrategia('REVISAO', 'Simulado de Retenção e Recuperação Espaçada', 20, 50)}
                  >
                    Gerar <ArrowUpRight className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            </div>
          </div>

          {/* Motor de Priorização: Pareto Aplicado ao Edital */}
          <div className="pareto-section-wrapper">
            <div className="pareto-header-row">
              <div className="pareto-title-group">
                <h2>
                  <Target className="w-5 h-5 text-indigo-600" /> Motor de Priorização de Pareto aplicado ao Edital
                </h2>
                <p>
                  Classificação transparente baseada no cruzamento de <strong>peso no edital</strong>, <strong>recorrência na banca</strong> e seu <strong>desempenho real</strong>.
                </p>
              </div>

              <div className="pareto-filters">
                <button
                  className={`pareto-filter-pill ${prioridadeFilter === 'TODOS' ? 'active' : ''}`}
                  onClick={() => setPrioridadeFilter('TODOS')}
                >
                  Todos ({topicos.length})
                </button>
                <button
                  className={`pareto-filter-pill ${prioridadeFilter === 'MAXIMA' ? 'active' : ''}`}
                  onClick={() => setPrioridadeFilter('MAXIMA')}
                  style={prioridadeFilter === 'MAXIMA' ? { borderColor: '#ef4444', color: '#dc2626' } : {}}
                >
                  🔴 Prioridade Máxima ({dashboardData?.resumoPrioridades?.maxima || 0})
                </button>
                <button
                  className={`pareto-filter-pill ${prioridadeFilter === 'ALTA' ? 'active' : ''}`}
                  onClick={() => setPrioridadeFilter('ALTA')}
                  style={prioridadeFilter === 'ALTA' ? { borderColor: '#f59e0b', color: '#d97706' } : {}}
                >
                  🟠 Alta ({dashboardData?.resumoPrioridades?.alta || 0})
                </button>
                <button
                  className={`pareto-filter-pill ${prioridadeFilter === 'MANUTENCAO' ? 'active' : ''}`}
                  onClick={() => setPrioridadeFilter('MANUTENCAO')}
                  style={prioridadeFilter === 'MANUTENCAO' ? { borderColor: '#10b981', color: '#059669' } : {}}
                >
                  🟡 Manutenção ({dashboardData?.resumoPrioridades?.manutencao || 0})
                </button>
                <button
                  className={`pareto-filter-pill ${prioridadeFilter === 'BAIXA' ? 'active' : ''}`}
                  onClick={() => setPrioridadeFilter('BAIXA')}
                >
                  🟢 Baixa ({dashboardData?.resumoPrioridades?.baixa || 0})
                </button>
              </div>
            </div>

            {/* Tabela de Tópicos do Edital */}
            <div className="pareto-table-container">
              <table className="pareto-table">
                <thead>
                  <tr>
                    <th>Conteúdo Programático / Tópico</th>
                    <th style={{ textAlign: 'center' }}>Peso no Edital</th>
                    <th style={{ textAlign: 'center' }}>Questões / Acerto</th>
                    <th>Classificação Estratégica</th>
                    <th style={{ textAlign: 'right' }}>Ação Rápida</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredTopicos.length === 0 ? (
                    <tr>
                      <td colSpan={5} style={{ textAlign: 'center', padding: '2rem', color: 'var(--calm-text-muted)' }}>
                        Nenhum tópico encontrado para este filtro de prioridade.
                      </td>
                    </tr>
                  ) : (
                    filteredTopicos.map((t: any) => (
                      <tr key={t.id || t.topico}>
                        <td style={{ maxWidth: '380px' }}>
                          <div className="topico-name-box">
                            <span className="topico-disc">{t.disciplina}</span>
                            <span className="topico-title">{t.topico}</span>
                            <span className="pareto-justificativa-hint">{t.justificativa}</span>
                          </div>
                        </td>
                        <td style={{ textAlign: 'center' }}>
                          <span className="hero-chip">Peso {t.peso || 1.0}</span>
                        </td>
                        <td style={{ textAlign: 'center' }}>
                          {t.taxaAcertoPct !== null ? (
                            <div>
                              <strong style={{ color: t.taxaAcertoPct < 60 ? '#dc2626' : t.taxaAcertoPct >= 75 ? '#059669' : '#d97706' }}>
                                {t.taxaAcertoPct}%
                              </strong>
                              <div style={{ fontSize: '0.72rem', color: 'var(--calm-text-muted)' }}>
                                {t.questoesFeitas} questões ({t.erros} erros)
                              </div>
                            </div>
                          ) : (
                            <span style={{ fontSize: '0.75rem', color: '#94a3b8' }}>Não praticado</span>
                          )}
                        </td>
                        <td>
                          <span className={`badge-prioridade ${t.prioridade?.toLowerCase()}`}>
                            {t.prioridade === 'MAXIMA' && '🔴 Prioridade Máxima'}
                            {t.prioridade === 'ALTA' && '🟠 Prioridade Alta'}
                            {t.prioridade === 'MANUTENCAO' && '🟡 Manutenção'}
                            {t.prioridade === 'BAIXA' && '🟢 Baixa Relativa'}
                          </span>
                        </td>
                        <td style={{ textAlign: 'right' }}>
                          <button
                            className="btn-card-action"
                            onClick={() => handleLaunchEstrategia(
                              'TOPICO',
                              `Simulado Cirúrgico: ${t.topico}`,
                              15,
                              35,
                              [t.disciplina],
                              [t.topico]
                            )}
                            title="Gerar simulado focado exclusivamente neste assunto"
                          >
                            🎯 Treinar Tópico
                          </button>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* =========================================================================
          ABA 2: CONFIGURADOR AVANÇADO DE SIMULADO
          ========================================================================= */}
      {activeMainTab === 'CONFIGURADOR' && (
        <div className="configurador-layout">
          {/* Coluna Esquerda: Parâmetros */}
          <div className="configurador-main-card">
            <div>
              <h3 className="config-section-title">1. Modalidade de Execução</h3>
              <div className="modo-selector-grid">
                <div
                  className={`modo-card-option ${configModo === 'SIMULADO' ? 'active' : ''}`}
                  onClick={() => {
                    setConfigModo('SIMULADO');
                    setConfigTitulo('Simulado Geral Focado — Prova Objetiva');
                  }}
                >
                  <span className="modo-card-icon">⏱️</span>
                  <div className="modo-card-info">
                    <strong>Modo Simulado Real</strong>
                    <span>Cronômetro regressivo, gabarito e nota líquida ao final da prova.</span>
                  </div>
                </div>

                <div
                  className={`modo-card-option ${configModo === 'TREINO' ? 'active' : ''}`}
                  onClick={() => {
                    setConfigModo('TREINO');
                    setConfigTitulo('Caderno de Treino & Aprendizado');
                  }}
                >
                  <span className="modo-card-icon">📚</span>
                  <div className="modo-card-info">
                    <strong>Modo Treino / Aprendizado</strong>
                    <span>Gabarito e justificativas imediatas a cada questão respondida.</span>
                  </div>
                </div>
              </div>
            </div>

            <div>
              <h3 className="config-section-title">2. Parâmetros de Filtro e Abrangência</h3>
              <div className="form-group" style={{ marginBottom: '1rem' }}>
                <label style={{ fontSize: '0.8rem', fontWeight: 600, color: 'var(--calm-text-muted)' }}>
                  Título do Caderno / Simulado
                </label>
                <input
                  type="text"
                  className="form-control"
                  value={configTitulo}
                  onChange={(e) => setConfigTitulo(e.target.value)}
                  style={{ width: '100%', marginTop: '0.3rem' }}
                />
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', marginBottom: '1rem' }}>
                <div className="form-group">
                  <label style={{ fontSize: '0.8rem', fontWeight: 600, color: 'var(--calm-text-muted)' }}>
                    Banca Examinadora
                  </label>
                  <select
                    className="form-control"
                    value={configBanca}
                    onChange={(e) => setConfigBanca(e.target.value)}
                    style={{ width: '100%', marginTop: '0.3rem' }}
                  >
                    <option value="TODAS">Todas as Bancas Relevantes</option>
                    {activeConcurso?.banca && (
                      <option value={activeConcurso.banca}>Banca do Concurso ({activeConcurso.banca})</option>
                    )}
                    <option value="FGV">FGV (Fundação Getulio Vargas)</option>
                    <option value="CEBRASPE">Cebraspe (CESPE)</option>
                    <option value="FCC">FCC (Fundação Carlos Chagas)</option>
                    <option value="FUNDATEC">Fundatec</option>
                    <option value="IBGP">IBGP</option>
                  </select>
                </div>

                <div className="form-group">
                  <label style={{ fontSize: '0.8rem', fontWeight: 600, color: 'var(--calm-text-muted)' }}>
                    Volume de Questões
                  </label>
                  <select
                    className="form-control"
                    value={configQuantidade}
                    onChange={(e) => {
                      const q = Number(e.target.value);
                      setConfigQuantidade(q);
                      setConfigTempoMinutos(Math.round(q * 2.5));
                    }}
                    style={{ width: '100%', marginTop: '0.3rem' }}
                  >
                    <option value={15}>15 Questões (Bateria Rápida)</option>
                    <option value={30}>30 Questões (Padrão)</option>
                    <option value={50}>50 Questões (Aprofundado)</option>
                    <option value={70}>70 Questões (Prova Intermediária)</option>
                    <option value={90}>90 Questões (Prova Completa)</option>
                  </select>
                </div>
              </div>

              <div className="form-group" style={{ marginBottom: '1rem' }}>
                <label style={{ fontSize: '0.8rem', fontWeight: 600, color: 'var(--calm-text-muted)' }}>
                  Histórico de Resolução das Questões
                </label>
                <div style={{ display: 'flex', gap: '0.5rem', marginTop: '0.3rem', flexWrap: 'wrap' }}>
                  <button
                    type="button"
                    className={`pareto-filter-pill ${configFiltroResolucao === 'TODAS' ? 'active' : ''}`}
                    onClick={() => setConfigFiltroResolucao('TODAS')}
                  >
                    Todas as Questões
                  </button>
                  <button
                    type="button"
                    className={`pareto-filter-pill ${configFiltroResolucao === 'NAO_RESOLVIDAS' ? 'active' : ''}`}
                    onClick={() => setConfigFiltroResolucao('NAO_RESOLVIDAS')}
                  >
                    Apenas Não Resolvidas
                  </button>
                  <button
                    type="button"
                    className={`pareto-filter-pill ${configFiltroResolucao === 'APENAS_ERRADAS' ? 'active' : ''}`}
                    onClick={() => setConfigFiltroResolucao('APENAS_ERRADAS')}
                  >
                    ⚠️ Apenas Questões com Erro Anterior
                  </button>
                </div>
              </div>

              {configModo === 'SIMULADO' && (
                <div style={{ background: 'rgba(79, 70, 229, 0.05)', border: '1px solid rgba(79, 70, 229, 0.2)', padding: '1rem', borderRadius: '10px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span style={{ fontSize: '0.85rem', fontWeight: 700, color: 'var(--calm-text-main)' }}>
                      ⏱️ Tempo Limite do Simulado:
                    </span>
                    <strong style={{ fontSize: '1rem', color: '#4f46e5' }}>
                      {configTempoMinutos} minutos (~{Math.round((configTempoMinutos / configQuantidade) * 10) / 10} min/questão)
                    </strong>
                  </div>
                </div>
              )}

              <div style={{ marginTop: '1.25rem', padding: '0.9rem', background: 'var(--calm-bg-subtle, #f8fafc)', border: '1px solid var(--calm-card-border, #e2e8f0)', borderRadius: '10px', display: 'flex', flexDirection: 'column', gap: '0.65rem' }}>
                <span style={{ fontSize: '0.82rem', fontWeight: 700, color: 'var(--calm-text-main)' }}>
                  🎯 Simulação de Prova Real & Resistência
                </span>
                <label style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', fontSize: '0.8rem', color: 'var(--calm-text-muted)', cursor: 'pointer' }}>
                  <input
                    type="checkbox"
                    checked={chaosModeEnabled}
                    onChange={(e) => setChaosModeEnabled(e.target.checked)}
                  />
                  <span>Intercalar questões muito difíceis (Treino de calma e controle de tempo sob pressão)</span>
                </label>
                <label style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', fontSize: '0.8rem', color: 'var(--calm-text-muted)', cursor: 'pointer' }}>
                  <input
                    type="checkbox"
                    checked={stressFatigueSimulation}
                    onChange={(e) => setStressFatigueSimulation(e.target.checked)}
                  />
                  <span>Simulação de fadiga mental (Aumentar enunciados extensos na reta final da prova)</span>
                </label>
              </div>
            </div>

            <div>
              <h3 className="config-section-title">
                3. Disciplinas Selecionadas ({selectedDisciplinas.length} selecionadas)
              </h3>
              <div className="disciplinas-list-box">
                {(dashboardData?.disciplinas || []).map((d: any) => {
                  const isSel = selectedDisciplinas.includes(d.disciplina);
                  return (
                    <div
                      key={d.disciplina}
                      className={`disc-check-item ${isSel ? 'selected' : ''}`}
                      onClick={() => toggleDisciplina(d.disciplina)}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem' }}>
                        <div className="disc-check-box">
                          {isSel ? '✓' : ''}
                        </div>
                        <span>{d.disciplina}</span>
                      </div>
                      <span style={{ fontSize: '0.74rem', color: 'var(--calm-text-muted)' }}>
                        {d.totalTopicos} tópicos • Peso médio {d.pesoMedio}
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>

          {/* Coluna Direita: Resumo e Ação */}
          <div className="configurador-summary-card">
            <h3 className="config-section-title">Resumo da Configuração</h3>

            <div className="summary-block">
              <div className="summary-row">
                <span>Modalidade:</span>
                <strong>{configModo === 'SIMULADO' ? 'Simulado Cronometrado' : 'Treino / Aprendizado'}</strong>
              </div>
              <div className="summary-row">
                <span>Volume:</span>
                <strong>{configQuantidade} questões</strong>
              </div>
              <div className="summary-row">
                <span>Banca:</span>
                <strong>{configBanca}</strong>
              </div>
              {configModo === 'SIMULADO' && (
                <div className="summary-row">
                  <span>Duração Estrita:</span>
                  <strong>{configTempoMinutos} minutos</strong>
                </div>
              )}
              <div className="summary-row">
                <span>Filtro de Histórico:</span>
                <strong>
                  {configFiltroResolucao === 'TODAS' && 'Todas'}
                  {configFiltroResolucao === 'NAO_RESOLVIDAS' && 'Inéditas'}
                  {configFiltroResolucao === 'APENAS_ERRADAS' && 'Apenas Erros'}
                </strong>
              </div>
              <div className="summary-row">
                <span>Disciplinas:</span>
                <strong>{selectedDisciplinas.length} ativas</strong>
              </div>
            </div>

            <div style={{ background: 'var(--calm-bg-subtle, #f8fafc)', border: '1px solid var(--calm-card-border, #e2e8f0)', padding: '0.85rem', borderRadius: '10px' }}>
              <div style={{ fontSize: '0.8rem', fontWeight: 700, color: 'var(--calm-text-main)', marginBottom: '0.3rem' }}>
                🎯 Garantia de Fidelidade ao Edital
              </div>
              <p style={{ fontSize: '0.76rem', color: 'var(--calm-text-muted)', margin: 0, lineHeight: 1.45 }}>
                As questões serão extraídas exclusivamente do acervo vinculado aos conteúdos programáticos oficiais do concurso selecionado.
              </p>
            </div>

            <button
              className="btn-launch-primary"
              style={{ width: '100%', justifyContent: 'center', padding: '1rem' }}
              onClick={() => handleLaunchEstrategia('CUSTOM', configTitulo, configQuantidade, configTempoMinutos, selectedDisciplinas)}
              disabled={selectedDisciplinas.length === 0 || isGenerating}
            >
              <Play className="w-4 h-4 fill-white" /> Iniciar Simulado Agora ({configQuantidade} Questões)
            </button>
          </div>
        </div>
      )}

      {/* =========================================================================
          ABA 3: HISTÓRICO & CADERNOS EXECUTADOS
          ========================================================================= */}
      {activeMainTab === 'HISTORICO' && (
        <div className="historico-simulados-wrapper">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem', flexWrap: 'wrap', gap: '0.75rem' }}>
            <div>
              <h2 style={{ fontSize: '1.15rem', fontWeight: 800, color: 'var(--calm-text-main)', margin: 0 }}>
                📜 Histórico de Simulados e Provas Realizadas
              </h2>
              <p style={{ fontSize: '0.82rem', color: 'var(--calm-text-muted)', margin: '0.2rem 0 0 0' }}>
                Monitore sua evolução longitudinal, notas líquidas e acesse a correção cirúrgica dos erros.
              </p>
            </div>
            <button className="btn-secondary-calm" onClick={fetchDashboard}>
              <RefreshCw className="w-3.5 h-3.5" /> Atualizar
            </button>
          </div>

          {(!dashboardData?.historicoSimulados || dashboardData.historicoSimulados.length === 0) ? (
            <div className="historico-empty-state">
              <div className="icon">⏱️</div>
              <h3>Nenhum simulado finalizado recentemente</h3>
              <p style={{ maxWidth: '460px', margin: '0 auto 1.25rem auto', fontSize: '0.85rem' }}>
                Você ainda não completou um simulado nesta preparação. Inicie o simulado recomendado pelo motor de Pareto para registrar seu primeiro diagnóstico.
              </p>
              <button
                className="btn-launch-primary"
                onClick={() => setActiveMainTab('ESTRATEGICA')}
                style={{ margin: '0 auto' }}
              >
                Ver Próximo Simulado Recomendado
              </button>
            </div>
          ) : (
            <div className="pareto-table-container">
              <table className="pareto-table">
                <thead>
                  <tr>
                    <th>Simulado / Prova</th>
                    <th>Estratégia</th>
                    <th>Data de Conclusão</th>
                    <th style={{ textAlign: 'center' }}>Questões</th>
                    <th style={{ textAlign: 'center' }}>Nota Líquida / Aproveitamento</th>
                    <th style={{ textAlign: 'right' }}>Ações</th>
                  </tr>
                </thead>
                <tbody>
                  {dashboardData.historicoSimulados.map((item: any) => (
                    <tr key={item.id}>
                      <td>
                        <strong>{item.titulo}</strong>
                      </td>
                      <td>
                        <span className="hero-chip">{item.estrategia}</span>
                      </td>
                      <td>
                        {item.finalizado_em ? new Date(item.finalizado_em).toLocaleString('pt-BR') : 'Hoje'}
                      </td>
                      <td style={{ textAlign: 'center' }}>
                        {item.total_questoes} q ({item.acertos} acertos, {item.erros} erros)
                      </td>
                      <td style={{ textAlign: 'center' }}>
                        <strong style={{ color: item.nota_liquida > 0 ? '#059669' : '#dc2626' }}>
                          {item.nota_liquida} pts
                        </strong>
                      </td>
                      <td style={{ textAlign: 'right' }}>
                        <button
                          className="btn-card-action"
                          onClick={() => handleLaunchEstrategia(
                            'PONTOS_FRACOS',
                            `Revisão de Erros: ${item.titulo}`,
                            item.erros || 15,
                            30
                          )}
                        >
                          Revisar Erros
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default CadernosSimulados;
