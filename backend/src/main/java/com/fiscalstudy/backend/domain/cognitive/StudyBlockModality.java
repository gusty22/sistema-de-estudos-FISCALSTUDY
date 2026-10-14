package com.fiscalstudy.backend.domain.cognitive;

public enum StudyBlockModality {
    BLOCKED_PRACTICE,             // Fixação em bloco (mesmo tópico)
    REVERSE_STUDY_QUESTIONS,      // Estudo reverso direto por questões
    INTERLEAVED_PRACTICE,         // Prática intercalada misturando tópicos
    SPACED_REVIEW_BATTERY,        // Bateria de recuperação ativa FSRS (R < 0.88)
    THEORY_SURGICAL_READING       // Leitura cirúrgica de teoria / lei seca quente
}
