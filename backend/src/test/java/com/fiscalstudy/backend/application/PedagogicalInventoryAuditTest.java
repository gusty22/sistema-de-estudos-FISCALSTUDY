package com.fiscalstudy.backend.application;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.fiscalstudy.backend.domain.*;
import com.fiscalstudy.backend.infrastructure.out.persistence.EditalRepositoryImpl;
import com.fiscalstudy.backend.infrastructure.out.persistence.EventStoreRepositoryImpl;
import com.fiscalstudy.backend.infrastructure.out.persistence.QuestionRepositoryImpl;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.io.TempDir;
import org.springframework.core.io.ClassPathResource;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.jdbc.datasource.DriverManagerDataSource;
import org.springframework.jdbc.datasource.init.ResourceDatabasePopulator;

import java.nio.file.Files;
import java.nio.file.Path;
import java.security.MessageDigest;
import java.time.Clock;
import java.time.Instant;
import java.time.ZoneOffset;
import java.util.List;

import static org.junit.jupiter.api.Assertions.*;

/**
 * Testes determinísticos de auditoria do inventário pedagógico com SQLite sintético.
 * Verifica contratos de admissão, matriz epistêmica, motivos explícitos de rejeição e não interferência.
 */
class PedagogicalInventoryAuditTest {

    @TempDir Path temp;
    JdbcTemplate jdbc;
    LearningShadowSnapshotService snapshots;
    ObjectMapper mapper = new ObjectMapper();
    Instant cutoff = Instant.parse("2026-10-28T12:00:00Z");
    Path db;

    @BeforeEach
    void setup() {
        db = temp.resolve("synthetic-inventory.db");
        var ds = new DriverManagerDataSource("jdbc:sqlite:" + db);
        new ResourceDatabasePopulator(new ClassPathResource("schema.sql")).execute(ds);
        jdbc = new JdbcTemplate(ds);

        snapshots = new LearningShadowSnapshotService(
            jdbc,
            new EditalRepositoryImpl(jdbc),
            new QuestionRepositoryImpl(jdbc),
            new EventStoreRepositoryImpl(jdbc),
            mapper,
            new LearningEvidenceService(jdbc),
            "SYNTHETIC_INVENTORY_FIXTURE",
            true,
            Clock.fixed(cutoff, ZoneOffset.UTC)
        );

        jdbc.update("INSERT INTO editais(id,concurso_id,titulo,versao,tipo,created_at) VALUES('e','c','Fixture Syllabus','v1','ORIGINAL','2026-01-01T00:00:00Z')");
        jdbc.update("INSERT INTO edital_topicos(id,edital_id,concurso_id,disciplina,assunto,confirmado_humano,created_at) VALUES('t','e','c','Direito Tributário','Impostos Federais',1,'2026-01-01T00:00:00Z')");
        jdbc.update("INSERT INTO questions(id,enunciado,options_json,correct_option,gabarito_status,disciplina,assunto) VALUES('q','Questão tributária válida','[\"A\",\"B\"]','A','DEFINITIVO','Direito Tributário','Impostos Federais')");
        jdbc.update("INSERT INTO question_topic_classifications(id,question_id,topic_id,status,confidence,origin,reviewer,evidence,created_at) VALUES('link1','q','t','CONFIRMED',1.0,'HUMAN','Revisor Humano','Auditoria oficial','2026-01-01T00:00:00Z')");
    }

    byte[] databaseHash() throws Exception {
        return MessageDigest.getInstance("SHA-256").digest(Files.readAllBytes(db));
    }

    @Test
    void auditInventoryProducesFullMatrixAndConfirmedCandidates() throws Exception {
        byte[] before = databaseHash();

        InventoryAuditResult audit = snapshots.auditInventory("c", "e", cutoff, 60, 15);

        assertNotNull(audit);
        assertEquals("c", audit.contestId());
        assertEquals("e", audit.editalId());
        assertEquals(cutoff.toString(), audit.observedAt());

        // Candidato diagnóstico confirmado
        assertEquals(1, audit.admittedCandidates().size());
        PedagogicalCandidate candidate = audit.admittedCandidates().get(0);
        assertEquals("diagnostic:t:q", candidate.candidateId());
        assertEquals(PedagogicalActivityType.DIAGNOSE_CONCEPT, candidate.activityType());
        assertEquals(EpistemicStatus.CONFIRMADO, candidate.epistemicStatus());
        assertTrue(candidate.materialAvailable());
        assertTrue(candidate.inSyllabus());
        assertEquals("NOT_APPLICABLE", candidate.prerequisitesStatus());

        // Matriz de atividades
        assertEquals(1, audit.activityMatrix().get(PedagogicalActivityType.DIAGNOSE_CONCEPT).get(EpistemicStatus.CONFIRMADO));
        assertEquals(1, audit.activityMatrix().get(PedagogicalActivityType.DEEPEN_APPLICATION).get(EpistemicStatus.INDISPONIVEL));

        // Rejeições estruturadas contêm a indisponibilidade de instrumento de transferência
        assertTrue(audit.rejections().stream().anyMatch(r ->
            r.activityType() == PedagogicalActivityType.DEEPEN_APPLICATION &&
            r.reasons().contains(PedagogicalRejectionReason.APPLICATION_INSTRUMENT_UNAVAILABLE)));

        // Imutabilidade estrita: leitura pura
        assertArrayEquals(before, databaseHash());
    }

