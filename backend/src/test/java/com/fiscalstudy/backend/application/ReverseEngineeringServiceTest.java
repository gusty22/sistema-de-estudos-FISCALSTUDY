package com.fiscalstudy.backend.application;

import com.fiscalstudy.backend.domain.EventStoreRepository;
import com.fiscalstudy.backend.infrastructure.in.web.dto.ReverseEngineeringAnswerRequestDTO;
import com.fiscalstudy.backend.infrastructure.in.web.dto.ReverseEngineeringSessionDTO;
import com.fiscalstudy.backend.infrastructure.in.web.dto.ReverseEngineeringStartRequestDTO;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.jdbc.datasource.SingleConnectionDataSource;

import java.util.List;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.Mockito.*;

class ReverseEngineeringServiceTest {

    private JdbcTemplate jdbcTemplate;
    private EventStoreRepository eventStoreRepository;
    private ReverseEngineeringService service;

    @BeforeEach
    void setUp() {
        SingleConnectionDataSource dataSource = new SingleConnectionDataSource("jdbc:sqlite::memory:", true);
        dataSource.setSuppressClose(true);

        jdbcTemplate = new JdbcTemplate(dataSource);

        // Cria schema mínimo em memória
        jdbcTemplate.execute("CREATE TABLE IF NOT EXISTS reverse_engineering_sessions (" +
                "id TEXT PRIMARY KEY, session_id TEXT NOT NULL, concurso_id TEXT, " +
                "disciplina TEXT NOT NULL, assunto TEXT NOT NULL, banca TEXT NOT NULL, " +
                "nivel_topico TEXT NOT NULL DEFAULT 'INTERMEDIARIO', " +
                "total_questoes INTEGER NOT NULL DEFAULT 5, questoes_resolvidas INTEGER NOT NULL DEFAULT 0, " +
                "questoes_corretas INTEGER NOT NULL DEFAULT 0, erros_questoes_numeros TEXT, " +
                "alternativas_eliminadas_json TEXT, pegadinhas_detectadas_json TEXT, " +
                "prescricao_recorte_texto TEXT, pdf_doc_nome TEXT, " +
                "pagina_inicio_recorte INTEGER DEFAULT 16, pagina_fim_recorte INTEGER DEFAULT 22, " +
                "paginas_puladas INTEGER DEFAULT 15, status TEXT NOT NULL DEFAULT 'EM_ANDAMENTO', " +
                "created_at TEXT DEFAULT CURRENT_TIMESTAMP, completed_at TEXT)");

        jdbcTemplate.execute("CREATE TABLE IF NOT EXISTS questions (" +
                "id TEXT PRIMARY KEY, enunciado TEXT, options_json TEXT, correct_option TEXT, " +
                "disciplina TEXT, assunto TEXT, banca TEXT, ano INTEGER, orgao TEXT, cargo TEXT, gabarito_status TEXT, " +
                "status TEXT DEFAULT 'VALIDADA', justificativa TEXT, texto_apoio TEXT, texto_apoio_titulo TEXT, numero_original INTEGER, arquivo_origem TEXT)");

        jdbcTemplate.execute("CREATE TABLE IF NOT EXISTS concursos (" +
                "id TEXT PRIMARY KEY, nome TEXT, orgao TEXT, banca TEXT, ano INTEGER, cargo TEXT)");

        jdbcTemplate.execute("CREATE TABLE IF NOT EXISTS event_store (" +
                "event_id TEXT PRIMARY KEY, event_type TEXT, aggregate_type TEXT, aggregate_id TEXT, " +
                "session_id TEXT, event_version INTEGER, schema_version TEXT, payload_json TEXT, recorded_at TEXT)");

        jdbcTemplate.execute("CREATE TABLE IF NOT EXISTS edital_topicos (" +
                "id TEXT PRIMARY KEY, concurso_id TEXT, disciplina TEXT, assunto TEXT, subassunto TEXT, peso INTEGER)");

        eventStoreRepository = mock(EventStoreRepository.class);
        service = new ReverseEngineeringService(jdbcTemplate, eventStoreRepository);
    }

    @Test
    @DisplayName("Deve iniciar sessão de Engenharia Reversa com 5 questões da banca foco")
    void testStartSession_Selects5Questions() {
        ReverseEngineeringStartRequestDTO req = new ReverseEngineeringStartRequestDTO(
                "conc-araguari", "Direito Tributário", "Substituição Tributária para Frente", "FGV", "INTERMEDIARIO", 5, "sess-123"
        );

        ReverseEngineeringSessionDTO session = service.startReverseEngineeringSession(req);

        assertNotNull(session);
        assertNotNull(session.getId());
        assertEquals("FGV", session.getBanca());
        assertEquals("Direito Tributário", session.getDisciplina());
        assertEquals("Substituição Tributária para Frente", session.getAssunto());
        assertEquals(5, session.getTotalQuestoes());
        assertEquals("EM_ANDAMENTO", session.getStatus());
        assertEquals(5, session.getQuestoes().size());

        verify(eventStoreRepository, times(1)).appendEvent(
                eq("REVERSE_ENGINEERING_SESSION_STARTED"), eq("REVERSE_SESSION"), anyString(), anyString(), anyInt(), anyString(), anyString()
        );
    }

