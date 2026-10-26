package com.fiscalstudy.backend.application.review;

import java.util.ArrayList;
import java.util.List;

public class AdaptiveRevisionDecisionDTO {
    private String concursoId;
    private int tempoDisponivelMinutos;
    private String estrategiaGlobal;
    private String status;
    private boolean canApply;
    private List<TopicRevisionDecision> decisoes = new ArrayList<>();
    private DecisionStatistics estatisticas = new DecisionStatistics();

    public static class TopicRevisionDecision {
        private String topicId;
        private String disciplina;
        private String topico;
        private String dominioEstimadoNivel; // Alto, Médio, Baixo
        private double dominioPct;
        private String recuperabilidadeNivel; // Alta, Média, Baixa, Incerta
        private double retencaoFsrsPct;
        private double incertezaSigma;
        private String importanciaEditalNivel; // Alta, Média, Baixa
        private double pesoEdital;
        private String consequenciaEsquecimento; // Crítica, Moderada, Isolada
        private int dependentesCount;
        private String decisao; // ADIAR_REVISAO, PRIORIZAR_REVISAO_ATIVA, DIAGNOSTICO_DIRECIONADO, MICRO_REVISAO_RAPIDA
        private String justificativa;
        private int duracaoSugeridaMinutos;
        private double urgenciaScore;
        private boolean activeInformationGathering;

        public String getTopicId() { return topicId; }
        public void setTopicId(String topicId) { this.topicId = topicId; }
        public String getDisciplina() { return disciplina; }
        public void setDisciplina(String disciplina) { this.disciplina = disciplina; }
        public String getTopico() { return topico; }
        public void setTopico(String topico) { this.topico = topico; }
        public String getDominioEstimadoNivel() { return dominioEstimadoNivel; }
        public void setDominioEstimadoNivel(String dominioEstimadoNivel) { this.dominioEstimadoNivel = dominioEstimadoNivel; }
        public double getDominioPct() { return dominioPct; }
        public void setDominioPct(double dominioPct) { this.dominioPct = dominioPct; }
        public String getRecuperabilidadeNivel() { return recuperabilidadeNivel; }
        public void setRecuperabilidadeNivel(String recuperabilidadeNivel) { this.recuperabilidadeNivel = recuperabilidadeNivel; }
        public double getRetencaoFsrsPct() { return retencaoFsrsPct; }
        public void setRetencaoFsrsPct(double retencaoFsrsPct) { this.retencaoFsrsPct = retencaoFsrsPct; }
        public double getIncertezaSigma() { return incertezaSigma; }
        public void setIncertezaSigma(double incertezaSigma) { this.incertezaSigma = incertezaSigma; }
        public String getImportanciaEditalNivel() { return importanciaEditalNivel; }
        public void setImportanciaEditalNivel(String importanciaEditalNivel) { this.importanciaEditalNivel = importanciaEditalNivel; }
        public double getPesoEdital() { return pesoEdital; }
        public void setPesoEdital(double pesoEdital) { this.pesoEdital = pesoEdital; }
        public String getConsequenciaEsquecimento() { return consequenciaEsquecimento; }
        public void setConsequenciaEsquecimento(String consequenciaEsquecimento) { this.consequenciaEsquecimento = consequenciaEsquecimento; }
        public int getDependentesCount() { return dependentesCount; }
        public void setDependentesCount(int dependentesCount) { this.dependentesCount = dependentesCount; }
        public String getDecisao() { return decisao; }
        public void setDecisao(String decisao) { this.decisao = decisao; }
        public String getJustificativa() { return justificativa; }
        public void setJustificativa(String justificativa) { this.justificativa = justificativa; }
        public int getDuracaoSugeridaMinutos() { return duracaoSugeridaMinutos; }
        public void setDuracaoSugeridaMinutos(int duracaoSugeridaMinutos) { this.duracaoSugeridaMinutos = duracaoSugeridaMinutos; }
        public double getUrgenciaScore() { return urgenciaScore; }
        public void setUrgenciaScore(double urgenciaScore) { this.urgenciaScore = urgenciaScore; }
        public boolean isActiveInformationGathering() { return activeInformationGathering; }
        public void setActiveInformationGathering(boolean activeInformationGathering) { this.activeInformationGathering = activeInformationGathering; }
    }

    public static class DecisionStatistics {
        private int totalAnalisados;
        private int adiadasCount;
        private int ativasPrioritariasCount;
        private int diagnosticosCount;
        private int tempoTotalAlocadoMinutos;

        public int getTotalAnalisados() { return totalAnalisados; }
        public void setTotalAnalisados(int totalAnalisados) { this.totalAnalisados = totalAnalisados; }
        public int getAdiadasCount() { return adiadasCount; }
        public void setAdiadasCount(int adiadasCount) { this.adiadasCount = adiadasCount; }
        public int getAtivasPrioritariasCount() { return ativasPrioritariasCount; }
        public void setAtivasPrioritariasCount(int ativasPrioritariasCount) { this.ativasPrioritariasCount = ativasPrioritariasCount; }
        public int getDiagnosticosCount() { return diagnosticosCount; }
        public void setDiagnosticosCount(int diagnosticosCount) { this.diagnosticosCount = diagnosticosCount; }
        public int getTempoTotalAlocadoMinutos() { return tempoTotalAlocadoMinutos; }
        public void setTempoTotalAlocadoMinutos(int tempoTotalAlocadoMinutos) { this.tempoTotalAlocadoMinutos = tempoTotalAlocadoMinutos; }
    }

    public String getConcursoId() { return concursoId; }
    public void setConcursoId(String concursoId) { this.concursoId = concursoId; }
    public int getTempoDisponivelMinutos() { return tempoDisponivelMinutos; }
    public void setTempoDisponivelMinutos(int tempoDisponivelMinutos) { this.tempoDisponivelMinutos = tempoDisponivelMinutos; }
    public String getEstrategiaGlobal() { return estrategiaGlobal; }
    public void setEstrategiaGlobal(String estrategiaGlobal) { this.estrategiaGlobal = estrategiaGlobal; }
    public String getStatus() { return status; }
    public void setStatus(String status) { this.status = status; }
    public boolean isCanApply() { return canApply; }
    public void setCanApply(boolean canApply) { this.canApply = canApply; }
    public List<TopicRevisionDecision> getDecisoes() { return decisoes; }
    public void setDecisoes(List<TopicRevisionDecision> decisoes) { this.decisoes = decisoes; }
    public DecisionStatistics getEstatisticas() { return estatisticas; }
    public void setEstatisticas(DecisionStatistics estatisticas) { this.estatisticas = estatisticas; }
}
