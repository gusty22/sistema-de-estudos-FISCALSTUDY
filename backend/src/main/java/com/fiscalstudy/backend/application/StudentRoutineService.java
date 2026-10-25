package com.fiscalstudy.backend.application;

import com.fiscalstudy.backend.domain.*;
import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.springframework.stereotype.Service;

import java.time.DayOfWeek;
import java.time.Instant;
import java.time.LocalDate;
import java.util.*;

@Service
public class StudentRoutineService {

    private final StudentRoutineRepository routineRepository;
    private final EditalRepository editalRepository;
    private final ObjectMapper objectMapper;

    public StudentRoutineService(StudentRoutineRepository routineRepository,
                                 EditalRepository editalRepository,
                                 ObjectMapper objectMapper) {
        this.routineRepository = routineRepository;
        this.editalRepository = editalRepository;
        this.objectMapper = objectMapper;
    }

    public StudentRoutine getRoutineForConcurso(String concursoId) {
        String effectiveConcursoId = (concursoId != null && !concursoId.isBlank() && !"undefined".equalsIgnoreCase(concursoId) && !"null".equalsIgnoreCase(concursoId))
                ? concursoId.trim()
                : null;
        Optional<StudentRoutine> existing = routineRepository.findByConcursoId(effectiveConcursoId);

        if (existing.isPresent()) {
            StudentRoutine routine = existing.get();
            if (routine.getCicloDisciplinasJson() == null || routine.getCicloDisciplinasJson().isBlank() || routine.getCicloDisciplinasJson().trim().equals("[]")) {
                List<Map<String, Object>> ciclo = generateCycleFromEdital(routine.getConcursoId(), routine.getTotalHorasSemanais());
                if (!ciclo.isEmpty()) {
                    try {
                        routine.setCicloDisciplinasJson(objectMapper.writeValueAsString(ciclo));
                        routine = routineRepository.save(routine);
                    } catch (Exception ignored) {}
                }
            }
            return routine;
        }

        // Gera rotina padrão com 24h semanais distribuídas
        String routineConcursoId = effectiveConcursoId != null ? effectiveConcursoId : "default";
        StudentRoutine defaultRoutine = new StudentRoutine(
                UUID.randomUUID().toString(),
                routineConcursoId,
                "SEMANAL",
                3.0, 3.0, 3.0, 3.0, 3.0, 5.0, 4.0,
                null,
                null
        );

        // Gera ciclo inicial proporcional baseado nas matérias do edital
        List<Map<String, Object>> ciclo = generateCycleFromEdital(effectiveConcursoId, defaultRoutine.getTotalHorasSemanais());
        try {
            defaultRoutine.setCicloDisciplinasJson(objectMapper.writeValueAsString(ciclo));
        } catch (Exception ignored) {}

        return routineRepository.save(defaultRoutine);
    }

    public StudentRoutine saveRoutine(StudentRoutine routine) {
        if (routine.getCicloDisciplinasJson() == null || routine.getCicloDisciplinasJson().isBlank() || routine.getCicloDisciplinasJson().trim().equals("[]")) {
            List<Map<String, Object>> ciclo = generateCycleFromEdital(routine.getConcursoId(), routine.getTotalHorasSemanais());
            try {
                routine.setCicloDisciplinasJson(objectMapper.writeValueAsString(ciclo));
            } catch (Exception ignored) {}
        }
        return routineRepository.save(routine);
    }

    public List<Map<String, Object>> generateCycleFromEdital(String concursoId, double totalHorasSemana) {
        List<EditalTopico> topicos = editalRepository.findTopicosByConcurso(concursoId);
        if (topicos.isEmpty()) {
            return Collections.emptyList();
        }

        // Agrupa tópicos por disciplina e soma os pesos
        Map<String, Double> pesosPorDisciplina = new LinkedHashMap<>();
        Map<String, Integer> topicosPorDisciplina = new LinkedHashMap<>();
        double somaPesosTotal = 0.0;

        for (EditalTopico t : topicos) {
            String disc = t.getDisciplina();
            double peso = t.getPeso() > 0 ? t.getPeso() : 1.0;
            pesosPorDisciplina.put(disc, pesosPorDisciplina.getOrDefault(disc, 0.0) + peso);
            topicosPorDisciplina.put(disc, topicosPorDisciplina.getOrDefault(disc, 0) + 1);
            somaPesosTotal += peso;
        }

        if (somaPesosTotal <= 0) somaPesosTotal = 1.0;
        if (!Double.isFinite(totalHorasSemana) || totalHorasSemana <= 0) return Collections.emptyList();

        List<Map<String, Object>> ciclo = new ArrayList<>();
        int index = 0;
        for (Map.Entry<String, Double> entry : pesosPorDisciplina.entrySet()) {
            String disc = entry.getKey();
            double pesoDisc = entry.getValue();
            double proporcao = pesoDisc / somaPesosTotal;
            double horasSugeridas = Math.floor(proporcao * totalHorasSemana * 60.0) / 60.0; // múltiplos de 30min

            Map<String, Object> item = new LinkedHashMap<>();
            item.put("ordem", index + 1);
            item.put("disciplina", disc);
            item.put("peso", Math.round(pesoDisc * 10.0) / 10.0);
            item.put("totalTopicos", topicosPorDisciplina.getOrDefault(disc, 0));
            item.put("horasSugeridas", horasSugeridas);
            item.put("blocoMinutos", (int) (horasSugeridas * 60));
            ciclo.add(item);
            index++;
        }
        return ciclo;
    }

