package com.fiscalstudy.backend.domain;

import java.util.List;
import java.util.Optional;

public interface EditalRepository {
    List<Edital> findEditaisByConcurso(String concursoId);
    Optional<Edital> findEditalById(String id);
    Edital saveEdital(Edital edital);

    List<EditalTopico> findTopicosByConcurso(String concursoId);
    Optional<EditalTopico> findTopicoById(String id);
    EditalTopico saveTopico(EditalTopico topico);
    void deleteTopico(String id);
    void confirmTopico(String id);
}
