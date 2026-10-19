import React, { useState } from 'react';
import {
  AlertTriangle,
  CheckCircle2,
  RotateCcw,
  Eye,
  FileCode,
  ChevronRight,
  ChevronDown,
  Info,
  ShieldCheck
} from 'lucide-react';
import './CentralProcessamento.css';

export interface ProcessamentoItem {
  id: string;
  nomeImportacao: string;
  concurso: string;
  situacao: 'AGUARDANDO' | 'PROCESSANDO' | 'EXTRACAO_CONCLUIDA' | 'VALIDACAO_ESTRUTURAL' | 'NECESSITA_REVISAO' | 'PRONTA_AUDITORIA' | 'FALHA' | 'CANCELADA';
  extraidasCount: number;
  esperadasCount: number;
  pendenciasCount: number;
  arquivos: string[];
  paginasProcessadas: number;
  lacunas: number;
  duplicacoes: number;
  gabaritosEncontrados: string;
  ocrFalhas: number;
  imagensNaoAssociadas: number;
  edicoesHumanasPreservadas: number;
  ultimaAtualizacao: string;
}

export interface CentralProcessamentoProps {
  stagingFiles?: any[];
  onOpenAudit?: (fileId: string) => void;
  onOpenAuditoria?: (fileId: string) => void;
  onOpenWizard?: () => void;
  onRefresh?: () => void;
}

