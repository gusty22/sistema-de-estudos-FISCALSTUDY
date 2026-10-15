package com.fiscalstudy.backend.domain.cycle;

/**
 * Bloco individual dentro da fila circular do Ciclo de Estudos Robin Hood.
 */
public class RobinHoodCycleBlock {

    public enum BlockType {
        ESTUDO_REGULAR,
        ESTUDO_LIVRE, // Para quitar atrasos e amortecer imprevistos
        SIMULADO,     // Gatilho de fechamento do ciclo
        EMERGENCIA_ROBIN_HOOD // Intervenção crítica psicométrica calculada pelo R
    }

    private final int sequenceOrder;
    private final BlockType type;
    private final String disciplina;
    private final int duracaoMinutos;
    private final int nivelDominioEstrelas;
    private final double pesoProva;
    private final double horasAlocadasDisciplina;
    private final double horasOriginais;
    private final double horasTransferidasRobinHood;
    private final String mensagemEuDoPassado; // next_session_handoff da última sessão
    private boolean completed;

    public RobinHoodCycleBlock(
            int sequenceOrder,
            BlockType type,
            String disciplina,
            int duracaoMinutos,
            int nivelDominioEstrelas,
            double pesoProva,
            double horasAlocadasDisciplina,
            double horasOriginais,
            double horasTransferidasRobinHood,
            String mensagemEuDoPassado
    ) {
        this.sequenceOrder = sequenceOrder;
        this.type = type;
        this.disciplina = disciplina;
        this.duracaoMinutos = duracaoMinutos;
        this.nivelDominioEstrelas = nivelDominioEstrelas;
        this.pesoProva = pesoProva;
        this.horasAlocadasDisciplina = horasAlocadasDisciplina;
        this.horasOriginais = horasOriginais;
        this.horasTransferidasRobinHood = horasTransferidasRobinHood;
        this.mensagemEuDoPassado = mensagemEuDoPassado;
        this.completed = false;
    }

    public static RobinHoodCycleBlock createFreeStudyBlock(int sequenceOrder, int duracaoMinutos) {
        return new RobinHoodCycleBlock(
                sequenceOrder,
                BlockType.ESTUDO_LIVRE,
                "Estudo Livre (Buffer de Atrasos)",
                duracaoMinutos,
                0,
                1.0,
                duracaoMinutos / 60.0,
                duracaoMinutos / 60.0,
                0.0,
                "Bloco curinga para quitar atrasos de matérias difíceis ou reforçar pontos fracos sem quebrar o ciclo."
        );
    }

    public static RobinHoodCycleBlock createSimuladoBlock(int sequenceOrder, int duracaoMinutos) {
        return new RobinHoodCycleBlock(
                sequenceOrder,
                BlockType.SIMULADO,
                "Simulado de Fechamento de Ciclo",
                duracaoMinutos,
                0,
                1.0,
                duracaoMinutos / 60.0,
                duracaoMinutos / 60.0,
                0.0,
                "Bateria cronometrada em ondas (60% fáceis primeiro, marcar círculos nas médias e ? nas difíceis)."
        );
    }

    public static RobinHoodCycleBlock createEmergencyBlock(int sequenceOrder, String disciplina, String topic, int duracaoMinutos, String rationale) {
        return new RobinHoodCycleBlock(
                sequenceOrder,
                BlockType.EMERGENCIA_ROBIN_HOOD,
                disciplina + (topic != null && !topic.isBlank() ? " — " + topic : ""),
                duracaoMinutos,
                1,
                3.0,
                duracaoMinutos / 60.0,
                0.0,
                duracaoMinutos / 60.0,
                rationale != null && !rationale.isBlank() ? rationale : "Intervenção Crítica de Memória via Robin Hood (Taxa de retenção em colapso calculada pelo laboratório R)."
        );
    }

    public int getSequenceOrder() {
        return sequenceOrder;
    }

    public BlockType getType() {
        return type;
    }

    public String getDisciplina() {
        return disciplina;
    }

    public int getDuracaoMinutos() {
        return duracaoMinutos;
    }

    public int getNivelDominioEstrelas() {
        return nivelDominioEstrelas;
    }

    public double getPesoProva() {
        return pesoProva;
    }

    public double getHorasAlocadasDisciplina() {
        return horasAlocadasDisciplina;
    }

    public double getHorasOriginais() {
        return horasOriginais;
    }

    public double getHorasTransferidasRobinHood() {
        return horasTransferidasRobinHood;
    }

    public String getMensagemEuDoPassado() {
        return mensagemEuDoPassado;
    }

    public boolean isCompleted() {
        return completed;
    }

    public void setCompleted(boolean completed) {
        this.completed = completed;
    }
}
