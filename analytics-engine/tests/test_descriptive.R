# tests/test_descriptive.R
# Testes Unitários de Estatística Descritiva e Calibração

# 1. Testes do Intervalo de Wilson
ci_zero <- calculate_wilson_ci(0, 10, 0.95)
assert_equal(unname(ci_zero["lower"]), 0.0, "Wilson CI lower bound com 0 acertos e 0.0")
assert_true(ci_zero["upper"] > 0 && ci_zero["upper"] < 0.35, "Wilson CI upper bound com 0 acertos e plausivel")

ci_full <- calculate_wilson_ci(10, 10, 0.95)
assert_equal(unname(ci_full["upper"]), 1.0, "Wilson CI upper bound com 10/10 acertos e 1.0")

ci_invalid <- calculate_wilson_ci(5, 0, 0.95)
assert_true(is.na(ci_invalid["lower"]), "Wilson CI com N=0 retorna NA")

# 2. Desempenho Global (Overall)
empty_perf <- calculate_performance_overall(data.frame())
assert_equal(empty_perf$n_attempts, 0, "Dataframe vazio resulta em 0 tentativas")
assert_true(is.na(empty_perf$accuracy), "Dataframe vazio tem accuracy NA")

evt_df <- utils::read.csv("tests/fixtures/valid_events.csv", stringsAsFactors = FALSE)
q_df <- utils::read.csv("tests/fixtures/valid_questions.csv", stringsAsFactors = FALSE)
attempts_df <- evt_df[evt_df$event_type == "ANSWER_SUBMITTED", ]

perf_res <- calculate_performance_overall(attempts_df)
# Na fixture valid_events:
# evt-02: TRUE, evt-03: FALSE, evt-04: TRUE, evt-05: TRUE, evt-06: FALSE, evt-07: TRUE, evt-08: FALSE, evt-09: TRUE
# evt-12: TRUE, evt-13: TRUE, evt-14: TRUE, evt-15: TRUE
# Total tentativas: 12. Acertos: 9 (75%), Erros: 3.
assert_equal(perf_res$n_attempts, 12, "Total de 12 tentativas validas identificadas")
assert_equal(perf_res$n_correct, 9, "Total de 9 acertos identificados")
assert_equal(perf_res$n_incorrect, 3, "Total de 3 erros identificados")
assert_equal(perf_res$accuracy, 0.75, "Taxa de acerto global e exatamente 75.0%")
assert_true(grepl("9 acertos em 12 tentativas", perf_res$denominator_text), "Denominador formatado corretamente no texto")

# 3. Desempenho por Disciplina
disc_perf <- calculate_performance_by_discipline(attempts_df, q_df)
assert_true(nrow(disc_perf) > 0, "Calculou desempenho para as disciplinas do catalogo")
assert_true("Direito Tributario" %in% disc_perf$disciplina, "Direito Tributario presente nas disciplinas analisadas")
dt_sub <- disc_perf[disc_perf$disciplina == "Direito Tributario", ]
# q001 (evt-02, TRUE), q002 (evt-03, FALSE; evt-12, TRUE) -> 3 tentativas, 2 acertos
assert_equal(dt_sub$n_attempts, 3, "Direito Tributario possui 3 tentativas")
assert_equal(dt_sub$n_correct, 2, "Direito Tributario possui 2 acertos")

# 4. Métricas de Tempo
time_res <- calculate_time_metrics(attempts_df)
assert_equal(time_res$n_valid_times, 12, "12 tempos validos analisados")
assert_true(time_res$median_sec > 0, "Mediana de tempo e positiva")
assert_true(time_res$iqr_sec >= 0, "IQR de tempo e nao-negativo")
assert_equal(time_res$min_sec, 35.0, "Menor tempo registrado e 35 segundos (35000 ms)")

# Teste com tempos negativos isolados
bad_time_df <- data.frame(active_time_ms = c(-1000, 20000, 30000))
bad_time_res <- calculate_time_metrics(bad_time_df)
assert_equal(bad_time_res$n_valid_times, 2, "Ignora tempos negativos na agregacao descritiva sem lancar excecao")

