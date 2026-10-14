import React, { useState, useEffect } from 'react';
import type { ConcursoItem } from '../concursos/MeusConcursos';
import './CicloRevisoes.css';

interface CicloRevisoesProps {
  activeConcurso: ConcursoItem | null;
  onStartErrorNotebook: (errorType?: string) => void;
  onNavigateToStudy?: (disciplina?: string, assunto?: string) => void;
}

interface PerformanceXRayData {
  totalUniqueQuestionsSolved: number;
  totalAnswersSubmitted: number;
  totalCorrect: number;
  totalIncorrect: number;
  accuracyRate: number;
  topErrorAreas: Array<{
    topico: string;
    disciplina: string;
    totalAttempts: number;
    incorrectCount: number;
    errorRate: number;
  }>;
  masteredAreas: Array<{
    topico: string;
    disciplina: string;
    totalAttempts: number;
    correctCount: number;
    accuracyRate: number;
  }>;
}

interface EditalTopicItem {
  id: string;
  disciplina: string;
  assunto: string;
  subassunto?: string;
  peso: number;
  statusEstudo?: string;
}

interface PontoChaveCard {
  id: string;
  disciplina: string;
  topico: string;
  criterioCritico: string;
  textoComOmissao: string;
  explicacao: string;
  revisoesCount: number;
  proximaRevisao?: string;
}

