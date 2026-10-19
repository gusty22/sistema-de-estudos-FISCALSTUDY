import React, { useState, useEffect } from 'react';
import {
  Brain,
  Info,
  Clock,
  Sparkles,
  ChevronRight,
  X
} from 'lucide-react';
import './CalibracaoRetencaoAbas.css';

export interface CalibracaoRetencaoAbasProps {
  concursoId?: string;
  onNavigateToContentAnalysis?: (disciplina: string, topico: string) => void;
}

export const CalibracaoRetencaoAbas: React.FC<CalibracaoRetencaoAbasProps> = ({
  concursoId,
  onNavigateToContentAnalysis
}) => {
  const [activeSubTab, setActiveSubTab] = useState<'A_CONFIANCA' | 'B_RETENCAO' | 'C_MODELO'>('A_CONFIANCA');
  const [data, setData] = useState<any | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [activePorQueModal, setActivePorQueModal] = useState<any | null>(null);

  useEffect(() => {
    setIsLoading(true);
    fetch(`/api/v1/analytics/calibration-model?concursoId=${encodeURIComponent(concursoId || '')}`)
      .then(res => res.ok ? res.json() : null)
      .then(resData => {
        if (resData) setData(resData);
      })
      .catch(err => console.warn('Erro ao carregar calibração e modelo:', err))
      .finally(() => setIsLoading(false));
  }, [concursoId]);

  const abaA = data?.abaA_confianca || {
    matriz: { altaConfiancaAcerto: 35, altaConfiancaErro: 8, baixaConfiancaAcerto: 12, baixaConfiancaErro: 15 },
    acertosInseguros: 12,
    errosAltaConfianca: 8,
    brierScore: 0.142,
    indiceCalibracao: '81.4%',
    evolucaoCalibracao: '+6.2% de precisão metaconscienciosa no último mês',
    curvaCalibracao: [
      { nivel: 1, confiancaDeclarada: '20%', precisaoReal: '25%', amostra: 12 },
      { nivel: 2, confiancaDeclarada: '40%', precisaoReal: '38%', amostra: 15 },
      { nivel: 3, confiancaDeclarada: '60%', precisaoReal: '62%', amostra: 18 },
      { nivel: 4, confiancaDeclarada: '80%', precisaoReal: '79%', amostra: 24 },
      { nivel: 5, confiancaDeclarada: '100%', precisaoReal: '84%', amostra: 19 }
    ],
    confiancaPorDisciplina: [
      { disciplina: 'Direito Tributário', confiancaMedia: '4.3 / 5', precisao: '82% — 28/34', status: 'CALIBRADO' },
      { disciplina: 'Língua Portuguesa', confiancaMedia: '4.5 / 5', precisao: '72% — 18/25', status: 'OVERCONFIDENT' },
      { disciplina: 'Contabilidade Geral', confiancaMedia: '3.2 / 5', precisao: '78% — 14/18', status: 'UNDERCONFIDENT' },
      { disciplina: 'Administração Pública', confiancaMedia: '4.0 / 5', precisao: '85% — 17/20', status: 'CALIBRADO' }
    ]
  };

  const abaB = data?.abaB_retencao || {
    conteudosTestadosAposIntervalo: 18,
    resultadosRecuperacaoTexto: '81% — 13 recuperações confirmadas em 16 verificações espaçadas',
    conteudosAindaNaoTestados: 6,
    revisoesRealizadas: 24,
    regraAvisoEstimativa: 'Aviso metodológico: Taxas de retenção e curvas de esquecimento são projeções matemáticas baseadas em intervalos e tentativas prévias, e não certezas biológicas individuais.',
    itens: [
      { disciplina: 'Direito Tributário', topico: 'Suspensão do crédito', ultimoTeste: 'Há 2 dias', retencaoEstimada: '88%', status: 'ESTABILIZADO' },
      { disciplina: 'Língua Portuguesa', topico: 'Concordância verbal', ultimoTeste: 'Há 5 dias', retencaoEstimada: '74%', status: 'ALERTA_ESQUECIMENTO' },
      { disciplina: 'Contabilidade Geral', topico: 'Balanço patrimonial', ultimoTeste: 'Há 7 dias', retencaoEstimada: '68%', status: 'VERIFICACAO_URGENTE' },
      { disciplina: 'Administração Pública', topico: 'Planejamento estratégico', ultimoTeste: 'Há 3 dias', retencaoEstimada: '85%', status: 'ESTABILIZADO' }
    ]
  };

  const modelos = data?.abaC_modeloEstudante || [
    {
      disciplina: 'Direito Tributário',
      desempenhoObservado: 'Favorável (82% de acertos observados)',
      retencao: 'Ainda não confirmada em prazos superiores a 15 dias',
      confianca: 'Tendência a superestimar conhecimento em exceções e imunidades',
      evidencia: 'Moderada (34 questões resolvidas)',
      proximaVerificacao: 'Questão inédita após intervalo de 3 dias',
      porQue: {
        dadosUtilizados: '34 resoluções no event_store (26 inéditas e 8 repetições), 4 sessões de foco registradas.',
        periodo: 'Últimos 30 dias de atividade',
        quantidadeObservacoes: 34,
        versaoAnalise: 'Gêmeo Digital v2.4 (Psicometria e Half-Life)',
        limitacoes: 'Amostra concentrada em Suspensão e Extinção; tópicos de ITCMD e Legislação Estadual ainda possuem baixa evidência (< 5 itens).'
      }
    },
    {
      disciplina: 'Língua Portuguesa',
      desempenhoObservado: 'Em consolidação (72% de acertos observados)',
      retencao: 'Sensível a distratores atrativos de banca',
      confianca: 'Superestimação moderada em sintaxe de orações',
      evidencia: 'Alta (48 questões resolvidas)',
      proximaVerificacao: 'Teste de transferência com pegadinha sutil',
      porQue: {
        dadosUtilizados: '48 resoluções de provas recentes FGV e Cebraspe.',
        periodo: 'Últimos 45 dias',
        quantidadeObservacoes: 48,
        versaoAnalise: 'Gêmeo Digital v2.4 (Classificação E1-E5)',
        limitacoes: 'Necessidade de maior amostragem em regência verbal e crase.'
      }
    },
    {
      disciplina: 'Contabilidade Geral',
      desempenhoObservado: 'Atenção (65% de acertos observados)',
      retencao: 'Necessita consolidação e prática espaçada',
      confianca: 'Subestimação (acerta com dúvida ou insegurança declarada)',
      evidencia: 'Moderada (22 questões resolvidas)',
      proximaVerificacao: 'Revisão guiada com exemplo resolvido',
      porQue: {
        dadosUtilizados: '22 resoluções de questões de escrituração e balanço.',
        periodo: 'Últimos 20 dias',
        quantidadeObservacoes: 22,
        versaoAnalise: 'Gêmeo Digital v2.4',
        limitacoes: 'Amostra recente sem resolução de prova completa de contabilidade sob restrição de tempo.'
      }
    }
  ];

  return (
    <div className="t28-container">
      {/* Abas Sub-Header */}
      <div className="t28-tabs-bar">
        <button
          className={`t28-tab-btn ${activeSubTab === 'A_CONFIANCA' ? 'active' : ''}`}
          onClick={() => setActiveSubTab('A_CONFIANCA')}
        >
          <Brain className="w-4 h-4 inline mr-1.5" />
          Aba A — Confiança & Calibração
        </button>

        <button
          className={`t28-tab-btn ${activeSubTab === 'B_RETENCAO' ? 'active' : ''}`}
          onClick={() => setActiveSubTab('B_RETENCAO')}
        >
          <Clock className="w-4 h-4 inline mr-1.5" />
          Aba B — Retenção & Decaimento
        </button>

        <button
          className={`t28-tab-btn ${activeSubTab === 'C_MODELO' ? 'active' : ''}`}
          onClick={() => setActiveSubTab('C_MODELO')}
        >
          <Sparkles className="w-4 h-4 inline mr-1.5" />
          Aba C — Modelo do Estudante
        </button>
      </div>

      {isLoading && (
        <div className="t28-loading">Carregando telemetria analítica avançada...</div>
      )}

      {/* =========================================================================
          ABA A — CONFIANÇA
          ========================================================================= */}
      {activeSubTab === 'A_CONFIANCA' && (
        <div className="t28-subview animate-fade-in">
          <div className="t28-grid-2col">
            {/* Matriz 2x2 Canônica */}
            <div className="t28-card">
              <div className="t28-card-header">
                <h4>Matriz 2x2 de Calibração Metaconscienciosa</h4>
                <span className="badge-calm">Confiança x Acerto</span>
              </div>
              <p className="t28-card-desc">
                Compara a confiança declarada pelo estudante antes do gabarito contra a exatidão objetiva da resposta.
              </p>

              <div className="matriz-table-container">
                <table className="matriz-table">
                  <thead>
                    <tr>
                      <th className="corner"></th>
                      <th className="header-acertou">Acertou</th>
                      <th className="header-errou">Errou</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr>
                      <td className="row-label">Confiança alta</td>
                      <td className="cell-success">
                        <span className="cell-num">{abaA.matriz.altaConfiancaAcerto}</span>
                        <span className="cell-tag">Bem Calibrado</span>
                      </td>
                      <td className="cell-danger">
                        <span className="cell-num">{abaA.matriz.altaConfiancaErro}</span>
                        <span className="cell-tag">Ponto Cego (Falsa Fluência)</span>
                      </td>
                    </tr>
                    <tr>
                      <td className="row-label">Confiança baixa</td>
                      <td className="cell-warning">
                        <span className="cell-num">{abaA.matriz.baixaConfiancaAcerto}</span>
                        <span className="cell-tag">Acerto Inseguro (Sorte/Dúvida)</span>
                      </td>
                      <td className="cell-neutral">
                        <span className="cell-num">{abaA.matriz.baixaConfiancaErro}</span>
                        <span className="cell-tag">Lacuna Consciente</span>
                      </td>
                    </tr>
                  </tbody>
                </table>
              </div>

              {/* Indicadores Canônicos */}
              <div className="matriz-indicators-row">
                <div className="matriz-ind-box">
                  <span className="ind-label">Acertos Inseguros</span>
                  <span className="ind-val text-amber-400">{abaA.acertosInseguros}</span>
                </div>
                <div className="matriz-ind-box">
                  <span className="ind-label">Erros com Alta Confiança</span>
                  <span className="ind-val text-rose-400">{abaA.errosAltaConfianca}</span>
                </div>
                <div className="matriz-ind-box">
                  <span className="ind-label">Brier Score</span>
                  <span className="ind-val text-indigo-400">{abaA.brierScore}</span>
                </div>
                <div className="matriz-ind-box">
                  <span className="ind-label">Índice Geral</span>
                  <span className="ind-val text-emerald-400">{abaA.indiceCalibracao}</span>
                </div>
              </div>
            </div>

            {/* Curva de Calibração e Disciplinas */}
            <div className="t28-card">
              <div className="t28-card-header">
                <h4>Curva de Calibração Estatística</h4>
                <span className="badge-calm">5 Níveis de Confiança</span>
              </div>
              <p className="t28-card-desc">
                Idealmente, itens respondidos com 80% de convicção devem atingir 80% de precisão real observada.
              </p>

              <div className="curva-bars-list">
                {abaA.curvaCalibracao.map((pt: any) => (
                  <div key={pt.nivel} className="curva-bar-item">
                    <div className="curva-bar-header">
                      <span className="curva-level">Nível {pt.nivel} ({pt.confiancaDeclarada})</span>
                      <span className="curva-acc">Real: <strong>{pt.precisaoReal}</strong> ({pt.amostra} itens)</span>
                    </div>
                    <div className="curva-track">
                      <div className="curva-fill" style={{ width: pt.precisaoReal }} />
                      <div className="curva-target-line" style={{ left: pt.confiancaDeclarada }} title="Alvo ideal" />
                    </div>
                  </div>
                ))}
              </div>

              <div className="disc-calib-section">
                <h5 className="sub-title">Confiança por Disciplina</h5>
                <div className="disc-calib-grid">
                  {abaA.confiancaPorDisciplina.map((d: any, idx: number) => (
                    <div key={idx} className="disc-calib-card">
                      <div className="disc-calib-top">
                        <span className="disc-name">{d.disciplina}</span>
                        <span className={`status-pill ${d.status.toLowerCase()}`}>{d.status}</span>
                      </div>
                      <div className="disc-calib-meta">
                        <span>Confiança: <strong>{d.confiancaMedia}</strong></span>
                        <span>Precisão: <strong>{d.precisao}</strong></span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* =========================================================================
          ABA B — RETENÇÃO
          ========================================================================= */}
      {activeSubTab === 'B_RETENCAO' && (
        <div className="t28-subview animate-fade-in">
          {/* Regra Canônica: Aviso de certeza metodológica */}
          <div className="banner-regra-estimativa">
            <Info className="w-5 h-5 text-indigo-400 shrink-0" />
            <div>
              <strong>Regra Canônica de Transparência Metodológica:</strong>
              <p>{abaB.regraAvisoEstimativa}</p>
            </div>
          </div>

          <div className="retencao-summary-row">
            <div className="ret-card">
              <span className="ret-num">{abaB.conteudosTestadosAposIntervalo}</span>
              <span className="ret-label">Conteúdos testados após intervalo</span>
            </div>
            <div className="ret-card">
              <span className="ret-num text-emerald-400">{abaB.resultadosRecuperacaoTexto}</span>
              <span className="ret-label">Resultados de recuperação confirmados</span>
            </div>
            <div className="ret-card">
              <span className="ret-num text-amber-400">{abaB.conteudosAindaNaoTestados}</span>
              <span className="ret-label">Conteúdos ainda não testados</span>
            </div>
            <div className="ret-card">
              <span className="ret-num text-indigo-400">{abaB.revisoesRealizadas}</span>
              <span className="ret-label">Revisões adaptativas realizadas</span>
            </div>
          </div>

          <div className="t28-card" style={{ marginTop: '1.25rem' }}>
            <div className="t28-card-header">
              <h4>Monitoramento de Estabilidade e Prontidão de Recuperação</h4>
            </div>
            <div className="retencao-table-container">
              <table className="retencao-table">
                <thead>
                  <tr>
                    <th>Disciplina</th>
                    <th>Tópico Curricular</th>
                    <th>Última Verificação</th>
                    <th>Estabilidade Projetada</th>
                    <th>Situação da Retenção</th>
                    <th>Ação</th>
                  </tr>
                </thead>
                <tbody>
                  {abaB.itens.map((it: any, idx: number) => (
                    <tr key={idx}>
                      <td className="font-semibold">{it.disciplina}</td>
                      <td>{it.topico}</td>
                      <td>{it.ultimoTeste}</td>
                      <td>
                        <div className="ret-proj-cell">
                          <span className="font-bold">{it.retencaoEstimada}</span>
                          <span className="proj-tag">Estimada</span>
                        </div>
                      </td>
                      <td>
                        <span className={`status-ret-badge ${it.status.toLowerCase()}`}>
                          {it.status.replace('_', ' ')}
                        </span>
                      </td>
                      <td>
                        <button
                          className="btn-link-action"
                          onClick={() => onNavigateToContentAnalysis && onNavigateToContentAnalysis(it.disciplina, it.topico)}
                        >
                          Ver evolução <ChevronRight className="w-3.5 h-3.5 inline" />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* =========================================================================
          ABA C — MODELO DO ESTUDANTE
          ========================================================================= */}
      {activeSubTab === 'C_MODELO' && (
        <div className="t28-subview animate-fade-in">
          <div className="modelo-intro-box">
            <Sparkles className="w-4 h-4 text-indigo-400" />
            <div>
              <h4 style={{ margin: 0, fontSize: '0.92rem', color: '#fff' }}>Perfil Psicométrico e Metaconsciencioso</h4>
              <p style={{ margin: '0.2rem 0 0 0', fontSize: '0.8rem', color: '#94a3b8' }}>
                Informações interpretáveis por disciplina geradas pelo terceiro observador a partir dos eventos longitudinais.
              </p>
            </div>
          </div>

          <div className="modelos-grid">
            {modelos.map((m: any, idx: number) => (
              <div key={idx} className="modelo-card">
                <div className="modelo-card-header">
                  <h3 className="modelo-disciplina">{m.disciplina}</h3>
                  <button
                    className="btn-ver-porque"
                    onClick={() => setActivePorQueModal(m)}
                  >
                    Ver por que o sistema concluiu isso <ChevronRight className="w-3.5 h-3.5 inline ml-1" />
                  </button>
                </div>

                <div className="modelo-attributes-list">
                  <div className="modelo-attr-row">
                    <span className="attr-name">Desempenho observado:</span>
                    <span className="attr-val font-semibold">{m.desempenhoObservado}</span>
                  </div>
                  <div className="modelo-attr-row">
                    <span className="attr-name">Retenção:</span>
                    <span className="attr-val text-amber-300">{m.retencao}</span>
                  </div>
                  <div className="modelo-attr-row">
                    <span className="attr-name">Confiança:</span>
                    <span className="attr-val">{m.confianca}</span>
                  </div>
                  <div className="modelo-attr-row">
                    <span className="attr-name">Evidência:</span>
                    <span className="attr-val text-indigo-300">{m.evidencia}</span>
                  </div>
                  <div className="modelo-attr-row">
                    <span className="attr-name">Próxima verificação:</span>
                    <span className="attr-val text-emerald-400 font-semibold">{m.proximaVerificacao}</span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Modal Canônico: "Ver por que o sistema concluiu isso" */}
      {activePorQueModal && (
        <div className="porque-modal-overlay" onClick={() => setActivePorQueModal(null)}>
          <div className="porque-modal-card" onClick={e => e.stopPropagation()}>
            <div className="porque-modal-header">
              <div>
                <span className="text-xs uppercase text-indigo-400 font-bold tracking-wider">Transparência Algorítmica</span>
                <h3 className="text-lg font-bold text-white mt-1">Por que o sistema concluiu isso?</h3>
                <p className="text-xs text-slate-400">{activePorQueModal.disciplina}</p>
              </div>
              <button onClick={() => setActivePorQueModal(null)} className="btn-close-sm">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="porque-modal-body">
              <div className="porque-item">
                <span className="porque-label">📊 Dados Utilizados</span>
                <p className="porque-text">{activePorQueModal.porQue?.dadosUtilizados}</p>
              </div>

              <div className="porque-item">
                <span className="porque-label">📅 Período Avaliado</span>
                <p className="porque-text">{activePorQueModal.porQue?.periodo}</p>
              </div>

              <div className="porque-item">
                <span className="porque-label">🔍 Quantidade de Observações</span>
                <p className="porque-text">{activePorQueModal.porQue?.quantidadeObservacoes} eventos auditados no Event Store</p>
              </div>

              <div className="porque-item">
                <span className="porque-label">⚙️ Versão da Análise</span>
                <p className="porque-text">{activePorQueModal.porQue?.versaoAnalise}</p>
              </div>

              <div className="porque-item highlight-limitacoes">
                <span className="porque-label text-amber-400">⚠️ Limitações da Conclusão</span>
                <p className="porque-text">{activePorQueModal.porQue?.limitacoes}</p>
              </div>
            </div>

            <div className="porque-modal-footer">
              <button className="btn-modal-close" onClick={() => setActivePorQueModal(null)}>
                Entendido
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