    @Test
    void auditInventoryRejectsQuestionWithMissingSupportMedia() throws Exception {
        // Vincula material de apoio apontando para caminho de mídia inexistente
        Path missingMedia = temp.resolve("grafico-inexistente.png");
        jdbc.update("INSERT INTO support_materials(id,tipo,titulo,conteudo_texto,media_path) VALUES('sup1','GRAFICO','Gráfico Fiscal',NULL,?)", missingMedia.toString());
        jdbc.update("INSERT INTO question_support_materials(question_id,material_id) VALUES('q','sup1')");

        InventoryAuditResult audit = snapshots.auditInventory("c", "e", cutoff, 60, 15);

        // Não admite a questão pois falta o gráfico necessário
        assertTrue(audit.admittedCandidates().isEmpty());

        // Rejeição explícita documentada
        assertTrue(audit.rejections().stream().anyMatch(r ->
            r.activityType() == PedagogicalActivityType.DIAGNOSE_CONCEPT &&
            r.reasons().contains(PedagogicalRejectionReason.SUPPORT_MATERIAL_MEDIA_MISSING)));

        // Verificação no capture(): também não inclui no snapshot de envio ao R
        var shadowRequest = snapshots.capture("c", "e", cutoff, 60, 15);
        assertTrue(((List<?>) shadowRequest.get("candidates")).isEmpty());
    }

    @Test
    void auditInventoryRejectsStudyMaterialWhenFileMissingOrPageRangeInvalid() throws Exception {
        // Material com arquivo inexistente
        Path missingPdf = temp.resolve("apostila-ausente.pdf");
        jdbc.update("INSERT INTO study_materials(id,concurso_id,disciplina,titulo,formato,total_paginas,url_ou_caminho) " +
                    "VALUES('mat1','c','Direito Tributário','Manual Tributário','PDF',200,?)", missingPdf.toString());
        jdbc.update("INSERT INTO topic_material_links(id,topico_id,material_id,pagina_inicio,pagina_fim,status) " +
                    "VALUES('link-m1','t','mat1',10,25,'NAO_INICIADO')");

        InventoryAuditResult audit = snapshots.auditInventory("c", "e", cutoff, 60, 15);

        assertTrue(audit.rejections().stream().anyMatch(r ->
            r.activityType() == PedagogicalActivityType.LEARN_NEW &&
            r.reasons().contains(PedagogicalRejectionReason.PHYSICAL_FILE_MISSING)));

        // Material com páginas invertidas (pagina_inicio > pagina_fim)
        Path validPdf = temp.resolve("manual-real.pdf");
        Files.writeString(validPdf, "%PDF-1.4 Mock content");
        jdbc.update("INSERT INTO study_materials(id,concurso_id,disciplina,titulo,formato,total_paginas,url_ou_caminho) " +
                    "VALUES('mat2','c','Direito Tributário','Manual Invertido','PDF',100,?)", validPdf.toString());
        jdbc.update("INSERT INTO topic_material_links(id,topico_id,material_id,pagina_inicio,pagina_fim,status) " +
                    "VALUES('link-m2','t','mat2',50,20,'NAO_INICIADO')");

        audit = snapshots.auditInventory("c", "e", cutoff, 60, 15);

        assertTrue(audit.rejections().stream().anyMatch(r ->
            r.candidateId().contains("mat2") &&
            r.reasons().contains(PedagogicalRejectionReason.PAGE_RANGE_UNVERIFIED)));
    }

