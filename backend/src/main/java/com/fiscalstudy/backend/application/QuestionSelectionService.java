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
        return getNextQuestion(sessionId, null);
    }

    public Optional<Question> getNextQuestion(String sessionId, String disciplina) {
        return questionRepository.findNextAvailableQuestion(sessionId, disciplina);
    }

    public Optional<Question> getNextQuestion(String sessionId, String concursoId, String disciplina, String assunto, Boolean includeAnswered) {
        return questionRepository.findNextAvailableQuestion(sessionId, concursoId, disciplina, assunto, includeAnswered);
    }

    public java.util.List<Question> getQuestionBatch(String sessionId, String concursoId, String disciplina, String assunto, Boolean includeAnswered, int limit) {
        return questionRepository.findQuestionBatch(sessionId, concursoId, disciplina, assunto, includeAnswered, limit);
    }

    public java.util.List<String> getAvailableDisciplines() {
        return questionRepository.findAllDisciplines();
    }

    public java.util.List<String> getAvailableAssuntos(String disciplina) {
        return questionRepository.findAllAssuntos(disciplina);
    }

    public void recordPresentation(String questionId, String sessionId) {
        // Debounce técnico de 5 segundos para absorver StrictMode e retries imediatos sem suprimir reapresentações legítimas
        if (!eventStoreRepository.hasRecentEventSeconds("QUESTION_PRESENTED", questionId, sessionId, 5)) {
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
