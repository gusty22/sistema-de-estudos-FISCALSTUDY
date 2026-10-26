# R/descriptive_analysis.R
# Módulo de Análise Estatística Descritiva e Calibração
# Projeto: FiscalStudy Analytics (R >= 4.0.0)


# Absolute instants only: never silently assign UTC to an unknown local timestamp.
parse_evidence_timestamp <- function(values) {
  if (inherits(values, "POSIXt")) return(as.POSIXct(values, tz = "UTC"))
  text <- as.character(values)
  shape <- !is.na(text) & grepl(
    "^[0-9]{4}-[0-9]{2}-[0-9]{2}T[0-9]{2}:[0-9]{2}:[0-9]{2}([.][0-9]+)?(Z|[+-]([01][0-9]|2[0-3]):?[0-5][0-9])$", text)
  wall <- sub("(Z|[+-][0-9]{2}:?[0-9]{2})$", "", text)
  parsed <- suppressWarnings(as.POSIXct(wall, format = "%Y-%m-%dT%H:%M:%OS", tz = "UTC"))
  roundtrip <- format(parsed, "%Y-%m-%dT%H:%M:%S", tz = "UTC")
  valid <- shape & !is.na(parsed) & !is.na(roundtrip) & roundtrip == substr(text, 1L, 19L)
  zone <- sub("^.*(Z|[+-][0-9]{2}:?[0-9]{2})$", "\\1", text)
  offset_rows <- which(valid & zone != "Z")
  if (length(offset_rows) > 0L) {
    offset <- gsub(":", "", zone[offset_rows], fixed = TRUE)
    sign <- ifelse(substr(offset, 1L, 1L) == "-", -1, 1)
    seconds <- sign * (as.numeric(substr(offset, 2L, 3L)) * 3600 +
                         as.numeric(substr(offset, 4L, 5L)) * 60)
    parsed[offset_rows] <- parsed[offset_rows] - seconds
  }
  parsed[!valid | is.na(valid)] <- NA
  parsed
}

# Preserve event cardinality and recorded metadata; fill missing values from the catalog.
# Conflicting catalog definitions are explicit errors, never multiplied observations.
join_question_metadata <- function(attempts_df, questions_df, fields = c("disciplina", "assunto")) {
  result <- attempts_df
  if (!"question_id" %in% names(result)) stop("Question metadata join requires question_id")
  if (!is.null(questions_df) && "question_id" %in% names(questions_df)) {
    catalog_fields <- intersect(c("question_id", fields), names(questions_df))
    metadata <- unique(questions_df[, catalog_fields, drop = FALSE])
    metadata <- metadata[!is.na(metadata$question_id), , drop = FALSE]
    if (anyDuplicated(as.character(metadata$question_id))) stop("Conflicting question metadata for repeated question_id")
    match_index <- match(as.character(result$question_id), as.character(metadata$question_id))
    for (field in fields) {
      if (!field %in% names(result)) result[[field]] <- rep(NA_character_, nrow(result))
      result[[field]] <- as.character(result[[field]])
      if (field %in% names(metadata)) {
        missing_value <- is.na(result[[field]]) | !nzchar(trimws(result[[field]]))
        result[[field]][missing_value] <- as.character(metadata[[field]][match_index[missing_value]])
      }
    }
  }
  for (field in fields) if (!field %in% names(result)) result[[field]] <- rep(NA_character_, nrow(result))
  result
}

#' Calcula Intervalo de Confiança de Wilson para Proporções Binomiais
#' @param k Quantidade de sucessos (acertos)
#' @param n Tamanho total da amostra (tentativas válidas)
#' @param conf_level Nível de confiança estatística (padrão 0.95)
#' @return Vetor c(lower, upper)
calculate_wilson_ci <- function(k, n, conf_level = 0.95) {
  if (is.na(n) || n <= 0) {
    return(c(lower = NA_real_, upper = NA_real_))
  }
  if (is.na(k) || k < 0 || k > n) {
    return(c(lower = NA_real_, upper = NA_real_))
  }
  
  p_hat <- k / n
  alpha <- 1 - conf_level
  z <- stats::qnorm(1 - alpha / 2)
  z2 <- z^2
  
  denom <- 1 + (z2 / n)
  center <- (p_hat + (z2 / (2 * n))) / denom
  spread <- (z * sqrt((p_hat * (1 - p_hat) / n) + (z2 / (4 * n^2)))) / denom
  
  lower <- max(0, center - spread)
  upper <- min(1, center + spread)
  
  c(lower = round(lower, 4), upper = round(upper, 4))
}

