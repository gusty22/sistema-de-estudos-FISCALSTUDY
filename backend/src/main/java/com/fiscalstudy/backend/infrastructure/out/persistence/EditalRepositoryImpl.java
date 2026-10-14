package com.fiscalstudy.backend.infrastructure.out.persistence;

import com.fiscalstudy.backend.domain.Edital;
import com.fiscalstudy.backend.domain.EditalRepository;
import com.fiscalstudy.backend.domain.EditalTopico;
import jakarta.annotation.PostConstruct;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.jdbc.core.RowMapper;
import org.springframework.stereotype.Repository;

import java.time.Instant;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

@Repository
public class EditalRepositoryImpl implements EditalRepository {

    private static final Logger logger = LoggerFactory.getLogger(EditalRepositoryImpl.class);
    private final JdbcTemplate jdbcTemplate;

    private final RowMapper<Edital> editalRowMapper = (rs, rowNum) -> {
        Edital e = new Edital();
        e.setId(rs.getString("id"));
        e.setConcursoId(rs.getString("concurso_id"));
        e.setTitulo(rs.getString("titulo"));
        e.setVersao(rs.getString("versao"));
        e.setTipo(rs.getString("tipo"));
        e.setFilename(rs.getString("filename"));
        e.setCreatedAt(rs.getString("created_at"));
        return e;
    };

    private final RowMapper<EditalTopico> topicoRowMapper = (rs, rowNum) -> {
        EditalTopico t = new EditalTopico();
        t.setId(rs.getString("id"));
        t.setEditalId(rs.getString("edital_id"));
        t.setConcursoId(rs.getString("concurso_id"));
        t.setDisciplina(rs.getString("disciplina"));
        t.setAssunto(rs.getString("assunto"));
        t.setSubassunto(rs.getString("subassunto"));
        t.setPeso(rs.getObject("peso") != null ? rs.getDouble("peso") : 1.0);
        t.setQuestoesPrevistas(rs.getObject("questoes_previstas") != null ? rs.getInt("questoes_previstas") : null);
        t.setDocOrigem(rs.getString("doc_origem"));
        t.setPaginaOrigem(rs.getObject("pagina_origem") != null ? rs.getInt("pagina_origem") : null);
        t.setTrechoOrigem(rs.getString("trecho_origem"));
        t.setTipoClassificacao(rs.getString("tipo_classificacao"));
        t.setConfirmadoHumano(rs.getInt("confirmado_humano") == 1);
        t.setCreatedAt(rs.getString("created_at"));
        return t;
    };

    public EditalRepositoryImpl(JdbcTemplate jdbcTemplate) {
        this.jdbcTemplate = jdbcTemplate;
    }

