package com.fiscalstudy.backend.domain;

/**
 * Taxonomia explícita dos motivos de rejeição de candidatos pedagógicos.
 * Garante que itens omitidos possuam diagnóstico auditável e rastreável.
 */
public enum PedagogicalRejectionReason {
    // Escopo e Edital
    SYLLABUS_SCOPE_MISMATCH("Concurso ou versão de edital incompatível com o contexto requisitado"),
    TOPIC_NOT_CONFIRMED_HUMAN("Tópico do edital não confirmado por validação humana"),
    CONTEST_DISCIPLINE_MISMATCH("Disciplina do recurso incompatível com o edital do concurso"),

    // Integridade e Validade de Questões
    QUESTION_QUARANTINED_OR_INVALID("Questão em quarentena diagnóstica ou com status diferente de VALIDADA"),
    GABARITO_NOT_DEFINITIVE("Gabarito da questão não é definitivo (anulado, ausente ou pendente)"),
    QUESTION_STRUCTURALLY_INVALID("Enunciado em branco ou menos de duas alternativas preenchidas"),
    CLASSIFICATION_NOT_CONFIRMED("Vínculo questão-tópico não confirmado por revisor humano (status SUGGESTED ou REJECTED)"),
    CLASSIFICATION_AFTER_OBSERVED_AT("Classificação registrada com timestamp posterior ao instante de observação do inventário"),

    // Material de Apoio da Questão (support_materials)
    SUPPORT_MATERIAL_MEDIA_MISSING("Arquivo de mídia do material de apoio inexistente no disco local"),
    SUPPORT_MATERIAL_TEXT_MISSING("Material de apoio da questão desprovido de texto e mídia utilizáveis"),

    // Biblioteca de Materiais Didáticos (study_materials e topic_material_links)
    MATERIAL_RECORD_MISSING("Registro do material didático inexistente no repositório"),
    NO_MATERIAL_LOCATION("Material didático sem URL ou caminho de arquivo informado"),
    PHYSICAL_FILE_MISSING("Arquivo físico do material didático não encontrado no sistema de arquivos local"),
    PAGE_RANGE_UNVERIFIED("Intervalo de páginas ausente, não positivo ou invertido (inicio > fim)"),
    PAGES_EXCEED_TOTAL("Intervalo de páginas informado excede o total de páginas verificado do material"),

    // Pré-requisitos e Dependências Conceituais
    PREREQUISITES_NOT_ESTABLISHED("Conceitos pré-requisitos existentes na DAG canônica sem evidência de domínio"),
    PREREQUISITE_DEPENDENCY_CYCLE("Incoerência ou ciclo detectado na cadeia de dependências de pré-requisitos"),

    // Memória Espaçada (FSRS)
    MODEL_VERSION_INCOMPATIBLE("Versão do modelo FSRS na memória incompatível com o padrão canônico"),
    MEMORY_NOT_DUE("Item de memória com data de vencimento (due_at) posterior ao instante observado"),
    MEMORY_AFTER_CUTOFF("Última revisão do item com data posterior ao cutoff histórico de evidências"),
    ABSENT_MEMORY_LINEAGE("Estado de memória sem histórico legítimo de evento ANSWER_SUBMITTED"),

    // Execução, Aplicação e Evidência Científica
    APPLICATION_INSTRUMENT_UNAVAILABLE("Instrumento operacional para avaliação de aplicação/transferência indisponível"),
    DURATION_UNVERIFIED_HEURISTIC("Duração estimada baseada em divisão heurística sem calibração empírica"),
    FREQUENCY_WITHOUT_DENOMINATOR("Frequência de questões sem denominador de caderno não gera prioridade estatística confiável");

    private final String description;

    PedagogicalRejectionReason(String description) {
        this.description = description;
    }

    public String getDescription() {
        return description;
    }
}
