package com.fiscalstudy.backend.infrastructure.in.web;

import com.fiscalstudy.backend.application.AttemptSubmissionService;
import com.fiscalstudy.backend.application.QuestionSelectionService;
import com.fiscalstudy.backend.domain.Question;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.Map;
import java.util.Optional;

@RestController
@RequestMapping("/api/v1/questions")
@CrossOrigin(origins = "*") // Permite requisições do frontend local
public class QuestionController {

    private final QuestionSelectionService questionSelectionService;
    private final AttemptSubmissionService attemptSubmissionService;

    public QuestionController(QuestionSelectionService questionSelectionService, AttemptSubmissionService attemptSubmissionService) {
        this.questionSelectionService = questionSelectionService;
        this.attemptSubmissionService = attemptSubmissionService;
    }

    @GetMapping("/next")
    public ResponseEntity<QuestionDTO> getNextQuestion(
            @RequestParam(required = false) String sessionId,
            @RequestParam(required = false) String concursoId,
            @RequestParam(required = false) String disciplina,
            @RequestParam(required = false) String assunto,
            @RequestParam(required = false) Boolean includeAnswered,
            @RequestParam(required = false) String studyMode) {
        Optional<Question> questionOpt = questionSelectionService.getNextQuestion(sessionId, concursoId, disciplina, assunto, includeAnswered);
        
        if (questionOpt.isEmpty()) {
            return ResponseEntity.notFound().build();
        }
        
        Question q = questionOpt.get();
        // NUNCA devolve o gabarito (correctOption) para o frontend
        QuestionDTO dto = new QuestionDTO(
            q.getId(),
            q.getStatement(),
            q.getOptions(),
            q.getDiscipline(),
            q.getTopic(),
            q.getBoard(),
            q.getYear(),
            q.getSupportMaterial()
        );
        
        return ResponseEntity.ok(dto);
    }

    @GetMapping("/batch")
    public ResponseEntity<List<QuestionDTO>> getQuestionBatch(
            @RequestParam(required = false) String sessionId,
            @RequestParam(required = false) String concursoId,
            @RequestParam(required = false) String disciplina,
            @RequestParam(required = false) String assunto,
            @RequestParam(required = false) Boolean includeAnswered,
            @RequestParam(required = false, defaultValue = "15") Integer limit) {
        List<Question> questions = questionSelectionService.getQuestionBatch(sessionId, concursoId, disciplina, assunto, includeAnswered, limit != null ? limit : 15);
        List<QuestionDTO> dtos = questions.stream()
                .map(item -> new QuestionDTO(
                        item.getId(),
                        item.getStatement(),
                        item.getOptions(),
                        item.getDiscipline(),
                        item.getTopic(),
                        item.getBoard(),
                        item.getYear(),
                        item.getSupportMaterial()
                ))
                .collect(java.util.stream.Collectors.toList());
        return ResponseEntity.ok(dtos);
    }

    @GetMapping("/disciplines")
    public ResponseEntity<List<String>> getDisciplines() {
        List<String> disciplines = questionSelectionService.getAvailableDisciplines();
        return ResponseEntity.ok(disciplines);
    }

    @GetMapping("/assuntos")
    public ResponseEntity<List<String>> getAssuntos(@RequestParam(required = false) String disciplina) {
        List<String> assuntos = questionSelectionService.getAvailableAssuntos(disciplina);
        return ResponseEntity.ok(assuntos);
    }

    @PostMapping("/{id}/presented")
    public ResponseEntity<Void> recordPresentation(
            @PathVariable String id,
            @RequestBody Map<String, String> payload) {
        String sessionId = payload.get("sessionId");
        if (sessionId == null || sessionId.isBlank()) {
            return ResponseEntity.badRequest().build();
        }
        questionSelectionService.recordPresentation(id, sessionId);
        return ResponseEntity.ok().build();
    }

