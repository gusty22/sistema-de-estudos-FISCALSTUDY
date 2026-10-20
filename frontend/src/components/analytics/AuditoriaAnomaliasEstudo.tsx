import React, { useState, useEffect } from 'react';
import {
  ShieldAlert,
  AlertTriangle,
  CheckCircle2,
  BookOpen,
  ArrowRight,
  RotateCw,
  Coffee,
  Sparkles,
  Info,
  Layers,
  Zap,
  BarChart2
} from 'lucide-react';
import './AuditoriaAnomaliasEstudo.css';

export interface AnomalyItem {
  type: 'EXCESSO_TEORIA_PASSIVA' | 'ESTAGNACAO_VERTICAL' | 'FADIGA_QUEDA_RENDIMENTO';
  severity: 'CRITICA' | 'ALTA' | 'MODERADA';
  title: string;
  description: string;
  metricEvidence: string;
  recommendedAction: string;
  detectedAt: string;
}

export interface AuditMetrics {
  weeklyTotalStudySeconds: number;
  weeklyPassiveTheorySeconds: number;
  weeklyQuestionsSeconds: number;
  weeklyOtherSeconds: number;
  weeklyTheoryPercentage: number;
  weeklyQuestionsPercentage: number;
  currentSubject: string | null;
  daysOnCurrentSubject: number;
  activeContinuousSeconds: number;
  totalSubjectsInEdital: number;
  neglectedSubjectsCount: number;
  neglectedSubjects: string[];
}

export interface StudyAnomalyReport {
  concursoId: string;
  auditedAt: string;
  metrics: AuditMetrics;
  anomalies: AnomalyItem[];
  totalAnomalies: number;
  systemHealthStatus: 'ESTUDO_CALIBRADO' | 'ATENCAO_CRITICA';
}

export interface AuditoriaAnomaliasEstudoProps {
  concursoId?: string;
  onNavigateToStudy?: (disciplina?: string, assunto?: string) => void;
  onNavigateToCycle?: () => void;
  onNavigateToQuestions?: () => void;
}