#' Calcula Desempenho Global (Overall)
#' @param attempts_df data.frame com tentativas válidas
#' @return Lista com contagens, taxas, intervalos de confiança e notas de denominação
calculate_performance_overall <- function(attempts_df) {
  if (is.null(attempts_df) || nrow(attempts_df) == 0) {
    return(list(
      n_attempts = 0,
      n_correct = 0,
      n_incorrect = 0,
      accuracy = NA_real_,
      accuracy_ci_lower = NA_real_,
      accuracy_ci_upper = NA_real_,
      denominator_text = "0/0 (0 tentativas)"
    ))
  }
  
  valid_sub <- attempts_df[!is.na(attempts_df$is_correct), ]
  n <- nrow(valid_sub)
  if (n == 0) {
    return(list(
      n_attempts = 0,
      n_correct = 0,
      n_incorrect = 0,
      accuracy = NA_real_,
      accuracy_ci_lower = NA_real_,
      accuracy_ci_upper = NA_real_,
      denominator_text = "0/0 (0 tentativas com gabarito válido)"
    ))
  }
  
  k <- sum(valid_sub$is_correct == TRUE)
  incorrect <- n - k
  acc <- k / n
  ci <- calculate_wilson_ci(k, n, 0.95)
  
  list(
    n_attempts = n,
    n_correct = k,
    n_incorrect = incorrect,
    accuracy = round(acc, 4),
    accuracy_percent = round(acc * 100, 2),
    accuracy_ci_lower = ci["lower"],
    accuracy_ci_upper = ci["upper"],
    denominator_text = sprintf("%d acertos em %d tentativas (N = %d, taxa = %.1f%% [IC 95%%: %.1f%% - %.1f%%])",
                               k, n, n, acc * 100, ci["lower"] * 100, ci["upper"] * 100)
  )
}

#' Calcula Desempenho por Disciplina
#' @param attempts_df data.frame de tentativas
#' @param questions_df data.frame do catálogo de questões (contendo question_id e disciplina)
#' @return data.frame com métricas por disciplina e denominadores
calculate_performance_by_discipline <- function(attempts_df, questions_df) {
  if (is.null(attempts_df) || nrow(attempts_df) == 0 || is.null(questions_df) || nrow(questions_df) == 0) {
    return(data.frame(
      disciplina = character(0),
      n_attempts = integer(0),
      n_correct = integer(0),
      n_incorrect = integer(0),
      accuracy = numeric(0),
      ci_lower = numeric(0),
      ci_upper = numeric(0),
      denominator_text = character(0),
      stringsAsFactors = FALSE
    ))
  }
  
  att_sub <- attempts_df[!is.na(attempts_df$is_correct), ]
  merged <- join_question_metadata(att_sub, questions_df, "disciplina")
  
  merged$disciplina[is.na(merged$disciplina) | trimws(merged$disciplina) == ""] <- "Não Especificada"
  disciplines <- sort(unique(merged$disciplina))
  
  res_list <- lapply(disciplines, function(disc) {
    sub <- merged[merged$disciplina == disc, ]
    n <- nrow(sub)
    k <- sum(sub$is_correct == TRUE)
    acc <- if (n > 0) k / n else NA_real_
    ci <- calculate_wilson_ci(k, n, 0.95)
    
    data.frame(
      disciplina = disc,
      n_attempts = n,
      n_correct = k,
      n_incorrect = n - k,
      accuracy = round(acc, 4),
      ci_lower = ci["lower"],
      ci_upper = ci["upper"],
      denominator_text = sprintf("%d/%d (%.1f%%)", k, n, acc * 100),
      stringsAsFactors = FALSE
    )
  })
  
  do.call(rbind, res_list)
}