    @PostMapping("/{id}/attempts")
    public ResponseEntity<AttemptResultDTO> submitAttempt(
            @PathVariable String id,
            @RequestBody AttemptPayloadDTO payload) {
            
        if (payload.getConfidenceLevel() < 1 || payload.getConfidenceLevel() > 5) {
            return ResponseEntity.badRequest().build();
        }
        if (payload.getActiveTimeMs() < 0) {
            return ResponseEntity.badRequest().build();
        }
        if (payload.getSessionId() == null || payload.getSessionId().isBlank()) {
            return ResponseEntity.badRequest().build();
        }


        try {
            com.fiscalstudy.backend.domain.AttemptResult result = attemptSubmissionService.submitAttempt(
                    id,
                    payload.getSelectedOption(),
                    payload.getConfidenceLevel(),
                    payload.getActiveTimeMs(),
                    payload.getSessionId(),
                    payload.getOrigin(),
                    payload.getCausaErro(),
                    payload.getNaCordaBamba(),
                    payload.getPensouContrario(),
                    payload.getTempoLeituraMs(),
                    payload.getTempoHesitacaoMs(),
                    payload.getTrocasOpcaoCount(),
                    payload.getDistanciaCursorPx(),
                    payload.getFriccaoCognitivaScore(),
                    payload.getChuteEducadoDetectado(),
                    payload.getFluenciaNeurologica(),
                    payload.getUsedHelp(),
                    payload.getHelpType(),
                    payload.getInterventionType(),
                    payload.getAttemptId()
            );

            AttemptResultDTO dto = new AttemptResultDTO(
                    result.getIsCorrect(),
                    result.getGabaritoStatus() != null ? result.getGabaritoStatus().name() : "DEFINITIVO",
                    result.getConcursoPoint(),
                    result.getBloqueioCognitivo(),
                    result.getErrosConsecutivos(),
                    result.getMediaPrescriptionTexto(),
                    result.getMediaVeiculo(),
                    result.getCorrectOption()
            );
            dto.attemptId=result.getAttemptId();
            return ResponseEntity.ok(dto);
        } catch (AttemptSubmissionService.LearningProjectionPendingException e) {
            AttemptResultDTO pending=new AttemptResultDTO(null,"PROJECTION_PENDING",null);
            pending.attemptId=e.getAttemptId();
            return ResponseEntity.status(503).header("X-FiscalStudy-Attempt-Persisted","true").body(pending);
        } catch (AttemptSubmissionService.AttemptConflictException e) {
            return ResponseEntity.status(409).build();
        } catch (IllegalStateException e) {
            return ResponseEntity.badRequest().build();
        } catch (IllegalArgumentException e) {
            if (e.getMessage() != null && e.getMessage().contains("Invalid")) {
                return ResponseEntity.badRequest().build();
            }
            return ResponseEntity.notFound().build();
        }
    }

    @GetMapping("/{id}/attempts/{attemptId}/annotations")
    public ResponseEntity<?> annotations(@PathVariable String id,@PathVariable String attemptId) {
        try {return ResponseEntity.ok(attemptSubmissionService.getAttemptHistory(id,attemptId));}
        catch(IllegalArgumentException e){return ResponseEntity.notFound().build();}
    }

    @PostMapping("/{id}/attempts/{attemptId}/annotations")
    public ResponseEntity<Map<String,Object>> annotate(@PathVariable String id,@PathVariable String attemptId,@RequestBody Map<String,String> payload) {
        try { return ResponseEntity.ok(attemptSubmissionService.annotateAttempt(id,attemptId,payload.get("annotationId"),payload.get("sessionId"),payload.get("causaErro"))); }
        catch(AttemptSubmissionService.AttemptConflictException e){ return ResponseEntity.status(409).build(); }
        catch(IllegalArgumentException e){ return ResponseEntity.badRequest().build(); }
    }

    public static class QuestionDTO {
        public String questionId;
        public String statement;
        public Object options; // can be List<String> or List<Map>
        public MetadataDTO metadata;

        public QuestionDTO(String questionId, String statement, Object options, String discipline, String topic, String board, Integer year) {
            this(questionId, statement, options, discipline, topic, board, year, null);
        }