    @Test
    @DisplayName("Deve prescrever: pular as primeiras 15 páginas do PDF e focar nas páginas 16 a 22 quando errar questões 3 e 4")
    void testCanonicalPrescription_Questions3And4Wrong() {
        ReverseEngineeringStartRequestDTO req = new ReverseEngineeringStartRequestDTO(
                "conc-araguari", "Direito Tributário", "Substituição Tributária para Frente", "FGV", "INTERMEDIARIO", 5, "sess-123"
        );
        ReverseEngineeringSessionDTO session = service.startReverseEngineeringSession(req);
        String revId = session.getId();

        // Questão 1: Acerto na regra geral (elimina C e D)
        service.recordQuestionResolution(new ReverseEngineeringAnswerRequestDTO(
                revId, "q1", 1, "A", true, List.of("C", "D"), 25, null
        ));

        // Questão 2: Acerto na regra geral (elimina B e E)
        service.recordQuestionResolution(new ReverseEngineeringAnswerRequestDTO(
                revId, "q2", 2, "A", true, List.of("B", "E"), 30, null
        ));

        // Questão 3: Erro na exceção jurisprudencial (caiu na pegadinha da banca)
        service.recordQuestionResolution(new ReverseEngineeringAnswerRequestDTO(
                revId, "q3", 3, "E", false, List.of("A", "C"), 55, "EXCECAO_JURISPRUDENCIAL"
        ));

        // Questão 4: Erro na exceção jurisprudencial (caiu na pegadinha da banca)
        service.recordQuestionResolution(new ReverseEngineeringAnswerRequestDTO(
                revId, "q4", 4, "D", false, List.of("A", "C"), 60, "EXCECAO_JURISPRUDENCIAL"
        ));

        // Questão 5: Acerto final
        ReverseEngineeringSessionDTO completedSession = service.recordQuestionResolution(new ReverseEngineeringAnswerRequestDTO(
                revId, "q5", 5, "C", true, List.of("A", "B", "E"), 35, null
        ));

        assertEquals("CONCLUIDA", completedSession.getStatus());
        assertEquals(5, completedSession.getQuestoesResolvidas());
        assertEquals(3, completedSession.getQuestoesCorretas());
        assertEquals("3, 4", completedSession.getErrosQuestoesNumeros());

        // Validação da prescrição exata requerida pelo usuário
        String prescricao = completedSession.getPrescricaoRecorteTexto();
        assertNotNull(prescricao);
        assertTrue(prescricao.contains("Você já domina a regra geral. Pule as primeiras 15 páginas do PDF. Leia apenas as páginas 16 a 22, que contêm as exceções jurisprudenciais onde você acabou de errar nas questões 3 e 4."));
        assertEquals(15, completedSession.getPaginasPuladas());
        assertEquals(16, completedSession.getPaginaInicioRecorte());
        assertEquals(22, completedSession.getPaginaFimRecorte());

        verify(eventStoreRepository, times(1)).appendEvent(
                eq("REVERSE_ENGINEERING_COMPLETED"), eq("REVERSE_SESSION"), eq(revId), anyString(), anyInt(), anyString(), anyString()
        );
    }

    @Test
    @DisplayName("Deve prescrever economia de 100% das páginas quando acertar todas as 5 questões")
    void testPrescription_AllCorrect() {
        ReverseEngineeringStartRequestDTO req = new ReverseEngineeringStartRequestDTO(
                "conc-1", "Contabilidade Geral", "Balanço Patrimonial", "FGV", "AVANCADO", 5, "sess-456"
        );
        ReverseEngineeringSessionDTO session = service.startReverseEngineeringSession(req);

        for (int i = 1; i <= 5; i++) {
            session = service.recordQuestionResolution(new ReverseEngineeringAnswerRequestDTO(
                    session.getId(), "q" + i, i, "A", true, List.of("B", "C"), 20, null
            ));
        }

        assertEquals("CONCLUIDA", session.getStatus());
        assertEquals(5, session.getQuestoesCorretas());
        assertTrue(session.getPrescricaoRecorteTexto().contains("Pule 100% da leitura teórica do PDF"));
        assertEquals(30, session.getPaginasPuladas());
    }

    @Test
    @DisplayName("Deve indicar elegibilidade para tópicos intermediários ou avançados")
    void testTopicEligibility() {
        boolean eligible = service.isTopicEligibleForReverseEngineering("Direito Tributário", "Substituição Tributária", "conc-1");
        assertTrue(eligible);
    }
}
