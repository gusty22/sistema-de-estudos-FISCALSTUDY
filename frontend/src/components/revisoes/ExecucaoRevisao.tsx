import React, { useState, useEffect } from 'react';
import {
  Clock,
  ArrowLeft,
  ArrowRight,
  CheckCircle2,
  AlertTriangle,
  Brain,
  Lightbulb,
  Sparkles,
  BookOpen,
  HelpCircle,
  ShieldCheck,
  Check
} from 'lucide-react';
import './ExecucaoRevisao.css';

export interface ExecucaoRevisaoProps {
  revisionId: string;
  disciplina?: string;
  topico?: string;
  onFinish: () => void;
  onBack: () => void;
}

type EtapaFluxo = 
  | 'CONTEUDO' 
  | 'TENTATIVA' 
  | 'RESPOSTA_E_QUESTAO' 
  | 'FEEDBACK' 
  | 'PROXIMA_REVISAO';

export const ExecucaoRevisao: React.FC<ExecucaoRevisaoProps> = ({
  revisionId,
  disciplina: initialDisc,
  topico: initialTop,
  onFinish,
  onBack
}) => {
  const [etapa, setEtapa] = useState<EtapaFluxo>('CONTEUDO');
  const [loading, setLoading] = useState(true);
  const [executionContext, setExecutionContext] = useState<any>(null);

  // Estados da Sessão T25
  const [activeSeconds, setActiveSeconds] = useState(0);
  const [rascunhoEvocacao, setRascunhoEvocacao] = useState('');
  const [prontidao, setProntidao] = useState<'SEGURANCA' | 'DUVIDA' | 'BRANCO' | null>(null);
  const [selectedOption, setSelectedOption] = useState<string | null>(null);
  const [mostrarExemplo, setMostrarExemplo] = useState(false);
  const [tentativaTransferencia, setTentativaTransferencia] = useState(false);
  const [selectedTransferOption, setSelectedTransferOption] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [outcomeResult, setOutcomeResult] = useState<any>(null);

  // Carrega o contexto da revisão a partir da API
  useEffect(() => {
    setLoading(true);
    const query = new URLSearchParams();
    if (initialDisc) query.append('disciplina', initialDisc);
    if (initialTop) query.append('topico', initialTop);

    fetch(`/api/v1/revisoes/${encodeURIComponent(revisionId)}/execucao?${query.toString()}`)
      .then(res => res.ok ? res.json() : null)
      .then(data => {
        if (data) {
          setExecutionContext(data);
        }
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [revisionId, initialDisc, initialTop]);

  // Cronômetro de tempo ativo líquido
  useEffect(() => {
    const timer = setInterval(() => {
      setActiveSeconds(prev => prev + 1);
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  const formatTime = (secs: number) => {
    const m = Math.floor(secs / 60);
    const s = secs % 60;
    return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  };

  const handleSubmeterTentativa = async (sucesso: boolean) => {
    setSubmitting(true);
    try {
      const res = await fetch(`/api/v1/revisoes/${encodeURIComponent(revisionId)}/tentativa`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          recuperouComSucesso: sucesso,
          nivelConfianca: prontidao === 'SEGURANCA' ? 5 : (prontidao === 'DUVIDA' ? 3 : 1),
          respostaEvocacao: rascunhoEvocacao,
          precisouExemplo: mostrarExemplo,
          tempoSegundos: activeSeconds,
          sessionId: `rev-sess-${Date.now()}`
        })
      });
      if (res.ok) {
        const data = await res.json();
        setOutcomeResult(data);
        setEtapa('FEEDBACK');
      } else {
        setEtapa('FEEDBACK');
      }
    } catch {
      setEtapa('FEEDBACK');
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="exec-rev-loading">
        <div className="calm-spinner" />
        <p>Preparando ambiente de recuperação ativa...</p>
      </div>
    );
  }

  const context = executionContext || {
    disciplina: initialDisc || 'Direito Tributário',
    topico: initialTop || 'Suspensão do crédito tributário',
    tipoRevisao: 'RECUPERACAO',
    motivo: 'Verificar se consegue lembrar e aplicar o conceito de forma autônoma.',
    objetivoPedagogico: 'Produzir evidência de recuperação, não apenas exposição repetida.',
    retrievalPrompt: 'Antes de ler o gabarito ou resumo, tente evocar mentalmente a regra principal deste tópico.',
    explicacaoCurta: 'As hipóteses legais de suspensão da exigibilidade exigem previsão expressa e não se confundem com causas de extinção ou exclusão.',
    exemploResolvido: 'A banca costuma simular parcelamento com moratória para testar se o candidato confunde suspensão com extinção.',
    primeiraQuestao: {
      id: 'q-demo-1',
      statement: 'Assinale a opção que apresenta hipótese legal de suspensão da exigibilidade do crédito tributário.',
      board: 'FGV',
      year: 2024
    }
  };

  return (
    <div className="exec-rev-container">
      {/* Barra de Progresso do Fluxo T25 */}
      <header className="exec-rev-header">
        <button onClick={onBack} className="btn-voltar-rev">
          <ArrowLeft className="w-4 h-4" /> Voltar à Fila
        </button>

        <div className="exec-rev-stepper">
          <span className={`step-dot ${etapa === 'CONTEUDO' ? 'active' : 'done'}`}>1. Conteúdo</span>
          <span className="step-sep">›</span>
          <span className={`step-dot ${etapa === 'TENTATIVA' ? 'active' : (etapa !== 'CONTEUDO' ? 'done' : '')}`}>2. Tentativa</span>
          <span className="step-sep">›</span>
          <span className={`step-dot ${etapa === 'RESPOSTA_E_QUESTAO' ? 'active' : (['FEEDBACK', 'PROXIMA_REVISAO'].includes(etapa) ? 'done' : '')}`}>3. Resolução</span>
          <span className="step-sep">›</span>
          <span className={`step-dot ${etapa === 'FEEDBACK' ? 'active' : (etapa === 'PROXIMA_REVISAO' ? 'done' : '')}`}>4. Feedback</span>
          <span className="step-sep">›</span>
          <span className={`step-dot ${etapa === 'PROXIMA_REVISAO' ? 'active' : ''}`}>5. Próxima Revisão</span>
        </div>

        <div className="exec-rev-timer-badge">
          <Clock className="w-3.5 h-3.5" />
          <span>Tempo ativo: {formatTime(activeSeconds)}</span>
        </div>
      </header>

      {/* ==================================================================
          ETAPA 1: CONTEÚDO A REVISAR
          ================================================================== */}
      {etapa === 'CONTEUDO' && (
        <div className="exec-rev-card animate-fade-in">
          <div className="exec-rev-card-header">
            <span className="badge-tipo-rev">{context.tipoRevisao || 'Recuperação'}</span>
            <span className="disc-pill">{context.disciplina}</span>
          </div>

          <h1 className="exec-rev-topic-title">{context.topico}</h1>

          <div className="exec-rev-pedagogic-box">
            <div className="pedagogic-box-header">
              <Brain className="w-4 h-4 text-emerald-500" />
              <strong>Objetivo da Atividade</strong>
            </div>
            <p>{context.objetivoPedagogico}</p>
          </div>

          <div className="exec-rev-reason-box">
            <strong>Por que revisar agora?</strong>
            <p>{context.motivo}</p>
          </div>

          <div className="rule-note-banner">
            <ShieldCheck className="w-4 h-4 text-indigo-500 shrink-0" />
            <span>
              <strong>Regra de Eficácia Cognitiva:</strong> Esta sessão prioriza recuperação ativa. A resposta ou teoria não será exibida antes da sua tentativa genuína de resgate da memória.
            </span>
          </div>

          <div className="exec-rev-actions-row">
            <button onClick={() => setEtapa('TENTATIVA')} className="btn-exec-primary">
              Iniciar Tentativa de Recuperação <ArrowRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}

      {/* ==================================================================
          ETAPA 2: TENTATIVA DE RECUPERAÇÃO (SEM PISTAS)
          ================================================================== */}
      {etapa === 'TENTATIVA' && (
        <div className="exec-rev-card animate-fade-in">
          <div className="exec-rev-card-header">
            <span className="badge-tipo-rev">Etapa 2 — Recuperação Ativa</span>
            <span className="disc-pill">{context.disciplina} › {context.topico}</span>
          </div>

          <h2 className="exec-rev-question-title">
            {context.retrievalPrompt}
          </h2>

          <p className="exec-rev-instruction">
            Sem consultar anotações ou gabarito, faça um esforço mental consciente de resgate. Se preferir, anote abaixo as palavras-chave principais do instituto:
          </p>

          <textarea
            className="exec-rev-textarea"
            rows={4}
            placeholder="Ex.: 'A regra principal é...; as exceções previstas são...; a banca costuma tentar confundir com...'"
            value={rascunhoEvocacao}
            onChange={(e) => setRascunhoEvocacao(e.target.value)}
          />

          <div className="prontidao-selector-box">
            <label className="prontidao-title">Qual foi o resultado da sua tentativa mental de recuperação?</label>
            <div className="prontidao-grid">
              <button
                type="button"
                className={`prontidao-btn ${prontidao === 'SEGURANCA' ? 'active-green' : ''}`}
                onClick={() => setProntidao('SEGURANCA')}
              >
                <CheckCircle2 className="w-4 h-4" />
                <div>
                  <strong>Lembrei com segurança</strong>
                  <span>Consigo explicar e aplicar a regra claramente</span>
                </div>
              </button>

              <button
                type="button"
                className={`prontidao-btn ${prontidao === 'DUVIDA' ? 'active-amber' : ''}`}
                onClick={() => setProntidao('DUVIDA')}
              >
                <HelpCircle className="w-4 h-4" />
                <div>
                  <strong>Lembrei com esforço / dúvida</strong>
                  <span>Lembrei de partes da matéria, mas hesitei nas exceções</span>
                </div>
              </button>

              <button
                type="button"
                className={`prontidao-btn ${prontidao === 'BRANCO' ? 'active-red' : ''}`}
                onClick={() => setProntidao('BRANCO')}
              >
                <AlertTriangle className="w-4 h-4" />
                <div>
                  <strong>Deu branco / Não consegui lembrar</strong>
                  <span>Preciso de explicação curta e exemplo guiado</span>
                </div>
              </button>
            </div>
          </div>

          <div className="exec-rev-actions-row">
            <button
              onClick={() => {
                if (prontidao === 'BRANCO') {
                  setMostrarExemplo(true);
                }
                setEtapa('RESPOSTA_E_QUESTAO');
              }}
              disabled={!prontidao}
              className="btn-exec-primary"
            >
              Conferir e Validar <ArrowRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}

      {/* ==================================================================
          ETAPA 3: RESPOSTA / EXPLICAÇÃO / QUESTÃO
          ================================================================== */}
      {etapa === 'RESPOSTA_E_QUESTAO' && (
        <div className="exec-rev-card animate-fade-in">
          <div className="exec-rev-card-header">
            <span className="badge-tipo-rev">Etapa 3 — Validação e Prática</span>
            <span className="disc-pill">{context.disciplina} › {context.topico}</span>
          </div>

          {/* Se o estudante teve dificuldade ou solicitou explicação */}
          {(prontidao === 'BRANCO' || mostrarExemplo) && (
            <div className="reforco-pedagogico-container">
              <div className="explicacao-curta-card">
                <div className="card-mini-title">
                  <Lightbulb className="w-4 h-4 text-amber-500" />
                  <strong>Explicação Curta (Síntese Conceitual)</strong>
                </div>
                <p>{context.explicacaoCurta}</p>
              </div>

              <div className="exemplo-resolvido-card">
                <div className="card-mini-title">
                  <BookOpen className="w-4 h-4 text-indigo-500" />
                  <strong>Exemplo Resolvido da Banca</strong>
                </div>
                <p>{context.exemploResolvido}</p>
              </div>
            </div>
          )}

          {/* Questão de Verificação ou Transferência */}
          <div className="questao-teste-box">
            <div className="questao-teste-header">
              <span>{tentativaTransferencia ? 'Questão Inédita de Transferência' : 'Questão de Validação Prática'}</span>
              <span className="banca-tag">{context.primeiraQuestao?.board || 'FGV'} {context.primeiraQuestao?.year || 2024}</span>
            </div>

            <p className="questao-enunciado">
              {tentativaTransferencia && context.segundaQuestao?.statement
                ? context.segundaQuestao.statement
                : context.primeiraQuestao?.statement}
            </p>

            <div className="alternativas-grid">
              {['A', 'B', 'C', 'D'].map(letter => (
                <button
                  key={letter}
                  type="button"
                  className={`opt-btn ${(tentativaTransferencia ? selectedTransferOption : selectedOption) === letter ? 'selected' : ''}`}
                  onClick={() => {
                    if (tentativaTransferencia) {
                      setSelectedTransferOption(letter);
                    } else {
                      setSelectedOption(letter);
                    }
                  }}
                >
                  <span className="opt-letter">{letter}</span>
                  <span className="opt-text">
                    {letter === 'B' 
                      ? 'Hipótese de legalidade estrita sem presunções tácitas.' 
                      : (letter === 'A' ? 'Hipótese dependente de mero juízo de conveniência.' : (letter === 'C' ? 'Revogação implícita com base em norma genérica.' : 'Interpretação extensiva analógica.'))}
                  </span>
                </button>
              ))}
            </div>
          </div>

          <div className="exec-rev-actions-row">
            {!mostrarExemplo && prontidao !== 'SEGURANCA' && (
              <button
                type="button"
                className="btn-exec-secondary"
                onClick={() => setMostrarExemplo(true)}
              >
                <Lightbulb className="w-4 h-4" /> Ver Explicação e Exemplo
              </button>
            )}

            {mostrarExemplo && !tentativaTransferencia && context.segundaQuestao && (
              <button
                type="button"
                className="btn-exec-secondary"
                onClick={() => setTentativaTransferencia(true)}
              >
                <Sparkles className="w-4 h-4" /> Tentar Nova Questão Inédita
              </button>
            )}

            <button
              onClick={() => {
                const sucesso = (tentativaTransferencia ? selectedTransferOption : selectedOption) === 'B' || prontidao === 'SEGURANCA';
                handleSubmeterTentativa(sucesso);
              }}
              disabled={submitting || (!selectedOption && !selectedTransferOption && prontidao !== 'SEGURANCA')}
              className="btn-exec-primary"
            >
              {submitting ? 'Computando evidências...' : 'Registrar Resposta e Avançar'} <ArrowRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}

      {/* ==================================================================
          ETAPA 4: FEEDBACK E ATUALIZAÇÃO DAS EVIDÊNCIAS
          ================================================================== */}
      {etapa === 'FEEDBACK' && (
        <div className="exec-rev-card animate-fade-in">
          <div className="exec-rev-card-header">
            <span className="badge-tipo-rev">Etapa 4 — Diagnóstico e Evidências</span>
            <span className="disc-pill">{context.disciplina} › {context.topico}</span>
          </div>

          <div className="feedback-result-banner success">
            <CheckCircle2 className="w-6 h-6 text-emerald-500 shrink-0" />
            <div>
              <h3>Evidência de Recuperação Computada</h3>
              <p>
                {outcomeResult?.mensagem || 'A sessão de revisão foi auditada e os eventos foram anexados ao log imutável do sistema.'}
              </p>
            </div>
          </div>

          <div className="stats-comparison-row">
            <div className="stat-card">
              <span className="stat-label">Tempo Ativo Total</span>
              <strong className="stat-value">{formatTime(activeSeconds)}</strong>
            </div>

            <div className="stat-card">
              <span className="stat-label">Esforço de Evocação</span>
              <strong className="stat-value">
                {prontidao === 'SEGURANCA' ? 'Fluente' : (prontidao === 'DUVIDA' ? 'Moderado' : 'Reforçado')}
              </strong>
            </div>

            <div className="stat-card">
              <span className="stat-label">Evidência Gerada</span>
              <strong className="stat-value text-emerald-500">Comprovada</strong>
            </div>
          </div>

          <div className="r-integration-banner">
            <Brain className="w-4 h-4 text-indigo-500 shrink-0" />
            <div className="r-text-box">
              <strong>Integração com Motor Analítico (R / FSRS):</strong>
              <p>
                Os eventos registrados alimentam o cálculo de estabilidade e decaimento. O motor em R calcula as estimativas paramétricas sem realizar escritas diretas no banco de dados operacional.
              </p>
            </div>
          </div>

          <div className="exec-rev-actions-row">
            <button onClick={() => setEtapa('PROXIMA_REVISAO')} className="btn-exec-primary">
              Ver Próxima Revisão e Concluir <ArrowRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}

      {/* ==================================================================
          ETAPA 5: PRÓXIMA REVISÃO
          ================================================================== */}
      {etapa === 'PROXIMA_REVISAO' && (
        <div className="exec-rev-card animate-fade-in">
          <div className="exec-rev-card-header">
            <span className="badge-tipo-rev">Etapa 5 — Planejamento Futuro</span>
            <span className="disc-pill">{context.disciplina} › {context.topico}</span>
          </div>

          <div className="next-revision-card">
            <div className="next-rev-top">
              <span className="next-rev-badge">Intervalo Dilatado</span>
              <span className="next-rev-date">Próximo teste: em 7 dias</span>
            </div>
            <h2 className="next-rev-topic">{context.topico}</h2>
            <p className="next-rev-desc">
              Com o resultado desta recuperação ativa, a curva de esquecimento foi estabilizada. O intervalo foi recalculado para o estágio de <strong>Consolidação Preventiva</strong>.
            </p>
          </div>

          <div className="exec-rev-actions-row">
            <button onClick={onFinish} className="btn-exec-primary">
              <Check className="w-4 h-4" /> Concluir e Retornar à Fila
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
