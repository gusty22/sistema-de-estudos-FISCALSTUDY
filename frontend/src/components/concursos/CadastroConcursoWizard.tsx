import React, { useState } from 'react';
import type { ConcursoItem } from './MeusConcursos';
import './CadastroConcursoWizard.css';

interface CadastroConcursoWizardProps {
  isOpen: boolean;
  onClose: () => void;
  onConcursoCreated: (concurso: ConcursoItem) => void;
  initialData?: ConcursoItem | null;
}

export const CadastroConcursoWizard: React.FC<CadastroConcursoWizardProps> = ({
  isOpen,
  onClose,
  onConcursoCreated,
  initialData,
}) => {
  const [step, setStep] = useState<number>(1);
  const [isSaving, setIsSaving] = useState<boolean>(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Form State
  const [formData, setFormData] = useState({
    // Step 1: Geral
    nome: initialData?.nome || '',
    orgao: initialData?.orgao || '',
    cargo: initialData?.cargo || '',
    cargoCodigo: initialData?.cargoCodigo || '',
    banca: initialData?.banca || 'FGV',
    ano: initialData?.ano ? String(initialData.ano) : String(new Date().getFullYear()),
    situacao: initialData?.situacao || 'EDITAL_PUBLICADO',
    localidade: initialData?.localidade || 'MG',
    escolaridade: initialData?.escolaridade || 'Superior em Qualquer Área',
    vagas: initialData?.vagas ? String(initialData.vagas) : '10',
    salario: initialData?.salario ? String(initialData.salario) : '15000',
    descricao: initialData?.descricao || '',

    // Step 2: Datas
    dataProva: initialData?.dataProva || '',
    dataProvaTipo: initialData?.dataProvaTipo || 'OFICIAL',
    dataEdital: '',
    dataInscricaoInicio: '',
    dataInscricaoFim: '',
    dataResultado: '',

    // Step 3: Edital
    editalTipo: 'MANUAL', // MANUAL, UPLOAD, REFERENCIA
    linkEdital: initialData?.linkEdital || '',

    // Step 4: Disponibilidade (Horas por dia)
    horasSeg: 4,
    horasTer: 4,
    horasQua: 4,
    horasQui: 4,
    horasSex: 4,
    horasSab: 6,
    horasDom: 4,
  });

  if (!isOpen) return null;

  const totalHorasSemana =
    Number(formData.horasSeg) +
    Number(formData.horasTer) +
    Number(formData.horasQua) +
    Number(formData.horasQui) +
    Number(formData.horasSex) +
    Number(formData.horasSab) +
    Number(formData.horasDom);

  const calculateDaysToExam = (): number | null => {
    if (!formData.dataProva) return null;
    const examDate = new Date(formData.dataProva);
    const today = new Date();
    const diffTime = examDate.getTime() - today.getTime();
    return Math.ceil(diffTime / (1000 * 60 * 60 * 24));
  };

  const daysToExam = calculateDaysToExam();

  const handleNext = () => {
    setErrorMsg(null);
    if (step === 1) {
      if (!formData.nome.trim() || !formData.orgao.trim() || !formData.cargo.trim()) {
        setErrorMsg('Por favor, preencha Nome do Concurso, Órgão e Cargo pretendido.');
        return;
      }
    }
    setStep((prev) => Math.min(prev + 1, 5));
  };

  const handleBack = () => {
    setErrorMsg(null);
    setStep((prev) => Math.max(prev - 1, 1));
  };

  const handleSave = async () => {
    setIsSaving(true);
    setErrorMsg(null);

    const datasImportantes = {
      dataEdital: formData.dataEdital || null,
      dataInscricaoInicio: formData.dataInscricaoInicio || null,
      dataInscricaoFim: formData.dataInscricaoFim || null,
      dataResultado: formData.dataResultado || null,
    };

    const disponibilidade = {
      totalSemana: totalHorasSemana,
      dias: {
        segunda: Number(formData.horasSeg),
        terca: Number(formData.horasTer),
        quarta: Number(formData.horasQua),
        quinta: Number(formData.horasQui),
        sexta: Number(formData.horasSex),
        sabado: Number(formData.horasSab),
        domingo: Number(formData.horasDom),
      },
    };

    const payload = {
      nome: formData.nome.trim(),
      orgao: formData.orgao.trim(),
      cargo: formData.cargo.trim(),
      cargoCodigo: formData.cargoCodigo.trim(),
      banca: formData.banca.trim(),
      ano: formData.ano ? parseInt(formData.ano, 10) : null,
      situacao: formData.situacao,
      localidade: formData.localidade.trim(),
      escolaridade: formData.escolaridade.trim(),
      vagas: formData.vagas ? parseInt(formData.vagas, 10) : null,
      salario: formData.salario ? parseFloat(formData.salario) : null,
      descricao: formData.descricao.trim(),
      linkEdital: formData.linkEdital.trim() || null,
      dataProva: formData.dataProva || null,
      dataProvaTipo: formData.dataProvaTipo,
      datasImportantesJson: JSON.stringify(datasImportantes),
      disponibilidadeJson: JSON.stringify(disponibilidade),
    };

    try {
      let res: Response;
      if (initialData?.id) {
        res = await fetch(`/api/v1/concursos/${initialData.id}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        });
      } else {
        res = await fetch('/api/v1/concursos', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        });
      }

      if (!res.ok) {
        const errJson = await res.json().catch(() => ({}));
        throw new Error(errJson.message || `Falha ao salvar concurso (HTTP ${res.status})`);
      }

      const created: ConcursoItem = await res.json();
      onConcursoCreated(created);
      onClose();
    } catch (err: any) {
      setErrorMsg(err.message || 'Erro inesperado ao salvar.');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="wizard-modal-overlay">
      <div className="wizard-modal-card glass animate-fade-in">
        {/* Header */}
        <div className="wizard-header">
          <div>
            <h3>🏛️ {initialData ? 'Editar Concurso' : 'Novo Concurso-Alvo'}</h3>
            <p className="wizard-subtitle">
              Configuração progressiva em 5 etapas para personalização adaptativa
            </p>
          </div>
          <button className="wizard-close-btn" onClick={onClose}>
            ✕
          </button>
        </div>

        {/* Steps Progress Bar */}
        <div className="wizard-stepper">
          {[
            { num: 1, label: 'Geral & Cargo' },
            { num: 2, label: 'Datas Críticas' },
            { num: 3, label: 'Edital & Origem' },
            { num: 4, label: 'Disponibilidade' },
            { num: 5, label: 'Confirmação' },
          ].map((s) => (
            <div
              key={s.num}
              className={`stepper-step ${step === s.num ? 'active' : ''} ${
                step > s.num ? 'completed' : ''
              }`}
              onClick={() => step > s.num && setStep(s.num)}
            >
              <div className="step-circle">{step > s.num ? '✓' : s.num}</div>
              <span className="step-label">{s.label}</span>
            </div>
          ))}
        </div>

        {errorMsg && (
          <div className="wizard-error-banner">
            <span>⚠️ {errorMsg}</span>
          </div>
        )}

        {/* Step Content */}
        <div className="wizard-body">
          {/* STEP 1: GERAL */}
          {step === 1 && (
            <div className="step-panel animate-fade-in">
              <h4 className="panel-title">1. Informações Gerais do Concurso</h4>
              <div className="form-grid-2">
                <div className="form-group">
                  <label>Nome Amigável do Concurso *</label>
                  <input
                    type="text"
                    value={formData.nome}
                    onChange={(e) => setFormData({ ...formData, nome: e.target.value })}
                    placeholder="Ex: SEFAZ-MG 2024 — Auditor Fiscal"
                  />
                </div>
                <div className="form-group">
                  <label>Órgão Público *</label>
                  <input
                    type="text"
                    value={formData.orgao}
                    onChange={(e) => setFormData({ ...formData, orgao: e.target.value })}
                    placeholder="Ex: Secretaria de Estado da Fazenda de Minas Gerais"
                  />
                </div>
              </div>

              <div className="form-grid-3">
                <div className="form-group">
                  <label>Cargo Pretendido *</label>
                  <input
                    type="text"
                    value={formData.cargo}
                    onChange={(e) => setFormData({ ...formData, cargo: e.target.value })}
                    placeholder="Ex: Auditor Fiscal da Receita Estadual"
                  />
                </div>
                <div className="form-group">
                  <label>Código do Cargo</label>
                  <input
                    type="text"
                    value={formData.cargoCodigo}
                    onChange={(e) => setFormData({ ...formData, cargoCodigo: e.target.value })}
                    placeholder="Ex: AFRE-01 ou 503"
                  />
                </div>
                <div className="form-group">
                  <label>Banca Examinadora</label>
                  <select
                    value={formData.banca}
                    onChange={(e) => setFormData({ ...formData, banca: e.target.value })}
                  >
                    <option value="FGV">FGV</option>
                    <option value="Cebraspe">Cebraspe / CESPE</option>
                    <option value="FCC">FCC</option>
                    <option value="IBGP">IBGP</option>
                    <option value="Vunesp">Vunesp</option>
                    <option value="AOCP">Instituto AOCP</option>
                    <option value="Outra">Outra</option>
                  </select>
                </div>
              </div>

              <div className="form-grid-4">
                <div className="form-group">
                  <label>Ano</label>
                  <input
                    type="number"
                    value={formData.ano}
                    onChange={(e) => setFormData({ ...formData, ano: e.target.value })}
                  />
                </div>
                <div className="form-group">
                  <label>Situação</label>
                  <select
                    value={formData.situacao}
                    onChange={(e) => setFormData({ ...formData, situacao: e.target.value })}
                  >
                    <option value="PREVISTO">Previsto / Boato</option>
                    <option value="AUTORIZADO">Autorizado</option>
                    <option value="COMISSAO_FORMADA">Comissão Formada</option>
                    <option value="BANCA_DEFINIDA">Banca Definida</option>
                    <option value="EDITAL_PUBLICADO">Edital Publicado</option>
                    <option value="CONCLUIDO">Concluído</option>
                  </select>
                </div>
                <div className="form-group">
                  <label>Vagas Previstas</label>
                  <input
                    type="number"
                    value={formData.vagas}
                    onChange={(e) => setFormData({ ...formData, vagas: e.target.value })}
                    placeholder="Ex: 50"
                  />
                </div>
                <div className="form-group">
                  <label>Salário Estimado (R$)</label>
                  <input
                    type="number"
                    value={formData.salario}
                    onChange={(e) => setFormData({ ...formData, salario: e.target.value })}
                    placeholder="Ex: 22000"
                  />
                </div>
              </div>

              <div className="form-group">
                <label>Observações e Foco Estratégico</label>
                <textarea
                  rows={2}
                  value={formData.descricao}
                  onChange={(e) => setFormData({ ...formData, descricao: e.target.value })}
                  placeholder="Ex: Foco prioritário em Legislação Tributária Estadual e Contabilidade Avançada."
                />
              </div>
            </div>
          )}

          {/* STEP 2: DATAS */}
          {step === 2 && (
            <div className="step-panel animate-fade-in">
              <h4 className="panel-title">2. Datas Críticas e Cronograma Oficial</h4>
              <p className="panel-help">
                As datas alimentam a contagem regressiva e o ritmo de cobertura do edital verticalizado.
              </p>

              <div className="form-grid-2 highlight-box">
                <div className="form-group">
                  <label>Data da Prova Objetiva / Discursiva</label>
                  <input
                    type="date"
                    value={formData.dataProva}
                    onChange={(e) => setFormData({ ...formData, dataProva: e.target.value })}
                  />
                </div>
                <div className="form-group">
                  <label>Origem / Confiança da Data da Prova</label>
                  <select
                    value={formData.dataProvaTipo}
                    onChange={(e) => setFormData({ ...formData, dataProvaTipo: e.target.value })}
                  >
                    <option value="OFICIAL">Data Oficial (Fixada no Edital)</option>
                    <option value="PREVISTA">Data Prevista (Notícias / Banca)</option>
                    <option value="INFORMADA_PELO_USUARIO">Estimativa Pessoal</option>
                  </select>
                </div>
              </div>

              {daysToExam !== null && (
                <div className={`countdown-preview ${daysToExam < 30 ? 'alert' : ''}`}>
                  ⏱️ <strong>{daysToExam > 0 ? `${daysToExam} dias restantes` : 'Data da prova já transcorreu'}</strong> até a prova.
                </div>
              )}

              <div className="form-grid-3" style={{ marginTop: '1rem' }}>
                <div className="form-group">
                  <label>Data de Publicação do Edital</label>
                  <input
                    type="date"
                    value={formData.dataEdital}
                    onChange={(e) => setFormData({ ...formData, dataEdital: e.target.value })}
                  />
                </div>
                <div className="form-group">
                  <label>Início das Inscrições</label>
                  <input
                    type="date"
                    value={formData.dataInscricaoInicio}
                    onChange={(e) => setFormData({ ...formData, dataInscricaoInicio: e.target.value })}
                  />
                </div>
                <div className="form-group">
                  <label>Término das Inscrições</label>
                  <input
                    type="date"
                    value={formData.dataInscricaoFim}
                    onChange={(e) => setFormData({ ...formData, dataInscricaoFim: e.target.value })}
                  />
                </div>
              </div>
            </div>
          )}

          {/* STEP 3: EDITAL */}
          {step === 3 && (
            <div className="step-panel animate-fade-in">
              <h4 className="panel-title">3. Edital Verticalizado & Conteúdo Programático</h4>
              <p className="panel-help">
                Vincule o edital que servirá de referência para a árvore de tópicos e questões.
              </p>

              <div className="radio-group-cards">
                <label className={`radio-card ${formData.editalTipo === 'MANUAL' ? 'selected' : ''}`}>
                  <input
                    type="radio"
                    name="editalTipo"
                    value="MANUAL"
                    checked={formData.editalTipo === 'MANUAL'}
                    onChange={() => setFormData({ ...formData, editalTipo: 'MANUAL' })}
                  />
                  <div className="radio-content">
                    <span className="radio-icon">✍️</span>
                    <div>
                      <strong>Construir Manualmente / Edital Padrão</strong>
                      <p>Utilizar disciplinas fiscais recomendadas e editar a árvore de tópicos posteriormente.</p>
                    </div>
                  </div>
                </label>

                <label className={`radio-card ${formData.editalTipo === 'UPLOAD' ? 'selected' : ''}`}>
                  <input
                    type="radio"
                    name="editalTipo"
                    value="UPLOAD"
                    checked={formData.editalTipo === 'UPLOAD'}
                    onChange={() => setFormData({ ...formData, editalTipo: 'UPLOAD' })}
                  />
                  <div className="radio-content">
                    <span className="radio-icon">📥</span>
                    <div>
                      <strong>Central de Ingestão de Provas / Edital</strong>
                      <p>Enviar arquivo PDF do edital ou provas anteriores via Studio de Ingestão.</p>
                    </div>
                  </div>
                </label>
              </div>

              <div className="form-group" style={{ marginTop: '1.25rem' }}>
                <label>Link Público Oficial do Edital (Opcional)</label>
                <input
                  type="url"
                  value={formData.linkEdital}
                  onChange={(e) => setFormData({ ...formData, linkEdital: e.target.value })}
                  placeholder="https://exemplo.com/edital-oficial.pdf"
                />
              </div>
            </div>
          )}

          {/* STEP 4: DISPONIBILIDADE */}
          {step === 4 && (
            <div className="step-panel animate-fade-in">
              <h4 className="panel-title">4. Disponibilidade Semanal de Estudo</h4>
              <p className="panel-help">
                Informe as horas líquidas diárias que você planeja dedicar. Isso calculará sua capacidade de cobertura.
              </p>

              <div className="disponibilidade-grid">
                {[
                  { key: 'horasSeg', day: 'Segunda-feira' },
                  { key: 'horasTer', day: 'Terça-feira' },
                  { key: 'horasQua', day: 'Quarta-feira' },
                  { key: 'horasQui', day: 'Quinta-feira' },
                  { key: 'horasSex', day: 'Sexta-feira' },
                  { key: 'horasSab', day: 'Sábado' },
                  { key: 'horasDom', day: 'Domingo' },
                ].map((item) => (
                  <div key={item.key} className="dia-item">
                    <span className="dia-nome">{item.day}</span>
                    <div className="dia-input-wrapper">
                      <input
                        type="number"
                        min="0"
                        max="16"
                        step="0.5"
                        value={(formData as any)[item.key]}
                        onChange={(e) =>
                          setFormData({ ...formData, [item.key]: parseFloat(e.target.value) || 0 })
                        }
                      />
                      <span>h</span>
                    </div>
                  </div>
                ))}
              </div>

              <div className="disponibilidade-summary">
                <div className="metric-box">
                  <span className="metric-label">Carga Horária Semanal:</span>
                  <span className="metric-value">{totalHorasSemana}h líquidas</span>
                </div>
                <div className="metric-box">
                  <span className="metric-label">Média Diária:</span>
                  <span className="metric-value">{(totalHorasSemana / 7).toFixed(1)}h/dia</span>
                </div>
              </div>
            </div>
          )}

          {/* STEP 5: RESUMO & CONFIRMAÇÃO */}
          {step === 5 && (
            <div className="step-panel animate-fade-in">
              <h4 className="panel-title">5. Revisão & Confirmação</h4>
              <p className="panel-help">
                Verifique os dados cadastrados antes de inicializar o concurso na plataforma.
              </p>

              <div className="summary-card">
                <div className="summary-row">
                  <span className="summary-label">Concurso:</span>
                  <span className="summary-val font-bold">{formData.nome}</span>
                </div>
                <div className="summary-row">
                  <span className="summary-label">Órgão / Cargo:</span>
                  <span className="summary-val">{formData.orgao} • {formData.cargo}</span>
                </div>
                <div className="summary-row">
                  <span className="summary-label">Banca / Ano:</span>
                  <span className="summary-val">{formData.banca} • {formData.ano}</span>
                </div>
                <div className="summary-row">
                  <span className="summary-label">Situação:</span>
                  <span className="summary-badge">{formData.situacao}</span>
                </div>
                <div className="summary-row">
                  <span className="summary-label">Data da Prova:</span>
                  <span className="summary-val">
                    {formData.dataProva ? `${formData.dataProva} (${formData.dataProvaTipo})` : 'A definir'}
                  </span>
                </div>
                <div className="summary-row">
                  <span className="summary-label">Carga Semanal:</span>
                  <span className="summary-val text-green font-bold">{totalHorasSemana} horas/semana</span>
                </div>
              </div>

              <div className="mvt-notice">
                ℹ️ <strong>Filosofia MVT:</strong> Todas as métricas de acerto e progresso de edital serão calculadas exclusivamente com base em respostas reais registradas no Event Store.
              </div>
            </div>
          )}
        </div>

        {/* Footer Navigation */}
        <div className="wizard-footer">
          {step > 1 && (
            <button className="btn btn-secondary" onClick={handleBack} disabled={isSaving}>
              ← Voltar
            </button>
          )}
          <div style={{ flex: 1 }} />
          {step < 5 ? (
            <button className="btn" onClick={handleNext}>
              Avançar →
            </button>
          ) : (
            <button className="btn btn-primary-confirm" onClick={handleSave} disabled={isSaving}>
              {isSaving ? 'Salvando...' : '✓ Confirmar e Ativar Concurso'}
            </button>
          )}
        </div>
      </div>
    </div>
  );
};

export default CadastroConcursoWizard;
