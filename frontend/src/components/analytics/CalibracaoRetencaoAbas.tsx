import React, { useState, useEffect } from 'react';
import {
  Brain,
  Info,
  Clock,
  Sparkles,
  ChevronRight,
  X
} from 'lucide-react';
import { useSimplifiedMode } from '../../context/SimplifiedModeContext';
import './CalibracaoRetencaoAbas.css';

export interface CalibracaoRetencaoAbasProps {
  concursoId?: string;
  onNavigateToContentAnalysis?: (disciplina: string, topico: string) => void;
}

export const CalibracaoRetencaoAbas: React.FC<CalibracaoRetencaoAbasProps> = ({
  concursoId,
  onNavigateToContentAnalysis
}) => {
  const { isSimplifiedMode } = useSimplifiedMode();
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
    matriz: { altaConfiancaAcerto: 0, altaConfiancaErro: 0, baixaConfiancaAcerto: 0, baixaConfiancaErro: 0 },
    acertosInseguros: 0,
    errosAltaConfianca: 0,
    brierScore: 0.0,
    indiceCalibracao: '0.0%',
    evolucaoCalibracao: 'Aguardando resoluções com avaliação de confiança',
    curvaCalibracao: [],
    confiancaPorDisciplina: []
  };

  const abaB = data?.abaB_retencao || {
    conteudosTestadosAposIntervalo: 0,
    resultadosRecuperacaoTexto: '0% — Sem verificações espaçadas registradas',
    conteudosAindaNaoTestados: 0,
    revisoesRealizadas: 0,
    regraAvisoEstimativa: 'Aviso metodológico: Taxas de retenção e curvas de esquecimento são projeções matemáticas baseadas em intervalos e tentativas prévias, e não certezas biológicas individuais.',
    itens: []
  };

  const modelos: any[] = data?.abaC_modeloEstudante || [];

  return (
    <div className="t28-container">
      {/* Abas Sub-Header */}
      <div className="t28-tabs-bar">
        <button
          className={`t28-tab-btn ${activeSubTab === 'A_CONFIANCA' ? 'active' : ''}`}
          onClick={() => setActiveSubTab('A_CONFIANCA')}
        >
          <Brain className="w-4 h-4 inline mr-1.5" />
          {isSimplifiedMode ? 'Aba A — Certeza & Calibração' : 'Aba A — Confiança & Calibração'}
        </button>

        <button
          className={`t28-tab-btn ${activeSubTab === 'B_RETENCAO' ? 'active' : ''}`}
          onClick={() => setActiveSubTab('B_RETENCAO')}
        >
          <Clock className="w-4 h-4 inline mr-1.5" />
          {isSimplifiedMode ? 'Aba B — Retenção & Memória' : 'Aba B — Retenção & Decaimento'}
        </button>

        <button
          className={`t28-tab-btn ${activeSubTab === 'C_MODELO' ? 'active' : ''}`}
          onClick={() => setActiveSubTab('C_MODELO')}
        >
          <Sparkles className="w-4 h-4 inline mr-1.5" />
          {isSimplifiedMode ? 'Aba C — Perfil de Domínio' : 'Aba C — Modelo do Estudante'}
        </button>
      </div>

      {isLoading && (
        <div className="t28-loading">{isSimplifiedMode ? 'Carregando análise de retenção e calibração...' : 'Carregando telemetria analítica avançada...'}</div>
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
                  <span className="ind-label">{isSimplifiedMode ? 'Precisão da Certeza' : 'Brier Score'}</span>
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
                {abaA.confiancaPorDisciplina.length === 0 ? (
                  <div style={{ padding: '1.5rem', textAlign: 'center', color: '#94a3b8', fontSize: '0.82rem' }}>
                    Nenhuma resolução avaliada com metaconsciência ainda. Resolva questões informando seu nível de certeza para calibrar este gráfico.
                  </div>
                ) : (
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
                )}
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
          {/* Hero: Mentoria Prática (Modo Aluno) vs Modelo Matemático Puro (Modo Avançado) */}
          {isSimplifiedMode ? (
            <div className="modelo-matematico-hero aluno-mentoria" style={{ background: 'linear-gradient(135deg, rgba(16, 185, 129, 0.08) 0%, rgba(79, 70, 229, 0.05) 100%)', border: '1px solid rgba(16, 185, 129, 0.3)', borderRadius: '1rem', padding: '1.5rem', marginBottom: '1.25rem' }}>
              <div className="modelo-matematico-top" style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.65rem' }}>
                <span className="modelo-matematico-badge" style={{ background: '#10b981', color: '#ffffff', fontWeight: 700, padding: '0.2rem 0.6rem', borderRadius: '9999px', fontSize: '0.75rem' }}>
                  🎓 Mentoria Prática de Retenção
                </span>
                <span style={{ fontSize: '0.78rem', color: '#059669', fontWeight: 600 }}>
                  Ações recomendadas para não esquecer a matéria
                </span>
              </div>
              <h3 style={{ fontSize: '1.15rem', fontWeight: 700, color: 'var(--calm-text-main, #0f172a)', margin: '0 0 0.45rem 0' }}>
                Por que medimos seu Domínio Real em vez da média simples?
              </h3>
              <p className="modelo-matematico-desc" style={{ fontSize: '0.85rem', lineHeight: 1.6, color: 'var(--calm-text-muted, #475569)', margin: '0 0 1.25rem 0' }}>
                Tirar 90% em questões feitas logo após a leitura do PDF não garante que o conteúdo foi fixado a longo prazo. Com o passar dos dias sem contato, a retenção natural diminui. A mentoria calcula o seu <strong>domínio de hoje</strong> para que você resolva apenas o que está esquecendo, no momento certo.
              </p>

              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(210px, 1fr))', gap: '0.85rem' }}>
                <div style={{ background: 'var(--calm-card-bg, #ffffff)', padding: '0.85rem', borderRadius: '0.75rem', border: '1px solid var(--calm-card-border, #e2e8f0)', boxShadow: '0 1px 3px rgba(0,0,0,0.02)' }}>
                  <div style={{ fontSize: '0.78rem', fontWeight: 700, color: '#059669', marginBottom: '0.25rem' }}>🎯 1. Recuperação com Questões</div>
                  <div style={{ fontSize: '0.74rem', color: 'var(--calm-text-muted, #64748b)', lineHeight: 1.45 }}>Em vez de reler PDFs inteiros, resolva de 5 a 10 questões para reativar o conteúdo com esforço ativo.</div>
                </div>

                <div style={{ background: 'var(--calm-card-bg, #ffffff)', padding: '0.85rem', borderRadius: '0.75rem', border: '1px solid var(--calm-card-border, #e2e8f0)', boxShadow: '0 1px 3px rgba(0,0,0,0.02)' }}>
                  <div style={{ fontSize: '0.78rem', fontWeight: 700, color: '#4f46e5', marginBottom: '0.25rem' }}>⏳ 2. Respeite os Alertas de Tempo</div>
                  <div style={{ fontSize: '0.74rem', color: 'var(--calm-text-muted, #64748b)', lineHeight: 1.45 }}>Conteúdos há mais de 14 dias sem contato têm prioridade imediata na fila diária de estudos.</div>
                </div>

                <div style={{ background: 'var(--calm-card-bg, #ffffff)', padding: '0.85rem', borderRadius: '0.75rem', border: '1px solid var(--calm-card-border, #e2e8f0)', boxShadow: '0 1px 3px rgba(0,0,0,0.02)' }}>
                  <div style={{ fontSize: '0.78rem', fontWeight: 700, color: '#d97706', marginBottom: '0.25rem' }}>🛡️ 3. Simulados Frios Semanais</div>
                  <div style={{ fontSize: '0.74rem', color: 'var(--calm-text-muted, #64748b)', lineHeight: 1.45 }}>Simulados medem sua resposta real de prova, consolidando a estabilidade da memória.</div>
                </div>
              </div>
            </div>
          ) : (
            <div className="modelo-matematico-hero">
              <div className="modelo-matematico-top">
                <span className="modelo-matematico-badge">Modelo Matemático do Estado Real de Conhecimento (Student Knowledge State)</span>
              </div>
              <div className="modelo-matematico-equacao">
                P<sub>atual</sub>(t) = P<sub>base</sub> · e<sup>-Δt / S</sup>
              </div>
              <p className="modelo-matematico-desc">
                <strong>Por que a média simples é enganosa?</strong> Medir o domínio de um tópico apenas por acertos/total oculta que uma nota de 90% obtida há 45 dias decaiu severamente pela Curva do Esquecimento de Ebbinghaus. Além disso, resolver 10 questões no mesmo dia da leitura do PDF infla a nota com memória de trabalho imediata.
              </p>

              <div className="modelo-vars-grid">
                <div className="modelo-var-card">
                  <div className="var-header">
                    <span className="var-simbolo">P<sub>base</sub></span>
                    <span className="var-nome">Taxa Ponderada</span>
                  </div>
                  <span className="var-expl">Simulados (1.5x) e retestes frios (1.2x) têm maior peso que resoluções imediatas pós-PDF (0.5x).</span>
                </div>

                <div className="modelo-var-card">
                  <div className="var-header">
                    <span className="var-simbolo">Δt</span>
                    <span className="var-nome">Intervalo sem Contato</span>
                  </div>
                  <span className="var-expl">Número de dias decorridos desde a última exposição ou resolução ativa no conteúdo.</span>
                </div>

                <div className="modelo-var-card">
                  <div className="var-header">
                    <span className="var-simbolo">S</span>
                    <span className="var-nome">Força da Memória</span>
                  </div>
                  <span className="var-expl">Estabilidade sináptica que se expande a cada revisão espaçada e reteste frio bem-sucedido.</span>
                </div>

                <div className="modelo-var-card destaque">
                  <div className="var-header">
                    <span className="var-simbolo">P<sub>atual</sub>(t)</span>
                    <span className="var-nome">Proficiência Real Hoje</span>
                  </div>
                  <span className="var-expl">Estimativa autêntica decaída no tempo presente, prevenindo a falsa fluência.</span>
                </div>
              </div>
            </div>
          )}

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
              <h4>Retenção Estimada por Tópico (Curva de Memória)</h4>
            </div>
            <div className="retencao-table-container">
              {abaB.itens.length === 0 ? (
                <div style={{ padding: '2rem 1rem', textAlign: 'center', color: '#94a3b8', fontSize: '0.82rem' }}>
                  Nenhum tópico com histórico de retenção avaliado após intervalos espaçados.
                </div>
              ) : (
                <table className="retencao-table">
                  <thead>
                    <tr>
                      <th>Disciplina</th>
                      <th>Tópico Curricular</th>
                      <th>Média Bruta</th>
                      <th>P<sub>base</sub> (Ponderada)</th>
                      <th>Δt (Último Contato)</th>
                      <th>S (Força Memória)</th>
                      <th>P<sub>atual</sub> (Real Hoje)</th>
                      <th>Situação</th>
                      <th>Ação</th>
                    </tr>
                  </thead>
                  <tbody>
                    {abaB.itens.map((it: any, idx: number) => {
                      const pAtualNum = parseFloat(it.pAtual || it.retencaoEstimada || '0');
                      const barColor = pAtualNum >= 80 ? '#34d399' : (pAtualNum >= 65 ? '#60a5fa' : (pAtualNum >= 45 ? '#fbbf24' : '#f87171'));
                      return (
                        <tr key={idx}>
                          <td className="font-semibold">{it.disciplina}</td>
                          <td>
                            <div style={{ display: 'flex', flexDirection: 'column' }}>
                              <span>{it.topico}</span>
                              {it.diagnostico && (
                                <span style={{ fontSize: '0.7rem', color: '#94a3b8', marginTop: '0.15rem' }}>
                                  {it.diagnostico}
                                </span>
                              )}
                            </div>
                          </td>
                          <td>
                            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start' }}>
                              <span style={{ textDecoration: it.isMediaSimplesEnganosa ? 'line-through' : 'none', color: it.isMediaSimplesEnganosa ? '#94a3b8' : 'inherit' }}>
                                {it.mediaSimples || it.retencaoEstimada}
                              </span>
                              {it.isMediaSimplesEnganosa && (
                                <span className="badge-falsa-fluencia">
                                  ⚠️ Falsa Fluência
                                </span>
                              )}
                            </div>
                          </td>
                          <td>
                            <span className="font-semibold text-indigo-300">{it.pBase || it.mediaSimples || it.retencaoEstimada}</span>
                          </td>
                          <td>
                            <span style={{ fontSize: '0.8rem', color: it.deltaTDias >= 15 ? '#fbbf24' : 'inherit' }}>
                              {it.ultimoTeste || (it.deltaTDias !== undefined ? `${it.deltaTDias} dias` : 'Recente')}
                            </span>
                          </td>
                          <td>
                            <span style={{ fontSize: '0.8rem', fontWeight: 600 }}>
                              {it.forcaMemoriaDias !== undefined ? `${it.forcaMemoriaDias} dias` : '—'}
                            </span>
                          </td>
                          <td>
                            <div className="ret-proj-cell" style={{ flexDirection: 'column', alignItems: 'flex-start', gap: '0.15rem' }}>
                              <span className="font-bold" style={{ color: barColor }}>{it.pAtual || it.retencaoEstimada}</span>
                              <div className="retencao-barra-mini">
                                <div className="retencao-barra-fill" style={{ width: `${Math.min(100, Math.max(5, pAtualNum))}%`, background: barColor }} />
                              </div>
                            </div>
                          </td>
                          <td>
                            <span className={`status-ret-badge ${(it.status || '').toLowerCase()}`}>
                              {(it.status || 'ESTABILIZADO').replace(/_/g, ' ')}
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
                      );
                    })}
                  </tbody>
                </table>
              )}
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
            {modelos.length === 0 ? (
              <div style={{ gridColumn: '1 / -1', padding: '3rem 1.5rem', textAlign: 'center', color: '#94a3b8', fontSize: '0.85rem' }}>
                Ainda não há dados suficientes no event_store para traçar perfis psicométricos comparativos. Conforme você resolver questões, este diagnóstico interpretativo será calculado.
              </div>
            ) : (
              modelos.map((m: any, idx: number) => (
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
            )))}
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
                <p className="porque-text">{activePorQueModal.porQue?.quantidadeObservacoes} resoluções e sessões analisadas no histórico</p>
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
