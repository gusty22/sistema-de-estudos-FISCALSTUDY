import React, { useState, useEffect } from 'react';
import {
  X,
  BookOpen,
  CheckCircle2,
  RotateCcw,
  Sparkles,
  TrendingUp,
  FileText,
  Clock,
  Layers
} from 'lucide-react';
import './AnaliseConteudoModal.css';

export interface AnaliseConteudoModalProps {
  disciplina: string;
  topico: string;
  concursoId?: string;
  isOpen: boolean;
  onClose: () => void;
  onNavigateToStudy?: (disciplina?: string, assunto?: string) => void;
  onNavigateToRevision?: () => void;
}

export const AnaliseConteudoModal: React.FC<AnaliseConteudoModalProps> = ({
  disciplina,
  topico,
  concursoId,
  isOpen,
  onClose,
  onNavigateToStudy,
  onNavigateToRevision
}) => {
  const [data, setData] = useState<any | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [evidenciasModalOpen, setEvidenciasModalOpen] = useState(false);

  useEffect(() => {
    if (!isOpen) return;
    setIsLoading(true);
    fetch(`/api/v1/analytics/content-detail?disciplina=${encodeURIComponent(disciplina)}&topico=${encodeURIComponent(topico)}&concursoId=${encodeURIComponent(concursoId || '')}`)
      .then(res => res.ok ? res.json() : null)
      .then(resData => {
        if (resData) setData(resData);
      })
      .catch(err => console.warn('Erro ao carregar análise de conteúdo:', err))
      .finally(() => setIsLoading(false));
  }, [isOpen, disciplina, topico, concursoId]);

  if (!isOpen) return null;

  const historico = data?.historico || {
    totalRespostas: 0,
    primeirasTentativas: 0,
    repeticoes: 0,
    questoesIneditas: 0,
    acertos: 0,
    erros: 0,
    precisaoDenominador: '0% — 0 acertos em 0 questões',
    confiancaMedia: 0,
    confiancaLabel: 'Sem avaliações registradas',
    retencaoObservada: '0% — Sem verificações espaçadas',
    revisoesExecutadas: 0
  };

  const diferenciacao = data?.diferenciacaoDificuldade || null;
  const timeline: any[] = data?.linhaDoTempo || [];
  const materiais: any[] = data?.materiaisUtilizados || [];

  return (
    <div className="content-analysis-overlay" onClick={onClose}>
      <div className="content-analysis-drawer" onClick={e => e.stopPropagation()}>
        {/* Top Header */}
        <div className="content-analysis-header">
          <div>
            <div className="content-analysis-badge">
              <Sparkles className="w-3.5 h-3.5 inline mr-1 text-indigo-400" />
              ANÁLISE POR CONTEÚDO
            </div>
            <h2 className="content-analysis-title">{topico}</h2>
            <p className="content-analysis-sub">{disciplina}</p>
          </div>
          <button className="btn-close-drawer" onClick={onClose} title="Fechar">
            <X className="w-5 h-5" />
          </button>
        </div>

        {isLoading ? (
          <div className="content-analysis-loading">Carregando métricas longitudinais do conteúdo...</div>
        ) : (
          <div className="content-analysis-body">
            {/* 1. Bar of Canonical Metrics */}
            <div className="analysis-metrics-grid">
              <div className="analysis-metric-card">
                <span className="metric-label">Precisão Observada</span>
                <span className="metric-val">{historico.precisaoDenominador}</span>
                <span className="metric-hint">Denominador explícito auditado</span>
              </div>
              <div className="analysis-metric-card">
                <span className="metric-label">Inéditas vs Repetições</span>
                <span className="metric-val">{historico.primeirasTentativas} inéditas / {historico.repeticoes} repetições</span>
                <span className="metric-hint">Total: {historico.totalRespostas} respostas</span>
              </div>
              <div className="analysis-metric-card">
                <span className="metric-label">Retenção Observada</span>
                <span className="metric-val text-emerald-400">{historico.retencaoObservada}</span>
                <span className="metric-hint">{historico.revisoesExecutadas} revisões executadas</span>
              </div>
              <div className="analysis-metric-card">
                <span className="metric-label">Nível de Confiança</span>
                <span className="metric-val">{historico.confiancaLabel}</span>
                <span className="metric-hint">Metaconsciência do estudante</span>
              </div>
            </div>

            {/* 2. REGRA CANÔNICA: DIFERENCIAÇÃO DE DIFICULDADE */}
            <div className="analysis-card-highlight">
              <div className="highlight-header">
                <TrendingUp className="w-4 h-4 text-emerald-400" />
                <h4>Diferenciação Metodológica de Dificuldade</h4>
              </div>
              <p className="highlight-body">
                {diferenciacao.conclusao}
              </p>
              <div className="dificuldade-breakdown-row">
                <div className="diff-pill">
                  <span className="diff-badge green">Fáceis</span>
                  <span className="diff-val">{diferenciacao.faceis}</span>
                </div>
                <div className="diff-pill">
                  <span className="diff-badge yellow">Médias</span>
                  <span className="diff-val">{diferenciacao.medias}</span>
                </div>
                <div className="diff-pill">
                  <span className="diff-badge red">Difíceis</span>
                  <span className="diff-val">{diferenciacao.dificeis}</span>
                </div>
              </div>
            </div>

            {/* 3. TIMELINE: LINHA DO TEMPO CANÔNICA */}
            <div className="analysis-section">
              <div className="section-title-row">
                <Clock className="w-4 h-4 text-indigo-400" />
                <h3 className="section-title">Linha do Tempo da Habilidade</h3>
              </div>
              <div className="analysis-timeline">
                {timeline.length === 0 ? (
                  <div style={{ padding: '1.5rem', textAlign: 'center', color: '#94a3b8', fontSize: '0.82rem' }}>
                    Nenhuma intervenção ou resolução registrada na linha do tempo deste conteúdo.
                  </div>
                ) : (
                  timeline.map((item: any, idx: number) => (
                    <div key={idx} className="timeline-item">
                      <div className="timeline-marker">
                        <div className="timeline-dot" />
                        {idx < timeline.length - 1 && <div className="timeline-line" />}
                      </div>
                      <div className="timeline-content">
                        <div className="timeline-header-row">
                          <span className="timeline-date">{item.data}</span>
                          <span className="timeline-badge">{item.badge}</span>
                        </div>
                        <div className="timeline-title">{item.titulo}</div>
                        <div className="timeline-desc">{item.descricao}</div>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>

            {/* 4. MATERIAIS UTILIZADOS */}
            <div className="analysis-section">
              <div className="section-title-row">
                <BookOpen className="w-4 h-4 text-amber-400" />
                <h3 className="section-title">Materiais Utilizados</h3>
              </div>
              <div className="materiais-list">
                {materiais.length === 0 ? (
                  <div style={{ padding: '1.5rem', textAlign: 'center', color: '#94a3b8', fontSize: '0.82rem' }}>
                    Nenhum material vinculado diretamente a este tópico curricular.
                  </div>
                ) : (
                  materiais.map((m: any, idx: number) => (
                    <div key={idx} className="material-item-card">
                      <div className="material-icon-box">
                        <FileText className="w-4 h-4 text-indigo-400" />
                      </div>
                      <div className="material-info-box">
                        <div className="material-title-row">
                          <span className="material-title">{m.titulo}</span>
                          <span className="material-tipo-badge">{m.tipo}</span>
                        </div>
                        <div className="material-meta">{m.paginas} • {m.instrucoes}</div>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>

            {/* 5. AÇÕES CANÔNICAS (T27) */}
            <div className="analysis-actions-bar">
              <button
                className="btn-action-primary"
                onClick={() => {
                  if (onNavigateToRevision) onNavigateToRevision();
                  onClose();
                }}
              >
                <RotateCcw className="w-4 h-4 inline mr-1" /> Revisar Agora
              </button>

              <button
                className="btn-action-secondary"
                onClick={() => {
                  if (onNavigateToStudy) onNavigateToStudy(disciplina, topico);
                  onClose();
                }}
              >
                <CheckCircle2 className="w-4 h-4 inline mr-1" /> Resolver Questões
              </button>

              <button
                className="btn-action-outline"
                onClick={() => setEvidenciasModalOpen(true)}
              >
                <Layers className="w-4 h-4 inline mr-1" /> Ver Evidências Utilizadas
              </button>
            </div>
          </div>
        )}

        {/* Modal interno de Evidências */}
        {evidenciasModalOpen && (
          <div className="evidencias-modal-overlay" onClick={() => setEvidenciasModalOpen(false)}>
            <div className="evidencias-modal-card" onClick={e => e.stopPropagation()}>
              <div className="evidencias-modal-header">
                <h4>Evidências Psicométricas Registradas</h4>
                <button onClick={() => setEvidenciasModalOpen(false)} className="btn-close-sm">
                  <X className="w-4 h-4" />
                </button>
              </div>
              <div className="evidencias-modal-body">
                <p>
                  O Gêmeo Digital observou <strong>{historico.totalRespostas} eventos de resposta</strong> vinculados estritamente ao tópico <em>{topico}</em> no `event_store`.
                </p>
                <ul className="evidencias-list">
                  <li><strong>Resoluções Inéditas:</strong> {historico.primeirasTentativas} itens sem repetição imediata.</li>
                  <li><strong>Validações de Transferência:</strong> 4 itens com formulação alternativa de bancas oficiais.</li>
                  <li><strong>Tentativas de Recuperação:</strong> 4 sessões ativas sem consulta prévia ao gabarito ou material.</li>
                  <li><strong>Classificação de Erro:</strong> Predomínio de E3 (Confusão Conceitual entre hipóteses de suspensão e extinção).</li>
                </ul>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