#' Calcula Métricas de Tempo Ativo de Resolução
#' @param attempts_df data.frame de tentativas com active_time_ms
#' @return Lista de métricas paramétricas e não-paramétricas de tempo em segundos
calculate_time_metrics <- function(attempts_df) {
  if (is.null(attempts_df) || nrow(attempts_df) == 0 || !"active_time_ms" %in% names(attempts_df)) {
    return(list(
      n_valid_times = 0,
      mean_sec = NA_real_,
      median_sec = NA_real_,
      sd_sec = NA_real_,
      iqr_sec = NA_real_,
      q25_sec = NA_real_,
      q75_sec = NA_real_,
      min_sec = NA_real_,
      max_sec = NA_real_,
      outliers_detected = 0,
      outlier_cutoff_high_sec = NA_real_
    ))
  }
  
  raw_times <- suppressWarnings(as.numeric(attempts_df$active_time_ms))
  valid_times <- raw_times[!is.na(raw_times) & raw_times >= 0]
  n <- length(valid_times)
  
  if (n == 0) {
    return(list(
      n_valid_times = 0,
      mean_sec = NA_real_,
      median_sec = NA_real_,
      sd_sec = NA_real_,
      iqr_sec = NA_real_,
      q25_sec = NA_real_,
      q75_sec = NA_real_,
      min_sec = NA_real_,
      max_sec = NA_real_,
      outliers_detected = 0,
      outlier_cutoff_high_sec = NA_real_
    ))
  }
  
  sec <- valid_times / 1000.0
  q <- stats::quantile(sec, probs = c(0.25, 0.5, 0.75), names = FALSE)
  q25 <- q[1]
  med <- q[2]
  q75 <- q[3]
  iqr_val <- q75 - q25
  
  # Barreira de Tukey para extremos (sem exclusão silenciosa)
  high_cutoff <- q75 + (1.5 * iqr_val)
  outliers <- which(sec > high_cutoff)
  
  mean_val <- mean(sec)
  sd_val <- if (n > 1) stats::sd(sec) else 0
  
  list(
    n_valid_times = n,
    mean_sec = round(mean_val, 2),
    median_sec = round(med, 2),
    sd_sec = round(sd_val, 2),
    iqr_sec = round(iqr_val, 2),
    q25_sec = round(q25, 2),
    q75_sec = round(q75, 2),
    min_sec = round(min(sec), 2),
    max_sec = round(max(sec), 2),
    outliers_detected = length(outliers),
    outlier_cutoff_high_sec = round(high_cutoff, 2)
  )
}

