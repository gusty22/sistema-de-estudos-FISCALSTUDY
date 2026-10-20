import React, { useState, useMemo } from 'react';
import {
  type DisciplinaConfig,
  type MotorParetoOutput,
  executarMotorParetoEdital,
  exportarTabelaMarkdown,
  TEMPLATE_DEFAULT_EDITAL_FISCAL,
} from '../../utils/motorParetoEdital';
import './MotorParetoEditalModal.css';

interface MotorParetoEditalModalProps {
  isOpen: boolean;
  onClose: () => void;
  concursoId: string;
  concursoNome: string;
  onSuccessImport?: () => void;
}

export const MotorParetoEditalModal: React.FC<MotorParetoEditalModalProps> = ({
  isOpen,
  onClose,
  concursoId,
  concursoNome,
  onSuccessImport,
}) => {
  const [activeTab, setActiveTab] = useState<'ENTRADA' | 'TABELA' | 'QUARTETO'>('ENTRADA');

  // Configuração das Disciplinas (Quadro de Provas)
  const [disciplinas, setDisciplinas] = useState<DisciplinaConfig[]>(
    TEMPLATE_DEFAULT_EDITAL_FISCAL.disciplinas
  );

  // Texto Bruto do Conteúdo Programático
  const [rawText, setRawText] = useState<string>(TEMPLATE_DEFAULT_EDITAL_FISCAL.rawText);

  // Estados de Filtro na Tabela
  const [searchTerm, setSearchTerm] = useState('');
  const [filtroClasse, setFiltroClasse] = useState<'TODAS' | 'A' | 'B' | 'C'>('TODAS');
  const [filtroFoco, setFiltroFoco] = useState<'TODOS' | 'Teoria' | 'Lei Seca' | 'Questões'>('TODOS');
  const [filtroDisciplina, setFiltroDisciplina] = useState<string>('TODAS');

  // Estados de feedback
  const [copiedMd, setCopiedMd] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [saveSuccessMsg, setSaveSuccessMsg] = useState<string | null>(null);

  // Execução Reativa do Motor de Pareto
  const paretoResult: MotorParetoOutput = useMemo(() => {
    return executarMotorParetoEdital(rawText, disciplinas);
  }, [rawText, disciplinas]);

  if (!isOpen) return null;

  // Handlers para o Quadro de Provas
  const handleUpdateDisciplina = (id: string, field: keyof DisciplinaConfig, value: any) => {
    setDisciplinas(prev =>
      prev.map(d => (d.id === id ? { ...d, [field]: value } : d))
    );
  };

  const handleAddDisciplina = () => {
    const newId = String(Date.now());
    setDisciplinas(prev => [
      ...prev,
      { id: newId, nome: 'Nova Disciplina', questoes: 10, peso: 1.0, complexidade: 1.2, dominioInicial: 50 },
    ]);
  };

  const handleRemoveDisciplina = (id: string) => {
    if (disciplinas.length <= 1) return;
    setDisciplinas(prev => prev.filter(d => d.id !== id));
  };

  const handleCarregarExemploFiscal = () => {
    setDisciplinas(TEMPLATE_DEFAULT_EDITAL_FISCAL.disciplinas);
    setRawText(TEMPLATE_DEFAULT_EDITAL_FISCAL.rawText);
    setActiveTab('TABELA');
  };

  const handleCarregarDoEditalAtual = async () => {
    try {
      const url = concursoId && concursoId !== 'undefined'
        ? `/api/v1/concursos/${encodeURIComponent(concursoId)}/edital`
        : '/api/v1/edital/topicos';
      const res = await fetch(url);
      if (!res.ok) return;
      const data = await res.json();
      const topics: Array<any> = Array.isArray(data) ? data : (data?.topicos || []);
      if (!topics || topics.length === 0) return;

      const discMap = new Map<string, Array<{ assunto: string; subassunto?: string; peso?: number }>>();
      topics.forEach((t) => {
        const disc = t.disciplina || 'Conhecimentos Fiscais';
        if (!discMap.has(disc)) discMap.set(disc, []);
        discMap.get(disc)!.push({
          assunto: t.assunto || 'Tópico Geral',
          subassunto: t.subassunto,
          peso: t.peso
        });
      });

      const newDisciplinas: DisciplinaConfig[] = [];
      let rawTextBuilt = '';

      let dIdx = 1;
      discMap.forEach((topList, discName) => {
        const avgPeso = topList.reduce((acc, cur) => acc + (cur.peso || 1.0), 0) / topList.length;
        newDisciplinas.push({
          id: `disc_${dIdx++}`,
          nome: discName,
          questoes: Math.max(5, Math.min(25, topList.length)),
          peso: Math.round(avgPeso * 10) / 10 || 1.0,
          complexidade: discName.toLowerCase().includes('tribut') ? 1.4 : discName.toLowerCase().includes('contab') ? 1.5 : 1.2,
          dominioInicial: 50
        });

        rawTextBuilt += `DISCIPLINA: ${discName}\n`;
        topList.forEach((t, tIdx) => {
          if (t.subassunto && t.subassunto.trim() !== '') {
            rawTextBuilt += `${tIdx + 1}. ${t.assunto} - ${t.subassunto}\n`;
          } else {
            rawTextBuilt += `${tIdx + 1}. ${t.assunto}\n`;
          }
        });
        rawTextBuilt += '\n';
      });

      setDisciplinas(newDisciplinas);
      setRawText(rawTextBuilt.trim());
      setActiveTab('TABELA');
    } catch (e) {
      console.warn('Erro ao carregar tópicos do edital no Pareto:', e);
    }
  };

  React.useEffect(() => {
    if (isOpen) {
      handleCarregarDoEditalAtual();
    }
  }, [isOpen, concursoId]);

  // Filtragem dos Tópicos para a Tabela
  const topicosFiltrados = paretoResult.topicos.filter(t => {
    const matchBusca =
      t.topicoPrincipal.toLowerCase().includes(searchTerm.toLowerCase()) ||
      t.subtopicoArtigos.toLowerCase().includes(searchTerm.toLowerCase()) ||
      t.disciplina.toLowerCase().includes(searchTerm.toLowerCase()) ||
      t.id.toLowerCase().includes(searchTerm.toLowerCase());
    const matchClasse = filtroClasse === 'TODAS' || t.classePareto === filtroClasse;
    const matchFoco = filtroFoco === 'TODOS' || t.focoEstrategico === filtroFoco;
    const matchDisc = filtroDisciplina === 'TODAS' || t.disciplina === filtroDisciplina;
    return matchBusca && matchClasse && matchFoco && matchDisc;
  });

  // Copiar Markdown Estrito
  const handleCopyMarkdown = () => {
    const md = exportarTabelaMarkdown(topicosFiltrados.length > 0 ? topicosFiltrados : paretoResult.topicos);
    navigator.clipboard.writeText(md);
    setCopiedMd(true);
    setTimeout(() => setCopiedMd(false), 2500);
  };

  // Exportar CSV
  const handleExportCsv = () => {
    const rows = [
      ['ID', 'Disciplina', 'Tópico', 'Subtópico / Artigos Correlatos', 'Classe Pareto', 'Peso Relativo Prova (%)', 'Foco Estratégico'],
      ...paretoResult.topicos.map(t => [
        t.id,
        `"${t.disciplina}"`,
        `"${t.topicoPrincipal}"`,
        `"${t.subtopicoArtigos}"`,
        t.classePareto,
        t.pesoRelativoProva.toFixed(1),
        t.focoEstrategico,
      ]),
    ];
    const csvContent = 'data:text/csv;charset=utf-8,\uFEFF' + rows.map(e => e.join(';')).join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `edital_verticalizado_pareto_${concursoId || 'fiscal'}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // Salvar no Concurso Atual (grava no banco SQLite via backend)
  const handleSalvarNoConcurso = async () => {
    if (!concursoId) {
      alert('Selecione um concurso ativo para integrar.');
      return;
    }

    setIsSaving(true);
    setSaveSuccessMsg(null);

    try {
      // Converte os tópicos de Pareto para a árvore de importação do FiscalStudy
      const materiasAgrupadas: Record<string, any[]> = {};

      paretoResult.topicos.forEach(t => {
        if (!materiasAgrupadas[t.disciplina]) {
          materiasAgrupadas[t.disciplina] = [];
        }
        materiasAgrupadas[t.disciplina].push({
          assunto: t.topicoPrincipal,
          subassunto: t.subtopicoArtigos !== '—' ? t.subtopicoArtigos : undefined,
          peso: t.classePareto === 'A' ? 2.0 : t.classePareto === 'B' ? 1.5 : 1.0,
          questoesPrevistas: Math.round(t.incidenciaEstimada / 3) || 1,
          tipoClassificacao: 'CONFIRMADA',
          confirmadoHumano: true,
          trechoOrigem: `Pareto Classe ${t.classePareto} (${t.incidenciaEstimada}% hist.) | Foco: ${t.focoEstrategico} | Peso Prova: ${t.pesoRelativoProva}%`,
        });
      });

      const payload = {
        materias: Object.keys(materiasAgrupadas).map(nome => ({
          disciplina: nome,
          topicos: materiasAgrupadas[nome],
        })),
      };

      const res = await fetch(`/api/v1/concursos/${concursoId}/edital/import-json`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          payload: JSON.stringify(payload),
          confirmadoHumano: true,
          procedenciaStatus: 'CONFIRMADA',
          overwrite: true,
          replaceAllPreviousTopics: true,
          titulo: `Edital Verticalizado Ponderado (Pareto) — ${concursoNome}`,
          versao: '3.0-PARETO',
          tipo: 'EDITAL_OFICIAL_POS_EDITAL',
          updateConcursoSituacao: true,
          novaSituacaoConcurso: 'EDITAL_PUBLICADO',
        }),
      });

      if (!res.ok) {
        throw new Error('Falha ao gravar no backend.');
      }

      setSaveSuccessMsg('✓ Edital Verticalizado Ponderado integrado com sucesso ao concurso!');
      if (onSuccessImport) {
        onSuccessImport();
      }
      setTimeout(() => {
        setSaveSuccessMsg(null);
      }, 4000);
    } catch (err: any) {
      alert('Erro ao salvar no concurso: ' + err.message);
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="motor-pareto-overlay" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="motor-pareto-modal" role="dialog" aria-modal="true">
        {/* Header */}
        <div className="motor-pareto-header">
          <div className="motor-pareto-title-group">
            <div className="motor-pareto-icon">🎯</div>
            <div>
              <h3>Motor de Ingestão e Matriz de Pareto da Área Fiscal</h3>
              <p>
                Parseamento estrito de edital bruto, ponderação de pontos e classificação de alta eficiência (Classes A, B e C)
              </p>
            </div>
          </div>
          <button className="motor-pareto-close-btn" onClick={onClose} title="Fechar">
            ✕
          </button>
        </div>

        {/* Abas */}
        <div className="motor-pareto-nav">
          <button
            className={`motor-nav-tab ${activeTab === 'ENTRADA' ? 'active' : ''}`}
            onClick={() => setActiveTab('ENTRADA')}
          >
            📥 1. Entrada do Edital & Quadro de Provas
          </button>
          <button
            className={`motor-nav-tab ${activeTab === 'TABELA' ? 'active' : ''}`}
            onClick={() => setActiveTab('TABELA')}
          >
            📊 2. Edital Verticalizado Ponderado ({paretoResult.topicos.length} tópicos)
          </button>
          <button
            className={`motor-nav-tab ${activeTab === 'QUARTETO' ? 'active' : ''}`}
            onClick={() => setActiveTab('QUARTETO')}
          >
            ⚖️ 3. Diagnóstico do Quarteto & Alocação de Tempo
          </button>
        </div>

        {/* Corpo do Modal */}
        <div className="motor-pareto-body">
          {/* Alertas de Sucesso */}
          {saveSuccessMsg && (
            <div
              style={{
                background: 'rgba(16, 185, 129, 0.15)',
                color: '#10b981',
                padding: '0.75rem 1rem',
                borderRadius: '8px',
                border: '1px solid rgba(16, 185, 129, 0.3)',
                marginBottom: '1rem',
                fontSize: '0.88rem',
                fontWeight: 600,
              }}
            >
              {saveSuccessMsg}
            </div>
          )}

          {/* KPIs Resumo */}
          <div className="pareto-kpis">
            <div className="pareto-kpi-card">
              <span className="pareto-kpi-label">Pontuação Total</span>
              <span className="pareto-kpi-value">{paretoResult.totalPontosProva.toFixed(1)} pts</span>
              <span className="pareto-kpi-sub">{paretoResult.totalQuestoes} questões distribuídas</span>
            </div>
            <div className="pareto-kpi-card">
              <span className="pareto-kpi-label">Tópicos Mapeados</span>
              <span className="pareto-kpi-value">{paretoResult.topicos.length} itens</span>
              <span className="pareto-kpi-sub">Segmentação estrita por matéria</span>
            </div>
            <div className="pareto-kpi-card">
              <span className="pareto-kpi-label">Cobertura Classe A</span>
              <span className="pareto-kpi-value" style={{ color: '#10b981' }}>
                {paretoResult.coberturaClasseA}%
              </span>
              <span className="pareto-kpi-sub">80% do resultado em ~20% dos tópicos</span>
            </div>
            <div className="pareto-kpi-card">
              <span className="pareto-kpi-label">Maior Peso na Prova</span>
              <span className="pareto-kpi-value" style={{ color: '#3b82f6', fontSize: '1.25rem' }}>
                {paretoResult.disciplinasCalculadas[0]?.nome || '—'}
              </span>
              <span className="pareto-kpi-sub">
                {paretoResult.disciplinasCalculadas[0]?.pesoRelativo || 0}% dos pontos totais
              </span>
            </div>
          </div>

          {/* ABA 1: ENTRADA & QUADRO */}
          {activeTab === 'ENTRADA' && (
            <div className="input-grid">
              {/* Painel Esquerdo: Texto Bruto */}
              <div className="form-panel">
                <div className="panel-header">
                  <h4>📄 Conteúdo Programático Bruto</h4>
                  <div style={{ display: 'flex', gap: '0.4rem' }}>
                    <button
                      type="button"
                      className="btn btn-secondary"
                      onClick={handleCarregarDoEditalAtual}
                      style={{ fontSize: '0.78rem', padding: '4px 10px', backgroundColor: '#4f46e5', color: '#ffffff' }}
                      title="Sincronizar com os tópicos do Edital Verticalizado deste concurso"
                    >
                      📥 Ler do Edital Verticalizado
                    </button>
                    <button
                      type="button"
                      className="btn btn-secondary"
                      onClick={handleCarregarExemploFiscal}
                      style={{ fontSize: '0.78rem', padding: '4px 10px' }}
                      title="Carregar modelo de alta incidência da Área Fiscal"
                    >
                      ⚡ Edital Padrão
                    </button>
                  </div>
                </div>
                <textarea
                  className="textarea-edital"
                  value={rawText}
                  onChange={e => setRawText(e.target.value)}
                  placeholder="Cole aqui o texto do edital (disciplinas e tópicos)..."
                />
                <span style={{ fontSize: '0.74rem', color: '#64748b', marginTop: '0.4rem' }}>
                  O motor detecta automaticamente disciplinas, numerações, tópicos e referências a leis/artigos.
                </span>
              </div>

              {/* Painel Direito: Quadro de Provas (Disciplinas, Questões e Pesos) */}
              <div className="form-panel">
                <div className="panel-header">
                  <h4>🎯 Quadro de Provas (Questões × Peso = Pontos)</h4>
                  <button
                    className="btn btn-secondary"
                    onClick={handleAddDisciplina}
                    style={{ fontSize: '0.78rem', padding: '4px 10px' }}
                  >
                    + Matéria
                  </button>
                </div>
                <div className="disciplinas-table-wrapper">
                  <table className="disciplinas-table">
                    <thead>
                      <tr>
                        <th>Disciplina</th>
                        <th>Questões</th>
                        <th>Peso</th>
                        <th>Pontos</th>
                        <th>% Prova</th>
                        <th></th>
                      </tr>
                    </thead>
                    <tbody>
                      {disciplinas.map(d => {
                        const pontos = d.questoes * d.peso;
                        const pesoRel = paretoResult.totalPontosProva > 0
                          ? ((pontos / paretoResult.totalPontosProva) * 100).toFixed(1)
                          : '0';
                        return (
                          <tr key={d.id}>
                            <td>
                              <input
                                type="text"
                                value={d.nome}
                                onChange={e => handleUpdateDisciplina(d.id, 'nome', e.target.value)}
                                style={{
                                  padding: '4px 6px',
                                  fontSize: '0.82rem',
                                  borderRadius: '6px',
                                  border: '1px solid #cbd5e1',
                                  width: '130px',
                                }}
                              />
                            </td>
                            <td>
                              <input
                                type="number"
                                min={1}
                                className="input-num"
                                value={d.questoes}
                                onChange={e => handleUpdateDisciplina(d.id, 'questoes', parseInt(e.target.value, 10) || 0)}
                              />
                            </td>
                            <td>
                              <input
                                type="number"
                                step="0.5"
                                min={0.5}
                                className="input-num"
                                value={d.peso}
                                onChange={e => handleUpdateDisciplina(d.id, 'peso', parseFloat(e.target.value) || 1)}
                              />
                            </td>
                            <td style={{ fontWeight: 700 }}>{pontos.toFixed(1)}</td>
                            <td>
                              <span style={{ color: '#3b82f6', fontWeight: 600 }}>{pesoRel}%</span>
                            </td>
                            <td>
                              <button
                                onClick={() => handleRemoveDisciplina(d.id)}
                                style={{
                                  background: 'transparent',
                                  border: 'none',
                                  color: '#ef4444',
                                  cursor: 'pointer',
                                  fontSize: '0.85rem',
                                }}
                                title="Remover"
                              >
                                ✕
                              </button>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>

                <div style={{ marginTop: '1.25rem', textAlign: 'right' }}>
                  <button
                    className="btn btn-primary"
                    onClick={() => setActiveTab('TABELA')}
                    style={{ padding: '8px 18px', fontSize: '0.88rem' }}
                  >
                    ⚡ Processar e Ver Tabela Verticalizada ➔
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* ABA 2: TABELA VERTICALIZADA PONDERADA */}
          {activeTab === 'TABELA' && (
            <div>
              {/* Barra de Filtros e Ações */}
              <div className="table-actions-bar">
                <div className="filter-group">
                  <input
                    type="text"
                    className="search-input"
                    placeholder="🔍 Buscar tópico ou artigo..."
                    value={searchTerm}
                    onChange={e => setSearchTerm(e.target.value)}
                  />

                  {/* Filtro Classe */}
                  <select
                    className="search-input"
                    style={{ minWidth: '130px' }}
                    value={filtroClasse}
                    onChange={e => setFiltroClasse(e.target.value as any)}
                  >
                    <option value="TODAS">Classe: Todas</option>
                    <option value="A">Classe A (Alta Incidência)</option>
                    <option value="B">Classe B (Média Incidência)</option>
                    <option value="C">Classe C (Suporte / Residual)</option>
                  </select>

                  {/* Filtro Foco */}
                  <select
                    className="search-input"
                    style={{ minWidth: '130px' }}
                    value={filtroFoco}
                    onChange={e => setFiltroFoco(e.target.value as any)}
                  >
                    <option value="TODOS">Foco: Todos</option>
                    <option value="Lei Seca">Lei Seca</option>
                    <option value="Teoria">Teoria</option>
                    <option value="Questões">Questões</option>
                  </select>

                  {/* Filtro Disciplina */}
                  <select
                    className="search-input"
                    style={{ minWidth: '140px' }}
                    value={filtroDisciplina}
                    onChange={e => setFiltroDisciplina(e.target.value)}
                  >
                    <option value="TODAS">Matéria: Todas</option>
                    {disciplinas.map(d => (
                      <option key={d.id} value={d.nome}>
                        {d.nome}
                      </option>
                    ))}
                  </select>
                </div>

                <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
                  <button
                    className="btn btn-secondary"
                    onClick={handleCopyMarkdown}
                    style={{
                      fontSize: '0.82rem',
                      padding: '6px 12px',
                      background: copiedMd ? 'rgba(16, 185, 129, 0.2)' : undefined,
                      borderColor: copiedMd ? '#10b981' : undefined,
                      color: copiedMd ? '#10b981' : undefined,
                    }}
                    title="Copiar tabela formatada em Markdown para notas/Obsidian"
                  >
                    📋 {copiedMd ? '✓ Markdown Copiado!' : 'Copiar Tabela Markdown'}
                  </button>

                  <button
                    className="btn btn-secondary"
                    onClick={handleExportCsv}
                    style={{ fontSize: '0.82rem', padding: '6px 12px' }}
                    title="Baixar planilha CSV"
                  >
                    📥 Exportar CSV
                  </button>

                  <button
                    className="btn btn-primary"
                    onClick={handleSalvarNoConcurso}
                    disabled={isSaving}
                    style={{ fontSize: '0.82rem', padding: '6px 14px' }}
                    title="Grava todos os tópicos ponderados na base de dados do concurso ativo"
                  >
                    💾 {isSaving ? 'Gravando...' : 'Salvar no Concurso Atual'}
                  </button>
                </div>
              </div>

              {/* Tabela Estruturada em Markdown Renderizada */}
              <div className="pareto-results-table-container">
                <table className="pareto-results-table">
                  <thead>
                    <tr>
                      <th style={{ width: '80px' }}>ID</th>
                      <th style={{ width: '160px' }}>Disciplina</th>
                      <th>Tópico</th>
                      <th>Subtópico / Artigos Correlatos</th>
                      <th style={{ width: '130px', textAlign: 'center' }}>Classe Pareto</th>
                      <th style={{ width: '130px', textAlign: 'center' }}>Peso Relativo Prova</th>
                      <th style={{ width: '120px', textAlign: 'center' }}>Foco Estratégico</th>
                    </tr>
                  </thead>
                  <tbody>
                    {topicosFiltrados.length === 0 ? (
                      <tr>
                        <td colSpan={7} style={{ textAlign: 'center', padding: '2rem', color: '#64748b' }}>
                          Nenhum tópico encontrado com os filtros selecionados.
                        </td>
                      </tr>
                    ) : (
                      topicosFiltrados.map(t => (
                        <tr key={t.id}>
                          <td style={{ fontFamily: 'monospace', fontWeight: 600, color: '#64748b' }}>
                            {t.id}
                          </td>
                          <td style={{ fontWeight: 600 }}>{t.disciplina}</td>
                          <td style={{ fontWeight: 600, color: 'var(--text-primary)' }}>
                            {t.topicoPrincipal}
                          </td>
                          <td style={{ color: '#64748b', fontSize: '0.8rem' }}>
                            {t.subtopicoArtigos}
                          </td>
                          <td style={{ textAlign: 'center' }}>
                            <span
                              className={`badge-pareto ${
                                t.classePareto === 'A'
                                  ? 'classe-a'
                                  : t.classePareto === 'B'
                                  ? 'classe-b'
                                  : 'classe-c'
                              }`}
                            >
                              Classe {t.classePareto}
                            </span>
                          </td>
                          <td style={{ textAlign: 'center', fontWeight: 700 }}>
                            {t.pesoRelativoProva.toFixed(1)}%
                          </td>
                          <td style={{ textAlign: 'center' }}>
                            <span
                              className={`badge-foco ${
                                t.focoEstrategico === 'Lei Seca'
                                  ? 'lei-seca'
                                  : t.focoEstrategico === 'Teoria'
                                  ? 'teoria'
                                  : 'questoes'
                              }`}
                            >
                              {t.focoEstrategico === 'Lei Seca' && '⚖️ '}
                              {t.focoEstrategico === 'Teoria' && '📖 '}
                              {t.focoEstrategico === 'Questões' && '🎯 '}
                              {t.focoEstrategico}
                            </span>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* ABA 3: DIAGNÓSTICO DO QUARTETO & ALOCAÇÃO DE TEMPO */}
          {activeTab === 'QUARTETO' && (
            <div>
              <div style={{ marginBottom: '1.25rem' }}>
                <h4 style={{ margin: 0, fontSize: '1rem', fontWeight: 700 }}>
                  ⚖️ Diagnóstico de Alocação de Tempo Baseado no Quarteto Estratégico
                </h4>
                <p style={{ margin: '0.25rem 0 0', fontSize: '0.84rem', color: '#64748b' }}>
                  Ponderação algorítmica considerando <strong>Volume</strong> de tópicos, <strong>Incidência/Peso</strong> na prova,{' '}
                  <strong>Complexidade Intrínseca</strong> e o seu <strong>Domínio Inicial</strong> declarado.
                </p>
              </div>

              <div className="quarteto-grid">
                {paretoResult.quartetoAlocacao.map(item => {
                  const discConfig = disciplinas.find(d => d.nome === item.disciplina);
                  return (
                    <div key={item.disciplina} className="quarteto-card">
                      <div className="quarteto-card-header">
                        <span className="quarteto-card-title">{item.disciplina}</span>
                        <span className="quarteto-percent-badge">{item.tempoRecomendadoPercent}%</span>
                      </div>

                      <div className="progress-track">
                        <div
                          className="progress-fill"
                          style={{ width: `${Math.min(100, item.tempoRecomendadoPercent * 2.5)}%` }}
                        />
                      </div>

                      <div className="quarteto-metrics-row">
                        <span>Peso na Prova:</span>
                        <strong>{item.pesoRelativoProva}% ({item.pontos} pts)</strong>
                      </div>
                      <div className="quarteto-metrics-row">
                        <span>Volume de Tópicos:</span>
                        <strong>{item.volumeTopicos} itens</strong>
                      </div>
                      <div className="quarteto-metrics-row">
                        <span>Complexidade:</span>
                        <strong>{item.complexidade.toFixed(2)}x</strong>
                      </div>
                      <div className="quarteto-metrics-row">
                        <span>Tempo Sugerido (25h/sem):</span>
                        <strong style={{ color: '#3b82f6' }}>{item.horasSugeridasSemanais}h / semana</strong>
                      </div>

                      {/* Slider de Domínio Inicial para recalcular interativamente */}
                      {discConfig && (
                        <div className="slider-group">
                          <label>
                            <span>Domínio Inicial do Estudante:</span>
                            <span style={{ color: '#10b981' }}>{discConfig.dominioInicial}%</span>
                          </label>
                          <input
                            type="range"
                            min="0"
                            max="100"
                            step="5"
                            value={discConfig.dominioInicial}
                            onChange={e =>
                              handleUpdateDisciplina(
                                discConfig.id,
                                'dominioInicial',
                                parseInt(e.target.value, 10)
                              )
                            }
                            style={{ width: '100%', cursor: 'pointer' }}
                          />
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="motor-pareto-footer">
          <div style={{ fontSize: '0.8rem', color: '#64748b' }}>
            {activeTab === 'TABELA' && (
              <span>
                Exibindo <strong>{topicosFiltrados.length}</strong> de {paretoResult.topicos.length} tópicos classificados
              </span>
            )}
            {activeTab === 'QUARTETO' && (
              <span>
                Ajuste os controles deslizantes de domínio para calibrar a grade de estudos automaticamente.
              </span>
            )}
            {activeTab === 'ENTRADA' && (
              <span>
                Configure a pontuação e clique em <strong>Processar</strong> para gerar a Matriz de Pareto.
              </span>
            )}
          </div>
          <div style={{ display: 'flex', gap: '0.5rem' }}>
            <button className="btn btn-secondary" onClick={onClose} style={{ padding: '7px 16px' }}>
              Fechar
            </button>
            {activeTab !== 'TABELA' && (
              <button
                className="btn btn-primary"
                onClick={() => setActiveTab('TABELA')}
                style={{ padding: '7px 16px' }}
              >
                Ver Tabela Verticalizada ➔
              </button>
            )}
            {activeTab === 'TABELA' && (
              <button
                className="btn btn-primary"
                onClick={handleSalvarNoConcurso}
                disabled={isSaving}
                style={{ padding: '7px 18px' }}
              >
                💾 {isSaving ? 'Gravando...' : 'Salvar no Concurso'}
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default MotorParetoEditalModal;
