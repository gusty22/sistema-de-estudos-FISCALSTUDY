package com.fiscalstudy.backend.application;

import com.fiscalstudy.backend.domain.*;
import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.springframework.stereotype.Service;

import java.time.DayOfWeek;
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
        Optional<StudentRoutine> existing = routineRepository.findByConcursoId(concursoId);
        if (existing.isPresent()) {
            return existing.get();
        }

        // Gera rotina padrão com 24h semanais distribuídas
        StudentRoutine defaultRoutine = new StudentRoutine(
                UUID.randomUUID().toString(),
                concursoId,
                "SEMANAL",
                3.0, 3.0, 3.0, 3.0, 3.0, 5.0, 4.0,
                null,
                null
        );

        // Gera ciclo inicial proporcional baseado nas matérias do edital
        List<Map<String, Object>> ciclo = generateCycleFromEdital(concursoId, defaultRoutine.getTotalHorasSemanais());
        try {
            defaultRoutine.setCicloDisciplinasJson(objectMapper.writeValueAsString(ciclo));
        } catch (Exception ignored) {}

        return routineRepository.save(defaultRoutine);
    }

    public StudentRoutine saveRoutine(StudentRoutine routine) {
        if (routine.getCicloDisciplinasJson() == null || routine.getCicloDisciplinasJson().isBlank()) {
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
        if (totalHorasSemana <= 0) totalHorasSemana = 24.0;

        List<Map<String, Object>> ciclo = new ArrayList<>();
        int index = 0;
        for (Map.Entry<String, Double> entry : pesosPorDisciplina.entrySet()) {
            String disc = entry.getKey();
            double pesoDisc = entry.getValue();
            double proporcao = pesoDisc / somaPesosTotal;
            double horasSugeridas = Math.max(1.0, Math.round(proporcao * totalHorasSemana * 2.0) / 2.0); // múltiplos de 30min

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
}
