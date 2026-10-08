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

        boolean isCorrect = optionLetter.equalsIgnoreCase(question.getCorrectOption() != null ? question.getCorrectOption().trim() : "");

        String payload = String.format(
            "{\"questionId\": \"%s\", \"selectedOption\": \"%s\", \"isCorrect\": %b, \"confidenceLevel\": %d, \"activeTimeMs\": %d}",
            questionId, selectedOption, isCorrect, confidenceLevel, activeTimeMs
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
}