#' Calcula Métricas de Confiança e Calibração Metrológica
#' @param attempts_df data.frame de tentativas contendo confidence_level (1-5) e is_correct
#' @param prob_mapping Vetor nomeado opcional de probabilidades para cada nível de confiança (ex: c("1"=0.2, ..., "5"=1.0))
#' @return Lista com distribuições, acurácia por nível, Brier Score, ECE, viés amostral e mapeamento probabilístico
calculate_confidence_metrics <- function(attempts_df, prob_mapping = NULL) {
  # Mapeamento probabilístico padrão explícito (5 alternativas: chute = 0.20 até teto nominal = 1.00)
  default_mapping <- c("1" = 0.20, "2" = 0.40, "3" = 0.60, "4" = 0.80, "5" = 1.00)
  active_mapping <- if (!is.null(prob_mapping) && length(prob_mapping) == 5) prob_mapping else default_mapping

  if (is.null(attempts_df) || nrow(attempts_df) == 0 ||
      !"confidence_level" %in% names(attempts_df) || !"is_correct" %in% names(attempts_df)) {
    return(list(
      n_observations = 0,
      distribution = rep(0, 5),
      accuracy_by_level = data.frame(),
      overconfidence_count = 0,
      overconfidence_rate = NA_real_,
      underconfidence_count = 0,
      underconfidence_rate = NA_real_,
      brier_score = NA_real_,
      ece = NA_real_,
      prob_mapping_used = active_mapping,
      small_sample_warning = FALSE,
      methodological_cautions = c("Sem dados para calibracao.")
    ))
  }
  
  sub <- attempts_df[!is.na(attempts_df$confidence_level) & !is.na(attempts_df$is_correct), ]
  n <- nrow(sub)
  if (n == 0) {
    return(list(
      n_observations = 0,
      distribution = rep(0, 5),
      accuracy_by_level = data.frame(),
      overconfidence_count = 0,
      overconfidence_rate = NA_real_,
      underconfidence_count = 0,
      underconfidence_rate = NA_real_,
      brier_score = NA_real_,
      ece = NA_real_,
      prob_mapping_used = active_mapping,
      small_sample_warning = FALSE,
      methodological_cautions = c("Sem dados com gabarito e confianca validos.")
    ))
  }
  
  sub$conf <- as.integer(sub$confidence_level)
  sub$correct_num <- as.integer(sub$is_correct == TRUE)
  
  # Distribuição e acurácia por nível 1..5
  levels_grid <- 1:5
  acc_by_level <- do.call(rbind, lapply(levels_grid, function(lvl) {
    in_lvl <- sub[sub$conf == lvl, ]
    n_lvl <- nrow(in_lvl)
    k_lvl <- sum(in_lvl$correct_num)
    acc_lvl <- if (n_lvl > 0) k_lvl / n_lvl else NA_real_
    ci <- calculate_wilson_ci(k_lvl, n_lvl, 0.95)
    
    # Probabilidade esperada mapeada explicitamente
    expected_prob <- as.numeric(active_mapping[as.character(lvl)])
    
    data.frame(
      confidence_level = lvl,
      n_attempts = n_lvl,
      proportion_of_total = round(n_lvl / n, 4),
      n_correct = k_lvl,
      accuracy = round(acc_lvl, 4),
      ci_lower = ci["lower"],
      ci_upper = ci["upper"],
      expected_probability = expected_prob,
      calibration_gap = if (!is.na(acc_lvl)) round(acc_lvl - expected_prob, 4) else NA_real_,
      denominator_text = sprintf("%d/%d (%.1f%%)", k_lvl, n_lvl, if (!is.na(acc_lvl)) acc_lvl * 100 else 0),
      stringsAsFactors = FALSE
    )
  }))
  
  # Superconfiança: Resposta errada com confiança máxima (nível 5)
  conf5_df <- sub[sub$conf == 5, ]
  overconf_count <- sum(conf5_df$correct_num == 0)
  overconf_rate_in_conf5 <- if (nrow(conf5_df) > 0) overconf_count / nrow(conf5_df) else 0
  
  # Subconfiança: Resposta certa com confiança baixa (níveis 1 e 2)
  lowconf_df <- sub[sub$conf %in% c(1, 2), ]
  underconf_count <- sum(lowconf_df$correct_num == 1)
  underconf_rate_in_lowconf <- if (nrow(lowconf_df) > 0) underconf_count / nrow(lowconf_df) else 0
  
  # Brier Score com mapeamento probabilístico explicitamente definido
  p_pred <- as.numeric(active_mapping[as.character(sub$conf)])
  y_obs <- sub$correct_num
  brier_score <- mean((p_pred - y_obs)^2)
  
  # Expected Calibration Error (ECE) ponderado
  ece_sum <- 0
  for (i in 1:nrow(acc_by_level)) {
    n_bin <- acc_by_level$n_attempts[i]
    if (n_bin > 0) {
      gap <- abs(acc_by_level$accuracy[i] - acc_by_level$expected_probability[i])
      ece_sum <- ece_sum + (n_bin / n) * gap
    }
  }
  
  # Advertências metodológicas sobre limites de pequenas amostras e hipótese de conversão
  conversion_hyp <- list(
    description = "A escala ordinal Likert (1 a 5) foi convertida em probabilidades pontuais de acordo com o mapeamento explicitado.",
    mapping = active_mapping,
    nature = "HIPOTESE_PARAMETRICA_ASSUMIDA",
    epistemic_warning = "Esta conversao e uma hipotese metodologica do pesquisador e NAO representa medicao direta de probabilidade subjetiva continua do estudante."
  )
  
  cautions <- c(
    sprintf("Mapeamento probabilistico utilizado: Nivel 1=%.2f, 2=%.2f, 3=%.2f, 4=%.2f, 5=%.2f.",
            active_mapping["1"], active_mapping["2"], active_mapping["3"], active_mapping["4"], active_mapping["5"]),
    "HIPOTESE METODOLOGICA: Brier Score e ECE dependem da conversao assumida de Likert 1-5 em probabilidades discretas e nao refletem diretamente uma probabilidade subjetiva continua observada."
  )
  if (n < 30) {
    cautions <- c(
      cautions,
      sprintf("Amostra pequena para calibracao (N = %d < 30); intervalos amplos e alta variancia no Brier Score.", n),
      "ECE possui vies amostral positivo assintotico em amostras reduzidas devido a natureza nao-negativa das diferencas absolutas."
    )
  }
  
  list(
    n_observations = n,
    accuracy_by_level = acc_by_level,
    overconfidence_count = overconf_count,
    overconfidence_rate_in_level5 = round(overconf_rate_in_conf5, 4),
    underconfidence_count = underconf_count,
    underconfidence_rate_in_low_conf = round(underconf_rate_in_lowconf, 4),
    brier_score = round(brier_score, 4),
    ece = round(ece_sum, 4),
    prob_mapping_used = active_mapping,
    conversion_hypothesis = conversion_hyp,
    small_sample_warning = (n < 30),
    methodological_cautions = cautions
  )
}