    @PostConstruct
    public void initSeedTopics() {
        try {
            Integer count = jdbcTemplate.queryForObject("SELECT count(*) FROM edital_topicos", Integer.class);
            if (count != null && count == 0) {
                logger.info("Initializing official verticalized edital topics for Araguari Auditor e Técnico");
                String concursoIdAuditor = "iss-araguari-auditor-2023";
                String editalIdAuditor = "edital-araguari-2023-v1";

                saveEdital(new Edital(
                        editalIdAuditor,
                        concursoIdAuditor,
                        "Edital Concurso Público 01/2023 — Prefeitura de Araguari/MG",
                        "1.0",
                        "ORIGINAL",
                        "edital_normativo_01_2023.pdf"
                ));

                // Tópicos reais de Auditor Fiscal (ISS Araguari)
                saveTopico(new EditalTopico(UUID.randomUUID().toString(), editalIdAuditor, concursoIdAuditor,
                        "Direito Tributário", "Sistema Tributário Nacional", "Competência Tributária e Limitações ao Poder de Tributar",
                        1.5, 10, "Edital 01/2023 Anexo II", 42, "Item 1.1 da Parte Específica", "EXPLICITA", true));

                saveTopico(new EditalTopico(UUID.randomUUID().toString(), editalIdAuditor, concursoIdAuditor,
                        "Direito Tributário", "Impostos Municipais", "IPTU, ISSQN e ITBI: Fato Gerador, Base de Cálculo e Alíquotas",
                        1.5, 8, "Edital 01/2023 Anexo II", 43, "Item 1.4 da Parte Específica", "EXPLICITA", true));

                saveTopico(new EditalTopico(UUID.randomUUID().toString(), editalIdAuditor, concursoIdAuditor,
                        "Direito Tributário", "Crédito Tributário", "Lançamento, Suspensão, Extinção e Exclusão do Crédito",
                        1.5, 6, "Edital 01/2023 Anexo II", 43, "Item 1.6 da Parte Específica", "EXPLICITA", true));

                saveTopico(new EditalTopico(UUID.randomUUID().toString(), editalIdAuditor, concursoIdAuditor,
                        "Legislação Municipal", "Código Tributário Municipal", "Normas gerais e procedimento fiscal administrativo de Araguari",
                        1.2, 5, "Edital 01/2023 Anexo II", 45, "Item 3.1 Legislação Municipal", "EXPLICITA", true));

                saveTopico(new EditalTopico(UUID.randomUUID().toString(), editalIdAuditor, concursoIdAuditor,
                        "Língua Portuguesa", "Interpretação de Texto", "Compreensão, inferência e tipologia textual",
                        1.0, 10, "Edital 01/2023 Anexo II", 40, "Item Conhecimentos Básicos", "EXPLICITA", true));

                saveTopico(new EditalTopico(UUID.randomUUID().toString(), editalIdAuditor, concursoIdAuditor,
                        "Raciocínio Lógico-Matemático", "Estruturas Lógicas", "Proposições, conectivos, diagramas e análise combinatória",
                        1.0, 5, "Edital 01/2023 Anexo II", 41, "Item RLM", "EXPLICITA", true));

                saveTopico(new EditalTopico(UUID.randomUUID().toString(), editalIdAuditor, concursoIdAuditor,
                        "Contabilidade Geral e Tributária", "Demonstrações Contábeis", "Balanço Patrimonial, DRE e lançamentos fiscais",
                        1.2, 5, "Edital 01/2023 Anexo II", 44, "Item Contabilidade", "EXPLICITA", true));

                // Para Técnico Fiscal
                String concursoIdTecnico = "iss-araguari-tecnico-2023";
                String editalIdTecnico = "edital-tecnico-araguari-2023-v1";
                saveEdital(new Edital(editalIdTecnico, concursoIdTecnico, "Edital 01/2023 — Técnico Fiscal", "1.0", "ORIGINAL", "edital_tecnico.pdf"));

                saveTopico(new EditalTopico(UUID.randomUUID().toString(), editalIdTecnico, concursoIdTecnico,
                        "Língua Portuguesa", "Morfossintaxe", "Classes de palavras, concordância e regência",
                        1.0, 10, "Edital 01/2023 Anexo II", 38, "Item Português", "EXPLICITA", true));

                saveTopico(new EditalTopico(UUID.randomUUID().toString(), editalIdTecnico, concursoIdTecnico,
                        "Raciocínio Lógico-Matemático", "Análise Combinatória", "Princípio fundamental da contagem e permutações",
                        1.0, 5, "Edital 01/2023 Anexo II", 39, "Item RLM", "EXPLICITA", true));

                saveTopico(new EditalTopico(UUID.randomUUID().toString(), editalIdTecnico, concursoIdTecnico,
                        "Noções de Informática", "Ambiente Operacional", "Sistemas de arquivos e aplicativos de escritório",
                        1.0, 5, "Edital 01/2023 Anexo II", 39, "Item Informática", "EXPLICITA", true));

                saveTopico(new EditalTopico(UUID.randomUUID().toString(), editalIdTecnico, concursoIdTecnico,
                        "Conhecimentos Específicos", "Tributos Municipais", "Noções gerais de tributação e atendimento ao contribuinte",
                        1.2, 20, "Edital 01/2023 Anexo II", 46, "Item Específica Técnico", "EXPLICITA", true));
            }
        } catch (Exception e) {
            logger.warn("Could not check or seed verticalized edital topics: {}", e.getMessage());
        }
    }

    @Override
    public List<Edital> findEditaisByConcurso(String concursoId) {
        return jdbcTemplate.query("SELECT * FROM editais WHERE concurso_id = ? ORDER BY created_at DESC", editalRowMapper, concursoId);
    }

    @Override
    public Optional<Edital> findEditalById(String id) {
        List<Edital> list = jdbcTemplate.query("SELECT * FROM editais WHERE id = ?", editalRowMapper, id);
        return list.isEmpty() ? Optional.empty() : Optional.of(list.get(0));
    }

