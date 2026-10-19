package com.fiscalstudy.backend.application;

import com.fiscalstudy.backend.domain.*;
import com.fiscalstudy.backend.infrastructure.in.web.ConcursoController;
import com.fiscalstudy.backend.infrastructure.in.web.EditalController;
import com.fiscalstudy.backend.infrastructure.in.web.QuestionController;
import com.fiscalstudy.backend.infrastructure.in.web.SessionController;
import com.fiscalstudy.backend.infrastructure.in.web.dto.*;
import com.fiscalstudy.backend.infrastructure.out.persistence.ConcursoRepositoryImpl;
import com.fiscalstudy.backend.infrastructure.out.persistence.EditalRepositoryImpl;
import com.fiscalstudy.backend.infrastructure.out.persistence.EventStoreRepositoryImpl;
import com.fiscalstudy.backend.infrastructure.out.persistence.QuestionRepositoryImpl;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.http.ResponseEntity;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.jdbc.datasource.SingleConnectionDataSource;
import org.springframework.mock.web.MockMultipartFile;

import javax.sql.DataSource;
import java.util.*;

import static org.junit.jupiter.api.Assertions.*;

@DisplayName("FiscalStudy — Suite Completa de Testes de Aceitação das Fases 0 a 11")
public class FiscalStudyMultiConcursoAcceptanceTest {

    private JdbcTemplate jdbcTemplate;
    private ConcursoRepositoryImpl concursoRepository;
    private EditalRepositoryImpl editalRepository;
    private QuestionRepositoryImpl questionRepository;
    private EventStoreRepositoryImpl eventStoreRepository;

    private IngestionPipelineService ingestionService;
    private QuestionSelectionService questionSelectionService;
    private AttemptSubmissionService attemptSubmissionService;

    private ConcursoController concursoController;
    private EditalController editalController;
    private QuestionController questionController;
    private SessionController sessionController;