# 5. Confiança e Calibração
conf_res <- calculate_confidence_metrics(attempts_df)
assert_equal(conf_res$n_observations, 12, "12 observacoes com confianca valida")
# Overconfidence: Erro com confianca 5 -> evt-03 (q002, FALSE, conf 5)
assert_equal(conf_res$overconfidence_count, 1, "Detectou exatamente 1 caso de superconfianca maxima (erro com conf 5)")
# Underconfidence: Acerto com confianca 1 ou 2 -> Nenhum (acertos foram em conf 3, 4, 5)
assert_equal(conf_res$underconfidence_count, 0, "Detectou 0 casos de subconfianca na fixture")
# Brier Score e ECE devem ser estritamente numericos e finitos
assert_true(!is.na(conf_res$brier_score) && conf_res$brier_score >= 0 && conf_res$brier_score <= 1, "Brier score e valido entre [0, 1]")
assert_true(!is.na(conf_res$ece) && conf_res$ece >= 0 && conf_res$ece <= 1, "ECE e valido entre [0, 1]")

# 6. Evolução Temporal
temp_res <- calculate_temporal_evolution(attempts_df)
assert_equal(nrow(temp_res), 2, "Identificou 2 sessoes distintas na fixture valida")
assert_true(all(temp_res$low_sample_flag == TRUE), "Sessoes com N < 10 foram assinaladas com flag de amostra baixa")

# 7. Desempenho por Tópico (calculate_performance_by_topic)
empty_topic_res <- calculate_performance_by_topic(data.frame(), q_df)
assert_equal(nrow(empty_topic_res), 0, "Topico com tentativas vazias retorna dataframe vazio")

no_q_topic_res <- calculate_performance_by_topic(attempts_df, data.frame())
assert_equal(nrow(no_q_topic_res), 0, "Topico sem catalogo de questoes retorna dataframe vazio")

topic_res <- calculate_performance_by_topic(attempts_df, q_df)
assert_true(nrow(topic_res) > 0, "Calculou desempenho para topicos do catalogo")
assert_true("assunto" %in% names(topic_res), "Coluna assunto presente no resultado")
assert_true("Obrigacao Tributaria" %in% topic_res$assunto, "Topico Obrigacao Tributaria presente")
obrig_sub <- topic_res[topic_res$assunto == "Obrigacao Tributaria", ]
assert_equal(obrig_sub$n_attempts, 2, "Obrigacao Tributaria possui 2 tentativas (q002 em sess-1 e sess-2)")
assert_equal(obrig_sub$n_correct, 1, "Obrigacao Tributaria possui 1 acerto (evt-03 errou, evt-12 acertou)")
assert_equal(obrig_sub$accuracy, 0.5, "Taxa de acerto em Obrigacao Tributaria e 50.0%")
assert_true(obrig_sub$low_sample_flag, "Topico com N=2 sinalizado com low_sample_flag")

# 8. Comparação de Períodos (compare_performance_periods)
empty_comp <- compare_performance_periods(data.frame(), c("2026-10-10", "2026-10-11"), c("2026-10-11", "2026-10-12"))
assert_true(is.na(empty_comp$delta_accuracy), "Comparacao em dataframe vazio retorna delta NA")

# Comparação real Sessão 1 vs Sessão 2
comp_real <- compare_performance_periods(
  attempts_df,
  period1_range = c("2026-10-10T10:00:00Z", "2026-10-10T10:12:00Z"),
  period2_range = c("2026-10-11T14:00:00Z", "2026-10-11T14:08:00Z"),
  period1_label = "Sessao 1",
  period2_label = "Sessao 2"
)
assert_equal(comp_real$period1$n_attempts, 8, "Sessao 1 contem 8 tentativas")
assert_equal(comp_real$period1$n_correct, 5, "Sessao 1 contem 5 acertos")
assert_equal(comp_real$period1$accuracy, 0.625, "Sessao 1 taxa de acerto e 62.5%")
assert_equal(comp_real$period2$n_attempts, 4, "Sessao 2 contem 4 tentativas")
assert_equal(comp_real$period2$n_correct, 4, "Sessao 2 contem 4 acertos")
assert_equal(comp_real$period2$accuracy, 1.0, "Sessao 2 taxa de acerto e 100.0%")
assert_equal(comp_real$delta_accuracy, 0.375, "Delta de acuracia e +37.5%")
assert_true(!is.na(comp_real$p_value), "Valor de p calculado via Fisher/prop.test")
assert_true(comp_real$sample_disparity_flag, "Flag de disparidade amostral ativada devido a N1=8 e N2=4")
assert_true(length(comp_real$methodological_cautions) >= 2, "Advertencias metodologicas retornadas explicitamente")



