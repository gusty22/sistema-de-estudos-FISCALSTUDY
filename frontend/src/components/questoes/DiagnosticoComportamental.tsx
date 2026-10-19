import React, { useState } from 'react';
import {
  CheckCircle2,
  XCircle,
  AlertTriangle,
  Lightbulb,
  ArrowRight,
  Brain,
  Clock,
  Sparkles
} from 'lucide-react';
import './DiagnosticoComportamental.css';

export interface DiagnosticoComportamentalProps {
  isCorrect: boolean | null;
  gabaritoStatus?: string; // DEFINITIVO, ANULADA, MODIFICADO, PENDENTE
  userSelectedOption: string;
  correctOption?: string;
  confidenceLevel: number; // 1 a 5
  activeTimeMs?: number;
  expectedTimeMs?: number;
  explicacao?: string;
  causaErroSelecionada?: string;
  onSelectCausaErro?: (causa: string) => void;
  onNextAction?: () => void;
  isAuditPreview?: boolean; // Sem dados pessoais para auditoria
}

export const ERROR_CATEGORIES = [
  { code: 'E1', label: 'E1 — Lacuna teórica / conceito não estudado' },
  { code: 'E2', label: 'E2 — Confusão conceitual ou pegadinha' },
  { code: 'E3', label: 'E3 — Interpretação de texto / leitura precipitada' },
  { code: 'E4', label: 'E4 — Distração / detalhe ignorado no enunciado' },
  { code: 'E5', label: 'E5 — Falta de tempo ou chute forçado' },
  { code: 'E6', label: 'E6 — Hesitação / dúvida entre duas alternativas' }
];