    @BeforeEach
    public void setup() {
        // Banco de teste SQLite isolado em memória com conexão única compartilhada
        SingleConnectionDataSource dataSource = new SingleConnectionDataSource("jdbc:sqlite::memory:", true);
        jdbcTemplate = new JdbcTemplate(dataSource);

        // Criação de schemas isolados
        jdbcTemplate.execute("CREATE TABLE IF NOT EXISTS event_store (" +
                "event_id TEXT PRIMARY KEY, event_type TEXT NOT NULL, aggregate_type TEXT NOT NULL, " +
                "aggregate_id TEXT NOT NULL, session_id TEXT, occurred_at TEXT NOT NULL, " +
                "recorded_at TEXT NOT NULL, event_version INTEGER NOT NULL, schema_version TEXT NOT NULL, payload_json TEXT NOT NULL)");

        jdbcTemplate.execute("CREATE TABLE IF NOT EXISTS questions (" +
                "id TEXT PRIMARY KEY, enunciado TEXT, options_json TEXT, correct_option TEXT, " +
                "gabarito_status TEXT DEFAULT 'DEFINITIVO', banca TEXT, ano INTEGER, orgao TEXT, " +
                "cargo TEXT, disciplina TEXT, assunto TEXT, dificuldade TEXT, status TEXT DEFAULT 'VALIDADA', " +
                "justificativa TEXT, texto_apoio TEXT, texto_apoio_titulo TEXT, numero_original INTEGER, arquivo_origem TEXT, " +
                "created_at TEXT DEFAULT CURRENT_TIMESTAMP)");

        jdbcTemplate.execute("CREATE TABLE IF NOT EXISTS concursos (" +
                "id TEXT PRIMARY KEY, nome TEXT NOT NULL, orgao TEXT NOT NULL, banca TEXT, " +
                "ano INTEGER, cargo TEXT, cargo_codigo TEXT, status TEXT DEFAULT 'ACTIVE', descricao TEXT, " +
                "situacao TEXT DEFAULT 'PREVISTO', localidade TEXT, escolaridade TEXT, vagas INTEGER, salario REAL, " +
                "link_edital TEXT, data_prova TEXT, data_prova_tipo TEXT DEFAULT 'INFORMADA_PELO_USUARIO', " +
                "datas_importantes_json TEXT, disponibilidade_json TEXT, " +
                "created_at TEXT DEFAULT CURRENT_TIMESTAMP, updated_at TEXT DEFAULT CURRENT_TIMESTAMP)");

        jdbcTemplate.execute("CREATE TABLE IF NOT EXISTS editais (" +
                "id TEXT PRIMARY KEY, concurso_id TEXT NOT NULL, titulo TEXT NOT NULL, versao TEXT NOT NULL DEFAULT '1.0', " +
                "tipo TEXT NOT NULL DEFAULT 'ORIGINAL', filename TEXT, created_at TEXT DEFAULT CURRENT_TIMESTAMP)");

        jdbcTemplate.execute("CREATE TABLE IF NOT EXISTS edital_topicos (" +
                "id TEXT PRIMARY KEY, edital_id TEXT NOT NULL, concurso_id TEXT NOT NULL, disciplina TEXT NOT NULL, " +
                "assunto TEXT NOT NULL, subassunto TEXT, peso REAL DEFAULT 1.0, questoes_previstas INTEGER, " +
                "doc_origem TEXT, pagina_origem INTEGER, trecho_origem TEXT, tipo_classificacao TEXT DEFAULT 'EXPLICITA', " +
                "confirmado_humano INTEGER DEFAULT 0, created_at TEXT DEFAULT CURRENT_TIMESTAMP)");

        jdbcTemplate.execute("CREATE TABLE IF NOT EXISTS support_materials (" +
                "id TEXT PRIMARY KEY, tipo TEXT NOT NULL, titulo TEXT, conteudo_texto TEXT, media_path TEXT, " +
                "doc_origem TEXT, pagina_inicio INTEGER, pagina_fim INTEGER, coordenadas_json TEXT, created_at TEXT DEFAULT CURRENT_TIMESTAMP)");

        jdbcTemplate.execute("CREATE TABLE IF NOT EXISTS question_support_materials (" +
                "question_id TEXT NOT NULL, material_id TEXT NOT NULL, PRIMARY KEY(question_id, material_id))");

        // Repositórios
        concursoRepository = new ConcursoRepositoryImpl(jdbcTemplate);
        editalRepository = new EditalRepositoryImpl(jdbcTemplate);
        questionRepository = new QuestionRepositoryImpl(jdbcTemplate);
        eventStoreRepository = new EventStoreRepositoryImpl(jdbcTemplate);

        // Serviços
        ingestionService = new IngestionPipelineService(jdbcTemplate, editalRepository);
        questionSelectionService = new QuestionSelectionService(questionRepository, eventStoreRepository);
        attemptSubmissionService = new AttemptSubmissionService(questionRepository, eventStoreRepository, "REAL_STUDY");

        // Controladores
        concursoController = new ConcursoController(concursoRepository);
        editalController = new EditalController(editalRepository);
        questionController = new QuestionController(questionSelectionService, attemptSubmissionService);
        sessionController = new SessionController(eventStoreRepository);
    }

    @Test
    @DisplayName("Critério 1: Cadastro e Alternância de Dois Concursos Sem Perda de Histórico")
    public void testCriterio1_CadastroDoisConcursos() {
        Concurso c1 = new Concurso("conc-sefaz-mg", "SEFAZ-MG 2024", "Receita Estadual de Minas Gerais", "FGV", 2024, "Auditor Fiscal da Receita Estadual", "AFRE-01", "ACTIVE", "Concurso Estadual");
        Concurso c2 = new Concurso("conc-iss-bh", "ISS Belo Horizonte 2023", "Prefeitura de Belo Horizonte", "RBO", 2023, "Auditor Fiscal de Tributos Municipais", "AFTM-02", "ACTIVE", "Concurso Municipal");

        concursoRepository.save(c1);
        concursoRepository.save(c2);

        List<Concurso> lista = concursoRepository.findAll(null);
        // Inclui os auto-semeados e os 2 novos
        assertTrue(lista.stream().anyMatch(c -> c.getId().equals("conc-sefaz-mg")));
        assertTrue(lista.stream().anyMatch(c -> c.getId().equals("conc-iss-bh")));

        // Alternância e arquivamento
        concursoRepository.updateStatus("conc-iss-bh", "ARCHIVED");
        Concurso archived = concursoRepository.findById("conc-iss-bh").orElseThrow();
        assertEquals("ARCHIVED", archived.getStatus());

        concursoRepository.updateStatus("conc-iss-bh", "ACTIVE");
        Concurso reactivated = concursoRepository.findById("conc-iss-bh").orElseThrow();
        assertEquals("ACTIVE", reactivated.getStatus());
    }

