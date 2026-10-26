# R/analytical_signals.R
# Módulo de Detecção de Sinais Analíticos Observáveis
# Projeto: FiscalStudy Analytics (R >= 4.0.0)

#' Cria Objeto Estruturado de Sinal Analítico
#' @param signal_id Identificador único do sinal
#' @param signal_type Categoria analítica do sinal
#' @param description Descrição clara e contextualizada
#' @param evidence_summary Resumo das evidências com denominadores estritos
#' @param n_observations Quantidade exata de observações associadas
#' @param period_start Timestamp de início do intervalo analisado
#' @param period_end Timestamp de término do intervalo analisado
#' @param applied_criterion Critério formal aplicado com thresholds
#' @param is_heuristic Indicador booleano se o critério é heurístico e provisório
#' @param limitations Limitações e advertências metodológicas
#' @param method_version Versão do método analítico
#' @return Lista nomeada em conformidade com o contrato de sinais
build_signal_record <- function(signal_id, signal_type, description,
                                evidence_summary, n_observations,
                                period_start = NA_character_, period_end = NA_character_,
                                applied_criterion, is_heuristic = TRUE,
                                limitations = character(0),
                                method_version = "v1.0.0") {
  list(
    signal_id = as.character(signal_id),
    signal_type = as.character(signal_type),
    description = as.character(description),
    evidence_summary = as.character(evidence_summary),
    n_observations = as.integer(n_observations),
    period_start = as.character(period_start),
    period_end = as.character(period_end),
    applied_criterion = as.character(applied_criterion),
    is_heuristic = as.logical(is_heuristic),
    limitations = as.list(limitations),
    method_version = as.character(method_version)
  )
}