    @Test
    void auditInventoryAdmitsStudyMaterialWhenAllContractsVerified() throws Exception {
        // Material com arquivo real existente em disco
        Path realPdf = temp.resolve("apostila-verificada.pdf");
        Files.writeString(realPdf, "%PDF-1.4 Mock content authentic");

        jdbc.update("INSERT INTO study_materials(id,concurso_id,disciplina,titulo,formato,total_paginas,url_ou_caminho) " +
                    "VALUES('mat_ok','c','Direito Tributário','Apostila Oficial CTN','PDF',80,?)", realPdf.toString());
        jdbc.update("INSERT INTO topic_material_links(id,topico_id,material_id,pagina_inicio,pagina_fim,status) " +
                    "VALUES('link_ok','t','mat_ok',1,20,'NAO_INICIADO')");

        // Conceito canônico vinculado sem pré-requisitos pendentes (conceito introdutório base)
        jdbc.update("INSERT INTO canonical_concepts(id,disciplina,macro_tema,nome) VALUES('conc1','Direito Tributário','Tributos','Conceito de Tributo')");
        jdbc.update("INSERT INTO edital_topico_concept_links(id,topico_id,concept_id) VALUES('top_conc1','t','conc1')");

        InventoryAuditResult audit = snapshots.auditInventory("c", "e", cutoff, 60, 15);

        // Candidato LEARN_NEW admitido com status CONFIRMADO
        assertTrue(audit.admittedCandidates().stream().anyMatch(c ->
            c.activityType() == PedagogicalActivityType.LEARN_NEW &&
            "mat_ok".equals(c.materialId()) &&
            c.epistemicStatus() == EpistemicStatus.CONFIRMADO &&
            "SATISFIED".equals(c.prerequisitesStatus())));

        assertEquals(1, audit.activityMatrix().get(PedagogicalActivityType.LEARN_NEW).get(EpistemicStatus.CONFIRMADO));
    }

    @Test
    void auditInventoryRejectsStudyMaterialWhenPrerequisitesUnsatisfied() throws Exception {
        Path realPdf = temp.resolve("apostila-avancada.pdf");
        Files.writeString(realPdf, "%PDF-1.4 Content");

        jdbc.update("INSERT INTO study_materials(id,concurso_id,disciplina,titulo,formato,total_paginas,url_ou_caminho) " +
                    "VALUES('mat_adv','c','Direito Tributário','Tributação Internacional','PDF',150,?)", realPdf.toString());
        jdbc.update("INSERT INTO topic_material_links(id,topico_id,material_id,pagina_inicio,pagina_fim,status) " +
                    "VALUES('link_adv','t','mat_adv',1,30,'NAO_INICIADO')");

        // Conceito com pré-requisito essencial na DAG
        jdbc.update("INSERT INTO canonical_concepts(id,disciplina,macro_tema,nome) VALUES('c_base','Direito Tributário','Base','Competência Tributária')");
        jdbc.update("INSERT INTO canonical_concepts(id,disciplina,macro_tema,nome) VALUES('c_adv','Direito Tributário','Avançado','Tratados Internacionais')");
        jdbc.update("INSERT INTO canonical_concept_prerequisites(concept_id,prerequisite_concept_id,grau_dependencia) VALUES('c_adv','c_base','ESSENCIAL')");
        jdbc.update("INSERT INTO edital_topico_concept_links(id,topico_id,concept_id) VALUES('link_c_adv','t','c_adv')");

        InventoryAuditResult audit = snapshots.auditInventory("c", "e", cutoff, 60, 15);

        // Rejeitado porque pré-requisito não possui comprovação de domínio
        assertTrue(audit.rejections().stream().anyMatch(r ->
            r.candidateId().contains("mat_adv") &&
            r.reasons().contains(PedagogicalRejectionReason.PREREQUISITES_NOT_ESTABLISHED)));
    }

    @Test
    void auditInventoryRejectsUnconfirmedTopicAndSuggestedClassification() throws Exception {
        // Tópico não confirmado por humano
        jdbc.update("INSERT INTO edital_topicos(id,edital_id,concurso_id,disciplina,assunto,confirmado_humano,created_at) VALUES('t_auto','e','c','Direito','Inferido',0,'2026-01-01T00:00:00Z')");
        jdbc.update("INSERT INTO questions(id,enunciado,options_json,correct_option,gabarito_status,disciplina,assunto) VALUES('q_auto','Enunciado','[\"A\",\"B\"]','A','DEFINITIVO','Direito','Inferido')");
        jdbc.update("INSERT INTO question_topic_classifications(id,question_id,topic_id,status,confidence,origin,reviewer,evidence,created_at) VALUES('link_auto','q_auto','t_auto','CONFIRMED',1.0,'HUMAN','Rev','Ev','2026-01-01T00:00:00Z')");

        // Tópico confirmado mas classificação apenas SUGGESTED
        jdbc.update("INSERT INTO questions(id,enunciado,options_json,correct_option,gabarito_status,disciplina,assunto) VALUES('q_sugg','Enunciado','[\"A\",\"B\"]','A','DEFINITIVO','Direito Tributário','Impostos Federais')");
        jdbc.update("INSERT INTO question_topic_classifications(id,question_id,topic_id,status,confidence,origin,evidence,created_at) VALUES('link_sugg','q_sugg','t','SUGGESTED',0.7,'AUTOMATED','Texto','2026-01-01T00:00:00Z')");

        InventoryAuditResult audit = snapshots.auditInventory("c", "e", cutoff, 60, 15);

        assertTrue(audit.rejections().stream().anyMatch(r ->
            r.candidateId().contains("t_auto") &&
            r.reasons().contains(PedagogicalRejectionReason.TOPIC_NOT_CONFIRMED_HUMAN)));

        assertTrue(audit.rejections().stream().anyMatch(r ->
            r.candidateId().contains("q_sugg") &&
            r.reasons().contains(PedagogicalRejectionReason.CLASSIFICATION_NOT_CONFIRMED)));
    }