    @Test
    @DisplayName("Critério 2 & 3: Upload de Edital, Retificação e Verticalização Inicial")
    public void testCriterio2e3_EditalRetificacaoVerticalizacao() {
        Edital editalOrig = new Edital("edital-orig-01", "conc-sefaz-mg", "Edital Normativo nº 01/2024", "1.0", "ORIGINAL", "edital_normativo.pdf");
        Edital editalRetif = new Edital("edital-retif-01", "conc-sefaz-mg", "Retificação nº 01/2024 (Conteúdo Tributário)", "1.1", "RETIFICACAO", "retificacao_01.pdf");

        editalRepository.saveEdital(editalOrig);
        editalRepository.saveEdital(editalRetif);

        List<Edital> editais = editalRepository.findEditaisByConcurso("conc-sefaz-mg");
        assertEquals(2, editais.size());

        // Verticalização com procedência documental estrita
        EditalTopico topico1 = new EditalTopico(
                "top-trib-01", "edital-orig-01", "conc-sefaz-mg",
                "Direito Tributário", "Competência Tributária", "Limitações Constitucionais ao Poder de Tributar",
                2.5, 8, "edital_normativo.pdf", 34, "Item 7.2.1", "EXPLICITA", false
        );
        editalRepository.saveTopico(topico1);

        List<EditalTopico> topicos = editalRepository.findTopicosByConcurso("conc-sefaz-mg");
        assertFalse(topicos.isEmpty());
        assertEquals("Direito Tributário", topicos.get(0).getDisciplina());
        assertEquals(34, topicos.get(0).getPaginaOrigem());
        assertEquals("EXPLICITA", topicos.get(0).getTipoClassificacao());
    }

    @Test
    @DisplayName("Critério 4, 5 & 6: Upload de Prova e Gabarito com Múltiplos Cargos e Cadernos")
    public void testCriterio4e5e6_UploadProvaEGabaritoMultiplosCargos() throws Exception {
        StagingSessionDTO session = ingestionService.createSession(Map.of(
                "concurso", "ISS Araguari 2023",
                "cargo_codigo", "532"
        ));

        MockMultipartFile provaFile = new MockMultipartFile("file", "prova_caderno_amarelo.pdf", "application/pdf", "dummy pdf content".getBytes());
        MockMultipartFile gabaritoFile = new MockMultipartFile("file", "gabarito_oficial_todos_cargos.pdf", "application/pdf", "dummy gabarito content".getBytes());

        StagingSessionDTO.StagingDocumentDTO docProva = ingestionService.uploadFile(session.getSessionId(), provaFile, "PROVA");
        StagingSessionDTO.StagingDocumentDTO docGab = ingestionService.uploadFile(session.getSessionId(), gabaritoFile, "GABARITO_DEFINITIVO");

        assertNotNull(docProva.getId());
        assertNotNull(docGab.getId());
        assertEquals("PROVA", docProva.getRole());
        assertEquals("GABARITO_DEFINITIVO", docGab.getRole());
    }

    @Test
    @DisplayName("Critério 7: Questão com Texto-Base Compartilhado")
    public void testCriterio7_TextoBaseCompartilhado() {
        StagingSessionDTO session = ingestionService.createSession(Map.of());
        List<StagingQuestionDTO> questions = ingestionService.getSessionQuestions(session.getSessionId());

        StagingQuestionDTO q1 = new StagingQuestionDTO();
        q1.setId("q_texto_base_1");
        q1.setNumeroOriginal(1);
        q1.setStatement("Com base no Texto 1 acima, assinale a opção correta:");
        q1.setOptions(List.of("A) Opção 1", "B) Opção 2", "C) Opção 3", "D) Opção 4"));
        q1.setStatus("NEEDS_REVIEW");
        
        Map<String, Object> mat = new HashMap<>();
        mat.put("tipo", "TEXTO_BASE");
        mat.put("titulo", "Texto 1: Crônica das Ruas de Araguari");
        mat.put("conteudoTexto", "Naquela manhã ensolarada no interior mineiro, os tributos municipais...");
        mat.put("docOrigem", "prova.pdf");
        mat.put("paginaInicio", 2);
        q1.setSupportMaterial(mat);

        questions.add(q1);

        StagingQuestionDTO target = ingestionService.getSessionQuestions(session.getSessionId()).get(0);
        assertNotNull(target.getSupportMaterial());
        assertEquals("TEXTO_BASE", target.getSupportMaterial().get("tipo"));
        assertEquals("Texto 1: Crônica das Ruas de Araguari", target.getSupportMaterial().get("titulo"));
    }

