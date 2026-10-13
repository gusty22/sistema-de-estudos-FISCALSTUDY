package com.fiscalstudy.backend.application;

import com.fiscalstudy.backend.domain.EventStoreRepository;
import com.fiscalstudy.backend.domain.Question;
import com.fiscalstudy.backend.domain.QuestionRepository;
import org.springframework.stereotype.Service;
import java.util.Optional;

@Service
public class AttemptSubmissionService {

    private final QuestionRepository questionRepository;
    private final EventStoreRepository eventStoreRepository;

    public AttemptSubmissionService(QuestionRepository questionRepository, EventStoreRepository eventStoreRepository) {
        this.questionRepository = questionRepository;
        this.eventStoreRepository = eventStoreRepository;
    }

    public com.fiscalstudy.backend.domain.AttemptResult submitAttempt(String questionId, String selectedOption, int confidenceLevel, long activeTimeMs, String sessionId) {
        return submitAttempt(questionId, selectedOption, confidenceLevel, activeTimeMs, sessionId, null);
    }

    public com.fiscalstudy.backend.domain.AttemptResult submitAttempt(String questionId, String selectedOption, int confidenceLevel, long activeTimeMs, String sessionId, String origin) {
        if (sessionId == null || sessionId.isBlank()) {
            throw new IllegalArgumentException("Session ID is required");
        }

        if (eventStoreRepository.isSessionEnded(sessionId)) {
            throw new IllegalStateException("Session already ended");
        }

        Optional<Question> questionOpt = questionRepository.findById(questionId);
        
        if (questionOpt.isEmpty()) {
            throw new IllegalArgumentException("Question not found");
        }

        Question question = questionOpt.get();
        
        if (selectedOption == null || selectedOption.trim().isEmpty()) {
            throw new IllegalArgumentException("Invalid selected option");
        }
        
        String optionLetter = selectedOption.trim().toUpperCase();
        
        boolean isValidOption = false;
        if (question.getOptions() != null) {
            for (String opt : question.getOptions()) {
                if (opt != null && opt.trim().toUpperCase().startsWith(optionLetter)) {
                    isValidOption = true;
                    break;
                }
            }
        }
        
        if (!isValidOption) {
            throw new IllegalArgumentException("Invalid selected option");
        }

        com.fiscalstudy.backend.domain.GabaritoStatus status = question.getGabaritoStatus();
        if (status == null) {
            String correctOpt = question.getCorrectOption() != null ? question.getCorrectOption().trim() : null;
            if ("ANULADA".equalsIgnoreCase(correctOpt)) {
                status = com.fiscalstudy.backend.domain.GabaritoStatus.ANULADA;
            } else if (correctOpt == null || correctOpt.isBlank()) {
                status = com.fiscalstudy.backend.domain.GabaritoStatus.AUSENTE;
            } else {
                status = com.fiscalstudy.backend.domain.GabaritoStatus.DEFINITIVO;
            }
        }

        // Idempotência: se já respondeu esta questão nesta mesma sessão, não duplica evento
        if (eventStoreRepository.hasEvent("ANSWER_SUBMITTED", questionId, sessionId)) {
            return calculateAttemptResult(question, optionLetter, status);
        }

        Boolean isCorrect;
        int concursoPoint;
        if (status == com.fiscalstudy.backend.domain.GabaritoStatus.ANULADA) {
            isCorrect = null; // Excluído de acurácia/domínio pedagógico
            concursoPoint = 1; // Ponto atribuído conforme regras do concurso
        } else if (status == com.fiscalstudy.backend.domain.GabaritoStatus.AUSENTE || status == com.fiscalstudy.backend.domain.GabaritoStatus.SOB_REVISAO) {
            isCorrect = null; // Sem gabarito verificado: sem acerto/erro atribuído
            concursoPoint = 0;
        } else {
            String correctOpt = question.getCorrectOption() != null ? question.getCorrectOption().trim() : "";
            boolean matched = optionLetter.equalsIgnoreCase(correctOpt);
            isCorrect = matched;
            concursoPoint = matched ? 1 : 0;
        }

        String determinedOrigin;
        if (origin != null && !origin.isBlank()) {
            determinedOrigin = com.fiscalstudy.backend.domain.EventOrigin.fromString(origin).name();
        } else {
            String lowerSession = sessionId.toLowerCase();
            if (lowerSession.startsWith("test-") || lowerSession.startsWith("mock-")) {
                determinedOrigin = com.fiscalstudy.backend.domain.EventOrigin.AUTOMATED_TEST.name();
            } else if (lowerSession.startsWith("demo-") || lowerSession.startsWith("sample-")) {
                determinedOrigin = com.fiscalstudy.backend.domain.EventOrigin.DEMONSTRATION.name();
            } else {
                determinedOrigin = com.fiscalstudy.backend.domain.EventOrigin.REAL_STUDY.name();
            }
        }

        String isCorrectStr = (isCorrect == null) ? "null" : String.valueOf(isCorrect);
        String payload = String.format(
            "{\"questionId\": \"%s\", \"selectedOption\": \"%s\", \"isCorrect\": %s, \"concursoPoint\": %d, \"gabaritoStatus\": \"%s\", \"confidenceLevel\": %d, \"activeTimeMs\": %d, \"origin\": \"%s\"}",
            questionId, optionLetter, isCorrectStr, concursoPoint, status.name(), confidenceLevel, activeTimeMs, determinedOrigin
        );

        eventStoreRepository.appendEvent(
                "ANSWER_SUBMITTED",
                "QUESTION",
                questionId,
                sessionId,
                1,
                "v1",
                payload
        );

        return new com.fiscalstudy.backend.domain.AttemptResult(isCorrect, status, concursoPoint);
    }

    private com.fiscalstudy.backend.domain.AttemptResult calculateAttemptResult(Question question, String optionLetter, com.fiscalstudy.backend.domain.GabaritoStatus status) {
        if (status == com.fiscalstudy.backend.domain.GabaritoStatus.ANULADA) {
            return new com.fiscalstudy.backend.domain.AttemptResult(null, status, 1);
        }
        if (status == com.fiscalstudy.backend.domain.GabaritoStatus.AUSENTE || status == com.fiscalstudy.backend.domain.GabaritoStatus.SOB_REVISAO) {
            return new com.fiscalstudy.backend.domain.AttemptResult(null, status, 0);
        }
        String correctOpt = question.getCorrectOption() != null ? question.getCorrectOption().trim() : "";
        boolean matched = optionLetter.equalsIgnoreCase(correctOpt);
        return new com.fiscalstudy.backend.domain.AttemptResult(matched, status, matched ? 1 : 0);
    }
}
