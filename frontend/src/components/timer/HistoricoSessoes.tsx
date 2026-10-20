import { useState, useEffect, useMemo } from 'react';
import {
  History,
  Clock,
  MessageSquarePlus,
  X
} from 'lucide-react';
import type { ConcursoItem } from '../concursos/MeusConcursos';
import './HistoricoSessoes.css';

export interface StudySessionItem {
  sessionId: string;
  concursoId?: string;
  disciplina: string;
  topicoId?: string;
  materialId?: string;
  durationSeconds: number;
  paginasLidas?: number;
  questoesFeitas?: number;
  questoesAcertadas?: number;
  rendimentoPercentual?: number;
  confiancaMedia?: number;
  modo?: string;
  activityType?: string;
  nextSessionHandoff?: string;
  notas?: string;
  occurredAt?: string;
  annotations?: Array<{
    annotationId: string;
    text: string;
    interruptionCorrection?: string;
    createdAt?: string;
  }>;
}

interface HistoricoSessoesProps {
  activeConcurso?: ConcursoItem | null;
  onNavigateToTab?: (tab: string) => void;
}

export default function HistoricoSessoes({
  activeConcurso,
  onNavigateToTab
}: HistoricoSessoesProps) {
  // 1. Estados de Filtro
  const [selectedConcursoId, setSelectedConcursoId] = useState<string>(activeConcurso?.id || 'ALL');
  const [selectedDisciplina, setSelectedDisciplina] = useState<string>('ALL');
  const [selectedType, setSelectedType] = useState<string>('ALL');
  const [selectedPeriod, setSelectedPeriod] = useState<'7D' | '30D' | 'ALL'>('ALL');

  // 3. Dados de Sessões
  const [sessions, setSessions] = useState<StudySessionItem[]>([]);
  const [concursos, setConcursos] = useState<ConcursoItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  // 4. Modal de Anotação / Retificação
  const [annotatingSession, setAnnotatingSession] = useState<StudySessionItem | null>(null);
  const [annotationText, setAnnotationText] = useState('');
  const [correctedInterruption, setCorrectedInterruption] = useState('');
  const [isSavingAnnotation, setIsSavingAnnotation] = useState(false);

  // Carregar lista de concursos para o filtro
  useEffect(() => {
    fetch('/api/v1/concursos?status=ALL')
      .then((res) => (res.ok ? res.json() : []))
      .then((data: ConcursoItem[]) => setConcursos(data))
      .catch(() => {});
  }, []);

  // Carregar sessões de estudo
  const loadSessions = () => {
    setIsLoading(true);
    let url = '/api/v1/study-sessions';
    const params = new URLSearchParams();
    if (selectedConcursoId && selectedConcursoId !== 'ALL') {
      params.append('concursoId', selectedConcursoId);
    }
    if (selectedDisciplina && selectedDisciplina !== 'ALL') {
      params.append('disciplina', selectedDisciplina);
    }
    if (selectedType && selectedType !== 'ALL') {
      params.append('tipo', selectedType);
    }
    const query = params.toString();
    if (query) url += `?${query}`;

    fetch(url)
      .then((res) => (res.ok ? res.json() : []))
      .then((data: StudySessionItem[]) => {
        setSessions(data);
      })
      .catch((err) => {
        console.error('Erro ao buscar histórico de sessões:', err);
      })
      .finally(() => {
        setIsLoading(false);
      });
  };

  useEffect(() => {
    loadSessions();
  }, [selectedConcursoId, selectedDisciplina, selectedType]);

  // Lista única de disciplinas disponíveis nas sessões para o filtro
  const availableDisciplines = useMemo(() => {
    const set = new Set<string>();
    sessions.forEach((s) => {
      if (s.disciplina) set.add(s.disciplina);
    });
    return Array.from(set);
  }, [sessions]);

  // Filtragem de período na memória
  const filteredSessions = useMemo(() => {
    if (selectedPeriod === 'ALL') return sessions;
    const now = new Date().getTime();
    const daysLimit = selectedPeriod === '7D' ? 7 : 30;
    const msLimit = daysLimit * 24 * 60 * 60 * 1000;

    return sessions.filter((s) => {
      if (!s.occurredAt) return true;
      const sessionTime = new Date(s.occurredAt).getTime();
      return now - sessionTime <= msLimit;
    });
  }, [sessions, selectedPeriod]);

  // Salvar anotação / correção de interrupção
  const handleSaveAnnotation = async () => {
    if (!annotatingSession || (!annotationText.trim() && !correctedInterruption.trim())) return;

    setIsSavingAnnotation(true);
    try {
      const res = await fetch(`/api/v1/study-sessions/${annotatingSession.sessionId}/annotation`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          text: annotationText.trim(),
          interruptionCorrection: correctedInterruption.trim() || undefined
        })
      });

      if (res.ok) {
        setAnnotatingSession(null);
        setAnnotationText('');
        setCorrectedInterruption('');
        loadSessions(); // Atualiza a lista com o overlay de anotações
      }
    } catch (err) {
      console.error('Falha ao gravar anotação:', err);
    } finally {
      setIsSavingAnnotation(false);
    }
  };

  const formatSessionTime = (seconds: number) => {
    if (!seconds || seconds <= 0) return '0 min';
    if (seconds < 60) return `${seconds}s`;
    const mins = Math.floor(seconds / 60);
    if (mins < 60) return `${mins} min`;
    const hours = Math.floor(mins / 60);
    const remMins = mins % 60;
    return `${hours}h ${remMins}m`;
  };

  const formatDate = (dateStr?: string) => {
    if (!dateStr) return 'Recente';
    try {
      const d = new Date(dateStr);
      return d.toLocaleDateString('pt-BR', {
        day: '2-digit',
        month: 'short',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
      });
    } catch {
      return dateStr;
    }
  };

  const getActivityTypeLabel = (type?: string) => {
    const t = (type || '').toUpperCase();
    if (t.includes('QUEST')) return { label: 'Resolução de Questões', class: 'questoes' };
    if (t.includes('REV')) return { label: 'Revisão Espaçada', class: 'revisao' };
    if (t.includes('SIMUL')) return { label: 'Simulado Real', class: 'simulado' };
    return { label: 'Estudo Orientado', class: 'estudo' };
  };

  return (
    <div className="history-calm-wrapper">
      <div className="history-container animate-fadeIn">
        {/* HEADER */}
        <header className="history-header">
          <div>
            <div className="history-tag">
              <History className="w-4 h-4 text-indigo-500" />
              <span>Módulo C — Registro de Execuções</span>
            </div>
            <h1 className="history-title">Histórico de Sessões</h1>
            <p className="history-subtitle">
              Auditoria transparente de tempo ativo, páginas lidas e questões resolvidas.
            </p>
          </div>
        </header>


        {/* BARRA DE FILTROS */}
        <div className="history-filters-bar">
          <div className="history-filter-item">
            <span className="history-filter-label">Objetivo</span>
            <select
              value={selectedConcursoId}
              onChange={(e) => setSelectedConcursoId(e.target.value)}
              className="history-filter-select"
            >
              <option value="ALL">Todos os Objetivos</option>
              {concursos.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.nome}
                </option>
              ))}
            </select>
          </div>

          <div className="history-filter-item">
            <span className="history-filter-label">Disciplina</span>
            <select
              value={selectedDisciplina}
              onChange={(e) => setSelectedDisciplina(e.target.value)}
              className="history-filter-select"
            >
              <option value="ALL">Todas as Disciplinas</option>
              {availableDisciplines.map((d) => (
                <option key={d} value={d}>
                  {d}
                </option>
              ))}
            </select>
          </div>

          <div className="history-filter-item">
            <span className="history-filter-label">Tipo de Atividade</span>
            <select
              value={selectedType}
              onChange={(e) => setSelectedType(e.target.value)}
              className="history-filter-select"
            >
              <option value="ALL">Todos os Tipos</option>
              <option value="HE">Estudo Orientado</option>
              <option value="QUESTOES">Resolução de Questões</option>
              <option value="REVISAO">Revisão</option>
              <option value="SIMULADO">Simulado</option>
            </select>
          </div>

          <div className="history-filter-item">
            <span className="history-filter-label">Período</span>
            <select
              value={selectedPeriod}
              onChange={(e) => setSelectedPeriod(e.target.value as any)}
              className="history-filter-select"
            >
              <option value="ALL">Todo o Histórico</option>
              <option value="7D">Últimos 7 dias</option>
              <option value="30D">Últimos 30 dias</option>
            </select>
          </div>
        </div>

        {/* LISTA DE SESSÕES */}
        {isLoading ? (
          <div className="text-center py-12 text-sm text-stone-500">
            Carregando histórico de sessões...
          </div>
        ) : filteredSessions.length === 0 ? (
          <div className="text-center py-16 bg-white dark:bg-[#16181a] rounded-2xl border border-stone-200 dark:border-[#26282b] p-8">
            <Clock className="w-10 h-10 text-stone-400 mx-auto mb-3" />
            <h3 className="text-base font-bold mb-1">Nenhuma sessão registrada com estes filtros</h3>
            <p className="text-xs text-stone-500 max-w-md mx-auto mb-4">
              Ao concluir ou registrar uma sessão de estudo, as execuções e telemetrias aparecerão
              aqui automaticamente.
            </p>
            {onNavigateToTab && (
              <button
                type="button"
                onClick={() => onNavigateToTab('session')}
                className="px-4 py-2 bg-indigo-600 text-white rounded-xl text-xs font-semibold hover:bg-indigo-700 transition"
              >
                Iniciar Nova Sessão de Foco
              </button>
            )}
          </div>
        ) : (
          <div className="history-sessions-list">
            {filteredSessions.map((session, idx) => {
              const typeInfo = getActivityTypeLabel(session.activityType);
              const qFeitas = session.questoesFeitas || 0;
              const qAcert = session.questoesAcertadas || 0;

              return (
                <div key={session.sessionId || idx} className="history-session-card">
                  <div className="history-card-header">
                    <span className="history-card-date">{formatDate(session.occurredAt)}</span>
                    <span className={`history-type-badge ${typeInfo.class}`}>
                      {typeInfo.label}
                    </span>
                  </div>

                  <div className="history-card-titles">
                    <div className="history-card-discipline">{session.disciplina}</div>
                    <h3 className="history-card-topic">
                      {session.topicoId || 'Estudo Focado e Revisão'}
                    </h3>
                  </div>

                  {/* Grid de Métricas */}
                  <div className="history-metrics-grid">
                    <div className="history-metric-box">
                      <span className="label">Tempo Ativo</span>
                      <span className="val">{formatSessionTime(session.durationSeconds)}</span>
                    </div>

                    <div className="history-metric-box">
                      <span className="label">Páginas Lidas</span>
                      <span className="val">{session.paginasLidas || 0} pág.</span>
                    </div>

                    <div className="history-metric-box">
                      <span className="label">Questões</span>
                      <span className="val">
                        {qFeitas > 0 ? `${qAcert}/${qFeitas}` : 'Leitura'}
                      </span>
                    </div>

                    {qFeitas > 0 && (
                      <div className="history-metric-box">
                        <span className="label">Aproveitamento</span>
                        <span className="val text-emerald-600 dark:text-emerald-400">
                          {session.rendimentoPercentual ?? Math.round((qAcert / qFeitas) * 100)}%
                        </span>
                      </div>
                    )}

                    {session.confiancaMedia !== undefined && session.confiancaMedia > 0 && (
                      <div className="history-metric-box">
                        <span className="label">Certeza Média</span>
                        <span className="val text-indigo-600 dark:text-indigo-400">
                          {session.confiancaMedia.toFixed(1)} / 5
                        </span>
                      </div>
                    )}
                  </div>

                  {session.nextSessionHandoff && (
                    <div className="text-xs text-stone-500 mb-2 italic">
                      📌 Ponto de parada: {session.nextSessionHandoff}
                    </div>
                  )}

                  {/* Anotações Preservadas */}
                  {session.annotations && session.annotations.length > 0 && (
                    <div className="history-annotations-list">
                      <span className="text-[11px] font-bold uppercase text-stone-400">
                        Anotações Auditadas:
                      </span>
                      {session.annotations.map((ann, aIdx) => (
                        <div key={ann.annotationId || aIdx} className="history-annotation-item">
                          {ann.interruptionCorrection && (
                            <div className="font-semibold text-[11px] text-amber-600 dark:text-amber-400 mb-0.5">
                              Retificação de Interrupção: {ann.interruptionCorrection}
                            </div>
                          )}
                          <div>{ann.text}</div>
                        </div>
                      ))}
                    </div>
                  )}

                  <div className="history-card-footer">
                    <button
                      type="button"
                      onClick={() => {
                        setAnnotatingSession(session);
                        setAnnotationText('');
                        setCorrectedInterruption('');
                      }}
                      className="history-btn-annotate"
                    >
                      <MessageSquarePlus className="w-3.5 h-3.5" /> Adicionar Observação / Retificar
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* MODAL DE ANOTAÇÃO / RETIFICAÇÃO DE INTERRUPÇÃO */}
        {annotatingSession && (
          <div className="history-modal-backdrop animate-fadeIn">
            <div className="history-modal-card">
              <div className="flex items-center justify-between mb-3">
                <h3 className="history-modal-title">Adicionar Observação / Retificação</h3>
                <button
                  type="button"
                  onClick={() => setAnnotatingSession(null)}
                  className="text-stone-400 hover:text-stone-600"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <p className="history-modal-desc">
                Sua anotação será anexada de forma segura ao histórico desta sessão, preservando
                o registro original de execução.
              </p>

              <div className="mb-3">
                <label className="block text-xs font-bold text-stone-500 mb-1">
                  Retificar Motivo de Interrupção (Opcional):
                </label>
                <input
                  type="text"
                  placeholder="Ex: Não foi cansaço, foi emergência de trabalho"
                  value={correctedInterruption}
                  onChange={(e) => setCorrectedInterruption(e.target.value)}
                  className="w-full p-2.5 rounded-xl border border-stone-300 dark:border-stone-800 bg-stone-50 dark:bg-[#111214] text-xs outline-none"
                />
              </div>

              <div className="mb-4">
                <label className="block text-xs font-bold text-stone-500 mb-1">
                  Observação Pedagógica / Anotação:
                </label>
                <textarea
                  placeholder="Insira detalhes adicionais sobre o aprendizado, dúvidas pontuais ou próximos passos..."
                  value={annotationText}
                  onChange={(e) => setAnnotationText(e.target.value)}
                  className="history-modal-textarea"
                />
              </div>

              <div className="history-modal-actions">
                <button
                  type="button"
                  onClick={() => setAnnotatingSession(null)}
                  className="history-modal-btn-cancel"
                >
                  Cancelar
                </button>
                <button
                  type="button"
                  onClick={handleSaveAnnotation}
                  disabled={isSavingAnnotation}
                  className="history-modal-btn-save"
                >
                  {isSavingAnnotation ? 'Salvando...' : 'Gravar no Histórico'}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