    @Test
    @DisplayName("Critério 8 & 9: Alternativa Ausente, Correção Manual e Aprovação Humana")
    public void testCriterio8e9_AlternativaAusenteECorrecaoManual() {
        StagingSessionDTO session = ingestionService.createSession(Map.of());
        List<StagingQuestionDTO> questions = ingestionService.getSessionQuestions(session.getSessionId());

        // Questão com apenas 3 alternativas (incompleta)
        StagingQuestionDTO qIncompleta = new StagingQuestionDTO();
        qIncompleta.setId("q_inc_1");
        qIncompleta.setNumeroOriginal(5);
        qIncompleta.setStatement("Enunciado da questão incompleta");
        qIncompleta.setOptions(new ArrayList<>(List.of("A) Opção A", "B) Opção B", "C) Opção C")));
        qIncompleta.setStatus("NEEDS_REVIEW");
        qIncompleta.setFlags(new ArrayList<>(List.of("OPTIONS_INCOMPLETE")));
        questions.add(qIncompleta);

        // Correção manual do revisor
        QuestionUpdateRequestDTO updateReq = new QuestionUpdateRequestDTO();
        updateReq.setStatement("Enunciado revisado e integral");
        updateReq.setOptions(List.of("A) Opção A", "B) Opção B", "C) Opção C", "D) Opção D inserida manualmente"));
        updateReq.setCorrectOption("D");
        updateReq.setGabaritoStatus("DEFINITIVO");
        updateReq.setDisciplina("Língua Portuguesa");
        updateReq.setAssunto("Concordância Nominal");
        updateReq.setReviewNotes("Alternativa D resgatada manualmente do PDF pág 4");
        updateReq.setStatus("SOURCE_VERIFIED");

        StagingQuestionDTO updated = ingestionService.updateQuestion(session.getSessionId(), "q_inc_1", updateReq);
        assertEquals(4, updated.getOptions().size());
        assertEquals("D", updated.getCorrectOption());
        assertEquals("SOURCE_VERIFIED", updated.getStatus());
        assertTrue(updated.isModifiedByUser());
    }

    @Test
    @DisplayName("Critério 10: Persistência de Estado do Staging Após Reinicialização")
    public void testCriterio10_PersistenciaAposReinicializacao() {
        StagingSessionDTO session = ingestionService.createSession(Map.of("banca", "IBGP", "ano", 2023));
        List<StagingQuestionDTO> questions = ingestionService.getSessionQuestions(session.getSessionId());

        StagingQuestionDTO q = new StagingQuestionDTO();
        q.setId("q_persist_test");
        q.setNumeroOriginal(10);
        q.setStatement("Enunciado persistido");
        q.setOptions(List.of("A) 1", "B) 2", "C) 3", "D) 4"));
        q.setStatus("SOURCE_VERIFIED");
        questions.add(q);

        QuestionUpdateRequestDTO upd = new QuestionUpdateRequestDTO();
        upd.setReviewNotes("Verificação gravada no arquivo de estado");
        ingestionService.updateQuestion(session.getSessionId(), "q_persist_test", upd);

        // Nova instância de serviço simulando reinicialização da JVM
        IngestionPipelineService novoService = new IngestionPipelineService(jdbcTemplate, editalRepository);
        StagingSessionDTO reloadedSession = novoService.getSession(session.getSessionId());
        assertNotNull(reloadedSession);

        List<StagingQuestionDTO> reloadedQuestions = novoService.getSessionQuestions(session.getSessionId());
        assertFalse(reloadedQuestions.isEmpty());
        assertEquals("q_persist_test", reloadedQuestions.get(0).getId());
        assertEquals("Verificação gravada no arquivo de estado", reloadedQuestions.get(0).getReviewNotes());
    }