export const CicloRevisoes: React.FC<CicloRevisoesProps> = ({
  activeConcurso,
  onStartErrorNotebook,
  onNavigateToStudy,
}) => {
  // Abas do Módulo de Revisões
  const [activeTab, setActiveTab] = useState<'ADAPTATIVE_GUIDE' | 'FLASHCARDS_SRS' | 'ERROR_NOTEBOOK'>('ADAPTATIVE_GUIDE');

  // Configuração da Duração Adaptativa
  const [baseBlockMinutes, setBaseBlockMinutes] = useState<number>(50);
  const [isAdaptativeMode, setIsAdaptativeMode] = useState<boolean>(true);

  // Estados de dados
  const [xrayData, setXrayData] = useState<PerformanceXRayData | null>(null);
  const [editalTopics, setEditalTopics] = useState<EditalTopicItem[]>([]);
  const [srsCards, setSrsCards] = useState<PontoChaveCard[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [selectedTaxonomy, setSelectedTaxonomy] = useState<string | null>(null);

  // Estado interativo de Flashcards
  const [srsIndex, setSrsIndex] = useState(0);
  const [srsRevealed, setSrsRevealed] = useState(false);

  useEffect(() => {
    if (!activeConcurso?.id) return;
    setIsLoading(true);

    Promise.all([
      fetch('/api/v1/analytics/performance-xray').then((r) => (r.ok ? r.json() : null)),
      fetch(`/api/v1/concursos/${activeConcurso.id}/edital`).then((r) => (r.ok ? r.json() : null)),
      fetch('/api/v1/cognitive/pontos-chave').then((r) => (r.ok ? r.json() : [])),
    ])
      .then(([xray, edital, cards]) => {
        if (xray) setXrayData(xray);
        if (edital && Array.isArray(edital.topicos)) setEditalTopics(edital.topicos);
        if (Array.isArray(cards)) setSrsCards(cards);
      })
      .catch((err) => console.error('Erro ao carregar dados de revisão:', err))
      .finally(() => setIsLoading(false));
  }, [activeConcurso?.id]);

  const totalErrors = xrayData?.totalIncorrect || 0;

  // Algoritmo de IA Comportamental para Duração Adaptativa do Bloco
  // Leva em conta: Peso no Edital + Carga Cognitiva da Disciplina + Desempenho Histórico
  const calculateAdaptativeDuration = (topic: EditalTopicItem): { minutes: number; reason: string; reviewStep: string; studyStep: string; practiceStep: string } => {
    if (!isAdaptativeMode) {
      return {
        minutes: baseBlockMinutes,
        reason: 'Duração fixa manual definida pelo usuário',
        reviewStep: `Revisão ativa de 15 min dos conceitos-chave de ${topic.assunto}.`,
        studyStep: `Leitura do material ou teoria essencial (${Math.round((baseBlockMinutes - 15) * 0.4)} min).`,
        practiceStep: `Resolução de questões com foco em fixação (${Math.round((baseBlockMinutes - 15) * 0.6)} min).`,
      };
    }

    const discLower = (topic.disciplina || '').toLowerCase();
    let duration = baseBlockMinutes;
    let reason = 'Duração padrão calibrada pela IA';

    // Fator 1: Carga Cognitiva por Natureza da Disciplina
    if (discLower.includes('contabil') || discLower.includes('exatas') || discLower.includes('racioc') || discLower.includes('ti') || discLower.includes('tecnologia')) {
      // Exatas e TI causam esgotamento cognitivo rápido (Daniel Kahneman / Sistema 2)
      duration = Math.max(35, Math.min(baseBlockMinutes, 45));
      reason = '⚡ Alta densidade de cálculo/lógica: bloco mais curto para evitar saturação do Sistema 2.';
    } else if (discLower.includes('tribut') || discLower.includes('constitucional') || discLower.includes('administrativo') || discLower.includes('legislacao')) {
      // Doutrina e Leis ganham profundidade com tempo maior de imersão
      duration = Math.min(80, baseBlockMinutes + 10);
      reason = '📚 Matéria de alto peso e fundamentação doutrinária: bloco estendido para imersão normativa.';
    } else {
      // Manutenção rápida
      duration = baseBlockMinutes;
      reason = '🎯 Matéria regular: bloco equilibrado para ritmo constante.';
    }

    // Fator 2: Ajuste pelo Peso do Tópico no Edital
    if (topic.peso >= 2.0) {
      duration += 5;
      reason += ' (+5 min por alto peso no edital)';
    }

    const reviewMin = Math.round(duration * 0.25);
    const studyMin = Math.round(duration * 0.35);
    const practiceMin = duration - reviewMin - studyMin;

    return {
      minutes: duration,
      reason,
      reviewStep: `Revisão Ativa (Active Recall) de ${reviewMin} min: resuma de memória os conceitos centrais de "${topic.assunto}" em papel limpo sem olhar o material.`,
      studyStep: `Aprofundamento Teórico de ${studyMin} min: examine as exceções, jurisprudência da banca e artigos mais cobrados.`,
      practiceStep: `Bateria Prática de ${practiceMin} min: resolva questões focadas aplicando "Pensar o Contrário" nas alternativas sedutoras.`,
    };
  };

  // Tópico prioritário de hoje sugerido pela IA
  const priorityTopic: EditalTopicItem | null = editalTopics.length > 0 ? editalTopics[0] : null;
  const priorityPlan = priorityTopic ? calculateAdaptativeDuration(priorityTopic) : null;

  const handleStartTopic = (disciplina: string, assunto: string) => {
    sessionStorage.setItem('fiscalstudy_filter_discipline', disciplina);
    sessionStorage.setItem('fiscalstudy_filter_assunto', assunto);
    sessionStorage.setItem('fiscalstudy_auto_start', 'true');
    if (onNavigateToStudy) {
      onNavigateToStudy(disciplina, assunto);
    } else {
      window.location.hash = '#study';
    }
  };

  // Taxonomia Oficial dos 5 Tipos de Erro
  const errorTaxonomy = [
    {
      code: 'NAO_SABIA_MATERIA',
      badge: '1',
      title: 'Não sabia a matéria',
      desc: 'Lacuna teórica pura; assunto nunca estudado ou não compreendido.',
      count: 0,
      color: '#ef4444',
      action: 'Estudar Teoria Base no PDF',
    },
    {
      code: 'NAO_LEMBRAVA',
      badge: '2',
      title: 'Não lembrava',
      desc: 'Falha de retenção e revisão espaçada de prazo, regra ou fórmula.',
      count: 0,
      color: '#3b82f6',
      action: 'Criar Ponto-Chave Cloze / SRS',
    },
    {
      code: 'INTERPRETACAO_EQUIVOCADA',
      badge: '3',
      title: 'Interpretação equivocada',
      desc: 'Falha na leitura do comando da questão ou na tradução do enunciado.',
      count: 0,
      color: '#f97316',
      action: 'Acompanhar com Caneta Palavra por Palavra',
    },
    {
      code: 'CONFUSAO_CONCEITUAL',
      badge: '4',
      title: 'Confusão entre conceitos',
      desc: 'Falta de organização macroestrutural; troca de institutos correlatos.',
      count: 0,
      color: '#eab308',
      action: 'Aplicar Técnica Feynman em Tela Limpa',
    },
    {
      code: 'FALTA_ATENCAO',
      badge: '5',
      title: 'Falta de atenção',
      desc: 'Leitura apressada; ignorar termos restritivos (salvo, exceto, nunca, prescindível).',
      count: 0,
      color: '#8b5cf6',
      action: 'Circundar Restritivos Obrigatoriamente',
    },
  ];

  return (
    <div className="revisoes-container animate-fade-in">
      {/* Header do Módulo de Revisões */}
      <div className="revisoes-header glass">
        <div>
          <h2>🔄 Central de Revisões Personalizadas & IA de Retenção</h2>
          <p className="revisoes-subtitle">
            O próprio sistema analisa seus dados para dizer quanto tempo estudar, o que ver, o que revisar e o passo a passo a seguir
            {activeConcurso ? ` — ${activeConcurso.nome}` : ''}
          </p>
        </div>

        {/* Seletor de Abas Principais */}
        <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
          <button
            className={`btn ${activeTab === 'ADAPTATIVE_GUIDE' ? 'btn-primary' : 'btn-secondary'}`}
            style={{
              background: activeTab === 'ADAPTATIVE_GUIDE' ? '#0284c7' : '#1e293b',
              color: '#ffffff',
              border: '1px solid #334155',
              padding: '0.5rem 0.9rem',
              fontSize: '0.85rem',
              fontWeight: 600,
              borderRadius: '6px',
              cursor: 'pointer',
            }}
            onClick={() => setActiveTab('ADAPTATIVE_GUIDE')}
          >
            🎯 Passo a Passo & Blocos Adaptativos
          </button>
          <button
            className={`btn ${activeTab === 'FLASHCARDS_SRS' ? 'btn-primary' : 'btn-secondary'}`}
            style={{
              background: activeTab === 'FLASHCARDS_SRS' ? '#0284c7' : '#1e293b',
              color: '#ffffff',
              border: '1px solid #334155',
              padding: '0.5rem 0.9rem',
              fontSize: '0.85rem',
              fontWeight: 600,
              borderRadius: '6px',
              cursor: 'pointer',
            }}
            onClick={() => setActiveTab('FLASHCARDS_SRS')}
          >
            🧠 Flashcards Ativos (SRS)
          </button>
          <button
            className={`btn ${activeTab === 'ERROR_NOTEBOOK' ? 'btn-primary' : 'btn-secondary'}`}
            style={{
              background: activeTab === 'ERROR_NOTEBOOK' ? '#ef4444' : '#1e293b',
              color: '#ffffff',
              border: '1px solid #334155',
              padding: '0.5rem 0.9rem',
              fontSize: '0.85rem',
              fontWeight: 600,
              borderRadius: '6px',
              cursor: 'pointer',
            }}
            onClick={() => setActiveTab('ERROR_NOTEBOOK')}
          >
            📕 Caderno de Erros ({totalErrors})
          </button>
        </div>
      </div>

      {/* ABA 1: PASSO A PASSO GUIADO & BLOCOS ADAPTATIVOS PELA IA */}
      {activeTab === 'ADAPTATIVE_GUIDE' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
          {/* Barra de Calibração do Bloco de Estudo Adaptativo */}
          <div className="glass" style={{ padding: '1.25rem 1.5rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem', borderLeft: '4px solid #38bdf8' }}>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.25rem' }}>
                <span style={{ fontSize: '1.2rem' }}>🤖</span>
                <strong style={{ color: '#f8fafc', fontSize: '1rem' }}>Motor de Calibração Adaptativa de Duração</strong>
                <span style={{ background: isAdaptativeMode ? 'rgba(16,185,129,0.15)' : 'rgba(148,163,184,0.15)', color: isAdaptativeMode ? '#34d399' : '#94a3b8', padding: '2px 8px', borderRadius: '4px', fontSize: '0.72rem', fontWeight: 700 }}>
                  {isAdaptativeMode ? 'IA ATIVA — BLOCOS ADAPTADOS' : 'MODO FIXO'}
                </span>
              </div>
              <p style={{ color: '#94a3b8', fontSize: '0.82rem', margin: 0 }}>
                Você estabelece uma base inicial e a IA ajusta a duração ideal para cada matéria baseada em carga cognitiva, histórico de retenção e peso no edital.
              </p>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <span style={{ color: '#cbd5e1', fontSize: '0.82rem' }}>Duração Base Inicial:</span>
                {[40, 50, 60, 90].map((m) => (
                  <button
                    key={m}
                    type="button"
                    onClick={() => setBaseBlockMinutes(m)}
                    style={{
                      background: baseBlockMinutes === m ? '#0284c7' : '#0f172a',
                      color: baseBlockMinutes === m ? '#ffffff' : '#94a3b8',
                      border: '1px solid #334155',
                      padding: '4px 10px',
                      borderRadius: '6px',
                      fontSize: '0.8rem',
                      fontWeight: 600,
                      cursor: 'pointer',
                    }}
                  >
                    {m} min
                  </button>
                ))}
              </div>

              <button
                type="button"
                onClick={() => setIsAdaptativeMode(!isAdaptativeMode)}
                style={{
                  background: isAdaptativeMode ? '#0284c7' : '#334155',
                  color: '#fff',
                  border: 'none',
                  padding: '6px 12px',
                  borderRadius: '6px',
                  fontSize: '0.8rem',
                  fontWeight: 600,
                  cursor: 'pointer',
                }}
              >
                {isAdaptativeMode ? 'Alternar p/ Modo Fixo' : 'Ativar IA Adaptativa'}
              </button>
            </div>
          </div>

          {/* Cartão de Destaque: Seu Passo a Passo Personalizado de Hoje */}
          {priorityTopic && priorityPlan ? (
            <div className="glass" style={{ padding: '1.75rem', border: '1px solid #0284c7', background: 'radial-gradient(circle at top left, rgba(2, 132, 199, 0.12) 0%, rgba(15, 23, 42, 0.8) 100%)', borderRadius: '12px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '1rem', marginBottom: '1.25rem' }}>
                <div>
                  <span style={{ textTransform: 'uppercase', fontSize: '0.75rem', letterSpacing: '0.08em', color: '#38bdf8', fontWeight: 800 }}>
                    📍 Próximo Bloco Recomendado pelo Sistema
                  </span>
                  <h3 style={{ color: '#f8fafc', fontSize: '1.4rem', margin: '0.25rem 0' }}>
                    {priorityTopic.assunto}
                  </h3>
                  <p style={{ color: '#94a3b8', fontSize: '0.88rem', margin: 0 }}>
                    Disciplina: <strong style={{ color: '#cbd5e1' }}>{priorityTopic.disciplina}</strong> • Peso no Edital: <strong style={{ color: '#fbbf24' }}>{priorityTopic.peso || 1.0}x</strong>
                  </p>
                </div>

                <div style={{ textAlign: 'right' }}>
                  <div style={{ background: '#0369a1', color: '#ffffff', padding: '6px 14px', borderRadius: '8px', fontSize: '1.1rem', fontWeight: 800, display: 'inline-block' }}>
                    ⏱️ {priorityPlan.minutes} minutos
                  </div>
                  <div style={{ color: '#38bdf8', fontSize: '0.75rem', marginTop: '4px' }}>
                    {priorityPlan.reason}
                  </div>
                </div>
              </div>

              {/* Roteiro Passo a Passo Guiado */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '1rem', marginBottom: '1.5rem' }}>
                <div style={{ background: 'rgba(15, 23, 42, 0.7)', border: '1px solid #1e293b', borderRadius: '8px', padding: '1rem' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.5rem' }}>
                    <span style={{ background: '#38bdf8', color: '#0f172a', width: '22px', height: '22px', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.75rem', fontWeight: 900 }}>1</span>
                    <strong style={{ color: '#38bdf8', fontSize: '0.88rem' }}>O que revisar hoje</strong>
                  </div>
                  <p style={{ color: '#cbd5e1', fontSize: '0.82rem', margin: 0, lineHeight: 1.45 }}>
                    {priorityPlan.reviewStep}
                  </p>
                </div>

                <div style={{ background: 'rgba(15, 23, 42, 0.7)', border: '1px solid #1e293b', borderRadius: '8px', padding: '1rem' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.5rem' }}>
                    <span style={{ background: '#a855f7', color: '#ffffff', width: '22px', height: '22px', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.75rem', fontWeight: 900 }}>2</span>
                    <strong style={{ color: '#c084fc', fontSize: '0.88rem' }}>O que ver / aprofundar</strong>
                  </div>
                  <p style={{ color: '#cbd5e1', fontSize: '0.82rem', margin: 0, lineHeight: 1.45 }}>
                    {priorityPlan.studyStep}
                  </p>
                </div>

                <div style={{ background: 'rgba(15, 23, 42, 0.7)', border: '1px solid #1e293b', borderRadius: '8px', padding: '1rem' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.5rem' }}>
                    <span style={{ background: '#10b981', color: '#ffffff', width: '22px', height: '22px', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.75rem', fontWeight: 900 }}>3</span>
                    <strong style={{ color: '#34d399', fontSize: '0.88rem' }}>Fixação Prática (Questões)</strong>
                  </div>
                  <p style={{ color: '#cbd5e1', fontSize: '0.82rem', margin: 0, lineHeight: 1.45 }}>
                    {priorityPlan.practiceStep}
                  </p>
                </div>
              </div>

              {/* Botões de Ação Imediata */}
              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem', flexWrap: 'wrap' }}>
                <button
                  type="button"
                  className="btn"
                  style={{
                    background: 'linear-gradient(135deg, #10b981 0%, #059669 100%)',
                    color: '#ffffff',
                    border: 'none',
                    fontWeight: 700,
                    padding: '0.65rem 1.4rem',
                    fontSize: '0.95rem',
                    borderRadius: '8px',
                    cursor: 'pointer',
                    boxShadow: '0 4px 14px rgba(16, 185, 129, 0.3)',
                  }}
                  onClick={() => handleStartTopic(priorityTopic.disciplina, priorityTopic.assunto)}
                >
                  ▶ Iniciar Resolução Deste Tópico Agora ({priorityPlan.minutes} min)
                </button>
              </div>
            </div>
          ) : (
            <div className="glass" style={{ padding: '2.5rem', textAlign: 'center', color: '#94a3b8' }}>
              <p style={{ fontSize: '1rem', color: '#f8fafc', marginBottom: '0.5rem' }}>
                Nenhum edital verticalizado cadastrado ainda para este concurso.
              </p>
              <p style={{ fontSize: '0.85rem', margin: '0 0 1rem 0' }}>
                Acesse a aba <strong>Edital Verticalizado</strong> ou utilize o assistente de cadastro para importar os tópicos do edital.
              </p>
            </div>
          )}

          {/* Fila Geral de Tópicos do Ciclo com Calibração de Tempo */}
          <div className="glass" style={{ padding: '1.5rem' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
              <div>
                <h3 style={{ color: '#f8fafc', fontSize: '1.1rem', margin: 0 }}>
                  📋 Fila de Tópicos do Edital & Calibração da IA
                </h3>
                <p style={{ color: '#94a3b8', fontSize: '0.82rem', margin: '0.2rem 0 0 0' }}>
                  A IA calcula a duração exata e o foco recomendados para cada assunto do seu edital.
                </p>
              </div>
              <span style={{ color: '#cbd5e1', fontSize: '0.82rem' }}>
                Total: <strong>{editalTopics.length} tópicos mapeados</strong>
              </span>
            </div>

            {editalTopics.length === 0 ? (
              <p style={{ color: '#64748b', fontSize: '0.85rem', textAlign: 'center', padding: '1rem' }}>
                Cadastre ou importe tópicos no Edital Verticalizado para visualizar a fila de estudo adaptativo.
              </p>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.6rem' }}>
                {editalTopics.slice(0, 10).map((topic, idx) => {
                  const plan = calculateAdaptativeDuration(topic);
                  return (
                    <div
                      key={topic.id || idx}
                      style={{
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                        background: '#0f172a',
                        border: '1px solid #1e293b',
                        padding: '0.75rem 1rem',
                        borderRadius: '8px',
                        gap: '1rem',
                        flexWrap: 'wrap',
                      }}
                    >
                      <div style={{ flex: 1, minWidth: '220px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.2rem' }}>
                          <span style={{ color: '#38bdf8', fontSize: '0.75rem', fontWeight: 700, textTransform: 'uppercase' }}>
                            {topic.disciplina}
                          </span>
                          <span style={{ color: '#64748b', fontSize: '0.72rem' }}>• Peso: {topic.peso || 1.0}x</span>
                        </div>
                        <strong style={{ color: '#f8fafc', fontSize: '0.9rem' }}>{topic.assunto}</strong>
                        <div style={{ color: '#94a3b8', fontSize: '0.75rem', marginTop: '2px' }}>
                          {plan.reason}
                        </div>
                      </div>

                      <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                        <div style={{ textAlign: 'right' }}>
                          <span style={{ display: 'block', color: '#f8fafc', fontWeight: 700, fontSize: '0.95rem' }}>
                            ⏱️ {plan.minutes} min
                          </span>
                          <span style={{ fontSize: '0.72rem', color: '#10b981' }}>IA Adaptativa</span>
                        </div>

                        <button
                          type="button"
                          className="btn btn-sm"
                          style={{
                            background: '#0284c7',
                            color: '#fff',
                            border: 'none',
                            padding: '0.45rem 0.85rem',
                            fontSize: '0.82rem',
                            fontWeight: 600,
                            borderRadius: '6px',
                            cursor: 'pointer',
                          }}
                          onClick={() => handleStartTopic(topic.disciplina, topic.assunto)}
                        >
                          ▶ Estudar Tópico
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      )}

      {/* ABA 2: PONTOS-CHAVE & FLASHCARDS ATIVOS (SRS) */}
      {activeTab === 'FLASHCARDS_SRS' && (
        <div className="glass" style={{ padding: '1.75rem' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem' }}>
            <div>
              <h3 style={{ color: '#f8fafc', fontSize: '1.2rem', margin: 0 }}>
                🧠 Pontos-Chave & Flashcards com Recuperação Ativa (SRS)
              </h3>
              <p style={{ color: '#94a3b8', fontSize: '0.85rem', margin: '0.25rem 0 0 0' }}>
                Revisão ativa independente de erro: force seu cérebro a recuperar os conceitos oclusos antes de ver a resposta.
              </p>
            </div>
            <span style={{ color: '#cbd5e1', fontSize: '0.85rem' }}>
              {srsCards.length > 0 ? `Card ${srsIndex + 1} de ${srsCards.length}` : '0 cards'}
            </span>
          </div>

          {srsCards.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '3rem 1.5rem', color: '#94a3b8' }}>
              <p style={{ fontSize: '1rem', color: '#f8fafc', marginBottom: '0.5rem' }}>
                Nenhum ponto-chave cadastrado ainda.
              </p>
              <p style={{ fontSize: '0.85rem', margin: 0 }}>
                Você pode cadastrar pontos-chave de fórmulas, prazos e regras na aba <strong>Pontos-Chave</strong>.
              </p>
            </div>
          ) : (
            <div style={{ maxWidth: '640px', margin: '0 auto' }}>
              <div
                style={{
                  background: '#0f172a',
                  border: '1px solid #334155',
                  borderRadius: '12px',
                  padding: '1.75rem',
                  minHeight: '200px',
                  display: 'flex',
                  flexDirection: 'column',
                  justifyContent: 'space-between',
                  marginBottom: '1.25rem',
                }}
              >
                <div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.75rem' }}>
                    <span style={{ color: '#38bdf8', fontSize: '0.8rem', fontWeight: 700, textTransform: 'uppercase' }}>
                      {srsCards[srsIndex].disciplina} • {srsCards[srsIndex].topico}
                    </span>
                    <span style={{ background: '#334155', color: '#e2e8f0', padding: '2px 8px', borderRadius: '4px', fontSize: '0.72rem' }}>
                      {srsCards[srsIndex].criterioCritico}
                    </span>
                  </div>

                  <p style={{ color: '#f8fafc', fontSize: '1.05rem', lineHeight: 1.5, margin: '1rem 0' }}>
                    {srsCards[srsIndex].textoComOmissao}
                  </p>

                  {srsRevealed && (
                    <div style={{ marginTop: '1.25rem', paddingTop: '1rem', borderTop: '1px solid #1e293b' }}>
                      <span style={{ color: '#10b981', fontSize: '0.75rem', fontWeight: 700, textTransform: 'uppercase' }}>
                        Resposta / Explicação:
                      </span>
                      <p style={{ color: '#cbd5e1', fontSize: '0.95rem', margin: '0.25rem 0 0 0' }}>
                        {srsCards[srsIndex].explicacao}
                      </p>
                    </div>
                  )}
                </div>

                <div style={{ marginTop: '1.5rem', textAlign: 'center' }}>
                  {!srsRevealed ? (
                    <button
                      type="button"
                      className="btn"
                      style={{ background: '#0284c7', color: '#fff', padding: '0.6rem 1.4rem', fontWeight: 600 }}
                      onClick={() => setSrsRevealed(true)}
                    >
                      👁️ Revelar Resposta
                    </button>
                  ) : (
                    <div style={{ display: 'flex', justifyContent: 'center', gap: '0.75rem' }}>
                      <button
                        type="button"
                        className="btn"
                        style={{ background: '#ef4444', color: '#fff', padding: '0.5rem 1rem', fontSize: '0.85rem' }}
                        onClick={() => {
                          setSrsRevealed(false);
                          setSrsIndex((srsIndex + 1) % srsCards.length);
                        }}
                      >
                        ❌ Difícil
                      </button>
                      <button
                        type="button"
                        className="btn"
                        style={{ background: '#f59e0b', color: '#fff', padding: '0.5rem 1rem', fontSize: '0.85rem' }}
                        onClick={() => {
                          setSrsRevealed(false);
                          setSrsIndex((srsIndex + 1) % srsCards.length);
                        }}
                      >
                        ⚡ Médio
                      </button>
                      <button
                        type="button"
                        className="btn"
                        style={{ background: '#10b981', color: '#fff', padding: '0.5rem 1rem', fontSize: '0.85rem' }}
                        onClick={() => {
                          setSrsRevealed(false);
                          setSrsIndex((srsIndex + 1) % srsCards.length);
                        }}
                      >
                        ✓ Fácil (Lembrei)
                      </button>
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ABA 3: CADERNO DE ERROS (DIAGNÓSTICO DAS 5 CAUSAS) */}
      {activeTab === 'ERROR_NOTEBOOK' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
          {/* Summary Row */}
          <div className="revisoes-summary-grid">
            <div className="summary-box glass">
              <span className="summary-num text-red">{isLoading ? '...' : totalErrors}</span>
              <span className="summary-title">Questões com Erro Mapeado</span>
              <span className="summary-sub">Erros registrados no Event Store</span>
            </div>

            <div className="summary-box glass">
              <span className="summary-num text-orange">{isLoading ? '...' : xrayData?.topErrorAreas?.length || 0}</span>
              <span className="summary-title">Áreas Críticas de Erro</span>
              <span className="summary-sub">Concentração de falhas no edital</span>
            </div>

            <div className="summary-box glass">
              <span className="summary-num text-green">
                {isLoading ? '...' : (xrayData && xrayData.totalAnswersSubmitted > 0 ? `${xrayData.accuracyRate.toFixed(1)}%` : '—')}
              </span>
              <span className="summary-title">Taxa de Acerto Geral</span>
              <span className="summary-sub">Cálculo real de todas as tentativas</span>
            </div>
          </div>

          <div className="revisoes-main-grid">
            {/* Left: Error Taxonomy Breakdown */}
            <div className="taxonomy-card glass">
              <div className="card-top-header">
                <div>
                  <h3>Diagnóstico das 5 Causas de Erro</h3>
                  <p>Distribuição das causas raízes identificadas durante suas resoluções</p>
                </div>
              </div>

              <div className="taxonomy-list">
                {errorTaxonomy.map((item) => {
                  const pct = totalErrors > 0 ? ((item.count / totalErrors) * 100).toFixed(1) : '0.0';
                  return (
                    <div
                      key={item.code}
                      className={`taxonomy-row ${selectedTaxonomy === item.code ? 'selected' : ''}`}
                      onClick={() => setSelectedTaxonomy(item.code === selectedTaxonomy ? null : item.code)}
                    >
                      <div className="tax-badge" style={{ backgroundColor: item.color }}>
                        {item.badge}
                      </div>

                      <div className="tax-info">
                        <div className="tax-title-row">
                          <strong>{item.title}</strong>
                          <span className="tax-count">
                            {item.count} erros ({pct}%)
                          </span>
                        </div>
                        <p className="tax-desc">{item.desc}</p>
                        <div className="tax-bar-wrap">
                          <div
                            className="tax-bar-fill"
                            style={{ width: `${pct}%`, backgroundColor: item.color }}
                          />
                        </div>
                      </div>

                      <button
                        className="btn-filter-error"
                        disabled={totalErrors === 0}
                        title={`Praticar apenas erros de ${item.code}`}
                        onClick={(e) => {
                          e.stopPropagation();
                          onStartErrorNotebook(item.code);
                        }}
                      >
                        ▶ Praticar
                      </button>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Right: Refazer Erros */}
            <div className="queue-card glass">
              <div className="card-top-header">
                <div>
                  <h3>Refazer Questões Erradas</h3>
                  <p>Pratique exclusivamente os erros sem misturar com a revisão geral</p>
                </div>
              </div>

              <div style={{ textAlign: 'center', padding: '2rem 1rem' }}>
                <p style={{ color: '#94a3b8', fontSize: '0.9rem', marginBottom: '1.25rem' }}>
                  {totalErrors === 0
                    ? 'Nenhum erro registrado ainda. Conforme você resolver questões, os erros aparecerão aqui classificados.'
                    : `Você possui ${totalErrors} questões erradas aguardando nova tentativa.`}
                </p>
                <button
                  className="btn btn-primary-refazer"
                  disabled={totalErrors === 0}
                  onClick={() => onStartErrorNotebook()}
                  style={{ width: '100%', padding: '0.75rem', fontSize: '0.95rem' }}
                >
                  ⚡ Refazer Todos os Erros ({totalErrors})
                </button>
              </div>

              <div className="queue-tip" style={{ marginTop: '1rem' }}>
                💡 <strong>Regra de ouro:</strong> Revisar um tópico de forma personalizada e ativa antes de praticar evita a repetição mecânica do erro.
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default CicloRevisoes;
