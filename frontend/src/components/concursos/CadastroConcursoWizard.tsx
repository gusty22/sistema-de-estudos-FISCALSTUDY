import React, { useState } from 'react';
import type { ConcursoItem } from './MeusConcursos';
import './CadastroConcursoWizard.css';

interface CadastroConcursoWizardProps {
  isOpen: boolean;
  onClose: () => void;
  onConcursoCreated: (concurso: ConcursoItem) => void;
  initialData?: ConcursoItem | null;
}

export interface SubtopicoItem {
  id: string;
  nome: string;
  ordem: number;
}

export interface TopicoItem {
  id: string;
  nome: string;
  ordem: number;
  subtopicos: SubtopicoItem[];
}

export interface MateriaItem {
  id: string;
  nome: string;
  ordem: number;
  peso?: number;
  topicos: TopicoItem[];
}

const AUTO_COLOR_PALETTE = [
  '#f55a5a', '#4f8ef7', '#7c5cfc', '#3ecf8e', '#f5c842', '#f5874a',
  '#00bcd4', '#e91e8c', '#8bc34a', '#ff9800', '#9c27b0', '#ff5722',
  '#009688', '#795548', '#3f51b5', '#cddc39', '#03a9f4', '#e91e63', '#4caf50'
];

const WIZARD_STEPS = [
  { num: 1, label: 'Identificação' },
  { num: 2, label: 'Datas' },
  { num: 3, label: 'Importar Edital' },
  { num: 4, label: 'Revisar Conteúdo' },
  { num: 5, label: 'Diagnóstico' },
  { num: 6, label: 'Rotina' },
  { num: 7, label: 'Confirmar' },
];

