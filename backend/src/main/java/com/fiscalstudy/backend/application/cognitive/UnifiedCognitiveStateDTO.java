package com.fiscalstudy.backend.application.cognitive;

import com.fasterxml.jackson.annotation.JsonInclude;
import java.util.ArrayList;
import java.util.List;

/**
 * Representação Unificada e Auditável da Arquitetura Cognitiva (6 Componentes).
 * Compartilha o mesmo modelo de conhecimento e histórico auditável sem subsistemas isolados.
 */
@JsonInclude(JsonInclude.Include.NON_NULL)
public class UnifiedCognitiveStateDTO {

    private String modelVersion;
    private String engineName;
    private String computedAt;
    private String auditHash;

    // 1. Registro de Eventos (Telemetria Histórica Imutável)
    private EventStoreSummary eventStoreSummary;

    // 2. Modelo de Conhecimento (Estimativas por Tópico)
    private List<TopicKnowledgeEstimate> knowledgeModel = new ArrayList<>();

    // 3. Calibração Metacognitiva (Confiança vs Desempenho Real)
    private MetacognitiveCalibration metacognition;

    // 4. Monitor de Anomalias (Qualidade e Confiabilidade das Evidências)
    private AnomalyEvidenceReport anomalyReport;

    // 5. Motor de Intervenções (Estratégias Pedagógicas Prescritas)
    private List<InterventionPrescription> activeInterventions = new ArrayList<>();

    // 6. Planejador Adaptativo (Roteiro Otimizado com Restrições Reais)
    private AdaptivePlanSummary adaptivePlan;

    public UnifiedCognitiveStateDTO() {}

    public String getModelVersion() { return modelVersion; }
    public void setModelVersion(String modelVersion) { this.modelVersion = modelVersion; }

    public String getEngineName() { return engineName; }
    public void setEngineName(String engineName) { this.engineName = engineName; }

    public String getComputedAt() { return computedAt; }
    public void setComputedAt(String computedAt) { this.computedAt = computedAt; }

    public String getAuditHash() { return auditHash; }
    public void setAuditHash(String auditHash) { this.auditHash = auditHash; }

    public EventStoreSummary getEventStoreSummary() { return eventStoreSummary; }
    public void setEventStoreSummary(EventStoreSummary eventStoreSummary) { this.eventStoreSummary = eventStoreSummary; }

    public List<TopicKnowledgeEstimate> getKnowledgeModel() { return knowledgeModel; }
    public void setKnowledgeModel(List<TopicKnowledgeEstimate> knowledgeModel) { this.knowledgeModel = knowledgeModel; }

    public MetacognitiveCalibration getMetacognition() { return metacognition; }
    public void setMetacognition(MetacognitiveCalibration metacognition) { this.metacognition = metacognition; }

    public AnomalyEvidenceReport getAnomalyReport() { return anomalyReport; }
    public void setAnomalyReport(AnomalyEvidenceReport anomalyReport) { this.anomalyReport = anomalyReport; }

    public List<InterventionPrescription> getActiveInterventions() { return activeInterventions; }
    public void setActiveInterventions(List<InterventionPrescription> activeInterventions) { this.activeInterventions = activeInterventions; }

    public AdaptivePlanSummary getAdaptivePlan() { return adaptivePlan; }
    public void setAdaptivePlan(AdaptivePlanSummary adaptivePlan) { this.adaptivePlan = adaptivePlan; }

    // ==========================================
    // Classes Internas Estruturadas
    // ==========================================

    public static class EventStoreSummary {
        private long totalEvents;
        private long totalAttempts;
        private String firstEventAt;
        private String lastEventAt;
        private boolean appendOnlyProtected;

        public long getTotalEvents() { return totalEvents; }
        public void setTotalEvents(long totalEvents) { this.totalEvents = totalEvents; }
        public long getTotalAttempts() { return totalAttempts; }
        public void setTotalAttempts(long totalAttempts) { this.totalAttempts = totalAttempts; }
        public String getFirstEventAt() { return firstEventAt; }
        public void setFirstEventAt(String firstEventAt) { this.firstEventAt = firstEventAt; }
        public String getLastEventAt() { return lastEventAt; }
        public void setLastEventAt(String lastEventAt) { this.lastEventAt = lastEventAt; }
        public boolean isAppendOnlyProtected() { return appendOnlyProtected; }
        public void setAppendOnlyProtected(boolean appendOnlyProtected) { this.appendOnlyProtected = appendOnlyProtected; }
    }

    public static class TopicKnowledgeEstimate {
        private String topicId;
        private String disciplina;
        private String assunto;
        private double pesoEdital;
        private double dominioEstimadoPct;
        private double incertezaSigma;
        private double retencaoAtualPct;
        private double estabilidadeDias;
        private double diasSemContato;
        private String evolucao; // MELHORANDO, ESTAVEL, REGREDINDO, VIRGEM_NAO_EXPLORADO
        private int evidenciasValidasCount;
        private double acuraciaObservadaPct;

