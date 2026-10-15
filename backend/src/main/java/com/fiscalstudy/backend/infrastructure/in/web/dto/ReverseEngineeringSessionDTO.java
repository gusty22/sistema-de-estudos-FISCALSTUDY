package com.fiscalstudy.backend.infrastructure.in.web.dto;

import java.util.List;
import java.util.Map;

public class ReverseEngineeringSessionDTO {
    private String id;
    private String sessionId;
    private String concursoId;
    private String disciplina;
    private String assunto;
    private String banca;
    private String nivelTopico; // INTERMEDIARIO, AVANCADO
    private int totalQuestoes;
    private int questoesResolvidas;
    private int questoesCorretas;
    private String errosQuestoesNumeros; // Ex: "3, 4"
    private List<String> alternativasEliminadasFacilidade;
    private List<Map<String, Object>> pegadinhasMapeadas;
    private String prescricaoRecorteTexto; // "Você já domina a regra geral. Pule as primeiras 15 páginas do PDF. Leia apenas as páginas 16 a 22, que contêm as exceções jurisprudenciais onde você acabou de errar nas questões 3 e 4."
    private String pdfDocNome;
    private int paginaInicioRecorte;
    private int paginaFimRecorte;
    private int paginasPuladas;
    private String status; // EM_ANDAMENTO, CONCLUIDA
    private List<Map<String, Object>> questoes;
    private String createdAt;
    private String completedAt;

    public ReverseEngineeringSessionDTO() {}

    public String getId() {
        return id;
    }

    public void setId(String id) {
        this.id = id;
    }

    public String getSessionId() {
        return sessionId;
    }

    public void setSessionId(String sessionId) {
        this.sessionId = sessionId;
    }

    public String getConcursoId() {
        return concursoId;
    }

    public void setConcursoId(String concursoId) {
        this.concursoId = concursoId;
    }

    public String getDisciplina() {
        return disciplina;
    }

    public void setDisciplina(String disciplina) {
        this.disciplina = disciplina;
    }

    public String getAssunto() {
        return assunto;
    }

    public void setAssunto(String assunto) {
        this.assunto = assunto;
    }

    public String getBanca() {
        return banca;
    }

    public void setBanca(String banca) {
        this.banca = banca;
    }

    public String getNivelTopico() {
        return nivelTopico;
    }

    public void setNivelTopico(String nivelTopico) {
        this.nivelTopico = nivelTopico;
    }

    public int getTotalQuestoes() {
        return totalQuestoes;
    }

    public void setTotalQuestoes(int totalQuestoes) {
        this.totalQuestoes = totalQuestoes;
    }

    public int getQuestoesResolvidas() {
        return questoesResolvidas;
    }

    public void setQuestoesResolvidas(int questoesResolvidas) {
        this.questoesResolvidas = questoesResolvidas;
    }

    public int getQuestoesCorretas() {
        return questoesCorretas;
    }

    public void setQuestoesCorretas(int questoesCorretas) {
        this.questoesCorretas = questoesCorretas;
    }

    public String getErrosQuestoesNumeros() {
        return errosQuestoesNumeros;
    }

    public void setErrosQuestoesNumeros(String errosQuestoesNumeros) {
        this.errosQuestoesNumeros = errosQuestoesNumeros;
    }

    public List<String> getAlternativasEliminadasFacilidade() {
        return alternativasEliminadasFacilidade;
    }

    public void setAlternativasEliminadasFacilidade(List<String> alternativasEliminadasFacilidade) {
        this.alternativasEliminadasFacilidade = alternativasEliminadasFacilidade;
    }

    public List<Map<String, Object>> getPegadinhasMapeadas() {
        return pegadinhasMapeadas;
    }

    public void setPegadinhasMapeadas(List<Map<String, Object>> pegadinhasMapeadas) {
        this.pegadinhasMapeadas = pegadinhasMapeadas;
    }

    public String getPrescricaoRecorteTexto() {
        return prescricaoRecorteTexto;
    }

    public void setPrescricaoRecorteTexto(String prescricaoRecorteTexto) {
        this.prescricaoRecorteTexto = prescricaoRecorteTexto;
    }

    public String getPdfDocNome() {
        return pdfDocNome;
    }

    public void setPdfDocNome(String pdfDocNome) {
        this.pdfDocNome = pdfDocNome;
    }

    public int getPaginaInicioRecorte() {
        return paginaInicioRecorte;
    }

    public void setPaginaInicioRecorte(int paginaInicioRecorte) {
        this.paginaInicioRecorte = paginaInicioRecorte;
    }

    public int getPaginaFimRecorte() {
        return paginaFimRecorte;
    }

    public void setPaginaFimRecorte(int paginaFimRecorte) {
        this.paginaFimRecorte = paginaFimRecorte;
    }

    public int getPaginasPuladas() {
        return paginasPuladas;
    }

    public void setPaginasPuladas(int paginasPuladas) {
        this.paginasPuladas = paginasPuladas;
    }

    public String getStatus() {
        return status;
    }

    public void setStatus(String status) {
        this.status = status;
    }

    public List<Map<String, Object>> getQuestoes() {
        return questoes;
    }

    public void setQuestoes(List<Map<String, Object>> questoes) {
        this.questoes = questoes;
    }

    public String getCreatedAt() {
        return createdAt;
    }

    public void setCreatedAt(String createdAt) {
        this.createdAt = createdAt;
    }

    public String getCompletedAt() {
        return completedAt;
    }

    public void setCompletedAt(String completedAt) {
        this.completedAt = completedAt;
    }
}