export const CadastroConcursoWizard: React.FC<CadastroConcursoWizardProps> = ({
  isOpen,
  onClose,
  onConcursoCreated,
  initialData,
}) => {
  const [step, setStep] = useState<number>(1);
  const [isSaving, setIsSaving] = useState<boolean>(false);
  const [isValidating, setIsValidating] = useState<boolean>(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Form State — Step 1 & 2
  const [formData, setFormData] = useState({
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

    dataProva: initialData?.dataProva || '',
    dataProvaTipo: initialData?.dataProvaTipo || 'OFICIAL',
    dataEdital: '',
    dataInscricaoInicio: '',
    dataInscricaoFim: '',
    dataResultado: '',

    // Step 6: Rotina Pessoal
    horasSeg: 4,
    horasTer: 4,
    horasQua: 4,
    horasQui: 4,
    horasSex: 4,
    horasSab: 6,
    horasDom: 4,
    blocoPreferidoMin: 60,
    restricoesRotina: '',
  });

  // Step 3 & 4: Edital State
  const [rawJsonText, setRawJsonText] = useState<string>('');
  const [docOrigem, setDocOrigem] = useState<string>('edital.pdf');
  const [validationResult, setValidationResult] = useState<{
    valid: boolean;
    status: string;
    totalMaterias: number;
    totalTopicos: number;
    totalSubtopicos: number;
    errors: string[];
    warnings: string[];
    procedenciaStatus: string;
    notaFidelidade?: string;
  } | null>(null);

  const [materias, setMaterias] = useState<MateriaItem[]>([]);
  const [expandedMaterias, setExpandedMaterias] = useState<Record<string, boolean>>({});

  // Step 5: Diagnóstico Autodeclarado por Matéria
  const [diagnosticoPorMateria, setDiagnosticoPorMateria] = useState<Record<string, string>>({});

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

  // Step 3: Validação de JSON via Endpoint Standalone (Passo A2)
  const handleValidateJson = async (textToValidate?: string) => {
    const text = textToValidate !== undefined ? textToValidate : rawJsonText;
    if (!text.trim()) {
      setErrorMsg('Por favor, cole o JSON do edital ou carregue um arquivo.');
      return;
    }

    setIsValidating(true);
    setErrorMsg(null);

    try {
      const res = await fetch('/api/v1/edital/validate-json', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: text,
      });

      if (!res.ok) {
        throw new Error(`Falha na validação (HTTP ${res.status})`);
      }

      const data = await res.json();
      setValidationResult(data);

      if (data.valid && data.normalizedMaterias) {
        setMaterias(data.normalizedMaterias);
        // Inicializa expandidos
        const exp: Record<string, boolean> = {};
        const diag: Record<string, string> = {};
        data.normalizedMaterias.forEach((m: MateriaItem) => {
          exp[m.id] = true;
          diag[m.nome] = 'BASICO_DECLARADO';
        });
        setExpandedMaterias(exp);
        setDiagnosticoPorMateria(diag);
      }
    } catch (err: any) {
      setErrorMsg(err.message || 'Erro ao validar JSON.');
    } finally {
      setIsValidating(false);
    }
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setDocOrigem(file.name);
    const reader = new FileReader();
    reader.onload = (event) => {
      const content = event.target?.result as string;
      setRawJsonText(content);
      handleValidateJson(content);
    };
    reader.readAsText(file);
  };

  // Navegação do Wizard
  const handleNext = () => {
    setErrorMsg(null);
    if (step === 1) {
      if (!formData.nome.trim() || !formData.orgao.trim() || !formData.cargo.trim()) {
        setErrorMsg('Nome do Concurso, Órgão e Cargo são obrigatórios.');
        return;
      }
    }
    if (step === 3 && rawJsonText.trim() && !validationResult) {
      // Se colou JSON mas não validou, valida automaticamente
      handleValidateJson();
      return;
    }
    setStep((prev) => Math.min(prev + 1, 7));
  };

  const handleBack = () => {
    setErrorMsg(null);
    setStep((prev) => Math.max(prev - 1, 1));
  };

  // Árvore de Revisão — Manipulações
  const toggleMateriaExpand = (id: string) => {
    setExpandedMaterias((prev) => ({ ...prev, [id]: !prev[id] }));
  };

  const handleMateriaNameChange = (id: string, newName: string) => {
    setMaterias((prev) =>
      prev.map((m) => (m.id === id ? { ...m, nome: newName } : m))
    );
  };

  const handleDeleteMateria = (id: string) => {
    setMaterias((prev) => prev.filter((m) => m.id !== id));
  };

  const handleAddMateria = () => {
    const newId = `mat_${Date.now()}`;
    const newMat: MateriaItem = {
      id: newId,
      nome: 'Nova Disciplina',
      ordem: materias.length,
      topicos: [],
    };
    setMaterias((prev) => [...prev, newMat]);
    setExpandedMaterias((prev) => ({ ...prev, [newId]: true }));
    setDiagnosticoPorMateria((prev) => ({ ...prev, 'Nova Disciplina': 'BASICO_DECLARADO' }));
  };

  const handleAddTopico = (matId: string) => {
    const newTopId = `top_${Date.now()}`;
    setMaterias((prev) =>
      prev.map((m) => {
        if (m.id !== matId) return m;
        return {
          ...m,
          topicos: [
            ...m.topicos,
            { id: newTopId, nome: 'Novo Tópico', ordem: m.topicos.length, subtopicos: [] },
          ],
        };
      })
    );
  };

  const handleDeleteTopico = (matId: string, topId: string) => {
    setMaterias((prev) =>
      prev.map((m) => {
        if (m.id !== matId) return m;
        return {
          ...m,
          topicos: m.topicos.filter((t) => t.id !== topId),
        };
      })
    );
  };

  const handleAddSubtopico = (matId: string, topId: string) => {
    const newSubId = `sub_${Date.now()}`;
    setMaterias((prev) =>
      prev.map((m) => {
        if (m.id !== matId) return m;
        return {
          ...m,
          topicos: m.topicos.map((t) => {
            if (t.id !== topId) return t;
            return {
              ...t,
              subtopicos: [
                ...t.subtopicos,
                { id: newSubId, nome: 'Novo Subtópico', ordem: t.subtopicos.length },
              ],
            };
          }),
        };
      })
    );
  };

  const handleDeleteSubtopico = (matId: string, topId: string, subId: string) => {
    setMaterias((prev) =>
      prev.map((m) => {
        if (m.id !== matId) return m;
        return {
          ...m,
          topicos: m.topicos.map((t) => {
            if (t.id !== topId) return t;
            return {
              ...t,
              subtopicos: t.subtopicos.filter((s) => s.id !== subId),
            };
          }),
        };
      })
    );
  };

  // Salvar e Ativar — Step 7 (Transacional Atômico)
  const handleSaveAndActivate = async () => {
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
      blocoPreferidoMin: formData.blocoPreferidoMin,
      restricoes: formData.restricoesRotina,
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

    const concursoData = {
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
      dataProva: formData.dataProva || null,
      dataProvaTipo: formData.dataProvaTipo,
      datasImportantesJson: JSON.stringify(datasImportantes),
      disponibilidadeJson: JSON.stringify(disponibilidade),
    };

    const editalPayload =
      materias.length > 0
        ? {
            versao: '1.0',
            docOrigem: docOrigem || 'edital.pdf',
            materias: materias,
          }
        : null;

    const requestPayload = {
      concurso: concursoData,
      editalPayload: editalPayload,
      confirmadoHumano: true,
      procedenciaStatus: 'STRUCTURE_HUMAN_REVIEWED',
      diagnosticoInicial: diagnosticoPorMateria,
    };

    try {
      const res = await fetch('/api/v1/concursos/with-edital', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(requestPayload),
      });

      if (!res.ok) {
        const errJson = await res.json().catch(() => ({}));
        throw new Error(errJson.message || `Falha ao salvar concurso (HTTP ${res.status})`);
      }

      const result = await res.json();
      const savedConcurso: ConcursoItem = {
        id: result.concurso.id,
        nome: result.concurso.nome,
        orgao: result.concurso.orgao,
        banca: result.concurso.banca,
        ano: result.concurso.ano,
        cargo: result.concurso.cargo,
        cargoCodigo: result.concurso.cargoCodigo,
        status: result.concurso.status,
        situacao: result.concurso.situacao,
        dataProva: result.concurso.dataProva,
        dataProvaTipo: result.concurso.dataProvaTipo,
        availableQuestionsCount: result.concurso.availableQuestionsCount || 0,
      };

      onConcursoCreated(savedConcurso);
      onClose();
    } catch (err: any) {
      setErrorMsg(err.message || 'Erro de comunicação ao salvar o concurso.');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="wizard-modal-overlay">
      <div className="wizard-modal-card animate-scale-up">
        {/* Header */}
        <div className="wizard-header">
          <div>
            <div className="wizard-header-title">
              <h3>Cadastrar Concurso Oficial</h3>
              <span className="wizard-tag">Fase A3 · 7 Passos</span>
            </div>
            <p className="wizard-subtitle">
              Configure os parâmetros do concurso, edital verticalizado, diagnóstico autodeclarado e rotina de estudos.
            </p>
          </div>
          <button className="wizard-close-btn" onClick={onClose} aria-label="Fechar">
            ✕
          </button>
        </div>

        {/* Stepper */}
        <div className="wizard-stepper">
          {WIZARD_STEPS.map((s) => (
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

        {/* Error Banner */}
        {errorMsg && (
          <div className="wizard-error-banner">
            <span>⚠️ {errorMsg}</span>
          </div>
        )}

        {/* Step Body */}
        <div className="wizard-body">
          {/* STEP 1: IDENTIFICAÇÃO */}
          {step === 1 && (
            <div className="step-panel animate-fade-in">
              <h4 className="panel-title">1. Identificação do Concurso</h4>
              <p className="panel-help">
                Informe os dados básicos da instituição e do cargo. Campos não confirmados pelo edital podem ser preenchidos como previsão.
              </p>

              <div className="form-grid-2">
                <div className="form-group">
                  <label>Nome do Concurso *</label>
                  <input
                    type="text"
                    value={formData.nome}
                    onChange={(e) => setFormData({ ...formData, nome: e.target.value })}
                    placeholder="Ex: ISS Araguari — Auditor Fiscal"
                  />
                </div>
                <div className="form-group">
                  <label>Órgão Público *</label>
                  <input
                    type="text"
                    value={formData.orgao}
                    onChange={(e) => setFormData({ ...formData, orgao: e.target.value })}
                    placeholder="Ex: Prefeitura Municipal de Araguari"
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
                    placeholder="Ex: Auditor Fiscal da Receita Municipal"
                  />
                </div>
                <div className="form-group">
                  <label>Código do Cargo</label>
                  <input
                    type="text"
                    value={formData.cargoCodigo}
                    onChange={(e) => setFormData({ ...formData, cargoCodigo: e.target.value })}
                    placeholder="Ex: 503 ou AFRE-01"
                  />
                </div>
                <div className="form-group">
                  <label>Banca Examinadora</label>
                  <select
                    value={formData.banca}
                    onChange={(e) => setFormData({ ...formData, banca: e.target.value })}
                  >
                    <option value="IBGP">IBGP</option>
                    <option value="FGV">FGV</option>
                    <option value="Cebraspe">Cebraspe / CESPE</option>
                    <option value="FCC">FCC</option>
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
                  <label>Situação Oficial</label>
                  <select
                    value={formData.situacao}
                    onChange={(e) => setFormData({ ...formData, situacao: e.target.value })}
                  >
                    <option value="EDITAL_PUBLICADO">Edital Publicado</option>
                    <option value="BANCA_DEFINIDA">Banca Definida</option>
                    <option value="COMISSAO_FORMADA">Comissão Formada</option>
                    <option value="AUTORIZADO">Autorizado</option>
                    <option value="PREVISTO">Previsto</option>
                  </select>
                </div>
                <div className="form-group">
                  <label>Vagas</label>
                  <input
                    type="number"
                    value={formData.vagas}
                    onChange={(e) => setFormData({ ...formData, vagas: e.target.value })}
                  />
                </div>
                <div className="form-group">
                  <label>Remuneração Inicial (R$)</label>
                  <input
                    type="number"
                    value={formData.salario}
                    onChange={(e) => setFormData({ ...formData, salario: e.target.value })}
                  />
                </div>
              </div>
            </div>
          )}

          {/* STEP 2: DATAS OFICIAIS & PREVISTAS */}
          {step === 2 && (
            <div className="step-panel animate-fade-in">
              <h4 className="panel-title">2. Datas Oficiais e Contagem Regressiva</h4>
              <p className="panel-help">
                As datas alimentam o horizonte temporal do planejamento e o ritmo de cobertura das revisões.
              </p>

              <div className="form-grid-2" style={{ background: '#0a0d14', padding: '1rem', borderRadius: '10px', border: '1px solid #1f2738' }}>
                <div className="form-group">
                  <label>Data Prevista / Fixada da Prova</label>
                  <input
                    type="date"
                    value={formData.dataProva}
                    onChange={(e) => setFormData({ ...formData, dataProva: e.target.value })}
                  />
                </div>
                <div className="form-group">
                  <label>Status da Data</label>
                  <select
                    value={formData.dataProvaTipo}
                    onChange={(e) => setFormData({ ...formData, dataProvaTipo: e.target.value })}
                  >
                    <option value="OFICIAL">Data Oficial (Publicada no Edital)</option>
                    <option value="PREVISTA">Data Prevista (Notícias / Banca)</option>
                    <option value="INFORMADA_PELO_USUARIO">Estimativa Pessoal</option>
                  </select>
                </div>
              </div>

              {daysToExam !== null && (
                <div style={{ marginTop: '1rem', padding: '0.75rem 1rem', background: 'rgba(59, 130, 246, 0.1)', border: '1px solid rgba(59, 130, 246, 0.3)', borderRadius: '8px', color: '#93c5fd', fontSize: '0.85rem' }}>
                  ⏱️ <strong>{daysToExam > 0 ? `${daysToExam} dias restantes` : 'Data informada já transcorreu'}</strong> até a realização da prova.
                </div>
              )}

              <div className="form-grid-3" style={{ marginTop: '1.25rem' }}>
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

          {/* STEP 3: IMPORTAÇÃO DO EDITAL JSON */}
          {step === 3 && (
            <div className="step-panel animate-fade-in">
              <h4 className="panel-title">3. Importação do Edital (Formato Track Concursos)</h4>
              <p className="panel-help">
                Cole o JSON do edital verticalizado estruturado em <code>materias → topicos → subtopicos</code> ou faça upload do arquivo <code>.json</code>.
              </p>

              <div className="wizard-info-banner">
                ℹ️ <strong>Compatibilidade Total:</strong> O FiscalStudy preserva integralmente nomes, ordem original e IDs de origem sem inventar dados. A validação opera em memória antes de qualquer gravação.
              </div>

              <textarea
                className="form-group json-input-box"
                placeholder='{
  "materias": [
    {
      "id": "mat_01",
      "nome": "Direito Tributário",
      "topicos": [
        {
          "id": "top_01",
          "nome": "Sistema Tributário Nacional",
          "subtopicos": [
            { "id": "sub_01", "nome": "Princípios Constitucionais Tributários" }
          ]
        }
      ]
    }
  ]
}'
                value={rawJsonText}
                onChange={(e) => setRawJsonText(e.target.value)}
              />

              <div className="json-action-bar">
                <div style={{ display: 'flex', gap: '0.5rem' }}>
                  <label className="btn-wizard-back" style={{ cursor: 'pointer', display: 'inline-flex', alignItems: 'center' }}>
                    📁 Carregar arquivo .json
                    <input type="file" accept=".json" onChange={handleFileUpload} style={{ display: 'none' }} />
                  </label>
                  <button
                    type="button"
                    className="btn-wizard-back"
                    onClick={() => {
                      setRawJsonText('');
                      setValidationResult(null);
                    }}
                  >
                    ✕ Limpar
                  </button>
                </div>

                <button
                  type="button"
                  className="btn-wizard-next"
                  onClick={() => handleValidateJson()}
                  disabled={isValidating || !rawJsonText.trim()}
                >
                  {isValidating ? 'Validando...' : '🔍 Validar Estrutura JSON'}
                </button>
              </div>

              {/* Feedback de Validação */}
              {validationResult && (
                <div
                  className={`validation-badge-box ${
                    validationResult.valid
                      ? validationResult.warnings.length > 0
                        ? 'warnings'
                        : 'valid'
                      : 'invalid'
                  }`}
                >
                  <div style={{ fontWeight: 700, display: 'flex', justifyContent: 'space-between' }}>
                    <span>
                      {validationResult.valid
                        ? '✓ Estrutura JSON Válida'
                        : '✕ Erros Estruturais Detectados'}
                    </span>
                    <span>Status: {validationResult.procedenciaStatus}</span>
                  </div>

                  {validationResult.valid ? (
                    <div>
                      Contagem detectada: {validationResult.totalMaterias} Matérias ·{' '}
                      {validationResult.totalTopicos} Tópicos · {validationResult.totalSubtopicos}{' '}
                      Subtópicos.
                      <p style={{ fontSize: '0.75rem', marginTop: '4px', opacity: 0.85 }}>
                        {validationResult.notaFidelidade}
                      </p>
                    </div>
                  ) : (
                    <div>
                      <p style={{ fontWeight: 600 }}>Problemas a corrigir:</p>
                      <ul style={{ paddingLeft: '1.25rem', marginTop: '4px' }}>
                        {validationResult.errors.map((err, idx) => (
                          <li key={idx}>{err}</li>
                        ))}
                      </ul>
                    </div>
                  )}

                  {validationResult.warnings.length > 0 && (
                    <div style={{ marginTop: '6px' }}>
                      <p style={{ fontWeight: 600 }}>Avisos:</p>
                      <ul style={{ paddingLeft: '1.25rem' }}>
                        {validationResult.warnings.map((w, idx) => (
                          <li key={idx}>{w}</li>
                        ))}
                      </ul>
                    </div>
                  )}
                </div>
              )}
            </div>
          )}

          {/* STEP 4: REVISÃO DO CONTEÚDO PROGRAMÁTICO (ÁRVORE INTERATIVA) */}
          {step === 4 && (
            <div className="step-panel animate-fade-in">
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
                <h4 className="panel-title">4. Revisão da Hierarquia Programática</h4>
                <button type="button" className="tree-btn" onClick={handleAddMateria}>
                  ＋ Nova Matéria
                </button>
              </div>
              <p className="panel-help">
                Confira a árvore de matérias, tópicos e subtópicos. Você pode editar títulos, ajustar pesos ou excluir itens específicos.
              </p>

              {materias.length === 0 ? (
                <div style={{ textAlign: 'center', padding: '2rem', color: '#94a3b8' }}>
                  <p>Nenhuma disciplina carregada ainda.</p>
                  <button type="button" className="btn-wizard-next" style={{ marginTop: '1rem' }} onClick={handleAddMateria}>
                    Adicionar Primeira Disciplina
                  </button>
                </div>
              ) : (
                <div className="tree-container">
                  {materias.map((materia, mIdx) => {
                    const color = AUTO_COLOR_PALETTE[mIdx % AUTO_COLOR_PALETTE.length];
                    const isExp = expandedMaterias[materia.id] !== false;

                    return (
                      <div key={materia.id} className="tree-materia-card">
                        <div className="tree-materia-header">
                          <div className="tree-materia-title">
                            <span
                              className="materia-color-dot"
                              style={{ background: color, boxShadow: `0 0 8px ${color}66` }}
                            />
                            <button
                              type="button"
                              onClick={() => toggleMateriaExpand(materia.id)}
                              style={{ background: 'none', border: 'none', color: '#94a3b8', cursor: 'pointer' }}
                            >
                              {isExp ? '▼' : '▶'}
                            </button>
                            <input
                              type="text"
                              className="tree-input-inline"
                              value={materia.nome}
                              onChange={(e) => handleMateriaNameChange(materia.id, e.target.value)}
                            />
                            <span style={{ fontSize: '0.72rem', color: '#64748b' }}>
                              ({materia.topicos.length} tópicos)
                            </span>
                          </div>

                          <div className="tree-actions">
                            <button
                              type="button"
                              className="tree-btn"
                              onClick={() => handleAddTopico(materia.id)}
                            >
                              ＋ Tópico
                            </button>
                            <button
                              type="button"
                              className="tree-btn danger"
                              onClick={() => handleDeleteMateria(materia.id)}
                            >
                              ✕
                            </button>
                          </div>
                        </div>

                        {/* Lista de Tópicos */}
                        {isExp && (
                          <div className="tree-topicos-list">
                            {materia.topicos.map((topico) => (
                              <div key={topico.id} className="tree-topico-item">
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                  <input
                                    type="text"
                                    className="tree-input-inline"
                                    value={topico.nome}
                                    onChange={(e) => {
                                      const newName = e.target.value;
                                      setMaterias((prev) =>
                                        prev.map((m) =>
                                          m.id !== materia.id
                                            ? m
                                            : {
                                                ...m,
                                                topicos: m.topicos.map((t) =>
                                                  t.id === topico.id ? { ...t, nome: newName } : t
                                                ),
                                              }
                                        )
                                      );
                                    }}
                                  />
                                  <div className="tree-actions">
                                    <button
                                      type="button"
                                      className="tree-btn"
                                      onClick={() => handleAddSubtopico(materia.id, topico.id)}
                                    >
                                      ＋ Subtópico
                                    </button>
                                    <button
                                      type="button"
                                      className="tree-btn danger"
                                      onClick={() => handleDeleteTopico(materia.id, topico.id)}
                                    >
                                      ✕
                                    </button>
                                  </div>
                                </div>

                                {/* Lista de Subtópicos */}
                                {topico.subtopicos && topico.subtopicos.length > 0 && (
                                  <div className="tree-subtopicos-list">
                                    {topico.subtopicos.map((sub) => (
                                      <div key={sub.id} className="tree-subtopico-item">
                                        <input
                                          type="text"
                                          className="tree-input-inline"
                                          style={{ fontSize: '0.8rem' }}
                                          value={sub.nome}
                                          onChange={(e) => {
                                            const newSubName = e.target.value;
                                            setMaterias((prev) =>
                                              prev.map((m) =>
                                                m.id !== materia.id
                                                  ? m
                                                  : {
                                                      ...m,
                                                      topicos: m.topicos.map((t) =>
                                                        t.id !== topico.id
                                                          ? t
                                                          : {
                                                              ...t,
                                                              subtopicos: t.subtopicos.map((s) =>
                                                                s.id === sub.id
                                                                  ? { ...s, nome: newSubName }
                                                                  : s
                                                              ),
                                                            }
                                                      ),
                                                    }
                                              )
                                            );
                                          }}
                                        />
                                        <button
                                          type="button"
                                          className="tree-btn danger"
                                          onClick={() =>
                                            handleDeleteSubtopico(materia.id, topico.id, sub.id)
                                          }
                                        >
                                          ✕
                                        </button>
                                      </div>
                                    ))}
                                  </div>
                                )}
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          {/* STEP 5: DIAGNÓSTICO INICIAL AUTODECLARADO */}
          {step === 5 && (
            <div className="step-panel animate-fade-in">
              <h4 className="panel-title">5. Diagnóstico Inicial Autodeclarado</h4>
              <p className="panel-help">
                Informe sua percepção inicial em relação a cada disciplina.
              </p>

              <div className="wizard-info-banner">
                🛡️ <strong>Princípio Epistemológico:</strong> Estes dados são registros de{' '}
                <code>SELF_REPORTED</code> (autorrelato). Eles não representam domínio comprovado e
                orientam apenas o ponto de partida inicial. O motor pedagógico substituirá esse
                relato por evidências observadas conforme você resolver questões.
              </div>

              <div className="diagnostic-list">
                {materias.map((materia, idx) => {
                  const color = AUTO_COLOR_PALETTE[idx % AUTO_COLOR_PALETTE.length];
                  const currentLevel = diagnosticoPorMateria[materia.nome] || 'BASICO_DECLARADO';

                  return (
                    <div key={materia.id} className="diagnostic-item">
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
                        <span className="materia-color-dot" style={{ background: color }} />
                        <span style={{ fontWeight: 600, color: '#f1f5f9', fontSize: '0.88rem' }}>
                          {materia.nome}
                        </span>
                      </div>

                      <select
                        className="diagnostic-select"
                        value={currentLevel}
                        onChange={(e) =>
                          setDiagnosticoPorMateria({
                            ...diagnosticoPorMateria,
                            [materia.nome]: e.target.value,
                          })
                        }
                      >
                        <option value="NUNCA_ESTUDEI">Nunca estudei</option>
                        <option value="BASICO_DECLARADO">Conhecimento básico declarado</option>
                        <option value="INTERMEDIARIO_DECLARADO">
                          Conhecimento intermediário declarado
                        </option>
                        <option value="AVANCADO_DECLARADO">Conhecimento avançado declarado</option>
                        <option value="NAO_SEI_AVALIAR">Não sei avaliar</option>
                      </select>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* STEP 6: ROTINA PESSOAL E DISPONIBILIDADE FLEXÍVEL */}
          {step === 6 && (
            <div className="step-panel animate-fade-in">
              <h4 className="panel-title">6. Rotina Pessoal e Disponibilidade</h4>
              <p className="panel-help">
                Cadastre sua disponibilidade semanal real. As sessões se adaptarão à sua rotina sem grades rígidas.
              </p>

              <div className="form-grid-4">
                <div className="form-group">
                  <label>Segunda</label>
                  <input
                    type="number"
                    min="0"
                    max="16"
                    value={formData.horasSeg}
                    onChange={(e) => setFormData({ ...formData, horasSeg: Number(e.target.value) })}
                  />
                </div>
                <div className="form-group">
                  <label>Terça</label>
                  <input
                    type="number"
                    min="0"
                    max="16"
                    value={formData.horasTer}
                    onChange={(e) => setFormData({ ...formData, horasTer: Number(e.target.value) })}
                  />
                </div>
                <div className="form-group">
                  <label>Quarta</label>
                  <input
                    type="number"
                    min="0"
                    max="16"
                    value={formData.horasQua}
                    onChange={(e) => setFormData({ ...formData, horasQua: Number(e.target.value) })}
                  />
                </div>
                <div className="form-group">
                  <label>Quinta</label>
                  <input
                    type="number"
                    min="0"
                    max="16"
                    value={formData.horasQui}
                    onChange={(e) => setFormData({ ...formData, horasQui: Number(e.target.value) })}
                  />
                </div>
              </div>

              <div className="form-grid-3" style={{ marginTop: '0.5rem' }}>
                <div className="form-group">
                  <label>Sexta</label>
                  <input
                    type="number"
                    min="0"
                    max="16"
                    value={formData.horasSex}
                    onChange={(e) => setFormData({ ...formData, horasSex: Number(e.target.value) })}
                  />
                </div>
                <div className="form-group">
                  <label>Sábado</label>
                  <input
                    type="number"
                    min="0"
                    max="16"
                    value={formData.horasSab}
                    onChange={(e) => setFormData({ ...formData, horasSab: Number(e.target.value) })}
                  />
                </div>
                <div className="form-group">
                  <label>Domingo</label>
                  <input
                    type="number"
                    min="0"
                    max="16"
                    value={formData.horasDom}
                    onChange={(e) => setFormData({ ...formData, horasDom: Number(e.target.value) })}
                  />
                </div>
              </div>

              <div style={{ marginTop: '1rem', padding: '0.75rem 1rem', background: '#0a0d14', borderRadius: '8px', border: '1px solid #1f2738' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ fontSize: '0.85rem', color: '#94a3b8' }}>Total Semanal Previsto:</span>
                  <span style={{ fontSize: '1.1rem', fontWeight: 700, color: '#38bdf8' }}>
                    {totalHorasSemana} horas / semana
                  </span>
                </div>
              </div>

              <div className="form-grid-2" style={{ marginTop: '1rem' }}>
                <div className="form-group">
                  <label>Duração Preferida do Bloco de Estudo</label>
                  <select
                    value={formData.blocoPreferidoMin}
                    onChange={(e) =>
                      setFormData({ ...formData, blocoPreferidoMin: Number(e.target.value) })
                    }
                  >
                    <option value={45}>45 minutos (Foco curto)</option>
                    <option value={60}>60 minutos (Padrão)</option>
                    <option value={90}>90 minutos (Imersão teórica)</option>
                    <option value={120}>120 minutos (Bloco longo de simulado)</option>
                  </select>
                </div>
                <div className="form-group">
                  <label>Compromissos Recorrentes / Restrições</label>
                  <input
                    type="text"
                    value={formData.restricoesRotina}
                    onChange={(e) =>
                      setFormData({ ...formData, restricoesRotina: e.target.value })
                    }
                    placeholder="Ex: Trabalho 08h-18h; Treino terça e quinta"
                  />
                </div>
              </div>
            </div>
          )}

          {/* STEP 7: CONFIRMAÇÃO E ATIVAÇÃO ATÔMICA */}
          {step === 7 && (
            <div className="step-panel animate-fade-in">
              <h4 className="panel-title">7. Resumo do Concurso e Ativação</h4>
              <p className="panel-help">
                Confira a consolidação de todos os parâmetros antes de gravar atomicamente no banco.
              </p>

              <div className="summary-grid">
                <div className="summary-card">
                  <h5>🏛️ Concurso & Cargo</h5>
                  <p>
                    <strong>{formData.nome}</strong> ({formData.orgao})
                  </p>
                  <p style={{ color: '#94a3b8', fontSize: '0.82rem' }}>
                    Cargo: {formData.cargo} · Banca: {formData.banca} · Ano: {formData.ano}
                  </p>
                </div>

                <div className="summary-card">
                  <h5>📅 Horizonte da Prova</h5>
                  <p>
                    {formData.dataProva
                      ? `${formData.dataProva} (${formData.dataProvaTipo})`
                      : 'Data não informada'}
                  </p>
                  <p style={{ color: '#94a3b8', fontSize: '0.82rem' }}>
                    {daysToExam !== null ? `${daysToExam} dias até a prova` : 'Contagem suspensa'}
                  </p>
                </div>

                <div className="summary-card">
                  <h5>📚 Conteúdo Programático</h5>
                  <p>
                    <strong>{materias.length}</strong> Disciplinas cadastradas
                  </p>
                  <p style={{ color: '#94a3b8', fontSize: '0.82rem' }}>
                    {materias.reduce((acc, m) => acc + m.topicos.length, 0)} tópicos · Procedência:{' '}
                    <code>STRUCTURE_HUMAN_REVIEWED</code>
                  </p>
                </div>

                <div className="summary-card">
                  <h5>⏱️ Rotina & Carga</h5>
                  <p>
                    <strong>{totalHorasSemana} horas / semana</strong>
                  </p>
                  <p style={{ color: '#94a3b8', fontSize: '0.82rem' }}>
                    Blocos de {formData.blocoPreferidoMin} min · Fila adaptativa pronta
                  </p>
                </div>
              </div>

              <div className="wizard-info-banner" style={{ background: 'rgba(16, 185, 129, 0.1)', borderColor: 'rgba(16, 185, 129, 0.3)', color: '#34d399' }}>
                ✓ <strong>Persistência Segura:</strong> Ao ativar, o concurso e seu edital verticalizado serão salvos em uma única transação atômica. Se houver qualquer inconsistência, nada será gravado de forma parcial.
              </div>
            </div>
          )}
        </div>

        {/* Footer Navigation */}
        <div className="wizard-footer">
          {step > 1 ? (
            <button type="button" className="btn-wizard-back" onClick={handleBack} disabled={isSaving}>
              ← Voltar
            </button>
          ) : (
            <button type="button" className="btn-wizard-back" onClick={onClose} disabled={isSaving}>
              Cancelar
            </button>
          )}

          <div style={{ fontSize: '0.78rem', color: '#64748b' }}>
            Etapa {step} de 7 · {WIZARD_STEPS[step - 1].label}
          </div>

          {step < 7 ? (
            <button type="button" className="btn-wizard-next" onClick={handleNext} disabled={isSaving}>
              Próximo →
            </button>
          ) : (
            <button
              type="button"
              className="btn-wizard-next btn-wizard-save"
              onClick={handleSaveAndActivate}
              disabled={isSaving}
            >
              {isSaving ? 'Salvando...' : '✓ Salvar e Ativar Concurso'}
            </button>
          )}
        </div>
      </div>
    </div>
  );
};

export default CadastroConcursoWizard;