        public String getTopicId() { return topicId; }
        public void setTopicId(String topicId) { this.topicId = topicId; }
        public String getDisciplina() { return disciplina; }
        public void setDisciplina(String disciplina) { this.disciplina = disciplina; }
        public String getAssunto() { return assunto; }
        public void setAssunto(String assunto) { this.assunto = assunto; }
        public double getPesoEdital() { return pesoEdital; }
        public void setPesoEdital(double pesoEdital) { this.pesoEdital = pesoEdital; }
        public double getDominioEstimadoPct() { return dominioEstimadoPct; }
        public void setDominioEstimadoPct(double dominioEstimadoPct) { this.dominioEstimadoPct = dominioEstimadoPct; }
        public double getIncertezaSigma() { return incertezaSigma; }
        public void setIncertezaSigma(double incertezaSigma) { this.incertezaSigma = incertezaSigma; }
        public double getRetencaoAtualPct() { return retencaoAtualPct; }
        public void setRetencaoAtualPct(double retencaoAtualPct) { this.retencaoAtualPct = retencaoAtualPct; }
        public double getEstabilidadeDias() { return estabilidadeDias; }
        public void setEstabilidadeDias(double estabilidadeDias) { this.estabilidadeDias = estabilidadeDias; }
        public double getDiasSemContato() { return diasSemContato; }
        public void setDiasSemContato(double diasSemContato) { this.diasSemContato = diasSemContato; }
        public String getEvolucao() { return evolucao; }
        public void setEvolucao(String evolucao) { this.evolucao = evolucao; }
        public int getEvidenciasValidasCount() { return evidenciasValidasCount; }
        public void setEvidenciasValidasCount(int evidenciasValidasCount) { this.evidenciasValidasCount = evidenciasValidasCount; }
        public double getAcuraciaObservadaPct() { return acuraciaObservadaPct; }
        public void setAcuraciaObservadaPct(double acuraciaObservadaPct) { this.acuraciaObservadaPct = acuraciaObservadaPct; }
    }

    public static class MetacognitiveCalibration {
        private double brierScore;
        private double alinhamentoCalibracaoPct;
        private int overconfidenceCount; // Certeza 5 e Erro
        private int underconfidenceCount; // Hesitação <= 2 e Acerto
        private int totalAvaliados;
        private String diagnosticoMetacognitivo;

        public double getBrierScore() { return brierScore; }
        public void setBrierScore(double brierScore) { this.brierScore = brierScore; }
        public double getAlinhamentoCalibracaoPct() { return alinhamentoCalibracaoPct; }
        public void setAlinhamentoCalibracaoPct(double alinhamentoCalibracaoPct) { this.alinhamentoCalibracaoPct = alinhamentoCalibracaoPct; }
        public int getOverconfidenceCount() { return overconfidenceCount; }
        public void setOverconfidenceCount(int overconfidenceCount) { this.overconfidenceCount = overconfidenceCount; }
        public int getUnderconfidenceCount() { return underconfidenceCount; }
        public void setUnderconfidenceCount(int underconfidenceCount) { this.underconfidenceCount = underconfidenceCount; }
        public int getTotalAvaliados() { return totalAvaliados; }
        public void setTotalAvaliados(int totalAvaliados) { this.totalAvaliados = totalAvaliados; }
        public String getDiagnosticoMetacognitivo() { return diagnosticoMetacognitivo; }
        public void setDiagnosticoMetacognitivo(String diagnosticoMetacognitivo) { this.diagnosticoMetacognitivo = diagnosticoMetacognitivo; }
    }

    public static class AnomalyEvidenceReport {
        private int totalEvidenciasAnalisadas;
        private int evidenciasConfiaveisCount;
        private int evidenciasAssistidasCount;
        private int evidenciasRuidoTempoCount;
        private int evidenciasSemGabaritoDefinitivoCount;
        private double pesoMedioConfiabilidade;
        private String diretrizAuditoria;