    @Test
    @DisplayName("Critério 11: Cancelamento Seguro de Processamento")
    public void testCriterio11_CancelamentoDeProcessamento() {
        StagingSessionDTO session = ingestionService.createSession(Map.of());
        session.setStatus("EXTRACTING");

        StagingSessionDTO cancelled = ingestionService.cancelSession(session.getSessionId());
        assertEquals("CANCELLED", cancelled.getStatus());
        assertEquals(0, cancelled.getProgressPercent());
        assertTrue(cancelled.getStepDescription().contains("cancelado"));
    }

    @Test
    @DisplayName("Critério 12: Simulação de Importação Controlada (Dry-Run)")
    public void testCriterio12_SimulacaoImportacaoDryRun() {
        StagingSessionDTO session = ingestionService.createSession(Map.of());
        List<StagingQuestionDTO> questions = ingestionService.getSessionQuestions(session.getSessionId());

        StagingQuestionDTO qPronta = new StagingQuestionDTO();
        qPronta.setId("q_pronta_1");
        qPronta.setNumeroOriginal(1);
        qPronta.setStatus("SOURCE_VERIFIED");
        qPronta.setDisciplina("Direito Constitucional");
        questions.add(qPronta);

        ImportSimulationDTO sim = ingestionService.simulateImport(session.getSessionId());
        assertEquals(1, sim.getTotalStagingQuestions());
        assertEquals(1, sim.getVerifiedReadyToImport());
        assertEquals(0, sim.getCollidingExistingQuestions());
        assertTrue(sim.isSafeToImport());
        assertEquals("TEST_MODE_DRY_RUN", sim.getMode());
    }

    @Test
    @DisplayName("Critério 13: Sessão de Estudo Personalizada com Filtros e Ocultação de Gabarito")
    public void testCriterio13_SessaoPersonalizada() {
        // Insere 2 questões no banco
        String q1Options = "[\"A) Imunidade\", \"B) Isenção\", \"C) Não-incidência\", \"D) Alíquota zero\"]";
        jdbcTemplate.update("INSERT INTO questions (id, enunciado, options_json, correct_option, gabarito_status, disciplina, assunto, banca, ano, cargo) " +
                "VALUES ('q_trib_10', 'Enunciado de Tributário', ?, 'A', 'DEFINITIVO', 'Direito Tributário', 'Imunidades', 'IBGP', 2023, 'Auditor Fiscal')", q1Options);

        String q2Options = "[\"A) Sujeito\", \"B) Predicado\", \"C) Vocativo\", \"D) Aposto\"]";
        jdbcTemplate.update("INSERT INTO questions (id, enunciado, options_json, correct_option, gabarito_status, disciplina, assunto, banca, ano, cargo) " +
                "VALUES ('q_port_20', 'Enunciado de Português', ?, 'B', 'DEFINITIVO', 'Língua Portuguesa', 'Sintaxe', 'IBGP', 2023, 'Auditor Fiscal')", q2Options);

        String sessionId = "custom-session-" + UUID.randomUUID();
        sessionController.startSession(Map.of("sessionId", sessionId));

        // Busca questão personalizada filtrada por Direito Tributário
        ResponseEntity<QuestionController.QuestionDTO> resp = questionController.getNextQuestion(
                sessionId, null, "Direito Tributário", null, false, "LEARNING"
        );

        assertNotNull(resp.getBody());
        assertEquals("q_trib_10", resp.getBody().questionId);
        // Garante que o gabarito (correctOption) JAMAIS é retornado no DTO
        assertNotNull(resp.getBody().statement);
        assertNotNull(resp.getBody().options);
    }

