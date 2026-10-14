package com.fiscalstudy.backend.infrastructure.out.persistence;

import com.fiscalstudy.backend.domain.StudyMaterial;
import com.fiscalstudy.backend.domain.StudyMaterialRepository;
import com.fiscalstudy.backend.domain.TopicMaterialLink;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.jdbc.core.RowMapper;
import org.springframework.stereotype.Repository;

import java.time.Instant;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

@Repository
public class StudyMaterialRepositoryImpl implements StudyMaterialRepository {

    private final JdbcTemplate jdbcTemplate;

    private final RowMapper<StudyMaterial> materialRowMapper = (rs, rowNum) -> new StudyMaterial(
            rs.getString("id"),
            rs.getString("concurso_id"),
            rs.getString("disciplina"),
            rs.getString("titulo"),
            rs.getString("autor"),
            rs.getString("formato"),
            rs.getInt("total_paginas"),
            rs.getInt("pagina_atual"),
            rs.getString("url_ou_caminho"),
            rs.getString("notas"),
            rs.getString("created_at")
    );

    private final RowMapper<TopicMaterialLink> linkRowMapper = (rs, rowNum) -> {
        TopicMaterialLink link = new TopicMaterialLink(
                rs.getString("id"),
                rs.getString("topico_id"),
                rs.getString("material_id"),
                rs.getObject("pagina_inicio") != null ? rs.getInt("pagina_inicio") : null,
                rs.getObject("pagina_fim") != null ? rs.getInt("pagina_fim") : null,
                rs.getInt("paginas_lidas"),
                rs.getString("status"),
                rs.getString("anotacoes"),
                rs.getString("created_at")
        );
        try { link.setMaterialTitulo(rs.getString("material_titulo")); } catch (Exception ignored) {}
        try { link.setMaterialFormato(rs.getString("material_formato")); } catch (Exception ignored) {}
        try { link.setTopicoAssunto(rs.getString("topico_assunto")); } catch (Exception ignored) {}
        try { link.setDisciplina(rs.getString("disciplina")); } catch (Exception ignored) {}
        return link;
    };

    public StudyMaterialRepositoryImpl(JdbcTemplate jdbcTemplate) {
        this.jdbcTemplate = jdbcTemplate;
    }

    @Override
    public List<StudyMaterial> findByConcursoIdOrGlobal(String concursoId) {
        String sql = "SELECT * FROM study_materials WHERE concurso_id = ? OR concurso_id IS NULL ORDER BY disciplina, titulo";
        return jdbcTemplate.query(sql, materialRowMapper, concursoId);
    }

    @Override
    public List<StudyMaterial> findByDisciplina(String concursoId, String disciplina) {
        String sql = "SELECT * FROM study_materials WHERE (concurso_id = ? OR concurso_id IS NULL) AND disciplina = ? ORDER BY titulo";
        return jdbcTemplate.query(sql, materialRowMapper, concursoId, disciplina);
    }

    @Override
    public Optional<StudyMaterial> findById(String id) {
        String sql = "SELECT * FROM study_materials WHERE id = ?";
        List<StudyMaterial> list = jdbcTemplate.query(sql, materialRowMapper, id);
        return list.isEmpty() ? Optional.empty() : Optional.of(list.get(0));
    }

    @Override
    public StudyMaterial save(StudyMaterial material) {
        if (material.getId() == null || material.getId().isBlank()) {
            material.setId(UUID.randomUUID().toString());
        }
        if (material.getCreatedAt() == null) {
            material.setCreatedAt(Instant.now().toString());
        }

        String sql = """
            INSERT INTO study_materials (
                id, concurso_id, disciplina, titulo, autor, formato,
                total_paginas, pagina_atual, url_ou_caminho, notas, created_at
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            ON CONFLICT(id) DO UPDATE SET
                concurso_id = excluded.concurso_id,
                disciplina = excluded.disciplina,
                titulo = excluded.titulo,
                autor = excluded.autor,
                formato = excluded.formato,
                total_paginas = excluded.total_paginas,
                pagina_atual = excluded.pagina_atual,
                url_ou_caminho = excluded.url_ou_caminho,
                notas = excluded.notas
        """;

        jdbcTemplate.update(sql,
                material.getId(),
                material.getConcursoId(),
                material.getDisciplina(),
                material.getTitulo(),
                material.getAutor(),
                material.getFormato(),
                material.getTotalPaginas(),
                material.getPaginaAtual(),
                material.getUrlOuCaminho(),
                material.getNotas(),
                material.getCreatedAt()
        );
        return material;
    }

