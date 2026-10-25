import { useState } from 'react';
import { useModalA11y } from '../../utils/accessibility';
import {
  Compass,
  ArrowRight,
  HelpCircle,
  AlertTriangle,
  RotateCcw,
  X
} from 'lucide-react';
import './BoasVindasT01.css';

interface BoasVindasT01Props {
  onCreateFirstObjective?: () => void;
  onStartWizard?: () => void;
  backendError?: boolean;
  onRetryConnection?: () => void;
  onRetry?: () => void;
}

export default function BoasVindasT01({
  onCreateFirstObjective,
  onStartWizard,
  backendError = false,
  onRetryConnection,
  onRetry
}: BoasVindasT01Props) {
  const handleStart = onStartWizard || onCreateFirstObjective || (() => {});
  const handleRetry = onRetry || onRetryConnection || (() => {});

  // 2. Modal calmo de "Conhecer o funcionamento"
  const [showHowItWorks, setShowHowItWorks] = useState(false);
  useModalA11y({
    isOpen: showHowItWorks,
    onClose: () => setShowHowItWorks(false),
    closeOnEscape: true,
    restoreFocus: true
  });

  return (
    <div className="welcome-calm-wrapper">

      {/* MODAL: Conhecer o Funcionamento */}
      {showHowItWorks && (
        <div className="welcome-modal-backdrop animate-fadeIn" onClick={(e) => e.target === e.currentTarget && setShowHowItWorks(false)}>
          <div className="welcome-modal-card" role="dialog" aria-modal="true" aria-labelledby="welcome-modal-title">
            <div className="welcome-modal-header">
              <h3 id="welcome-modal-title" className="welcome-modal-title">Como o FiscalStudy Funciona</h3>
              <button
                type="button"
                onClick={() => setShowHowItWorks(false)}
                className="welcome-modal-close-btn"
                aria-label="Fechar explicação do funcionamento"
                title="Fechar (Esc)"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="welcome-modal-steps-list">
              <div className="welcome-modal-step-item">
                <div className="welcome-modal-step-num">1</div>
                <div className="welcome-modal-step-text">
                  <h4>Defina seu Objetivo</h4>
                  <p>
                    Seja um concurso fiscal, vestibular, certificação profissional ou
                    disciplina livre, tudo começa com a sua meta.
                  </p>
                </div>
              </div>

              <div className="welcome-modal-step-item">
                <div className="welcome-modal-step-num">2</div>
                <div className="welcome-modal-step-text">
                  <h4>Currículo Navegável</h4>
                  <p>
                    Organizamos seu programa em disciplinas e microtópicos independentes
                    com identificadores estáveis.
                  </p>
                </div>
              </div>

              <div className="welcome-modal-step-item">
                <div className="welcome-modal-step-num">3</div>
                <div className="welcome-modal-step-text">
                  <h4>Planejamento Adaptativo</h4>
                  <p>
                    Uma fila dinâmica gerada a partir da sua capacidade real, sem
                    cronogramas rígidos que acumulam em bola de neve.
                  </p>
                </div>
              </div>

              <div className="welcome-modal-step-item">
                <div className="welcome-modal-step-num">4</div>
                <div className="welcome-modal-step-text">
                  <h4>Gêmeo Digital de Retenção</h4>
                  <p>
                    O sistema acompanha suas evidências práticas via resolução de
                    questões e injeta reforços no momento ideal.
                  </p>
                </div>
              </div>
            </div>

            <button
              type="button"
              onClick={() => {
                setShowHowItWorks(false);
                handleStart();
              }}
              className="welcome-primary-btn"
            >
              Começar Agora <ArrowRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}

      {/* ÁREA CENTRAL */}
      {backendError ? (
        /* ESTADO ESPECÍFICO: BANCO / SERVIDOR INDISPONÍVEL */
        <div className="welcome-card animate-fadeIn">
          <div className="welcome-error-circle">
            <AlertTriangle className="w-8 h-8" />
          </div>

          <h1 className="welcome-title">Conexão Indisponível</h1>

          <div className="welcome-error-box">
            <p className="m-0">
              <strong>Não foi possível acessar seus dados.</strong> Nenhuma
              informação foi alterada. Por favor, verifique se o servidor backend
              está ativo e tente reconectar.
            </p>
          </div>

          <div className="welcome-actions">
            <button
              type="button"
              onClick={handleRetry}
              className="welcome-primary-btn"
            >
              <RotateCcw className="w-4 h-4" /> Tentar Reconectar
            </button>
          </div>
        </div>
      ) : (
        /* T01: BOAS-VINDAS E ESTADO INICIAL */
        <div className="welcome-card animate-fadeIn">
          <div className="welcome-icon-circle">
            <Compass className="w-9 h-9" />
          </div>

          <h1 className="welcome-title">Vamos organizar seus estudos.</h1>

          <p className="welcome-desc">
            Informe o que deseja aprender. O sistema ajudará a organizar conteúdos,
            atividades e revisões de forma adaptativa e inteligente.
          </p>

          <div className="welcome-actions">
            <button
              type="button"
              onClick={handleStart}
              className="welcome-primary-btn"
            >
              Criar meu primeiro objetivo <ArrowRight className="w-4 h-4" />
            </button>

            <button
              type="button"
              onClick={() => setShowHowItWorks(true)}
              className="welcome-secondary-btn"
            >
              <HelpCircle className="w-4 h-4" /> Conhecer o funcionamento
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
