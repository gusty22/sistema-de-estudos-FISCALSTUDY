import React, { useState, useEffect } from 'react';
import {
  ShieldCheck,
  AlertTriangle,
  FileQuestion,
  HelpCircle,
  EyeOff,
  Copy,
  GitCompare,
  Flag,
  CheckCircle2,
  Lock,
  Clock,
  ChevronRight
} from 'lucide-react';
import './QualidadeBancoQuestoes.css';

export interface QualidadeBancoQuestoesProps {
  onOpenAudit?: (questionId: string) => void;
  onOpenAuditoria?: (questionId: string) => void;
}

export const QualidadeBancoQuestoes: React.FC<QualidadeBancoQuestoesProps> = ({
  onOpenAudit,
  onOpenAuditoria
}) => {
  const [qualityData, setQualityData] = useState<any | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [actionSuccessMsg, setActionSuccessMsg] = useState<string | null>(null);

  // Lista de questões em monitoramento
  const [monitoredQuestions, setMonitoredQuestions] = useState([
    {
      id: 'q_mon_1',
      numeroOriginal: 42,
      concurso: 'ISS Araguari / 2023',
      disciplina: 'Direito Tributário',
      assunto: 'Suspensão do Crédito',
      status: 'PUBLISHED',
      tipoProblema: 'GABARITO_DIVERGENTE',
      problemaDescricao: 'Recurso administrativo alterou gabarito de A para C em retificação oficial.',
      reportadoPor: '2 estudantes reportaram',
      respostasHistoricas: 18,
      versaoAtual: 'v2'
    },
    {
      id: 'q_mon_2',
      numeroOriginal: 18,
      concurso: 'Porto Alegre / 2023',
      disciplina: 'Contabilidade Geral',
      assunto: 'Balanço Patrimonial',
      status: 'PUBLISHED',
      tipoProblema: 'DUPLICACAO_SUSPEITA',
      problemaDescricao: 'Enunciado idêntico a item do concurso Domingos Martins (stem compartilhado).',
      reportadoPor: 'Auditoria algorítmica',
      respostasHistoricas: 34,
      versaoAtual: 'v1'
    },
    {
      id: 'q_mon_3',
      numeroOriginal: 27,
      concurso: 'SEFAZ-MG / 2023',
      disciplina: 'Legislação Tributária',
      assunto: 'ICMS Substituição Tributária',
      status: 'SUSPENDED',
      tipoProblema: 'QUESTAO_ANULADA',
      problemaDescricao: 'Questão anulada oficialmente pela banca FGV. Tratamento de pontuação neutra.',
      reportadoPor: 'Gabarito Oficial Homologado',
      respostasHistoricas: 52,
      versaoAtual: 'v3'
    }
  ]);

  const loadQuality = () => {
    setIsLoading(true);
    fetch('/api/v1/ingestion/quality-overview')
      .then(res => res.ok ? res.json() : null)
      .then(data => {
        if (data) setQualityData(data);
      })
      .catch(err => console.warn('Erro ao carregar qualidade do acervo:', err))
      .finally(() => setIsLoading(false));
  };

  useEffect(() => {
    loadQuality();
  }, []);

  const handleSuspendQuestion = async (qId: string) => {
    try {
      const res = await fetch(`/api/v1/ingestion/questions/${qId}/suspend`, { method: 'POST' });
      if (res.ok) {
        setMonitoredQuestions(prev => prev.map(q => q.id === qId ? { ...q, status: 'SUSPENDED' } : q));
        setActionSuccessMsg(`✓ Questão ${qId} suspensa com sucesso. Não será exibida em novos cadernos, preservando integralmente as respostas históricas no event_store.`);
        setTimeout(() => setActionSuccessMsg(null), 4500);
      }
    } catch {
      setActionSuccessMsg('Erro ao suspender questão.');
      setTimeout(() => setActionSuccessMsg(null), 3000);
    }
  };

  const handleRevalidateQuestion = async (qId: string) => {
    try {
      const res = await fetch(`/api/v1/ingestion/questions/${qId}/revalidate`, { method: 'POST' });
      if (res.ok) {
        setMonitoredQuestions(prev => prev.map(q => q.id === qId ? { ...q, status: 'PUBLISHED' } : q));
        setActionSuccessMsg(`✓ Questão ${qId} revalidada e republicada para prática dos estudantes.`);
        setTimeout(() => setActionSuccessMsg(null), 4500);
      }
    } catch {
      setActionSuccessMsg('Erro ao revalidar questão.');
      setTimeout(() => setActionSuccessMsg(null), 3000);
    }
  };

  const indicators = [
    { label: 'Questões Publicadas', val: qualityData?.questoesPublicadas ?? 13241, desc: 'Acervo oficial disponível', color: '#10b981', icon: ShieldCheck },
    { label: 'Pendentes em Staging', val: qualityData?.questoesPendentes ?? 6, desc: 'Aguardando auditoria humana', color: '#f59e0b', icon: Clock },
    { label: 'Com Alertas Estruturais', val: qualityData?.questoesComAlertas ?? 4, desc: 'Inconsistências em verificação', color: '#ec4899', icon: AlertTriangle },
    { label: 'Gabaritos Não Confirmados', val: qualityData?.gabaritosNaoConfirmados ?? 0, desc: 'Preliminares ou em recurso', color: '#6366f1', icon: HelpCircle },
    { label: 'Sem Classificação', val: qualityData?.questoesSemClassificacao ?? 0, desc: 'Sem disciplina ou tópico', color: '#94a3b8', icon: FileQuestion },
    { label: 'Imagens Ausentes', val: qualityData?.imagensAusentes ?? 0, desc: 'Figuras ou diagramas s/ link', color: '#f43f5e', icon: EyeOff },
    { label: 'Duplicações Suspeitas', val: qualityData?.duplicacoesSuspeitas ?? 0, desc: 'Enunciados com alta colisão', color: '#8b5cf6', icon: Copy },
    { label: 'Divergências de Versões', val: qualityData?.divergenciasVersoes ?? 4, desc: 'Edições humanas registradas', color: '#38bdf8', icon: GitCompare },
    { label: 'Reportadas por Estudantes', val: qualityData?.questoesReportadas ?? 2, desc: 'Chamados em aberto', color: '#fb923c', icon: Flag }
  ];

  return (
    <div className="qualidade-view animate-fade-in">
      <div className="qualidade-header">
        <div>
          <span className="qualidade-pill">ADMINISTRAÇÃO E CONFIABILIDADE</span>
          <h2 className="qualidade-title">Qualidade do Banco de Questões</h2>
          <p className="qualidade-subtitle">
            Auditoria em duas áreas: isolamento estrito entre preparação/staging e acervo publicado para estudantes.
          </p>
        </div>

        <button className="btn-recarregar-qualidade" disabled={isLoading} onClick={loadQuality}>
          {isLoading ? '⏳ Atualizando...' : '🔄 Atualizar Indicadores'}
        </button>
      </div>

      {actionSuccessMsg && (
        <div className="action-success-banner animate-fade-in">{actionSuccessMsg}</div>
      )}

      {/* Regra Canônica de Preservação Histórica */}
      <div className="regra-preservacao-banner">
        <ShieldCheck className="w-5 h-5 text-indigo-400 shrink-0" />
        <div>
          <strong>Regra Canônica de Governança de Acervo:</strong>
          <p>
            Quando uma questão publicada apresentar problema relevante, o sistema permite suspendê-la imediatamente.
            <strong> Nunca apagamos respostas históricas</strong> do `event_store`; as evidências são reprocessadas e auditadas.
          </p>
        </div>
      </div>

      {/* Os 9 Indicadores Canônicos (T35) */}
      <div className="indicadores-grid">
        {indicators.map((ind, idx) => {
          const Icon = ind.icon;
          return (
            <div key={idx} className="indicador-card">
              <div className="ind-card-top">
                <span className="ind-card-label">{ind.label}</span>
                <Icon className="w-4 h-4" style={{ color: ind.color }} />
              </div>
              <span className="ind-card-val" style={{ color: ind.color }}>
                {ind.val}
              </span>
              <span className="ind-card-desc">{ind.desc}</span>
            </div>
          );
        })}
      </div>

      {/* Tabela de Gestão e Suspensão de Questões */}
      <div className="tabela-gestao-card">
        <div className="tabela-gestao-header">
          <h3 className="tabela-heading">Questões em Monitoramento de Integridade</h3>
          <span className="tabela-sub">Itens com reportes, divergências ou recursos pendentes</span>
        </div>

        <table className="gestao-table">
          <thead>
            <tr>
              <th>Questão</th>
              <th>Origem</th>
              <th>Problema Identificado</th>
              <th>Respostas Históricas</th>
              <th>Situação</th>
              <th>Ações de Integridade</th>
            </tr>
          </thead>
          <tbody>
            {monitoredQuestions.map(q => (
              <tr key={q.id}>
                <td>
                  <strong className="q-num">Questão #{q.numeroOriginal}</strong>
                  <span className="q-disc">{q.disciplina} • {q.assunto}</span>
                </td>

                <td>
                  <span className="q-origem">{q.concurso}</span>
                </td>

                <td>
                  <div className="problema-cell">
                    <span className="badge-problema">{q.tipoProblema.replace('_', ' ')}</span>
                    <span className="problema-desc">{q.problemaDescricao}</span>
                  </div>
                </td>

                <td>
                  <span className="font-semibold text-slate-300">{q.respostasHistoricas} respostas</span>
                  <span className="q-evidencia-hint">Auditadas no event_store</span>
                </td>

                <td>
                  {q.status === 'PUBLISHED' ? (
                    <span className="status-badge published">✓ Publicada</span>
                  ) : (
                    <span className="status-badge suspended">⛔ Suspensa</span>
                  )}
                </td>

                <td>
                  <div className="gestao-actions">
                    {q.status === 'PUBLISHED' ? (
                      <button
                        className="btn-action-suspend"
                        onClick={() => handleSuspendQuestion(q.id)}
                        title="Suspender publicação sem apagar histórico"
                      >
                        <Lock className="w-3.5 h-3.5 inline mr-1" /> Suspender
                      </button>
                    ) : (
                      <button
                        className="btn-action-revalidate"
                        onClick={() => handleRevalidateQuestion(q.id)}
                        title="Revalidar questão para publicação"
                      >
                        <CheckCircle2 className="w-3.5 h-3.5 inline mr-1" /> Revalidar
                      </button>
                    )}

                    <button
                      className="btn-action-audit-link"
                      onClick={() => (onOpenAudit || onOpenAuditoria)?.(q.id)}
                      title="Abrir Auditoria especializada"
                    >
                      Auditar <ChevronRight className="w-3.5 h-3.5 inline" />
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};