        public QuestionDTO(String questionId, String statement, Object options, String discipline, String topic, String board, Integer year, Map<String, Object> supportMaterial) {
            this.questionId = questionId;
            this.statement = statement;
            this.options = options;
            this.metadata = new MetadataDTO(discipline, topic, board, year, supportMaterial);
        }
    }

    public static class MetadataDTO {
        public String discipline;
        public String topic;
        public String board;
        public Integer year;
        public Map<String, Object> supportMaterial;

        public MetadataDTO(String discipline, String topic, String board, Integer year) {
            this(discipline, topic, board, year, null);
        }

        public MetadataDTO(String discipline, String topic, String board, Integer year, Map<String, Object> supportMaterial) {
            this.discipline = discipline;
            this.topic = topic;
            this.board = board;
            this.year = year;
            this.supportMaterial = supportMaterial;
        }
    }

    public static class AttemptPayloadDTO {
        private String attemptId;
        public String getAttemptId(){return attemptId;}
        public void setAttemptId(String value){attemptId=value;}
        private String selectedOption;
        private int confidenceLevel;
        private long activeTimeMs;
        private String sessionId;
        private String origin;
        private String causaErro;
        private Boolean naCordaBamba;
        private Boolean pensouContrario;
        private Long tempoLeituraMs;
        private Long tempoHesitacaoMs;
        private Integer trocasOpcaoCount;
        private Double distanciaCursorPx;
        private Double friccaoCognitivaScore;
        private Boolean chuteEducadoDetectado;
        private String fluenciaNeurologica;
        private Boolean usedHelp;
        private String helpType;
        private String interventionType;

        public String getSelectedOption() { return selectedOption; }
        public void setSelectedOption(String selectedOption) { this.selectedOption = selectedOption; }
        public int getConfidenceLevel() { return confidenceLevel; }
        public void setConfidenceLevel(int confidenceLevel) { this.confidenceLevel = confidenceLevel; }
        public long getActiveTimeMs() { return activeTimeMs; }
        public void setActiveTimeMs(long activeTimeMs) { this.activeTimeMs = activeTimeMs; }
        public String getSessionId() { return sessionId; }
        public void setSessionId(String sessionId) { this.sessionId = sessionId; }
        public String getOrigin() { return origin; }
        public void setOrigin(String origin) { this.origin = origin; }
        public String getCausaErro() { return causaErro; }
        public void setCausaErro(String causaErro) { this.causaErro = causaErro; }
        public Boolean getNaCordaBamba() { return naCordaBamba; }
        public void setNaCordaBamba(Boolean naCordaBamba) { this.naCordaBamba = naCordaBamba; }
        public Boolean getPensouContrario() { return pensouContrario; }
        public void setPensouContrario(Boolean pensouContrario) { this.pensouContrario = pensouContrario; }
        public Long getTempoLeituraMs() { return tempoLeituraMs; }
        public void setTempoLeituraMs(Long tempoLeituraMs) { this.tempoLeituraMs = tempoLeituraMs; }
        public Long getTempoHesitacaoMs() { return tempoHesitacaoMs; }
        public void setTempoHesitacaoMs(Long tempoHesitacaoMs) { this.tempoHesitacaoMs = tempoHesitacaoMs; }
        public Integer getTrocasOpcaoCount() { return trocasOpcaoCount; }
        public void setTrocasOpcaoCount(Integer trocasOpcaoCount) { this.trocasOpcaoCount = trocasOpcaoCount; }
        public Double getDistanciaCursorPx() { return distanciaCursorPx; }
        public void setDistanciaCursorPx(Double distanciaCursorPx) { this.distanciaCursorPx = distanciaCursorPx; }
        public Double getFriccaoCognitivaScore() { return friccaoCognitivaScore; }
        public void setFriccaoCognitivaScore(Double friccaoCognitivaScore) { this.friccaoCognitivaScore = friccaoCognitivaScore; }
        public Boolean getChuteEducadoDetectado() { return chuteEducadoDetectado; }
        public void setChuteEducadoDetectado(Boolean chuteEducadoDetectado) { this.chuteEducadoDetectado = chuteEducadoDetectado; }
        public String getFluenciaNeurologica() { return fluenciaNeurologica; }
        public void setFluenciaNeurologica(String fluenciaNeurologica) { this.fluenciaNeurologica = fluenciaNeurologica; }
        public Boolean getUsedHelp() { return usedHelp; }
        public void setUsedHelp(Boolean usedHelp) { this.usedHelp = usedHelp; }
        public String getHelpType() { return helpType; }
        public void setHelpType(String helpType) { this.helpType = helpType; }
        public String getInterventionType() { return interventionType; }
        public void setInterventionType(String interventionType) { this.interventionType = interventionType; }
    }