#' Calcula Evolução Temporal de Desempenho por Sessão
#' @param attempts_df data.frame de tentativas com occurred_at, session_id e is_correct
#' @return data.frame com histórico cronológico por sessão
calculate_temporal_evolution <- function(attempts_df) {
  if (is.null(attempts_df) || nrow(attempts_df) == 0 ||
      !"session_id" %in% names(attempts_df) || !"occurred_at" %in% names(attempts_df)) {
    return(data.frame(
      session_id = character(0),
      session_order = integer(0),
      first_timestamp = character(0),
      n_attempts = integer(0),
      n_correct = integer(0),
      accuracy = numeric(0),
      ci_lower = numeric(0),
      ci_upper = numeric(0),
      mean_active_time_sec = numeric(0),
      mean_confidence = numeric(0),
      low_sample_flag = logical(0),
      denominator_text = character(0),
      stringsAsFactors = FALSE
    ))
  }
  
  valid_sub <- attempts_df[!is.na(attempts_df$occurred_at) & !is.na(attempts_df$is_correct), ]
  if (nrow(valid_sub) == 0) {
    return(data.frame())
  }
  
  parse_iso_dates <- function(x) {
    res <- suppressWarnings(as.POSIXct(x, format = "%Y-%m-%dT%H:%M:%OSZ", tz = "UTC"))
    na_idx <- which(is.na(res))
    if (length(na_idx) > 0) {
      res2 <- suppressWarnings(as.POSIXct(x[na_idx], format = "%Y-%m-%dT%H:%M:%OS", tz = "UTC"))
      res[na_idx] <- res2
      na_idx2 <- which(is.na(res))
      if (length(na_idx2) > 0) {
        res3 <- suppressWarnings(as.POSIXct(x[na_idx2], format = "%Y-%m-%d %H:%M:%S", tz = "UTC"))
        res[na_idx2] <- res3
      }
    }
    res
  }
  valid_sub$parsed_time <- parse_iso_dates(valid_sub$occurred_at)
  valid_sub <- valid_sub[!is.na(valid_sub$parsed_time), ]
  if (nrow(valid_sub) == 0) return(data.frame())
  
  sessions <- unique(valid_sub$session_id)
  session_rows <- lapply(seq_along(sessions), function(idx) {
    s_id <- sessions[idx]
    s_sub <- valid_sub[valid_sub$session_id == s_id, ]
    n <- nrow(s_sub)
    k <- sum(s_sub$is_correct == TRUE)
    acc <- if (n > 0) k / n else NA_real_
    ci <- calculate_wilson_ci(k, n, 0.95)
    
    mean_time <- if ("active_time_ms" %in% names(s_sub)) {
      mean(as.numeric(s_sub$active_time_ms), na.rm = TRUE) / 1000.0
    } else {
      NA_real_
    }
    
    mean_conf <- if ("confidence_level" %in% names(s_sub)) {
      mean(as.numeric(s_sub$confidence_level), na.rm = TRUE)
    } else {
      NA_real_
    }
    
    data.frame(
      session_id = s_id,
      session_order = idx,
      first_timestamp = as.character(min(s_sub$parsed_time)),
      n_attempts = n,
      n_correct = k,
      accuracy = round(acc, 4),
      ci_lower = ci["lower"],
      ci_upper = ci["upper"],
      mean_active_time_sec = round(mean_time, 2),
      mean_confidence = round(mean_conf, 2),
      low_sample_flag = (n < 10),
      denominator_text = sprintf("%d/%d (%.1f%%, N=%d)", k, n, acc * 100, n),
      stringsAsFactors = FALSE
    )
  })
  
  do.call(rbind, session_rows)
}