    @Test
    void auditInventoryRejectsQuarantinedAndNonDefinitiveQuestions() throws Exception {
        // Questão em quarentena diagnóstica
        jdbc.update("INSERT INTO diagnostic_reservation_events(event_id,reservation_id,question_id,state,protocol_id,purpose,occurred_at,classification_snapshot_json,novelty_status,reason,contract_version) " +
                    "VALUES('ev_res1','res1','q','RESERVED','proto1','DIAGNOSTIC','2026-01-01T00:00:00Z','{}','EXTERNAL_EXPOSURE_UNKNOWN','Gabarito sob suspeita','diagnostic-quarantine-v1')");

        InventoryAuditResult audit = snapshots.auditInventory("c", "e", cutoff, 60, 15);

        assertTrue(audit.admittedCandidates().isEmpty());
        assertTrue(audit.rejections().stream().anyMatch(r ->
            r.reasons().contains(PedagogicalRejectionReason.QUESTION_QUARANTINED_OR_INVALID)));

        // Remove reserva e anula questão
        jdbc.update("DELETE FROM diagnostic_reservation_events");
        jdbc.update("UPDATE questions SET gabarito_status='ANULADA' WHERE id='q'");

        audit = snapshots.auditInventory("c", "e", cutoff, 60, 15);
        assertTrue(audit.admittedCandidates().isEmpty());
        assertTrue(audit.rejections().stream().anyMatch(r ->
            r.reasons().contains(PedagogicalRejectionReason.GABARITO_NOT_DEFINITIVE)));
    }

    @Test
    void auditInventoryRejectsMemoryNotDueOrAbsentLineage() throws Exception {
        // Estado FSRS para o futuro (não vencido)
        jdbc.update("INSERT INTO learning_memory_state VALUES('q',2.0,5.0,1,0,'2026-10-20T12:00:00Z','2026-11-01T12:00:00Z',?)", LearningEvidenceService.MODEL_VERSION);

        InventoryAuditResult audit = snapshots.auditInventory("c", "e", cutoff, 60, 15);

        assertTrue(audit.rejections().stream().anyMatch(r ->
            r.activityType() == PedagogicalActivityType.REVIEW_ITEM &&
            r.reasons().contains(PedagogicalRejectionReason.MEMORY_NOT_DUE)));

        // Atualiza due_at para vencido, mas sem evento histórico de resposta
        jdbc.update("UPDATE learning_memory_state SET due_at='2026-10-22T12:00:00Z' WHERE question_id='q'");

        audit = snapshots.auditInventory("c", "e", cutoff, 60, 15);
        assertTrue(audit.rejections().stream().anyMatch(r ->
            r.activityType() == PedagogicalActivityType.REVIEW_ITEM &&
            r.reasons().contains(PedagogicalRejectionReason.ABSENT_MEMORY_LINEAGE)));

        // Insere evento histórico legítimo
        String payload = "{\"questionId\":\"q\",\"isCorrect\":true,\"gabaritoStatus\":\"DEFINITIVO\",\"origin\":\"REAL_STUDY\",\"studentId\":\"LOCAL_SINGLE_USER\",\"concursoId\":\"c\"}";
        jdbc.update("INSERT INTO event_store VALUES('ev1','ANSWER_SUBMITTED','QUESTION','q','fixture','2026-10-20T12:00:00Z','2026-10-20T12:00:00Z',2,'v2',?)", payload);

        audit = snapshots.auditInventory("c", "e", cutoff, 60, 15);
        assertTrue(audit.admittedCandidates().stream().anyMatch(c ->
            c.activityType() == PedagogicalActivityType.REVIEW_ITEM &&
            "review:t:q".equals(c.candidateId())));
    }
}