    @com.fasterxml.jackson.annotation.JsonInclude(com.fasterxml.jackson.annotation.JsonInclude.Include.NON_NULL)
    public static class AttemptResultDTO {
        public String attemptId;
        @com.fasterxml.jackson.annotation.JsonProperty("isCorrect")
        public Boolean isCorrect;

        @com.fasterxml.jackson.annotation.JsonProperty("gabaritoStatus")
        public String gabaritoStatus;

        @com.fasterxml.jackson.annotation.JsonProperty("concursoPoint")
        public Integer concursoPoint;

        @com.fasterxml.jackson.annotation.JsonProperty("bloqueioCognitivo")
        public Boolean bloqueioCognitivo;

        @com.fasterxml.jackson.annotation.JsonProperty("errosConsecutivos")
        public Integer errosConsecutivos;

        @com.fasterxml.jackson.annotation.JsonProperty("prescricaoTexto")
        public String prescricaoTexto;

        @com.fasterxml.jackson.annotation.JsonProperty("veiculo")
        public String veiculo;

        @com.fasterxml.jackson.annotation.JsonProperty("correctOption")
        public String correctOption;

        public AttemptResultDTO(Boolean isCorrect, String gabaritoStatus, Integer concursoPoint) {
            this(isCorrect, gabaritoStatus, concursoPoint, null, null, null, null, null);
        }

        public AttemptResultDTO(Boolean isCorrect, String gabaritoStatus, Integer concursoPoint,
                                Boolean bloqueioCognitivo, Integer errosConsecutivos,
                                String prescricaoTexto, String veiculo) {
            this(isCorrect, gabaritoStatus, concursoPoint, bloqueioCognitivo, errosConsecutivos, prescricaoTexto, veiculo, null);
        }

        public AttemptResultDTO(Boolean isCorrect, String gabaritoStatus, Integer concursoPoint,
                                Boolean bloqueioCognitivo, Integer errosConsecutivos,
                                String prescricaoTexto, String veiculo, String correctOption) {
            this.isCorrect = isCorrect;
            this.gabaritoStatus = gabaritoStatus;
            this.concursoPoint = concursoPoint;
            this.bloqueioCognitivo = bloqueioCognitivo;
            this.errosConsecutivos = errosConsecutivos;
            this.prescricaoTexto = prescricaoTexto;
            this.veiculo = veiculo;
            this.correctOption = correctOption;
        }

        public AttemptResultDTO(Boolean isCorrect, String gabaritoStatus) {
            this(isCorrect, gabaritoStatus, null);
        }

        public AttemptResultDTO(boolean isCorrect) {
            this(isCorrect, "DEFINITIVO", isCorrect ? 1 : 0);
        }

        public Boolean getIsCorrect() { return isCorrect; }
        public String getGabaritoStatus() { return gabaritoStatus; }
        public Integer getConcursoPoint() { return concursoPoint; }
        public Boolean getBloqueioCognitivo() { return bloqueioCognitivo; }
        public Integer getErrosConsecutivos() { return errosConsecutivos; }
        public String getPrescricaoTexto() { return prescricaoTexto; }
        public String getVeiculo() { return veiculo; }
        public String getCorrectOption() { return correctOption; }
    }
}