        public int getTotalEvidenciasAnalisadas() { return totalEvidenciasAnalisadas; }
        public void setTotalEvidenciasAnalisadas(int totalEvidenciasAnalisadas) { this.totalEvidenciasAnalisadas = totalEvidenciasAnalisadas; }
        public int getEvidenciasConfiaveisCount() { return evidenciasConfiaveisCount; }
        public void setEvidenciasConfiaveisCount(int evidenciasConfiaveisCount) { this.evidenciasConfiaveisCount = evidenciasConfiaveisCount; }
        public int getEvidenciasAssistidasCount() { return evidenciasAssistidasCount; }
        public void setEvidenciasAssistidasCount(int evidenciasAssistidasCount) { this.evidenciasAssistidasCount = evidenciasAssistidasCount; }
        public int getEvidenciasRuidoTempoCount() { return evidenciasRuidoTempoCount; }
        public void setEvidenciasRuidoTempoCount(int evidenciasRuidoTempoCount) { this.evidenciasRuidoTempoCount = evidenciasRuidoTempoCount; }
        public int getEvidenciasSemGabaritoDefinitivoCount() { return evidenciasSemGabaritoDefinitivoCount; }
        public void setEvidenciasSemGabaritoDefinitivoCount(int evidenciasSemGabaritoDefinitivoCount) { this.evidenciasSemGabaritoDefinitivoCount = evidenciasSemGabaritoDefinitivoCount; }
        public double getPesoMedioConfiabilidade() { return pesoMedioConfiabilidade; }
        public void setPesoMedioConfiabilidade(double pesoMedioConfiabilidade) { this.pesoMedioConfiabilidade = pesoMedioConfiabilidade; }
        public String getDiretrizAuditoria() { return diretrizAuditoria; }
        public void setDiretrizAuditoria(String diretrizAuditoria) { this.diretrizAuditoria = diretrizAuditoria; }
    }

    public static class InterventionPrescription {
        private String id;
        private String tipoIntervencao;
        private String disciplina;
        private String assunto;
        private String prioridade; // CRITICA, ALTA, REGULAR
        private String gatilho;
        private String justificativaPedagogica;
        private int duracaoSugeridaMinutos;

        public String getId() { return id; }
        public void setId(String id) { this.id = id; }
        public String getTipoIntervencao() { return tipoIntervencao; }
        public void setTipoIntervencao(String tipoIntervencao) { this.tipoIntervencao = tipoIntervencao; }
        public String getDisciplina() { return disciplina; }
        public void setDisciplina(String disciplina) { this.disciplina = disciplina; }
        public String getAssunto() { return assunto; }
        public void setAssunto(String assunto) { this.assunto = assunto; }
        public String getPrioridade() { return prioridade; }
        public void setPrioridade(String prioridade) { this.prioridade = prioridade; }
        public String getGatilho() { return gatilho; }
        public void setGatilho(String gatilho) { this.gatilho = gatilho; }
        public String getJustificativaPedagogica() { return justificativaPedagogica; }
        public void setJustificativaPedagogica(String justificativaPedagogica) { this.justificativaPedagogica = justificativaPedagogica; }
        public int getDuracaoSugeridaMinutos() { return duracaoSugeridaMinutos; }
        public void setDuracaoSugeridaMinutos(int duracaoSugeridaMinutos) { this.duracaoSugeridaMinutos = duracaoSugeridaMinutos; }
    }

    public static class AdaptivePlanSummary {
        private String planoId;
        private String concursoNome;
        private int tempoDisponivelMinutos;
        private String versaoModelo;
        private String justificativaAuditavel;
        private List<PlanBlock> blocos = new ArrayList<>();

        public String getPlanoId() { return planoId; }
        public void setPlanoId(String planoId) { this.planoId = planoId; }
        public String getConcursoNome() { return concursoNome; }
        public void setConcursoNome(String concursoNome) { this.concursoNome = concursoNome; }
        public int getTempoDisponivelMinutos() { return tempoDisponivelMinutos; }
        public void setTempoDisponivelMinutos(int tempoDisponivelMinutos) { this.tempoDisponivelMinutos = tempoDisponivelMinutos; }
        public String getVersaoModelo() { return versaoModelo; }
        public void setVersaoModelo(String versaoModelo) { this.versaoModelo = versaoModelo; }
        public String getJustificativaAuditavel() { return justificativaAuditavel; }
        public void setJustificativaAuditavel(String justificativaAuditavel) { this.justificativaAuditavel = justificativaAuditavel; }
        public List<PlanBlock> getBlocos() { return blocos; }
        public void setBlocos(List<PlanBlock> blocos) { this.blocos = blocos; }
    }

    public static class PlanBlock {
        private int ordem;
        private String tipoBloco;
        private String disciplina;
        private String assunto;
        private int duracaoMinutos;
        private String motivoDecisao;

        public int getOrdem() { return ordem; }
        public void setOrdem(int ordem) { this.ordem = ordem; }
        public String getTipoBloco() { return tipoBloco; }
        public void setTipoBloco(String tipoBloco) { this.tipoBloco = tipoBloco; }
        public String getDisciplina() { return disciplina; }
        public void setDisciplina(String disciplina) { this.disciplina = disciplina; }
        public String getAssunto() { return assunto; }
        public void setAssunto(String assunto) { this.assunto = assunto; }
        public int getDuracaoMinutos() { return duracaoMinutos; }
        public void setDuracaoMinutos(int duracaoMinutos) { this.duracaoMinutos = duracaoMinutos; }
        public String getMotivoDecisao() { return motivoDecisao; }
        public void setMotivoDecisao(String motivoDecisao) { this.motivoDecisao = motivoDecisao; }
    }
}