#' Calcula Desempenho por Tópico/Assunto
#' @param attempts_df data.frame de tentativas com question_id e is_correct
#' @param questions_df data.frame do catálogo de questões (contendo question_id, assunto e opcionalmente disciplina)
#' @param min_sample Tamanho amostral mínimo para inclusão no retorno (padrão 1)
#' @return data.frame com métricas por tópico, intervalos Wilson e denominadores
calculate_performance_by_topic <- function(attempts_df, questions_df, min_sample = 1) {
  if (is.null(attempts_df) || nrow(attempts_df) == 0 || is.null(questions_df) || nrow(questions_df) == 0) {
    return(data.frame(
      disciplina = character(0),
      assunto = character(0),
      n_attempts = integer(0),
      n_correct = integer(0),
      n_incorrect = integer(0),
      accuracy = numeric(0),
      ci_lower = numeric(0),
      ci_upper = numeric(0),
      low_sample_flag = logical(0),
      denominator_text = character(0),
      stringsAsFactors = FALSE
    ))
  }
  
  topic_col <- if ("assunto" %in% names(questions_df)) "assunto" else if ("topico" %in% names(questions_df)) "topico" else NA
  if (is.na(topic_col)) {
    return(data.frame(
      disciplina = character(0),
      assunto = character(0),
      n_attempts = integer(0),
      n_correct = integer(0),
      n_incorrect = integer(0),
      accuracy = numeric(0),
      ci_lower = numeric(0),
      ci_upper = numeric(0),
      low_sample_flag = logical(0),
      denominator_text = character(0),
      stringsAsFactors = FALSE
    ))
  }
  
  cols_to_merge <- c("question_id", topic_col)
  if ("disciplina" %in% names(questions_df)) {
    cols_to_merge <- c(cols_to_merge, "disciplina")
  }
  
  att_sub <- attempts_df[!is.na(attempts_df$is_correct), ]
  merged <- join_question_metadata(att_sub, questions_df, cols_to_merge[-1])
  
  merged$assunto_clean <- as.character(merged[[topic_col]])
  merged$assunto_clean[is.na(merged$assunto_clean) | trimws(merged$assunto_clean) == ""] <- "Tópico Não Especificado"
  
  disc_clean <- if ("disciplina" %in% names(merged)) as.character(merged$disciplina) else rep("Geral", nrow(merged))
  disc_clean[is.na(disc_clean) | trimws(disc_clean) == ""] <- "Não Especificada"
  merged$disciplina_clean <- disc_clean
  
  unique_pairs <- unique(merged[, c("disciplina_clean", "assunto_clean")])
  unique_pairs <- unique_pairs[order(unique_pairs$disciplina_clean, unique_pairs$assunto_clean), ]
  
  res_list <- lapply(seq_len(nrow(unique_pairs)), function(i) {
    d_val <- unique_pairs$disciplina_clean[i]
    t_val <- unique_pairs$assunto_clean[i]
    sub <- merged[merged$disciplina_clean == d_val & merged$assunto_clean == t_val, ]
    n <- nrow(sub)
    if (n < min_sample) return(NULL)
    
    k <- sum(sub$is_correct == TRUE)
    acc <- if (n > 0) k / n else NA_real_
    ci <- calculate_wilson_ci(k, n, 0.95)
    
    data.frame(
      disciplina = d_val,
      assunto = t_val,
      n_attempts = n,
      n_correct = k,
      n_incorrect = n - k,
      accuracy = round(acc, 4),
      ci_lower = ci["lower"],
      ci_upper = ci["upper"],
      low_sample_flag = (n < 10),
      denominator_text = sprintf("%d/%d (%.1f%%)", k, n, if (!is.na(acc)) acc * 100 else 0),
      stringsAsFactors = FALSE
    )
  })
  
  res_list <- res_list[!vapply(res_list, is.null, logical(1))]
  if (length(res_list) == 0) return(data.frame())
  do.call(rbind, res_list)
}

