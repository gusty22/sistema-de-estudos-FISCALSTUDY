package com.fiscalstudy.backend.application;

import com.fiscalstudy.backend.domain.EventStoreRepository;
import com.fiscalstudy.backend.domain.Question;
import com.fiscalstudy.backend.domain.QuestionRepository;
import org.springframework.stereotype.Service;

import java.util.Optional;

@Service
public class QuestionSelectionService {

    private final QuestionRepository questionRepository;
    private final EventStoreRepository eventStoreRepository;

    public QuestionSelectionService(QuestionRepository questionRepository, EventStoreRepository eventStoreRepository) {
        this.questionRepository = questionRepository;
        this.eventStoreRepository = eventStoreRepository;
    }

    public Optional<Question> getNextQuestion(String sessionId) {
        Optional<Question> question = questionRepository.findNextAvailableQuestion();
        
        return question;
    }

    public void recordPresentation(String questionId, String sessionId) {
        if (!eventStoreRepository.hasRecentEvent("QUESTION_PRESENTED", questionId, sessionId, 5)) {
            String payload = String.format("{\"questionId\": \"%s\"}", questionId);
            eventStoreRepository.appendEvent(
                    "QUESTION_PRESENTED",
                    "QUESTION",
                    questionId,
                    sessionId,
                    1,
                    "v1",
                    payload
            );
        }
    }
}
