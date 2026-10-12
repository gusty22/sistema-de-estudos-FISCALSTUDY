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

    public boolean submitAttempt(String questionId, String selectedOption, int confidenceLevel, long activeTimeMs, String sessionId) {
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

        // Idempotência: se já respondeu esta questão nesta mesma sessão, não duplica evento
        if (eventStoreRepository.hasEvent("ANSWER_SUBMITTED", questionId, sessionId)) {
            return calculateIsCorrect(question, optionLetter);
        }

        String correctOpt = question.getCorrectOption() != null ? question.getCorrectOption().trim() : null;
        boolean isAnulada = "ANULADA".equalsIgnoreCase(correctOpt);
        boolean isGabaritoAusente = (correctOpt == null || correctOpt.isBlank());

        boolean isCorrect;
        String gabaritoStatus;

        if (isAnulada) {
            isCorrect = true; // Em concurso público, questão anulada não pune o estudante
            gabaritoStatus = "ANULADA";
        } else if (isGabaritoAusente) {
            isCorrect = false;
            gabaritoStatus = "AUSENTE";
        } else {
            isCorrect = optionLetter.equalsIgnoreCase(correctOpt);
            gabaritoStatus = "DEFINITIVO";
        }

        String isCorrectStr = isGabaritoAusente ? "null" : String.valueOf(isCorrect);
        String payload = String.format(
            "{\"questionId\": \"%s\", \"selectedOption\": \"%s\", \"isCorrect\": %s, \"gabaritoStatus\": \"%s\", \"confidenceLevel\": %d, \"activeTimeMs\": %d}",
            questionId, selectedOption, isCorrectStr, gabaritoStatus, confidenceLevel, activeTimeMs
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

        return isCorrect;
    }

    private boolean calculateIsCorrect(Question question, String optionLetter) {
        String correctOpt = question.getCorrectOption() != null ? question.getCorrectOption().trim() : null;
        if ("ANULADA".equalsIgnoreCase(correctOpt)) return true;
        if (correctOpt == null || correctOpt.isBlank()) return false;
        return optionLetter.equalsIgnoreCase(correctOpt);
    }
}