export const CentralProcessamento: React.FC<CentralProcessamentoProps> = ({
  stagingFiles: _stagingFiles,
  onOpenAudit,
  onOpenAuditoria,
  onOpenWizard,
  onRefresh: _onRefresh
}) => {
  const [items] = useState<ProcessamentoItem[]>([
    {
      id: 'proc_1',
      nomeImportacao: 'ISS Araguari — Auditor Fiscal 2023',
      concurso: 'Prefeitura de Araguari / Fundatec',
      situacao: 'NECESSITA_REVISAO',
      extraidasCount: 40,
      esperadasCount: 50,
      pendenciasCount: 6,
      arquivos: ['prova_auditor_araguari.pdf', 'gabarito_definitivo.pdf'],
      paginasProcessadas: 16,
      lacunas: 2,
      duplicacoes: 0,
      gabaritosEncontrados: 'Definitivo Fundatec (100% pareado)',
      ocrFalhas: 0,
      imagensNaoAssociadas: 1,
      edicoesHumanasPreservadas: 4,
      ultimaAtualizacao: 'Há 12 minutos'
    },
    {
      id: 'proc_2',
      nomeImportacao: 'SEFAZ-MG — Auditor Fiscal da Receita 2023',
      concurso: 'SEF-MG / FGV',
      situacao: 'PRONTA_AUDITORIA',
      extraidasCount: 80,
      esperadasCount: 80,
      pendenciasCount: 0,
      arquivos: ['caderno_conhecimentos_especificos_t1.pdf', 'gabarito_fgv.pdf'],
      paginasProcessadas: 24,
      lacunas: 0,
      duplicacoes: 0,
      gabaritosEncontrados: 'Definitivo Pós-Recursos',
      ocrFalhas: 0,
      imagensNaoAssociadas: 0,
      edicoesHumanasPreservadas: 0,
      ultimaAtualizacao: 'Há 45 minutos'
    },
    {
      id: 'proc_3',
      nomeImportacao: 'ISS Florianópolis — Auditoria e Fiscalização 2023',
      concurso: 'Prefeitura de Florianópolis / FURB',
      situacao: 'PROCESSANDO',
      extraidasCount: 28,
      esperadasCount: 60,
      pendenciasCount: 0,
      arquivos: ['caderno_prova_florianopolis.pdf'],
      paginasProcessadas: 8,
      lacunas: 0,
      duplicacoes: 0,
      gabaritosEncontrados: 'Em pareamento...',
      ocrFalhas: 0,
      imagensNaoAssociadas: 0,
      edicoesHumanasPreservadas: 0,
      ultimaAtualizacao: 'Agora mesmo'
    },
    {
      id: 'proc_4',
      nomeImportacao: 'Receita Federal — Analista Tributário 2023',
      concurso: 'RFB / FGV',
      situacao: 'FALHA',
      extraidasCount: 0,
      esperadasCount: 70,
      pendenciasCount: 1,
      arquivos: ['prova_corrompida.pdf'],
      paginasProcessadas: 0,
      lacunas: 70,
      duplicacoes: 0,
      gabaritosEncontrados: 'Não localizado',
      ocrFalhas: 1,
      imagensNaoAssociadas: 0,
      edicoesHumanasPreservadas: 0,
      ultimaAtualizacao: 'Ontem'
    }
  ]);

  const [expandedId, setExpandedId] = useState<string | null>('proc_1');
  const [logModalItem, setLogModalItem] = useState<ProcessamentoItem | null>(null);
  const [reprocessMsg, setReprocessMsg] = useState<string | null>(null);

  const getStatusBadge = (status: ProcessamentoItem['situacao']) => {
    switch (status) {
      case 'AGUARDANDO':
        return { label: 'Aguardando', class: 'status-aguardando' };
      case 'PROCESSANDO':
        return { label: 'Em Processamento', class: 'status-processando' };
      case 'EXTRACAO_CONCLUIDA':
        return { label: 'Extração Concluída', class: 'status-concluida' };
      case 'VALIDACAO_ESTRUTURAL':
        return { label: 'Validação Estrutural', class: 'status-validacao' };
      case 'NECESSITA_REVISAO':
        return { label: 'Revisão Necessária', class: 'status-revisao' };
      case 'PRONTA_AUDITORIA':
        return { label: 'Pronta para Auditoria', class: 'status-pronta' };
      case 'FALHA':
        return { label: 'Falha na Extração', class: 'status-falha' };
      case 'CANCELADA':
        return { label: 'Cancelada', class: 'status-cancelada' };
    }
  };

  const handleReprocessar = (item: ProcessamentoItem) => {
    setReprocessMsg(`Reprocessando extração para "${item.nomeImportacao}". As ${item.edicoesHumanasPreservadas} edições humanas feitas anteriormente estão protegidas e serão preservadas.`);
    setTimeout(() => setReprocessMsg(null), 4500);
  };

  return (
    <div className="central-processamento-view animate-fade-in">
      <div className="central-header">
        <div>
          <span className="central-pill">CENTRAL DE PROCESSAMENTO</span>
          <h2 className="central-title">Central de Processamento de Provas</h2>
          <p className="central-subtitle">
            Acompanhe o pipeline de extração, auditoria estrutural e resolução de pendências na área de staging.
          </p>
        </div>

        <button className="btn-nova-importacao" onClick={onOpenWizard}>
          + Nova Importação de Prova
        </button>
      </div>

      {reprocessMsg && (
        <div className="reprocess-alert-banner animate-fade-in">
          <Info className="w-4 h-4 text-emerald-400 shrink-0" />
          <span>{reprocessMsg}</span>
        </div>
      )}

      {/* Tabela Canônica T30 */}
      <div className="processamento-table-card">
        <table className="processamento-table">
          <thead>
            <tr>
              <th>Importação</th>
              <th>Situação</th>
              <th>Extraídas</th>
              <th>Pendências</th>
              <th>Ações</th>
            </tr>
          </thead>
          <tbody>
            {items.map(item => {
              const statusInfo = getStatusBadge(item.situacao);
              const isExpanded = expandedId === item.id;
              return (
                <React.Fragment key={item.id}>
                  <tr className={isExpanded ? 'row-expanded' : ''}>
                    <td>
                      <div className="import-name-cell">
                        <button
                          className="btn-expand-row"
                          onClick={() => setExpandedId(isExpanded ? null : item.id)}
                        >
                          {isExpanded ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
                        </button>
                        <div>
                          <strong className="import-name">{item.nomeImportacao}</strong>
                          <span className="import-sub">{item.concurso}</span>
                        </div>
                      </div>
                    </td>

                    <td>
                      <span className={`status-badge-canonico ${statusInfo.class}`}>
                        {statusInfo.label}
                      </span>
                    </td>

                    <td>
                      <span className="extraidas-count font-bold">{item.extraidasCount}</span>
                      <span className="esperadas-count"> / {item.esperadasCount} esperadas</span>
                    </td>

                    <td>
                      {item.pendenciasCount > 0 ? (
                        <span className="badge-pendencia-alerta">
                          <AlertTriangle className="w-3.5 h-3.5 inline mr-1" />
                          {item.pendenciasCount} pendências
                        </span>
                      ) : (
                        <span className="badge-pendencia-ok">
                          <CheckCircle2 className="w-3.5 h-3.5 inline mr-1" />
                          Sem pendências
                        </span>
                      )}
                    </td>

                    <td>
                      <div className="row-actions-group">
                        <button
                          className="btn-action-audit"
                          onClick={() => (onOpenAudit || onOpenAuditoria)?.(item.id)}
                          title="Abrir Auditoria lado a lado"
                        >
                          <Eye className="w-3.5 h-3.5 inline mr-1" /> Auditoria
                        </button>

                        <button
                          className="btn-action-icon"
                          onClick={() => setLogModalItem(item)}
                          title="Consultar log de processamento"
                        >
                          <FileCode className="w-3.5 h-3.5" />
                        </button>

                        <button
                          className="btn-action-icon"
                          onClick={() => handleReprocessar(item)}
                          title="Reprocessar etapa preservando edições humanas"
                        >
                          <RotateCcw className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </td>
                  </tr>

                  {/* Detalhes de Processamento Expandidos (T30) */}
                  {isExpanded && (
                    <tr className="detail-expanded-row">
                      <td colSpan={5}>
                        <div className="process-details-drawer animate-fade-in">
                          <div className="details-header-row">
                            <span className="details-heading">
                              Detalhes Técnicos do Processamento • Atualizado {item.ultimaAtualizacao}
                            </span>
                            <div className="preservacao-humana-badge">
                              <ShieldCheck className="w-3.5 h-3.5 text-emerald-400 inline mr-1" />
                              {item.edicoesHumanasPreservadas} edições humanas protegidas contra sobreescrita
                            </div>
                          </div>

                          <div className="details-grid-metrics">
                            <div className="metric-box">
                              <span className="m-label">Arquivos Utilizados</span>
                              <span className="m-val">{item.arquivos.join(', ')}</span>
                            </div>
                            <div className="metric-box">
                              <span className="m-label">Páginas Processadas</span>
                              <span className="m-val">{item.paginasProcessadas} páginas</span>
                            </div>
                            <div className="metric-box">
                              <span className="m-label">Lacunas Identificadas</span>
                              <span className={`m-val ${item.lacunas > 0 ? 'text-amber-400' : 'text-emerald-400'}`}>
                                {item.lacunas} questões faltantes
                              </span>
                            </div>
                            <div className="metric-box">
                              <span className="m-label">Duplicações Suspeitas</span>
                              <span className="m-val">{item.duplicacoes} itens</span>
                            </div>
                            <div className="metric-box">
                              <span className="m-label">Gabarito Vinculado</span>
                              <span className="m-val">{item.gabaritosEncontrados}</span>
                            </div>
                            <div className="metric-box">
                              <span className="m-label">Falhas OCR / Imagens</span>
                              <span className="m-val">{item.ocrFalhas} falhas / {item.imagensNaoAssociadas} img s/ vínculo</span>
                            </div>
                          </div>

                          <div className="details-footer-actions">
                            <button className="btn-footer-link" onClick={() => (onOpenAudit || onOpenAuditoria)?.(item.id)}>
                              Abrir Auditoria Especializada <ChevronRight className="w-3.5 h-3.5 inline ml-1" />
                            </button>
                            <button className="btn-footer-link" onClick={() => handleReprocessar(item)}>
                              Reprocessar Etapa <RotateCcw className="w-3.5 h-3.5 inline ml-1" />
                            </button>
                            <button className="btn-footer-link" onClick={() => setLogModalItem(item)}>
                              Consultar Log Completo <FileCode className="w-3.5 h-3.5 inline ml-1" />
                            </button>
                          </div>
                        </div>
                      </td>
                    </tr>
                  )}
                </React.Fragment>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Modal de Logs */}
      {logModalItem && (
        <div className="log-modal-overlay" onClick={() => setLogModalItem(null)}>
          <div className="log-modal-card" onClick={e => e.stopPropagation()}>
            <div className="log-modal-header">
              <div>
                <h4>Log de Execução do Pipeline</h4>
                <p>{logModalItem.nomeImportacao}</p>
              </div>
              <button onClick={() => setLogModalItem(null)} className="btn-close-log">✕</button>
            </div>
            <div className="log-modal-terminal">
              <code>
                [PIPELINE_INIT] Staging isolation session initialized at target/staging_pipeline<br />
                [PARSER_PDF] Loading {logModalItem.arquivos[0]} (pages 1..{logModalItem.paginasProcessadas})<br />
                [DESENTRELACAMENTO] Multi-column target analysis active: 2 columns detected.<br />
                [SUPPORT_TEXT] 2 shared texts isolated. Stripping margin numbers and line prefixes.<br />
                [EXTRACTOR_STEM] 50 question candidates identified.<br />
                [ANSWER_KEY_FUSION] Key matched: {logModalItem.gabaritosEncontrados}<br />
                [HUMAN_PROTECTION] Preserving {logModalItem.edicoesHumanasPreservadas} manual edits from previous human review.<br />
                [STAGING_STATUS] Ready for interactive audit.
              </code>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