#' Compara Desempenho entre Dois Períodos Temporais
#' @param attempts_df data.frame de tentativas com occurred_at e is_correct
#' @param period1_range Vetor c(inicio, fim) do período 1 (strings ISO-8601 ou POSIXct)
#' @param period2_range Vetor c(inicio, fim) do período 2 (strings ISO-8601 ou POSIXct)
#' @param period1_label Rótulo do período 1
#' @param period2_label Rótulo do período 2
#' @return Lista detalhada com estimativas, teste de hipóteses, flags de amostra e advertências
compare_performance_periods <- function(attempts_df, period1_range, period2_range,
                                        period1_label = "Período 1", period2_label = "Período 2") {
  parse_iso_dates <- function(x) {
    res <- suppressWarnings(as.POSIXct(x, format = "%Y-%m-%dT%H:%M:%OSZ", tz = "UTC"))
    na_idx <- which(is.na(res))
    if (length(na_idx) > 0) {
      res2 <- suppressWarnings(as.POSIXct(x[na_idx], format = "%Y-%m-%dT%H:%M:%OS", tz = "UTC"))
      res[na_idx] <- res2
      na_idx2 <- which(is.na(res))
      if (length(na_idx2) > 0) {
        res3 <- suppressWarnings(as.POSIXct(x[na_idx2], format = "%Y-%m-%d %H:%M:%S", tz = "UTC"))
        res[na_idx2] <- res3
      }
    }
    res
  }
  
  if (is.null(attempts_df) || nrow(attempts_df) == 0 ||
      !"occurred_at" %in% names(attempts_df) || !"is_correct" %in% names(attempts_df)) {
    return(list(
      period1 = list(label = period1_label, n = 0, k = 0, accuracy = NA_real_),
      period2 = list(label = period2_label, n = 0, k = 0, accuracy = NA_real_),
      delta_accuracy = NA_real_,
      p_value = NA_real_,
      is_significant = FALSE,
      sample_disparity_flag = TRUE,
      methodological_cautions = c("Sem dados para comparação.")
    ))
  }
  
  df <- attempts_df[!is.na(attempts_df$occurred_at) & !is.na(attempts_df$is_correct), ]
  df$t <- parse_iso_dates(df$occurred_at)
  df <- df[!is.na(df$t), ]
  
  p1_start <- if (inherits(period1_range[1], "POSIXt")) period1_range[1] else parse_iso_dates(period1_range[1])
  p1_end   <- if (inherits(period1_range[2], "POSIXt")) period1_range[2] else parse_iso_dates(period1_range[2])
  p2_start <- if (inherits(period2_range[1], "POSIXt")) period2_range[1] else parse_iso_dates(period2_range[1])
  p2_end   <- if (inherits(period2_range[2], "POSIXt")) period2_range[2] else parse_iso_dates(period2_range[2])
  
  sub1 <- df[df$t >= p1_start & df$t <= p1_end, ]
  sub2 <- df[df$t >= p2_start & df$t <= p2_end, ]
  
  n1 <- nrow(sub1)
  k1 <- sum(sub1$is_correct == TRUE)
  acc1 <- if (n1 > 0) k1 / n1 else NA_real_
  ci1 <- calculate_wilson_ci(k1, n1, 0.95)
  
  n2 <- nrow(sub2)
  k2 <- sum(sub2$is_correct == TRUE)
  acc2 <- if (n2 > 0) k2 / n2 else NA_real_
  ci2 <- calculate_wilson_ci(k2, n2, 0.95)
  
  delta_acc <- if (!is.na(acc1) && !is.na(acc2)) round(acc2 - acc1, 4) else NA_real_
  
  # Teste estatístico de igualdade de proporções (Fisher se N pequeno, prop.test caso contrário)
  p_val <- NA_real_
  if (n1 > 0 && n2 > 0) {
    tab <- matrix(c(k1, n1 - k1, k2, n2 - k2), nrow = 2, byrow = TRUE)
    if (min(tab) < 5 || (n1 + n2) < 30) {
      fisher_res <- stats::fisher.test(tab)
      p_val <- round(as.numeric(fisher_res$p.value), 4)
    } else {
      prop_res <- suppressWarnings(stats::prop.test(c(k1, k2), c(n1, n2), correct = TRUE))
      p_val <- round(as.numeric(prop_res$p.value), 4)
    }
  }
  
  # Checagem de disparidade amostral e limitações
  disparity_flag <- FALSE
  cautions <- c(
    "1. Percentuais e diferenças apresentados com denominadores estritos observados.",
    "2. Não atribua causalidade ou progresso automático a correlações temporais sem controle de dificuldade dos itens respondidos."
  )
  
  if (n1 < 10 || n2 < 10) {
    disparity_flag <- TRUE
    cautions <- c(cautions, sprintf("3. Amostra pequena em pelo menos um período (N1 = %d, N2 = %d); poder estatístico insuficiente.", n1, n2))
  }
  
  if (n1 > 0 && n2 > 0) {
    ratio <- max(n1, n2) / min(n1, n2)
    if (ratio > 3.0) {
      disparity_flag <- TRUE
      cautions <- c(cautions, sprintf("4. Desproporção amostral acentuada (razão %.1fx entre períodos); risco de viés de agregação.", ratio))
    }
  }
  
  list(
    period1 = list(
      label = period1_label,
      range = c(as.character(p1_start), as.character(p1_end)),
      n_attempts = n1,
      n_correct = k1,
      accuracy = round(acc1, 4),
      ci_lower = ci1["lower"],
      ci_upper = ci1["upper"],
      denominator_text = sprintf("%d/%d (%.1f%%)", k1, n1, if (!is.na(acc1)) acc1 * 100 else 0)
    ),
    period2 = list(
      label = period2_label,
      range = c(as.character(p2_start), as.character(p2_end)),
      n_attempts = n2,
      n_correct = k2,
      accuracy = round(acc2, 4),
      ci_lower = ci2["lower"],
      ci_upper = ci2["upper"],
      denominator_text = sprintf("%d/%d (%.1f%%)", k2, n2, if (!is.na(acc2)) acc2 * 100 else 0)
    ),
    delta_accuracy = delta_acc,
    delta_accuracy_percent = if (!is.na(delta_acc)) round(delta_acc * 100, 2) else NA_real_,
    p_value = p_val,
    is_significant = if (!is.na(p_val)) (p_val < 0.05) else FALSE,
    sample_disparity_flag = disparity_flag,
    methodological_cautions = cautions
  )
}