    public double getEffectiveHoursForDate(String concursoId, LocalDate date) {
        StudentRoutine routine = getRoutineForConcurso(concursoId);
        DayOfWeek dow = date.getDayOfWeek();
        double baseHours = switch (dow) {
            case MONDAY -> routine.getHorasSegunda();
            case TUESDAY -> routine.getHorasTerca();
            case WEDNESDAY -> routine.getHorasQuarta();
            case THURSDAY -> routine.getHorasQuinta();
            case FRIDAY -> routine.getHorasSexta();
            case SATURDAY -> routine.getHorasSabado();
            case SUNDAY -> routine.getHorasDomingo();
        };

        // Aplica exceções para a data específica
        String dataStr = date.toString();
        List<RoutineException> exceptions = routineRepository.findAllExceptions();
        for (RoutineException ex : exceptions) {
            if (dataStr.equals(ex.getData())) {
                if ("INDISPONIBILIDADE".equalsIgnoreCase(ex.getTipo())) {
                    baseHours = Math.max(0, baseHours - ex.getHoras());
                } else if ("TEMPO_EXTRA".equalsIgnoreCase(ex.getTipo())) {
                    baseHours += ex.getHoras();
                }
            }
        }
        return Math.round(baseHours * 10.0) / 10.0;
    }

    public int getEffectiveMinutesForToday(String concursoId) {
        double hours = getEffectiveHoursForDate(concursoId, LocalDate.now());
        return (int) Math.round(hours * 60);
    }

    public List<RoutineCommitment> getAllCommitments() {
        return routineRepository.findAllCommitments();
    }

    public RoutineCommitment saveCommitment(RoutineCommitment commitment) {
        return routineRepository.saveCommitment(commitment);
    }

    public void deleteCommitment(String id) {
        routineRepository.deleteCommitment(id);
    }

    public List<RoutineException> getAllExceptions() {
        return routineRepository.findAllExceptions();
    }

    public RoutineException saveException(RoutineException exception) {
        return routineRepository.saveException(exception);
    }

    public void deleteException(String id) {
        routineRepository.deleteException(id);
    }

    public Map<String, Object> importRoutineFromJson(String concursoId, Map<String, Object> payload) {
        if (concursoId == null || concursoId.isBlank()) {
            concursoId = (String) payload.getOrDefault("concursoId", "");
        }

        StudentRoutine routine = getRoutineForConcurso(concursoId);

        // Extrai horas por dia
        Object horasObj = payload.get("horasSemana");
        if (horasObj instanceof Map<?, ?> hMap) {
            if (hMap.containsKey("segunda")) routine.setHorasSegunda(toDouble(hMap.get("segunda")));
            if (hMap.containsKey("terca")) routine.setHorasTerca(toDouble(hMap.get("terca")));
            if (hMap.containsKey("quarta")) routine.setHorasQuarta(toDouble(hMap.get("quarta")));
            if (hMap.containsKey("quinta")) routine.setHorasQuinta(toDouble(hMap.get("quinta")));
            if (hMap.containsKey("sexta")) routine.setHorasSexta(toDouble(hMap.get("sexta")));
            if (hMap.containsKey("sabado")) routine.setHorasSabado(toDouble(hMap.get("sabado")));
            if (hMap.containsKey("domingo")) routine.setHorasDomingo(toDouble(hMap.get("domingo")));
        }

        String modo = (String) payload.get("modoPlanejamento");
        if (modo != null && !modo.isBlank()) {
            routine.setModoPlanejamento(modo.toUpperCase());
        }

        // Regenera ciclo proporcional
        List<Map<String, Object>> ciclo = generateCycleFromEdital(concursoId, routine.getTotalHorasSemanais());
        try {
            routine.setCicloDisciplinasJson(objectMapper.writeValueAsString(ciclo));
        } catch (Exception ignored) {}

        StudentRoutine saved = routineRepository.save(routine);

        // Processa compromissos
        int commitmentsCreated = 0;
        Object commitsObj = payload.get("compromissos");
        if (commitsObj instanceof List<?> list) {
            String nowIso = Instant.now().toString();
            for (Object item : list) {
                if (item instanceof Map<?, ?> cMap) {
                    Object tituloObj = cMap.get("titulo");
                    Object diaObj = cMap.get("diaSemana");
                    Object hIniObj = cMap.get("horaInicio");
                    Object hFimObj = cMap.get("horaFim");
                    Object tipoObj = cMap.get("tipo");

                    String titulo = tituloObj != null ? tituloObj.toString() : null;
                    String dia = diaObj != null ? diaObj.toString() : null;
                    String hIni = hIniObj != null ? hIniObj.toString() : "08:00";
                    String hFim = hFimObj != null ? hFimObj.toString() : "17:00";
                    String tipo = tipoObj != null ? tipoObj.toString() : "OUTRO";

                    if (titulo != null && !titulo.isBlank() && dia != null) {
                        RoutineCommitment comm = new RoutineCommitment(
                                UUID.randomUUID().toString(),
                                titulo.trim(),
                                dia.toUpperCase().trim(),
                                hIni.trim(),
                                hFim.trim(),
                                tipo.toUpperCase().trim(),
                                nowIso
                        );
                        routineRepository.saveCommitment(comm);
                        commitmentsCreated++;
                    }
                }
            }
        }

        Map<String, Object> resp = new HashMap<>();
        resp.put("status", "SUCCESS");
        resp.put("message", "Rotina e compromissos importados com sucesso a partir do JSON estruturado!");
        resp.put("routine", saved);
        resp.put("commitmentsCount", commitmentsCreated);
        resp.put("totalHorasSemanais", saved.getTotalHorasSemanais());
        return resp;
    }

    private double toDouble(Object val) {
        if (val instanceof Number n) return n.doubleValue();
        if (val != null) {
            try { return Double.parseDouble(val.toString().replace(',', '.')); } catch (Exception ignored) {}
        }
        return 0.0;
    }
}