#' Detecta Sinais Analíticos a partir do Perfil e Tentativas
#' @param profile Lista estruturada gerada por build_learning_profile
#' @param attempts_df data.frame de tentativas de resolução
#' @param questions_df data.frame do catálogo de questões
#' @param config Lista de parâmetros configuráveis e provisórios
#' @return Lista com contagem de sinais detectados e lista de sinais individuais
detect_analytical_signals <- function(profile, attempts_df = NULL, questions_df = NULL, config = list()) {
  # Configurações provisórias com valores de referência default
  cfg <- list(
    min_recurrent_errors = if (!is.null(config$min_recurrent_errors)) config$min_recurrent_errors else 2L,
    overconfidence_level = if (!is.null(config$overconfidence_level)) config$overconfidence_level else 5L,
    sub_second_ms = if (!is.null(config$sub_second_ms)) config$sub_second_ms else 1000.0,
    session_volatility_delta = if (!is.null(config$session_volatility_delta)) config$session_volatility_delta else 0.25,
    low_evidence_n = if (!is.null(config$low_evidence_n)) config$low_evidence_n else 10L,
    repetition_ratio_threshold = if (!is.null(config$repetition_ratio_threshold)) config$repetition_ratio_threshold else 0.50
  )
  
  signals <- list()
  
  if (is.null(profile) || profile$data_quality$valid_attempts == 0) {
    # Sinal de ausência geral de dados
    signals[[length(signals) + 1]] <- build_signal_record(
      signal_id = "SIG_NO_VALID_DATA",
      signal_type = "DATA_ABSENCE",
      description = "Nenhuma tentativa valida de resolucao de questoes encontrada no conjunto de dados.",
      evidence_summary = "0 tentativas validas registradas (N = 0).",
      n_observations = 0L,
      period_start = NA_character_,
      period_end = NA_character_,
      applied_criterion = "valid_attempts == 0",
      is_heuristic = FALSE,
      limitations = c("Impossivel emitir qualquer inferencia sobre proficiencia ou retencao."),
      method_version = "v1.0.0-null_detector"
    )
    return(list(
      signals_count = length(signals),
      signals = signals,
      config_used = cfg
    ))
  }
  
  p_start <- profile$period$start
  p_end   <- profile$period$end
  
  # 1. Sinal: Erros Recorrentes por Questão Específica
  if (!is.null(profile$error_patterns$recurrent_error_questions) &&
      length(profile$error_patterns$recurrent_error_questions) > 0) {
    for (qid in profile$error_patterns$recurrent_error_questions) {
      q_sub <- if (!is.null(attempts_df)) attempts_df[attempts_df$question_id == qid, ] else NULL
      # A profile label cannot manufacture two error observations when rows are absent.
      if (is.null(q_sub) || nrow(q_sub) == 0L || !"is_correct" %in% names(q_sub)) next
      q_sub <- q_sub[!is.na(q_sub$is_correct), , drop = FALSE]
      n_q <- nrow(q_sub)
      if (n_q == 0L) next
      k_q <- sum(q_sub$is_correct == TRUE)
      err_q <- n_q - k_q
      
      if (err_q >= cfg$min_recurrent_errors) {
        signals[[length(signals) + 1]] <- build_signal_record(
          signal_id = paste0("SIG_RECURRENT_ERROR_Q_", qid),
          signal_type = "RECURRENT_ERROR",
          description = sprintf("Questao %s apresenta multiplos erros em tentativas repetidas.", qid),
          evidence_summary = sprintf("%d erro(s) em %d tentativa(s) na questao %s (taxa de erro = %.1f%%).",
                                     err_q, n_q, qid, (err_q / n_q) * 100),
          n_observations = n_q,
          period_start = p_start,
          period_end = p_end,
          applied_criterion = sprintf("Erros na mesma questao >= %d (provisorio/configuravel).", cfg$min_recurrent_errors),
          is_heuristic = TRUE,
          limitations = c(
            "Pode decorrer de ambiguidade no enunciado, pegadinha especifica de banca examinadora ou conceito ainda nao compreendido.",
            "Nao indica incapacidade cognitiva geral do estudante."
          ),
          method_version = "v1.0.0-recurrent_item_error"
        )
      }
    }
  }
  
  # 2. Sinal: Superconfiança com Erro (Desacordo Metrológico entre Certeza e Gabarito)
  if (!is.null(profile$metacognition$overconfidence_count) &&
      profile$metacognition$overconfidence_count > 0) {
    signals[[length(signals) + 1]] <- build_signal_record(
      signal_id = "SIG_OVERCONFIDENCE_ERROR",
      signal_type = "HIGH_CONFIDENCE_ERROR",
      description = "Ocorrencia observavel de resposta incorreta acompanhada do nivel maximo de confianca declarada (nivel 5).",
      evidence_summary = sprintf("%d erro(s) em questoes respondidas com certeza absoluta declarada (nivel 5). Taxa no nivel 5: %.1f%%.",
                                 profile$metacognition$overconfidence_count,
                                 profile$metacognition$overconfidence_rate_level5 * 100),
      n_observations = profile$metacognition$n_observations,
      period_start = p_start,
      period_end = p_end,
      applied_criterion = sprintf("is_correct == FALSE && confidence_level == %d", cfg$overconfidence_level),
      is_heuristic = FALSE,
      limitations = c(
        "Foco estrito em metrologia educacional: desacordo observavel entre certeza subjetiva maxima e gabarito.",
        "Registra somente a combinacao observada de resposta incorreta e confianca maxima; a causa do desacordo e desconhecida e nao e atribuida a um conceito ou perfil."
      ),
      method_version = "v1.0.0-overconfidence_flag"
    )
  }
  
  # 3. Sinal: Subconfiança Observada (Acertos em Nível Baixo de Confiança Declarada)
  if (!is.null(profile$metacognition$underconfidence_count) &&
      profile$metacognition$underconfidence_count >= 3) {
    signals[[length(signals) + 1]] <- build_signal_record(
      signal_id = "SIG_UNDERCONFIDENCE_HESITATION",
      signal_type = "UNDERCONFIDENCE",
      description = "Acertos recorrentes acompanhados de nivel baixo de confianca declarada (niveis 1 e 2).",
      evidence_summary = sprintf("%d acerto(s) com confianca baixa (niveis 1 ou 2). Taxa nessa faixa: %.1f%%.",
                                 profile$metacognition$underconfidence_count,
                                 profile$metacognition$underconfidence_rate_low * 100),
      n_observations = profile$metacognition$n_observations,
      period_start = p_start,
      period_end = p_end,
      applied_criterion = "is_correct == TRUE && confidence_level in c(1, 2) com contagem >= 3",
      is_heuristic = TRUE,
      limitations = c(
        "Pode refletir chute informado, eliminacao parcial de alternativas ou conhecimento intuitivo implicito.",
        "Nao autoriza diagnostico psicologico de hesitacao ou inseguranca cronica."
      ),
      method_version = "v1.0.0-underconfidence_flag"
    )
  }
  
  # 4. Sinal: Duracao Observada Sub-segundo
  if (!is.null(profile$fluency$sub_second_count) &&
      profile$fluency$sub_second_count > 0) {
    signals[[length(signals) + 1]] <- build_signal_record(
      signal_id = "SIG_TIME_ANOMALY_SUB_SECOND",
      signal_type = "RESPONSE_TIME_ANOMALY",
      description = "Registro de tempo ativo de tela inferior a 1 segundo em resolucoes de questoes.",
      evidence_summary = sprintf("%d tentativa(s) com tempo ativo < 1.000 ms.", profile$fluency$sub_second_count),
      n_observations = profile$fluency$n_valid_times,
      period_start = p_start,
      period_end = p_end,
      applied_criterion = sprintf("active_time_ms < %.0f ms", cfg$sub_second_ms),
      is_heuristic = TRUE,
      limitations = c(
        "O tempo registrado e inferior a um segundo; isso pode refletir temporizacao incompleta, interrupcao, clique acidental ou outra condicao nao observada.",
        "A causa nao pode ser inferida somente do tempo registrado e deve ser confirmada antes de excluir a tentativa da analise."
      ),
      method_version = "v1.0.0-subsecond_filter"
    )
  }
  
  # 5. Sinal: Tempos Discrepantes Superiores (Bloqueio ou Interrupção - Tukey Outliers)
  if (!is.null(profile$fluency$outliers_detected) &&
      profile$fluency$outliers_detected > 0) {
    signals[[length(signals) + 1]] <- build_signal_record(
      signal_id = "SIG_TIME_ANOMALY_HIGH_OUTLIER",
      signal_type = "RESPONSE_TIME_ANOMALY",
      description = "Tempos de resolucao anomalamente extensos detectados pela barreira superior de Tukey (Q3 + 1.5 * IQR).",
      evidence_summary = sprintf("%d tentativa(s) excederam o limiar de %.1f segundos (Q3 + 1.5*IQR).",
                                 profile$fluency$outliers_detected,
                                 profile$fluency$outlier_cutoff_high_sec),
      n_observations = profile$fluency$n_valid_times,
      period_start = p_start,
      period_end = p_end,
      applied_criterion = "active_time_sec > Q3 + 1.5 * IQR",
      is_heuristic = TRUE,
      limitations = c(
        "Pode refletir questao de calculo extremamente laboriosa ou interrupcao externa/pausa do estudante na tela."
      ),
      method_version = "v1.0.0-tukey_outlier_filter"
    )
  }
  
  # 6. Sinal: Tópicos com Evidência Insuficiente
  if (!is.null(profile$mastery_by_topic) && nrow(profile$mastery_by_topic) > 0) {
    low_topics <- profile$mastery_by_topic[profile$mastery_by_topic$evidence_level %in% c("LOW_EVIDENCE", "NO_DATA"), ]
    if (nrow(low_topics) > 0) {
      for (i in seq_len(nrow(low_topics))) {
        t_name <- low_topics$assunto[i]
        d_name <- low_topics$disciplina[i]
        n_t <- low_topics$n_attempts[i]
        lvl <- low_topics$evidence_level[i]
        
        signals[[length(signals) + 1]] <- build_signal_record(
          signal_id = paste0("SIG_INSUFFICIENT_EVIDENCE_", gsub("[^A-Za-z0-9]", "_", paste(d_name, t_name, sep = "_"))),
          signal_type = "INSUFFICIENT_EVIDENCE",
          description = sprintf("Topico '%s' (%s) possui volume amostral insuficiente para avaliacao estatistica de dominio.", t_name, d_name),
          evidence_summary = sprintf("N = %d tentativa(s) registradas. Classificacao: %s.", n_t, lvl),
          n_observations = n_t,
          period_start = p_start,
          period_end = p_end,
          applied_criterion = sprintf("n_attempts < %d observacoes (provisorio/configuravel)", cfg$low_evidence_n),
          is_heuristic = TRUE,
          limitations = c(
            "Ausencia de dados NAO deve ser interpretada como baixo desempenho ou desconhecimento do tema.",
            "Requer exposicao a questoes do topico antes de qualquer conclusao pedagógica."
          ),
          method_version = "v1.0.0-topic_evidence_filter"
        )
      }
    }
  }
  
  # 7. Sinal: Elevada Concentração em Repetição do Mesmo Item
  if (!is.null(profile$transfer_exposure$novel_vs_repeat_ratio) &&
      !is.na(profile$transfer_exposure$novel_vs_repeat_ratio)) {
    rep_ratio <- 1 - profile$transfer_exposure$novel_vs_repeat_ratio
    if (rep_ratio >= cfg$repetition_ratio_threshold && profile$transfer_exposure$repeated_attempts_count >= 3) {
      signals[[length(signals) + 1]] <- build_signal_record(
        signal_id = "SIG_HIGH_ITEM_REPETITION_DEPENDENCE",
        signal_type = "ITEM_REPETITION_CONCENTRATION",
        description = "Proporcao substantiva do estudo observada em repeticoes identicas de questoes ja vistas.",
        evidence_summary = sprintf("%d de %d tentativas sao repeticoes da mesma questao (%.1f%% do volume total).",
                                   profile$transfer_exposure$repeated_attempts_count,
                                   profile$data_quality$valid_attempts,
                                   rep_ratio * 100),
        n_observations = profile$data_quality$valid_attempts,
        period_start = p_start,
        period_end = p_end,
        applied_criterion = sprintf("Proporcao de repeticoes >= %.0f%% com pelo menos 3 repeticoes", cfg$repetition_ratio_threshold * 100),
        is_heuristic = TRUE,
        limitations = c(
          "Reflete a distribuicao do fluxo de questoes praticadas, sem imputar diagnostico psicologico de dependencia.",
          "O acerto na repeticao imediata pode refletir apenas reconhecimento da alternativa e nao transferencia de conceito.",
          "Recomenda-se introduzir questoes ineditas do mesmo topico para testar generalizacao."
        ),
        method_version = "v1.0.0-repetition_ratio_filter"
      )
    }
  }
  
  # 8. Sinal: Diferença Observada de Acurácia com o Aumento do Intervalo
  if (!is.null(profile$retention$retention_by_interval) &&
      nrow(profile$retention$retention_by_interval) >= 2) {
    ret_df <- profile$retention$retention_by_interval
    valid_bins <- ret_df[!is.na(ret_df$retention_rate) & ret_df$n_repetitions >= 2, ]
    if (nrow(valid_bins) >= 2) {
      r_imm <- valid_bins$retention_rate[1]
      r_late <- valid_bins$retention_rate[nrow(valid_bins)]
      drop_rate <- r_imm - r_late
      if (drop_rate >= 0.30) {
        signals[[length(signals) + 1]] <- build_signal_record(
          signal_id = "SIG_POSSIBLE_RETENTION_DECAY",
          signal_type = "RETENTION_DECAY",
          description = "Diferenca observada na proporcao de acertos em repeticoes entre intervalos curtos e intervalos dilatados.",
          evidence_summary = sprintf("Acuracia em repetições em '%s' = %.1f%% (%s) difere de %.1f%% (%s) em '%s' (queda observada de %.1f p.p.).",
                                     valid_bins$interval_label[1], r_imm * 100, valid_bins$denominator_text[1],
                                     r_late * 100, valid_bins$denominator_text[nrow(valid_bins)],
                                     valid_bins$interval_label[nrow(valid_bins)], drop_rate * 100),
          n_observations = sum(valid_bins$n_repetitions),
          period_start = p_start,
          period_end = p_end,
          applied_criterion = "Queda na taxa de retencao >= 30 pontos percentuais entre faixas temporais com N >= 2 por faixa",
          is_heuristic = TRUE,
          limitations = c(
            "Amostra reduzida nas faixas; itens revisados em intervalos longos podem ter dificuldade inerente superior.",
            "Nao assume curva universal de esquecimento sem ajuste estatistico longitudinal robusto com controle de dificuldade."
          ),
          method_version = "v1.0.0-retention_decay_heuristic"
        )
      }
    }
  }
  
  list(
    signals_count = length(signals),
    signals = signals,
    config_used = cfg
  )
}