export const AuditoriaAnomaliasEstudo: React.FC<AuditoriaAnomaliasEstudoProps> = ({
  concursoId,
  onNavigateToStudy,
  onNavigateToCycle,
  onNavigateToQuestions
}) => {
  const [report, setReport] = useState<StudyAnomalyReport | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [actionFeedback, setActionFeedback] = useState<string | null>(null);

  const loadAuditReport = () => {
    setIsLoading(true);
    fetch(`/api/v1/analytics/study-anomalies?concursoId=${encodeURIComponent(concursoId || '')}`)
      .then((res) => (res.ok ? res.json() : null))
      .then((data: StudyAnomalyReport | null) => {
        if (data) {
          setReport(data);
        }
      })
      .catch((err) => console.warn('Erro ao carregar auditoria de anomalias:', err))
      .finally(() => setIsLoading(false));
  };

  useEffect(() => {
    loadAuditReport();
  }, [concursoId]);

  const metrics = report?.metrics || {
    weeklyTotalStudySeconds: 0,
    weeklyPassiveTheorySeconds: 0,
    weeklyQuestionsSeconds: 0,
    weeklyOtherSeconds: 0,
    weeklyTheoryPercentage: 0,
    weeklyQuestionsPercentage: 0,
    currentSubject: null,
    daysOnCurrentSubject: 0,
    activeContinuousSeconds: 0,
    totalSubjectsInEdital: 0,
    neglectedSubjectsCount: 0,
    neglectedSubjects: []
  };

  const anomalies = report?.anomalies || [];
  const isHealthy = report?.systemHealthStatus === 'ESTUDO_CALIBRADO' && anomalies.length === 0;

  const hasPassiveAnomaly = anomalies.some((a) => a.type === 'EXCESSO_TEORIA_PASSIVA');
  const hasStagnationAnomaly = anomalies.some((a) => a.type === 'ESTAGNACAO_VERTICAL');
  const hasFatigueAnomaly = anomalies.some((a) => a.type === 'FADIGA_QUEDA_RENDIMENTO');

  const formatHours = (seconds: number) => {
    const h = (seconds / 3600).toFixed(1);
    return `${h}h`;
  };

  const handleAction = (message: string, callback?: () => void) => {
    setActionFeedback(message);
    setTimeout(() => setActionFeedback(null), 4500);
    if (callback) callback();
  };

  return (
    <div className="anomalias-audit-container animate-fade-in">
      {/* 1. TOPO: STATUS GERAL DA AUDITORIA AUTOMÁTICA */}
      <section className={`audit-hero-card ${isHealthy ? 'healthy' : 'warning'}`}>
        <div className="hero-status-content">
          <div className="hero-badge-row">
            <span className={`status-pill ${isHealthy ? 'pill-healthy' : 'pill-critical'}`}>
              {isHealthy ? (
                <>
                  <CheckCircle2 className="w-3.5 h-3.5 inline mr-1 text-emerald-400" />
                  CICLO EM CONFORMIDADE AUDITADA
                </>
              ) : (
                <>
                  <ShieldAlert className="w-3.5 h-3.5 inline mr-1 text-rose-400" />
                  {anomalies.length} ANOMALIA(S) DETECTADA(S) NOS LOGS
                </>
              )}
            </span>
            <span className="audit-source-tag">
              <Zap className="w-3 h-3 text-amber-400" />
              Diagnóstico Inteligente Baseado na Rotina Real
            </span>
          </div>

          <h2 className="hero-audit-title">
            {isHealthy
              ? 'Execução de Estudos sem Anomalias Críticas'
              : 'Desvios de Execução Detectados nos Registros Reais'}
          </h2>

          <p className="hero-audit-desc">
            Em vez de preencher formulários subjetivos da antiga <em>Planilha de Diagnóstico de 8 Áreas</em>, o
            sistema monitora continuamente seus logs de estudo, detectando instantaneamente excesso de teoria passiva,
            estagnação vertical monomaníaca e fadiga cognitiva sem pausas.
          </p>

          <div className="hero-meta-row">
            <span>Última checagem: {report ? new Date(report.auditedAt).toLocaleTimeString('pt-BR') : 'Carregando...'}</span>
            <span>•</span>
            <span>Janela semanal analisada: {formatHours(metrics.weeklyTotalStudySeconds)} de estudo líquido</span>
          </div>
        </div>

        <button className="btn-refresh-audit" onClick={loadAuditReport} disabled={isLoading}>
          <RotateCw className={`w-4 h-4 ${isLoading ? 'animate-spin' : ''}`} />
          {isLoading ? 'Auditando...' : 'Reauditar Logs'}
        </button>
      </section>

      {/* FEEDBACK DE AÇÃO PREVENTIVA */}
      {actionFeedback && (
        <div className="action-feedback-toast animate-fade-in">
          <Sparkles className="w-4 h-4 text-emerald-400 inline mr-2" />
          {actionFeedback}
        </div>
      )}

      {/* 2. OS 3 MONITORES AUTOMÁTICOS (CARDS PRINCIPAIS) */}
      <div className="audit-monitors-grid">
        {/* MONITOR 1: EXCESSO DE TEORIA PASSIVA */}
        <div className={`monitor-card ${hasPassiveAnomaly ? 'monitor-danger' : 'monitor-ok'}`}>
          <div className="monitor-header">
            <div className="monitor-icon-box theory">
              <BookOpen className="w-5 h-5 text-indigo-400" />
            </div>
            <div className="monitor-title-box">
              <span className="monitor-category">Monitor 1 • Equilíbrio Teoria x Prática</span>
              <h3 className="monitor-name">Teoria Passiva vs Questões</h3>
            </div>
            <span className={`monitor-status-badge ${hasPassiveAnomaly ? 'badge-alert' : 'badge-ok'}`}>
              {hasPassiveAnomaly ? 'Alerta Crítico' : 'Equilibrado'}
            </span>
          </div>

          <p className="monitor-description">
            Regra auditada: Tempo em PDF/Vídeo não pode exceder <strong>60%</strong> da semana com Questões abaixo de <strong>20%</strong>.
          </p>

          <div className="ratio-meters">
            <div className="meter-row">
              <div className="meter-label">
                <span>PDF / Videoaula (Teoria Passiva)</span>
                <strong className={metrics.weeklyTheoryPercentage > 60 ? 'text-danger' : ''}>
                  {metrics.weeklyTheoryPercentage.toFixed(1)}% (teto 60%)
                </strong>
              </div>
              <div className="meter-bar-track">
                <div
                  className={`meter-bar-fill ${metrics.weeklyTheoryPercentage > 60 ? 'bar-danger' : 'bar-indigo'}`}
                  style={{ width: `${Math.min(100, metrics.weeklyTheoryPercentage)}%` }}
                />
              </div>
            </div>

            <div className="meter-row">
              <div className="meter-label">
                <span>Resolução de Questões (Prática Ativa)</span>
                <strong className={metrics.weeklyQuestionsPercentage < 20 ? 'text-danger' : 'text-emerald'}>
                  {metrics.weeklyQuestionsPercentage.toFixed(1)}% (mínimo 20%)
                </strong>
              </div>
              <div className="meter-bar-track">
                <div
                  className={`meter-bar-fill ${metrics.weeklyQuestionsPercentage < 20 ? 'bar-danger' : 'bar-emerald'}`}
                  style={{ width: `${Math.min(100, metrics.weeklyQuestionsPercentage)}%` }}
                />
              </div>
            </div>
          </div>

          <div className="monitor-breakdown">
            <div className="breakdown-stat">
              <span className="stat-label">Teoria</span>
              <span className="stat-val">{formatHours(metrics.weeklyPassiveTheorySeconds)}</span>
            </div>
            <div className="breakdown-stat">
              <span className="stat-label">Questões</span>
              <span className="stat-val">{formatHours(metrics.weeklyQuestionsSeconds)}</span>
            </div>
            <div className="breakdown-stat">
              <span className="stat-label">Total Semana</span>
              <span className="stat-val">{formatHours(metrics.weeklyTotalStudySeconds)}</span>
            </div>
          </div>

          {hasPassiveAnomaly && (
            <div className="monitor-remediation">
              <button
                className="btn-remediation"
                onClick={() =>
                  handleAction(
                    'Modo Prática Ativa engajado! Redirecionando para o Banco de Questões...',
                    onNavigateToQuestions
                  )
                }
              >
                <Zap className="w-3.5 h-3.5 inline mr-1" />
                Ativar Modo Só Questões Agora
              </button>
            </div>
          )}
        </div>

        {/* MONITOR 2: ESTAGNAÇÃO VERTICAL (MONOMANIA) */}
        <div className={`monitor-card ${hasStagnationAnomaly ? 'monitor-danger' : 'monitor-ok'}`}>
          <div className="monitor-header">
            <div className="monitor-icon-box cycle">
              <Layers className="w-5 h-5 text-amber-400" />
            </div>
            <div className="monitor-title-box">
              <span className="monitor-category">Monitor 2 • Rotação & Amplitude</span>
              <h3 className="monitor-name">Estagnação Vertical no Ciclo</h3>
            </div>
            <span className={`monitor-status-badge ${hasStagnationAnomaly ? 'badge-alert' : 'badge-ok'}`}>
              {hasStagnationAnomaly ? 'Estagnação Detectada' : 'Ciclo em Giro'}
            </span>
          </div>

          <p className="monitor-description">
            Regra auditada: Não permanecer mais de <strong>3 semanas (21 dias)</strong> preso na mesma matéria sem girar as demais.
          </p>

          <div className="stagnation-display">
            <div className="stagnation-main-stat">
              <div className="days-counter">
                <span className={`days-number ${metrics.daysOnCurrentSubject >= 21 ? 'text-danger' : 'text-slate'}`}>
                  {metrics.daysOnCurrentSubject}
                </span>
                <span className="days-label">dias consecutivos em</span>
              </div>
              <div className="current-subject-badge">
                {metrics.currentSubject || 'Nenhuma matéria exclusiva'}
              </div>
            </div>

            <div className="threshold-indicator">
              <div className="threshold-bar-track">
                <div
                  className={`threshold-bar-fill ${metrics.daysOnCurrentSubject >= 21 ? 'bar-danger' : 'bar-amber'}`}
                  style={{ width: `${Math.min(100, (metrics.daysOnCurrentSubject / 21) * 100)}%` }}
                />
              </div>
              <div className="threshold-limits">
                <span>0 dias</span>
                <span className="limit-marker">Limite: 21 dias (3 sem.)</span>
              </div>
            </div>

            {metrics.neglectedSubjectsCount > 0 && (
              <div className="neglected-subjects-box">
                <span className="neglected-title">
                  {metrics.neglectedSubjectsCount} matéria(s) sem estudo recente no edital:
                </span>
                <div className="neglected-tags">
                  {metrics.neglectedSubjects.slice(0, 4).map((m, idx) => (
                    <button
                      key={idx}
                      className="subject-tag"
                      style={{ cursor: onNavigateToStudy ? 'pointer' : 'default', border: 'none' }}
                      onClick={() => {
                        if (onNavigateToStudy) {
                          handleAction(`Iniciando estudo em ${m}...`, () => onNavigateToStudy(m));
                        }
                      }}
                      title={onNavigateToStudy ? `Estudar ${m} agora` : m}
                    >
                      {m}
                    </button>
                  ))}
                  {metrics.neglectedSubjects.length > 4 && (
                    <span className="subject-tag-more">+{metrics.neglectedSubjects.length - 4}</span>
                  )}
                </div>
              </div>
            )}
          </div>

          {hasStagnationAnomaly && (
            <div className="monitor-remediation">
              <button
                className="btn-remediation"
                onClick={() =>
                  handleAction('Abrindo Planejamento Adaptativo para forçar rotação do ciclo...', onNavigateToCycle)
                }
              >
                <ArrowRight className="w-3.5 h-3.5 inline mr-1" />
                Girar Ciclo para Próxima Matéria
              </button>
            </div>
          )}
        </div>

        {/* MONITOR 3: FADIGA & QUEDA DE RENDIMENTO */}
        <div className={`monitor-card ${hasFatigueAnomaly ? 'monitor-danger' : 'monitor-ok'}`}>
          <div className="monitor-header">
            <div className="monitor-icon-box fatigue">
              <Coffee className="w-5 h-5 text-emerald-400" />
            </div>
            <div className="monitor-title-box">
              <span className="monitor-category">Monitor 3 • Ergonomia Cognitiva</span>
              <h3 className="monitor-name">Fadiga e Queda Pós-90min</h3>
            </div>
            <span className={`monitor-status-badge ${hasFatigueAnomaly ? 'badge-alert' : 'badge-ok'}`}>
              {hasFatigueAnomaly ? 'Queda Severa Registrada' : 'Ritmo Sustentável'}
            </span>
          </div>

          <p className="monitor-description">
            Regra auditada: Queda drástica de leitura (pág/h) ou taxa de acertos em sessões contínuas &gt; <strong>90 minutos</strong> sem pausa.
          </p>

          <div className="fatigue-telemetry-box">
            <div className="fatigue-stat-row">
              <div className="stat-item">
                <span className="stat-label">Limiar de Fadiga</span>
                <span className="stat-value">90 min contínuos</span>
              </div>
              <div className="stat-item">
                <span className="stat-label">Tolerância Queda</span>
                <span className="stat-value">&gt; 35% velocidade / &gt; 25% acerto</span>
              </div>
            </div>

            <div className="fatigue-guidance">
              <Info className="w-4 h-4 text-indigo-400 shrink-0 mt-0.5" />
              <span>
                A neurociência do aprendizado demonstra que blocos ultradianos de até 90 min mantêm a retenção
                ótima. Além de 90 min sem pausa, o custo cognitivo dispara e a consolidação de longo prazo desaba.
              </span>
            </div>
          </div>

          <div className="monitor-remediation">
            <button
              className="btn-remediation secondary"
              onClick={() =>
                handleAction(
                  'Pausa consciente recomendada: Faça 15 minutos de descanso sem telas para restaurar a memória de trabalho.'
                )
              }
            >
              <Coffee className="w-3.5 h-3.5 inline mr-1 text-emerald-400" />
              Prescrição: Pausa Ativa de 15 min
            </button>
          </div>
        </div>
      </div>

      {/* 3. LISTA DE ANOMALIAS DETECTADAS COM EVIDÊNCIAS E PRESCRIÇÃO */}
      <section className="detected-anomalies-section">
        <div className="section-header">
          <div className="header-badge">AUDITORIA DOS LOGS</div>
          <h3 className="section-title">Evidências Registradas e Prescrição Pedagógica</h3>
          <p className="section-subtitle">
            Diferente de opiniões ou palpites, cada apontamento abaixo é decorrente de dados matemáticos do seu histórico append-only.
          </p>
        </div>

        {anomalies.length === 0 ? (
          <div className="clean-audit-card">
            <div className="clean-icon-circle">
              <CheckCircle2 className="w-8 h-8 text-emerald-500" />
            </div>
            <h4>Nenhuma anomalia de execução detectada nos registros recentes</h4>
            <p>
              Sua rotina cumpre os critérios canônicos de proporção teoria/prática, rotação de matérias no edital e
              tempo contínuo de sessão. Continue executando o ciclo conforme planejado.
            </p>
          </div>
        ) : (
          <div className="anomalies-list">
            {anomalies.map((item, idx) => (
              <div key={idx} className={`anomaly-item-card severity-${item.severity.toLowerCase()}`}>
                <div className="anomaly-item-left">
                  <div className="severity-badge-wrap">
                    <span className={`severity-tag ${item.severity.toLowerCase()}`}>
                      {item.severity === 'CRITICA' && <AlertTriangle className="w-3.5 h-3.5 inline mr-1" />}
                      {item.severity}
                    </span>
                    <span className="anomaly-type-tag">{item.type}</span>
                  </div>
                  <h4 className="anomaly-item-title">{item.title}</h4>
                  <p className="anomaly-item-desc">{item.description}</p>

                  <div className="evidence-box">
                    <span className="evidence-title">Evidência Métrológica:</span>
                    <code className="evidence-code">{item.metricEvidence}</code>
                  </div>
                </div>

                <div className="anomaly-item-right">
                  <div className="prescription-card">
                    <span className="prescription-label">
                      <Sparkles className="w-3 h-3 text-amber-400 inline mr-1" />
                      Prescrição Corretiva do Sistema:
                    </span>
                    <p className="prescription-text">{item.recommendedAction}</p>

                    <div className="prescription-btn-group">
                      {item.type === 'EXCESSO_TEORIA_PASSIVA' && onNavigateToQuestions && (
                        <button
                          className="btn-prescribe"
                          onClick={() =>
                            handleAction('Redirecionando para o Banco de Questões...', onNavigateToQuestions)
                          }
                        >
                          Ir para Questões <ArrowRight className="w-3.5 h-3.5 inline ml-1" />
                        </button>
                      )}

                      {item.type === 'ESTAGNACAO_VERTICAL' && onNavigateToCycle && (
                        <button
                          className="btn-prescribe"
                          onClick={() =>
                            handleAction('Abrindo Planejamento Adaptativo do Ciclo...', onNavigateToCycle)
                          }
                        >
                          Rotacionar Ciclo <ArrowRight className="w-3.5 h-3.5 inline ml-1" />
                        </button>
                      )}

                      {item.type === 'FADIGA_QUEDA_RENDIMENTO' && (
                        <button
                          className="btn-prescribe calm"
                          onClick={() =>
                            handleAction(
                              'Pausa ativa iniciada: 15 minutos sem telas recomendados para repouso cortical.'
                            )
                          }
                        >
                          Registrar Pausa <Coffee className="w-3.5 h-3.5 inline ml-1" />
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      {/* 4. COMPARATIVO METODOLÓGICO: DIAGNÓSTICO INTELIGENTE VS PLANILHAS */}
      <section className="methodology-comparison-card">
        <div className="comparison-header">
          <div className="comparison-title-box">
            <BarChart2 className="w-5 h-5 text-indigo-400" />
            <div>
              <h4>Diagnóstico Inteligente de Hábitos de Estudo</h4>
              <p>Como o FiscalStudy acompanha sua evolução prática sem formulários manuais cansativos</p>
            </div>
          </div>
          <span className="badge-calm-tech">Tecnologia Calma</span>
        </div>

        <div className="table-wrapper">
          <table className="comparison-table">
            <thead>
              <tr>
                <th>Dimensão Avaliada</th>
                <th>Método Tradicional (Planilhas Estáticas)</th>
                <th>Como o FiscalStudy Executa (Automático e Silencioso)</th>
                <th>Status no Sistema</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td><strong>1. Equilíbrio Teoria x Prática</strong></td>
                <td>Preencher percentual estimado de PDF vs Questões</td>
                <td>Calcula o tempo real e exato entre leitura e resolução prática</td>
                <td><span className="badge-ok-small">Automatizado</span></td>
              </tr>
              <tr>
                <td><strong>2. Rotação de Disciplinas</strong></td>
                <td>Tentar lembrar se ficou muito tempo na mesma matéria</td>
                <td>Alerta pedagógico caso uma matéria fique mais de 21 dias sem contato</td>
                <td><span className="badge-ok-small">Automatizado</span></td>
              </tr>
              <tr>
                <td><strong>3. Cansaço e Rendimento</strong></td>
                <td>Autoavaliação subjetiva e imprecisa</td>
                <td>Identifica queda expressiva de rendimento após sessões longas sem pausa</td>
                <td><span className="badge-ok-small">Automatizado</span></td>
              </tr>
              <tr>
                <td><strong>4. Curva de Retenção da Memória</strong></td>
                <td>Estimativa manual de esquecimento</td>
                <td>Cálculo da estabilidade da memória com base no tempo desde a última revisão</td>
                <td><span className="badge-ok-small">Automatizado</span></td>
              </tr>
              <tr>
                <td><strong>5. Certeza e Calibração Metacognitiva</strong></td>
                <td>Tentar adivinhar se errou por excesso de confiança</td>
                <td>Cruza o nível de confiança declarado com o acerto real da questão</td>
                <td><span className="badge-ok-small">Automatizado</span></td>
              </tr>
              <tr>
                <td><strong>6. Ajuste de Carga Horária Semanal</strong></td>
                <td>Calcular horas manualmente na planilha todo fim de semana</td>
                <td>Reequilibra as horas da semana fortalecendo conteúdos com menor taxa de acerto</td>
                <td><span className="badge-ok-small">Automatizado</span></td>
              </tr>
              <tr>
                <td><strong>7. Velocidade de Leitura</strong></td>
                <td>Cronometrar e anotar páginas lidas em bloco de notas</td>
                <td>Acompanhamento natural do ritmo de páginas por hora por disciplina</td>
                <td><span className="badge-ok-small">Automatizado</span></td>
              </tr>
              <tr>
                <td><strong>8. Histórico Real de Evolução</strong></td>
                <td>Marcar 'X' em células do Excel</td>
                <td>Histórico seguro e contínuo de todas as resoluções e sessões</td>
                <td><span className="badge-ok-small">Automatizado</span></td>
              </tr>
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
};

export default AuditoriaAnomaliasEstudo;