# Absolute timestamp contract for predictive and followup evidence.
parsed_instants <- parse_evidence_timestamp(c(
  "2026-10-11T12:00:00Z", "2026-10-11T09:00:00-03:00", "2026-10-11T140000+0200",
  "2026-10-11 12:00:00", "2026-02-30T12:00:00Z", "2026-10-11T12:00:00Ztrailing",
  "2026-10-11T12:00:00+25:00", NA_character_
))
assert_equal(as.numeric(parsed_instants[1]), as.numeric(parsed_instants[2]),
             "Explicit offset and UTC are the same instant")
assert_true(all(is.na(parsed_instants[3:8])),
            "Malformed, naive, impossible and missing timestamps remain unavailable")
fractional <- parse_evidence_timestamp(c("2026-10-11T12:00:00.250Z", "2026-10-11T14:00:00.250+0200"))
assert_equal(as.numeric(fractional[1]), as.numeric(fractional[2]), "Fractions survive explicit-offset conversion")
assert_true(is.na(parse_evidence_timestamp("2026-10-11T12:60:00Z")), "Invalid clock minute is rejected")


# Ordinal confidence is an observation, not a measured continuous probability.
confidence_contract <- data.frame(
  confidence_level=c("5","3","1","4.9","6","NA",NA,"5"),
  is_correct=c("false","true","1","true","true","false","true","false"),
  gabarito_status=c(rep("DEFINITIVO",7),"ANULADA"),stringsAsFactors=FALSE)
ordinal <- calculate_confidence_metrics(confidence_contract)
assert_equal(ordinal$n_observations,3L,"Only exact ordinal levels and evaluable outcomes enter confidence metrics")
assert_equal(ordinal$n_level5,1L,"Maximum-confidence denominator is its own observed subset")
assert_equal(ordinal$n_low_confidence,1L,"Low-confidence denominator is its own observed subset")
assert_equal(ordinal$n_excluded_observations,5L,"Invalid ordinal evidence is counted, not silently truncated")
assert_equal(ordinal$overconfidence_rate_in_level5,1,"Conditional high-confidence error rate uses 1/1")
assert_equal(ordinal$underconfidence_rate_in_low_conf,1,"Conditional low-confidence success rate uses 1/1")
assert_equal(ordinal$brier_score,.6,"Mapped Brier matches the independent three-observation vector")
assert_equal(ordinal$ece,.7333,"Mapped ECE uses unrounded empirical bin proportions")
assert_false(ordinal$probability_mapping_validated,"An assumed mapping never claims validated subjective probabilities")
assert_equal(ordinal$confidence_timing_status,"NOT_ESTABLISHED","Missing pre-feedback timing is not reconstructed")
no_extremes <- calculate_confidence_metrics(data.frame(confidence_level=3,is_correct=TRUE))
assert_true(is.na(no_extremes$overconfidence_rate_in_level5),"Absent level five is unknown rate, not zero")
assert_true(is.na(no_extremes$underconfidence_rate_in_low_conf),"Absent low-confidence group is unknown rate")
none_valid <- calculate_confidence_metrics(data.frame(confidence_level=4.9,is_correct=TRUE))
assert_equal(none_valid$n_observations,0L,"Fractional ordinal level is excluded")
assert_true(is.na(none_valid$brier_score),"No valid ordinal evidence produces no Brier score")
assert_true(all(c("overconfidence_rate_in_level5","underconfidence_rate_in_low_conf","conversion_hypothesis") %in% names(none_valid)),
            "Empty confidence result preserves the result contract")
alternative <- setNames(c(.1,.3,.5,.7,.9),as.character(1:5))
mapped <- calculate_confidence_metrics(confidence_contract,prob_mapping=alternative)
assert_true(mapped$brier_score!=ordinal$brier_score,"Mapped scores are explicitly sensitive to the assumed mapping")
bad_mappings <- list(rep(.5,5),setNames(c(.2,.4,.6,.8,1.2),as.character(1:5)),
  setNames(c(.2,.4,NA,.8,1),as.character(1:5)),setNames(c(.9,.8,.7,.6,.5),as.character(1:5)),
  setNames(rep(.5,4),as.character(1:4)))
for (mapping in bad_mappings) {
  rejected <- tryCatch({calculate_confidence_metrics(confidence_contract,prob_mapping=mapping);FALSE},error=function(e)TRUE)
  assert_true(rejected,"Malformed probability mapping fails explicitly rather than reverting or emitting NA scores")
}