export const DiagnosticoComportamental: React.FC<DiagnosticoComportamentalProps> = ({
  isCorrect,
  gabaritoStatus = 'DEFINITIVO',
  userSelectedOption,
  correctOption,
  confidenceLevel,
  activeTimeMs = 45000,
  expectedTimeMs = 75000,
  explicacao,
  causaErroSelecionada,
  onSelectCausaErro,
  onNextAction,
  isAuditPreview = false
}) => {
  const [selectedCausa, setSelectedCausa] = useState<string | null>(causaErroSelecionada || null);

  const isAnulada = gabaritoStatus === 'ANULADA';
  const isHighConfidence = confidenceLevel >= 4;
  const isLowConfidence = confidenceLevel <= 2;
  const isTimeAtypical = activeTimeMs < expectedTimeMs * 0.45 || activeTimeMs > expectedTimeMs * 2.2;

  const handleChooseCausa = (code: string) => {
    setSelectedCausa(code);
    if (onSelectCausaErro) {
      onSelectCausaErro(code);
    }
  };

  return (
    <div className="diagnostico-box">
      {/* 1. Header com Status do Resultado */}
      <div className="diagnostico-header">
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
          {isAnulada ? (
            <span className="diagnostico-status-tag anulada">
              <AlertTriangle className="w-4 h-4" /> Questão Anulada pela Banca
            </span>
          ) : isCorrect ? (
            <span className="diagnostico-status-tag correta">
              <CheckCircle2 className="w-4 h-4" /> Resposta Correta
            </span>
          ) : (
            <span className="diagnostico-status-tag incorreta">
              <XCircle className="w-4 h-4" /> Resposta Incorreta
            </span>
          )}

          {!isAuditPreview && (
            <span style={{ fontSize: '0.78rem', color: 'var(--calm-text-muted)' }}>
              Confiança informada: {confidenceLevel === 5 ? 'Muito Alta (5/5)' : confidenceLevel === 4 ? 'Alta (4/5)' : confidenceLevel === 3 ? 'Média (3/5)' : confidenceLevel === 2 ? 'Baixa (2/5)' : 'Muito Baixa (1/5)'}
            </span>
          )}
        </div>

        <div className="diagnostico-respostas-row">
          <div className="respostas-item">
            <span>Sua resposta:</span>
            <strong>{userSelectedOption || 'Nenhuma'}</strong>
          </div>
          {correctOption && (
            <div className="respostas-item">
              <span>Gabarito oficial:</span>
              <strong style={{ color: '#34d399' }}>{correctOption}</strong>
            </div>
          )}
        </div>
      </div>

      {/* 2. Diagnóstico Comportamental Calibrado */}
      {!isAuditPreview && (
        <>
          {/* Caso A: Erro com Alta Confiança (Ilusão de Competência) */}
          {!isCorrect && !isAnulada && isHighConfidence && (
            <div className="diagnostico-insight-card overconfidence">
              <div className="diagnostico-insight-title" style={{ color: '#f87171' }}>
                <Brain className="w-4 h-4" /> Diagnóstico: Erro com alta confiança
              </div>
              <p className="diagnostico-insight-text">
                Você declarou alta confiança, mas a resposta estava incorreta. Isso pode indicar uma compreensão equivocada ou uma pegadinha da banca que merece investigação conceitual antes de seguir.
              </p>
            </div>
          )}

          {/* Caso B: Acerto com Baixa Confiança (Insegurança / Chute) */}
          {isCorrect && !isAnulada && isLowConfidence && (
            <div className="diagnostico-insight-card underconfidence">
              <div className="diagnostico-insight-title" style={{ color: '#fbbf24' }}>
                <Sparkles className="w-4 h-4" /> Diagnóstico: Acerto com baixa confiança
              </div>
              <p className="diagnostico-insight-text">
                Você acertou, mas ainda não demonstrou segurança na recuperação ativa. Uma questão inédita semelhante no próximo ciclo ajudará a confirmar o domínio real do conceito.
              </p>
            </div>
          )}

          {/* Caso C: Tempo Atípico (Não acusa precipitadamente) */}
          {isTimeAtypical && (
            <div className="diagnostico-insight-card">
              <div className="diagnostico-insight-title" style={{ color: '#a5b4fc' }}>
                <Clock className="w-4 h-4" /> Diagnóstico: Tempo de resolução atípico
              </div>
              <p className="diagnostico-insight-text">
                O tempo registrado ({Math.round(activeTimeMs / 1000)}s) foi diferente do seu padrão em questões deste assunto. Uma possibilidade em caso de erro é leitura precipitada. Confirme abaixo se isso aconteceu.
              </p>
            </div>
          )}
        </>
      )}

      {/* 3. Classificação Voluntária do Erro (E1 a E6) */}
      {!isCorrect && !isAnulada && !isAuditPreview && (
        <div className="diagnostico-erro-classificacao">
          <span className="diagnostico-section-label">O que causou o erro nesta questão?</span>
          <div className="diagnostico-e-chips">
            {ERROR_CATEGORIES.map(cat => (
              <button
                key={cat.code}
                className={`chip-erro ${selectedCausa === cat.code ? 'selected' : ''}`}
                onClick={() => handleChooseCausa(cat.code)}
                type="button"
              >
                {cat.label}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* 4. Fundamentação e Gabarito Comentado */}
      <div className="diagnostico-explicacao">
        <span className="diagnostico-section-label">Comentário do Gabarito & Fundamentação</span>
        <div className="diagnostico-explicacao-text">
          {explicacao || (
            isCorrect
              ? 'Excelente! Seu raciocínio converge com a jurisprudência e a doutrina predominante cobrada neste concurso.'
              : 'A alternativa correta fundamenta-se nos dispositivos expressos na legislação e no entendimento consolidado pela banca examinadora.'
          )}
        </div>
      </div>

      {/* 5. Próxima Ação Orientada */}
      <div className="diagnostico-proxima-acao">
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <Lightbulb className="w-4 h-4 text-indigo-400" />
          <span>
            <strong>Próxima ação:</strong>{' '}
            {isCorrect
              ? 'Conceito validado. Prosseguir na trilha ou reforçar próximo item.'
              : 'Adicionar ponto de revisão ao Gêmeo Digital e gerar flashcard no Anki se o conceito for recorrente.'}
          </span>
        </div>

        {onNextAction && (
          <button
            onClick={onNextAction}
            style={{
              background: '#6366f1',
              border: 'none',
              color: '#fff',
              padding: '0.4rem 0.8rem',
              borderRadius: '6px',
              fontSize: '0.78rem',
              fontWeight: 600,
              cursor: 'pointer',
              display: 'inline-flex',
              alignItems: 'center',
              gap: '0.35rem'
            }}
          >
            Avançar <ArrowRight className="w-3.5 h-3.5" />
          </button>
        )}
      </div>
    </div>
  );
};