    @Override
    public Edital saveEdital(Edital e) {
        String now = Instant.now().toString();
        if (e.getCreatedAt() == null) e.setCreatedAt(now);

        String sql = "INSERT INTO editais (id, concurso_id, titulo, versao, tipo, filename, created_at) " +
                "VALUES (?, ?, ?, ?, ?, ?, ?) " +
                "ON CONFLICT(id) DO UPDATE SET titulo=excluded.titulo, versao=excluded.versao, tipo=excluded.tipo, filename=excluded.filename";
        jdbcTemplate.update(sql, e.getId(), e.getConcursoId(), e.getTitulo(), e.getVersao(), e.getTipo(), e.getFilename(), e.getCreatedAt());
        return e;
    }

    @Override
    public List<EditalTopico> findTopicosByConcurso(String concursoId) {
        return jdbcTemplate.query(
                "SELECT * FROM edital_topicos WHERE concurso_id = ? ORDER BY CASE WHEN pagina_origem IS NOT NULL THEN pagina_origem ELSE 99999 END ASC, disciplina ASC, peso DESC, assunto ASC",
                topicoRowMapper,
                concursoId
        );
    }

    @Override
    public Optional<EditalTopico> findTopicoById(String id) {
        List<EditalTopico> list = jdbcTemplate.query("SELECT * FROM edital_topicos WHERE id = ?", topicoRowMapper, id);
        return list.isEmpty() ? Optional.empty() : Optional.of(list.get(0));
    }

    @Override
    public EditalTopico saveTopico(EditalTopico t) {
        String now = Instant.now().toString();
        if (t.getCreatedAt() == null) t.setCreatedAt(now);

        String sql = "INSERT INTO edital_topicos (id, edital_id, concurso_id, disciplina, assunto, subassunto, peso, questoes_previstas, doc_origem, pagina_origem, trecho_origem, tipo_classificacao, confirmado_humano, created_at) " +
                "VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?) " +
                "ON CONFLICT(id) DO UPDATE SET disciplina=excluded.disciplina, assunto=excluded.assunto, subassunto=excluded.subassunto, " +
                "peso=excluded.peso, questoes_previstas=excluded.questoes_previstas, doc_origem=excluded.doc_origem, " +
                "pagina_origem=excluded.pagina_origem, trecho_origem=excluded.trecho_origem, " +
                "tipo_classificacao=excluded.tipo_classificacao, confirmado_humano=excluded.confirmado_humano";

        jdbcTemplate.update(sql,
                t.getId(),
                t.getEditalId(),
                t.getConcursoId(),
                t.getDisciplina(),
                t.getAssunto(),
                t.getSubassunto(),
                t.getPeso(),
                t.getQuestoesPrevistas(),
                t.getDocOrigem(),
                t.getPaginaOrigem(),
                t.getTrechoOrigem(),
                t.getTipoClassificacao(),
                t.isConfirmadoHumano() ? 1 : 0,
                t.getCreatedAt()
        );
        return t;
    }

    @Override
    public void deleteTopico(String id) {
        jdbcTemplate.update("DELETE FROM edital_topicos WHERE id = ?", id);
    }

    @Override
    public void deleteTopicosByEditalId(String editalId) {
        jdbcTemplate.update("DELETE FROM edital_topicos WHERE edital_id = ?", editalId);
    }

    @Override
    public void deleteTopicosByConcursoId(String concursoId) {
        jdbcTemplate.update("DELETE FROM edital_topicos WHERE concurso_id = ?", concursoId);
    }

    @Override
    public void deleteEdital(String id) {
        jdbcTemplate.update("DELETE FROM editais WHERE id = ?", id);
    }

    @Override
    public List<EditalTopico> findTopicosByEditalId(String editalId) {
        return jdbcTemplate.query(
                "SELECT * FROM edital_topicos WHERE edital_id = ? ORDER BY pagina_origem ASC, disciplina ASC, assunto ASC",
                topicoRowMapper,
                editalId
        );
    }

    @Override
    public void confirmTopico(String id) {
        jdbcTemplate.update("UPDATE edital_topicos SET confirmado_humano = 1, tipo_classificacao = 'CONFIRMADA' WHERE id = ?", id);
    }
}