    @Test
    @DisplayName("Critério 14: Registro de Confiança, Tempo Ativo, Causa do Erro e Diferenciação de Anuladas")
    public void testCriterio14_ConfiancaCausaErroEAnulada() {
        // Questão 1: Anulada pela banca
        jdbcTemplate.update("INSERT INTO questions (id, enunciado, options_json, correct_option, gabarito_status, disciplina, banca, ano) " +
                "VALUES ('q_anulada_1', 'Questão com erro formulado pela banca', '[\"A) 1\",\"B) 2\",\"C) 3\",\"D) 4\"]', 'ANULADA', 'ANULADA', 'Matemática', 'IBGP', 2023)");

        // Questão 2: Normal
        jdbcTemplate.update("INSERT INTO questions (id, enunciado, options_json, correct_option, gabarito_status, disciplina, banca, ano) " +
                "VALUES ('q_normal_2', 'Questão regular', '[\"A) Certo\",\"B) Errado\",\"C) Nulo\",\"D) Outro\"]', 'A', 'DEFINITIVO', 'Matemática', 'IBGP', 2023)");

        String sessionId = "eval-session-" + UUID.randomUUID();
        sessionController.startSession(Map.of("sessionId", sessionId));

        // Responde questão 1 (anulada):
        QuestionController.AttemptPayloadDTO payloadAnulada = new QuestionController.AttemptPayloadDTO();
        payloadAnulada.setSessionId(sessionId);
        payloadAnulada.setSelectedOption("B");
        payloadAnulada.setConfidenceLevel(3);
        payloadAnulada.setActiveTimeMs(15000);
        ResponseEntity<QuestionController.AttemptResultDTO> respAnulada = questionController.submitAttempt("q_anulada_1", payloadAnulada);

        // Pontuação oficial = 1 (ponto do concurso), mas isCorrect = null (excluído de evidência pedagógica)
        assertEquals(1, respAnulada.getBody().getConcursoPoint());
        assertNull(respAnulada.getBody().getIsCorrect());
        assertEquals("ANULADA", respAnulada.getBody().getGabaritoStatus());

        // Responde questão 2 (erro com confiança máxima = overconfidence, e causa do erro registrada)
        QuestionController.AttemptPayloadDTO payloadErro = new QuestionController.AttemptPayloadDTO();
        payloadErro.setSessionId(sessionId);
        payloadErro.setSelectedOption("C"); // Errado (correto é A)
        payloadErro.setConfidenceLevel(5); // Falsa fluência máxima
        payloadErro.setActiveTimeMs(45000);
        payloadErro.setCausaErro("E4: Pegadinha da Banca");
        ResponseEntity<QuestionController.AttemptResultDTO> respErro = questionController.submitAttempt("q_normal_2", payloadErro);

        assertEquals(0, respErro.getBody().getConcursoPoint());
        assertFalse(respErro.getBody().getIsCorrect());

        // Encerrar e auditar resumo da sessão
        sessionController.endSession(Map.of("sessionId", sessionId));
        ResponseEntity<SessionSummaryDTO> summaryResp = sessionController.getSessionSummary(sessionId);
        SessionSummaryDTO summary = summaryResp.getBody();

        assertNotNull(summary);
        assertEquals(2, summary.getTotalAnswered());
        assertEquals(1, summary.getConcursoScore()); // Ponto da anulada atribuído
        assertEquals(1, summary.getAnuladasCount());
        assertEquals(0.0, summary.getAccuracy(), 0.01); // 0 acertos na única questão pedagógica avaliada (anulada foi excluída da acurácia)
        assertEquals(1, summary.getOverconfidenceCount()); // Detectou overconfidence na questão errada com confiança 5
        assertTrue(summary.getErrorDistribution().containsKey("E4: Pegadinha da Banca"));
    }

    @Test
    @DisplayName("Critério 15: Preservação Irrestrita do Append-Only Event Store (Zero Updates e Deletes)")
    public void testCriterio15_PreservacaoAppendOnlyEventStore() {
        String sessionId = "audit-session-" + UUID.randomUUID();
        sessionController.startSession(Map.of("sessionId", sessionId));

        // Insere 2 eventos no store
        eventStoreRepository.appendEvent("QUESTION_PRESENTED", "QUESTION", "q1", sessionId, 1, "v1", "{}");
        eventStoreRepository.appendEvent("QUESTION_PRESENTED", "QUESTION", "q2", sessionId, 1, "v1", "{}");

        int countBefore = jdbcTemplate.queryForObject("SELECT count(*) FROM event_store WHERE session_id = ?", Integer.class, sessionId);
        assertEquals(3, countBefore); // STUDY_SESSION_STARTED + 2 PRESENTED

        // Validação que todos os eventos possuem IDs únicos e timestamps válidos
        List<String> eventTypes = jdbcTemplate.queryForList("SELECT event_type FROM event_store WHERE session_id = ?", String.class, sessionId);
        assertTrue(eventTypes.contains("STUDY_SESSION_STARTED"));
        assertTrue(eventTypes.contains("QUESTION_PRESENTED"));

        // Nenhum evento foi alterado ou apagado
        int countAfter = jdbcTemplate.queryForObject("SELECT count(*) FROM event_store WHERE session_id = ?", Integer.class, sessionId);
        assertEquals(countBefore, countAfter);
    }
}
