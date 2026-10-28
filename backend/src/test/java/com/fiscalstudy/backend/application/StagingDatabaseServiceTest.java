package com.fiscalstudy.backend.application;

import com.fiscalstudy.backend.infrastructure.in.web.dto.QuestionUpdateRequestDTO;
import com.fiscalstudy.backend.infrastructure.in.web.dto.StagingFileDTO;
import com.fiscalstudy.backend.infrastructure.in.web.dto.StagingQuestionDTO;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.jdbc.core.JdbcTemplate;

import java.util.List;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.Mockito.mock;

class StagingDatabaseServiceTest {

    private StagingDatabaseService stagingService;

    @org.junit.jupiter.api.io.TempDir java.nio.file.Path temp;

    @BeforeEach
    void setUp() throws Exception {
        var env=new org.springframework.mock.env.MockEnvironment()
                .withProperty("spring.datasource.url","jdbc:sqlite:"+temp.resolve("main.db"))
                .withProperty("fiscalstudy.staging-db",temp.resolve("staging.db").toString())
                .withProperty("fiscalstudy.acervo-root",temp.resolve("materials").toString());
        var paths=new com.fiscalstudy.backend.infrastructure.config.DatabasePaths(env);
        paths.createDirectories();
        com.fiscalstudy.backend.infrastructure.config.StagingSchemaMigration.migrate(paths.stagingDatabase());
        try(var c=java.sql.DriverManager.getConnection("jdbc:sqlite:"+paths.stagingDatabase());var stmt=c.createStatement()) {
            stmt.execute("PRAGMA foreign_keys=ON");
            stmt.execute("INSERT INTO staging_files(id,rel_path,filename,file_size_bytes,sha256,total_pages) VALUES('file1','fixture.pdf','fixture.pdf',1,'fixture-hash',1)");
            stmt.execute("INSERT INTO staging_documents(id,file_id,doc_role,page_start,page_end) VALUES('doc1','file1','PROVA',1,1)");
            stmt.execute("INSERT INTO staging_questions(id,document_id,numero_original,statement,options_json,correct_option,pages_json) VALUES('q1','doc1',1,'Questão fixture','[\"A\",\"B\"]','A','[1]')");
            stmt.execute("INSERT INTO staging_support_materials(id,document_id,tipo,conteudo_texto) VALUES('mat1','doc1','TEXTO_BASE','Texto de apoio')");
            stmt.execute("INSERT INTO staging_question_support_materials VALUES('q1','mat1')");
        }
        var operational=new org.springframework.jdbc.datasource.DriverManagerDataSource("jdbc:sqlite:"+temp.resolve("main.db"));
        try(var connection=operational.getConnection()){com.fiscalstudy.backend.infrastructure.config.SchemaMigration.migrate(connection);}
        stagingService=new StagingDatabaseService(new JdbcTemplate(operational),paths);
    }

    @Test
    void deletingFilePreservesReferentialIntegrity() throws Exception {
        stagingService.deleteStagingFile("file1");
        try(var c=java.sql.DriverManager.getConnection("jdbc:sqlite:"+temp.resolve("staging.db"));var stmt=c.createStatement()) {
            try(var r=stmt.executeQuery("PRAGMA foreign_key_check")){assertFalse(r.next());}
            try(var r=stmt.executeQuery("SELECT count(*) FROM staging_support_materials")){assertTrue(r.next());assertEquals(0,r.getInt(1));}
        }
    }

    @Test
    @DisplayName("Deve listar arquivos catalogados no staging.db com agregações")
    void shouldListStagingFiles() {
        List<StagingFileDTO> files = stagingService.listStagingFiles();
        assertNotNull(files);
        assertFalse(files.isEmpty(), "Deveria conter arquivos registrados no staging.db");

        // Verifica se arquivos com questões processadas aparecem no topo
        StagingFileDTO first = files.get(0);
        assertNotNull(first.getId());
        assertNotNull(first.getFilename());
        assertTrue(first.getQuestionCount() >= 0);
    }

    @Test
    @DisplayName("Deve recuperar questões para arquivo de staging existente")
    void shouldGetQuestionsForFile() {
        List<StagingFileDTO> files = stagingService.listStagingFiles();
        StagingFileDTO fileWithQuestions = files.stream()
                .filter(f -> f.getQuestionCount() > 0)
                .findFirst()
                .orElse(null);

        assertNotNull(fileWithQuestions, "Deveria existir ao menos um arquivo com questões extraídas");

        List<StagingQuestionDTO> questions = stagingService.getQuestionsForFile(fileWithQuestions.getId());
        assertNotNull(questions);
        assertEquals(fileWithQuestions.getQuestionCount(), questions.size());

        StagingQuestionDTO firstQ = questions.get(0);
        assertNotNull(firstQ.getId());
        assertTrue(firstQ.getNumeroOriginal() > 0);
        assertNotNull(firstQ.getStatement());
        assertNotNull(firstQ.getOptions());
    }

    @Test
    @DisplayName("Deve verificar e rejeitar questão com atualização em staging.db")
    void shouldVerifyAndRejectQuestion() {
        List<StagingFileDTO> files = stagingService.listStagingFiles();
        StagingFileDTO fileWithQuestions = files.stream()
                .filter(f -> f.getQuestionCount() > 0)
                .findFirst()
                .orElse(null);

        assertNotNull(fileWithQuestions);
        List<StagingQuestionDTO> questions = stagingService.getQuestionsForFile(fileWithQuestions.getId());
        StagingQuestionDTO target = questions.get(0);

        // Marca como verificada
        StagingQuestionDTO verified = stagingService.verifyStagingQuestion(target.getId());
        assertEquals("SOURCE_VERIFIED", verified.getStatus());
        assertTrue(verified.isModifiedByUser());

        // Atualiza nota de revisão
        QuestionUpdateRequestDTO req = new QuestionUpdateRequestDTO();
        req.setReviewNotes("Verificado conforme gabarito oficial");
        StagingQuestionDTO updated = stagingService.updateStagingQuestion(target.getId(), req);
        assertEquals("Verificado conforme gabarito oficial", updated.getReviewNotes());
    }
}