    @Override
    public void delete(String id) {
        jdbcTemplate.update("DELETE FROM topic_material_links WHERE material_id = ?", id);
        jdbcTemplate.update("DELETE FROM study_materials WHERE id = ?", id);
    }

    @Override
    public List<TopicMaterialLink> findLinksByTopicoId(String topicoId) {
        String sql = """
            SELECT l.*, m.titulo AS material_titulo, m.formato AS material_formato,
                   t.assunto AS topico_assunto, t.disciplina AS disciplina
            FROM topic_material_links l
            JOIN study_materials m ON l.material_id = m.id
            JOIN edital_topicos t ON l.topico_id = t.id
            WHERE l.topico_id = ?
            ORDER BY l.pagina_inicio
        """;
        return jdbcTemplate.query(sql, linkRowMapper, topicoId);
    }

    @Override
    public List<TopicMaterialLink> findLinksByMaterialId(String materialId) {
        String sql = """
            SELECT l.*, m.titulo AS material_titulo, m.formato AS material_formato,
                   t.assunto AS topico_assunto, t.disciplina AS disciplina
            FROM topic_material_links l
            JOIN study_materials m ON l.material_id = m.id
            JOIN edital_topicos t ON l.topico_id = t.id
            WHERE l.material_id = ?
            ORDER BY t.disciplina, t.assunto
        """;
        return jdbcTemplate.query(sql, linkRowMapper, materialId);
    }

    @Override
    public List<TopicMaterialLink> findLinksByConcursoId(String concursoId) {
        String sql = """
            SELECT l.*, m.titulo AS material_titulo, m.formato AS material_formato,
                   t.assunto AS topico_assunto, t.disciplina AS disciplina
            FROM topic_material_links l
            JOIN study_materials m ON l.material_id = m.id
            JOIN edital_topicos t ON l.topico_id = t.id
            WHERE t.concurso_id = ?
            ORDER BY t.disciplina, t.assunto
        """;
        return jdbcTemplate.query(sql, linkRowMapper, concursoId);
    }

    @Override
    public TopicMaterialLink saveLink(TopicMaterialLink link) {
        if (link.getId() == null || link.getId().isBlank()) {
            link.setId(UUID.randomUUID().toString());
        }
        if (link.getCreatedAt() == null) {
            link.setCreatedAt(Instant.now().toString());
        }

        String sql = """
            INSERT INTO topic_material_links (
                id, topico_id, material_id, pagina_inicio, pagina_fim, paginas_lidas, status, anotacoes, created_at
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
            ON CONFLICT(id) DO UPDATE SET
                topico_id = excluded.topico_id,
                material_id = excluded.material_id,
                pagina_inicio = excluded.pagina_inicio,
                pagina_fim = excluded.pagina_fim,
                paginas_lidas = excluded.paginas_lidas,
                status = excluded.status,
                anotacoes = excluded.anotacoes
        """;

        jdbcTemplate.update(sql,
                link.getId(),
                link.getTopicoId(),
                link.getMaterialId(),
                link.getPaginaInicio(),
                link.getPaginaFim(),
                link.getPaginasLidas(),
                link.getStatus(),
                link.getAnotacoes(),
                link.getCreatedAt()
        );
        return link;
    }

    @Override
    public void deleteLink(String id) {
        jdbcTemplate.update("DELETE FROM topic_material_links WHERE id = ?", id);
    }
}
