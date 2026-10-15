package com.fiscalstudy.backend.infrastructure.in.web.dto;

import java.util.List;

public class ReverseEngineeringAnswerRequestDTO {
    private String reverseSessionId;
    private String questionId;
    private int numeroQuestao;
    private String selectedOption;
    private Boolean isCorrect;
    private List<String> eliminatedOptions; // Alternativas eliminadas com facilidade
    private int tempoGastoSegundos;
    private String pegadinhaCausa; // Ex: EXCECAO_JURISPRUDENCIAL, PEGADINHA_DE_PRAZO, DISTORCAO_CONCEITUAL

    public ReverseEngineeringAnswerRequestDTO() {}

    public ReverseEngineeringAnswerRequestDTO(String reverseSessionId, String questionId, int numeroQuestao,
                                             String selectedOption, Boolean isCorrect, List<String> eliminatedOptions,
                                             int tempoGastoSegundos, String pegadinhaCausa) {
        this.reverseSessionId = reverseSessionId;
        this.questionId = questionId;
        this.numeroQuestao = numeroQuestao;
        this.selectedOption = selectedOption;
        this.isCorrect = isCorrect;
        this.eliminatedOptions = eliminatedOptions;
        this.tempoGastoSegundos = tempoGastoSegundos;
        this.pegadinhaCausa = pegadinhaCausa;
    }

    public String getReverseSessionId() {
        return reverseSessionId;
    }

    public void setReverseSessionId(String reverseSessionId) {
        this.reverseSessionId = reverseSessionId;
    }

    public String getQuestionId() {
        return questionId;
    }

    public void setQuestionId(String questionId) {
        this.questionId = questionId;
    }

    public int getNumeroQuestao() {
        return numeroQuestao;
    }

    public void setNumeroQuestao(int numeroQuestao) {
        this.numeroQuestao = numeroQuestao;
    }

    public String getSelectedOption() {
        return selectedOption;
    }

    public void setSelectedOption(String selectedOption) {
        this.selectedOption = selectedOption;
    }

    public Boolean getIsCorrect() {
        return isCorrect;
    }

    public void setIsCorrect(Boolean correct) {
        isCorrect = correct;
    }

    public List<String> getEliminatedOptions() {
        return eliminatedOptions;
    }

    public void setEliminatedOptions(List<String> eliminatedOptions) {
        this.eliminatedOptions = eliminatedOptions;
    }

    public int getTempoGastoSegundos() {
        return tempoGastoSegundos;
    }

    public void setTempoGastoSegundos(int tempoGastoSegundos) {
        this.tempoGastoSegundos = tempoGastoSegundos;
    }

    public String getPegadinhaCausa() {
        return pegadinhaCausa;
    }

    public void setPegadinhaCausa(String pegadinhaCausa) {
        this.pegadinhaCausa = pegadinhaCausa;
    }
}
