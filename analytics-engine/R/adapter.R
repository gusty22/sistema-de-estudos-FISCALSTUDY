# R/adapter.R
# Módulo Adaptador de Contratos de Integração Operacional
# Projeto: FiscalStudy Analytics (R >= 4.0.0)

if (file.exists("R/provenance.R")) {
  source("R/provenance.R")
}

# Java exports UTC Instant values. Retain the original representation and validate it.
parse_operational_timestamps <- function(values) {
  values <- as.character(values)
  parsed <- suppressWarnings(as.POSIXct(values, format = "%Y-%m-%dT%H:%M:%OSZ", tz = "UTC"))
  valid_shape <- !is.na(values) & grepl("^[0-9]{4}-[0-9]{2}-[0-9]{2}T[0-9]{2}:[0-9]{2}:[0-9]{2}([.][0-9]+)?Z$", values)
  parsed[!valid_shape] <- NA
  parsed
}

#' Valida Arquivo de Exportação Operacional do FiscalStudy (fiscalstudy_attempts.csv)
#' @param export_df data.frame proveniente de GET /api/v1/analytics/export
#' @param allow_empty Se TRUE, aceita dataset com 0 linhas sob aviso de Cold Start (padrão FALSE)
#' @return Lista padronizada com is_valid, summary e issues
validate_operational_export <- function(export_df, allow_empty = FALSE) {
  issues <- data.frame(
    severity = character(0),
    rule_code = character(0),
    column_name = character(0),
    row_index = character(0),
    message = character(0),
    stringsAsFactors = FALSE
  )
  
  if (is.null(export_df) || !is.data.frame(export_df)) {
    return(list(
      is_valid = FALSE,
      has_warnings = FALSE,
      summary = list(total_rows = 0L, blocking_errors = 1L, warnings = 0L),
      issues = data.frame(
        severity = "BLOCKING_ERROR", rule_code = "INVALID_INPUT", column_name = "export_df",
        row_index = "N/A", message = "Objeto export_df e nulo ou nao e data.frame.", stringsAsFactors = FALSE
      )
    ))
  }
  
  n_rows <- nrow(export_df)
  if (n_rows == 0) {
    if (allow_empty) {
      # Suporte a Início a Frio (Cold Start): dataset vazio gera catálogo e tentativas vazios sem abortar
      return(list(
        is_valid = TRUE,
        has_warnings = TRUE,
        summary = list(total_rows = 0L, blocking_errors = 0L, warnings = 1L, infos = 0L),
        issues = data.frame(
          severity = "WARNING", rule_code = "COLD_START_EMPTY_DATASET", column_name = "export_df",
          row_index = "N/A", message = "Dataset de exportacao operacional esta vazio (0 linhas). Executando sob perfil de inicio a frio (Cold Start).", stringsAsFactors = FALSE
        )
      ))
    } else {
      return(list(
        is_valid = FALSE,
        has_warnings = FALSE,
        summary = list(total_rows = 0L, blocking_errors = 1L, warnings = 0L),
        issues = data.frame(
          severity = "BLOCKING_ERROR", rule_code = "EMPTY_DATASET", column_name = "export_df",
          row_index = "N/A", message = "Dataset de exportacao operacional esta vazio (0 linhas).", stringsAsFactors = FALSE
        )
      ))
    }
  }
  
  # Colunas essenciais da exportação operacional
  req_cols <- c("question_id", "selected_option", "is_correct", "gabarito_status", "confidence_level", "active_time_ms")
  missing_cols <- setdiff(req_cols, names(export_df))
  if (length(missing_cols) > 0) {
    return(list(
      is_valid = FALSE,
      has_warnings = FALSE,
      summary = list(total_rows = n_rows, blocking_errors = 1L, warnings = 0L),
      issues = data.frame(
        severity = "BLOCKING_ERROR", rule_code = "MISSING_REQUIRED_COLUMNS", column_name = paste(missing_cols, collapse = ","),
        row_index = "N/A", message = paste0("Colunas operacionais obrigatorias ausentes: ", paste(missing_cols, collapse = ", ")),
        stringsAsFactors = FALSE
      )
    ))
  }
  
  add_iss <- function(sev, code, col, idx, msg) {
    issues <<- rbind(issues, data.frame(
      severity = sev, rule_code = code, column_name = col,
      row_index = as.character(if (length(idx) > 10) paste0(paste(head(idx, 10), collapse = ","), " ...") else paste(idx, collapse = ",")),
      message = msg, stringsAsFactors = FALSE
    ))
  }
  
  # Validar question_id
  bad_qid <- which(is.na(export_df$question_id) | trimws(as.character(export_df$question_id)) == "")
  if (length(bad_qid) > 0) {
    add_iss("BLOCKING_ERROR", "EMPTY_QUESTION_ID", "question_id", bad_qid, "Tentativas com question_id nulo ou vazio.")
  }
  
  # Validar confidence_level [1..5]
  conf_num <- suppressWarnings(as.numeric(export_df$confidence_level))
  raw_conf <- trimws(as.character(export_df$confidence_level))
  bad_conf <- which((!is.na(conf_num) & (conf_num < 1 | conf_num > 5 | conf_num != round(conf_num))) |
                    (!is.na(raw_conf) & nzchar(raw_conf) & is.na(conf_num)))
  missing_conf <- which(is.na(conf_num))
  if (length(missing_conf) > 0) add_iss("WARNING", "CONFIDENCE_ABSENT", "confidence_level", missing_conf, "Confianca nao informada; calibracao deve usar somente observacoes presentes.")
  if (length(bad_conf) > 0) {
    add_iss("BLOCKING_ERROR", "INVALID_CONFIDENCE_RANGE", "confidence_level", bad_conf, "Niveis de confianca fora da escala [1, 5].")
  }
  
  # Validar active_time_ms >= 0
  time_num <- suppressWarnings(as.numeric(export_df$active_time_ms))
  neg_time <- which(!is.na(time_num) & time_num < 0)
  if (length(neg_time) > 0) {
    add_iss("BLOCKING_ERROR", "NEGATIVE_ACTIVE_TIME", "active_time_ms", neg_time, "Tempos ativos de resolucao negativos.")
  }
  
  raw_time <- trimws(as.character(export_df$active_time_ms))
  invalid_time <- which(!is.na(raw_time) & nzchar(raw_time) & is.na(time_num))
  if (length(invalid_time) > 0) add_iss("BLOCKING_ERROR", "INVALID_ACTIVE_TIME", "active_time_ms", invalid_time, "Tempo ativo presente nao e numerico.")
  raw_correct <- tolower(trimws(as.character(export_df$is_correct)))
  invalid_correct <- which(!is.na(raw_correct) & !raw_correct %in% c("", "na", "null", "true", "false", "1", "0"))
  if (length(invalid_correct) > 0) add_iss("BLOCKING_ERROR", "INVALID_IS_CORRECT", "is_correct", invalid_correct, "Resultado presente nao e booleano avaliavel.")

  # Warnings para tempos sub-segundo e itens sem gabarito
  sub_sec <- which(!is.na(time_num) & time_num >= 0 & time_num < 1000)
  if (length(sub_sec) > 0) {
    add_iss("WARNING", "SUSPICIOUS_SUB_SECOND_TIME", "active_time_ms", sub_sec, sprintf("%d resolucao(oes) em menos de 1 segundo.", length(sub_sec)))
  }
  
  unverified <- which(export_df$gabarito_status %in% c("AUSENTE", "SOB_REVISAO", "ANULADA") | is.na(export_df$is_correct))
  if (length(unverified) > 0) {
    add_iss("INFO", "NON_EVALUABLE_ITEMS_DETECTED", "gabarito_status", unverified, sprintf("%d tentativa(s) com gabarito ausente, anulada ou sob revisao.", length(unverified)))
  }
  
  # Identity and time are observations, not fields that the adapter may invent.
  for (field in c("event_id", "session_id", "occurred_at", "origin_type")) {
    values <- if (field %in% names(export_df)) as.character(export_df[[field]]) else rep(NA_character_, n_rows)
    missing <- which(is.na(values) | trimws(values) == "")
    if (length(missing) > 0) add_iss("WARNING", paste0(toupper(field), "_ABSENT"), field, missing, "Campo de rastreabilidade ausente; preservado como desconhecido.")
    if (field == "event_id") {
      known <- !is.na(values) & trimws(values) != ""
      duplicate <- which(known & duplicated(values))
      if (length(duplicate) > 0) add_iss("BLOCKING_ERROR", "DUPLICATE_EVENT_ID", field, duplicate, "A mesma identidade de evento aparece mais de uma vez; nao duplicar evidencias.")
    }
    if (field == "occurred_at") {
      known <- !is.na(values) & trimws(values) != ""
      parsed <- parse_operational_timestamps(values)
      invalid <- which(known & is.na(parsed))
      if (length(invalid) > 0) add_iss("BLOCKING_ERROR", "INVALID_DATE_FORMAT", field, invalid, "Timestamp presente invalido; o contrato operacional exige ISO-8601 UTC com Z.")
    }
  }

  n_block <- sum(issues$severity == "BLOCKING_ERROR")
  n_warn <- sum(issues$severity == "WARNING")
  
  list(
    is_valid = (n_block == 0),
    has_warnings = (n_warn > 0),
    summary = list(total_rows = n_rows, blocking_errors = n_block, warnings = n_warn, infos = sum(issues$severity == "INFO")),
    issues = issues
  )
}

#' Adapta Arquivo Operacional do FiscalStudy para o Esquema Analítico Canônico
#' @param export_df data.frame proveniente de fiscalstudy_attempts.csv
#' @param declared_provenance String opcional com a procedência declarada
#' @param file_path Caminho opcional do arquivo de origem
#' @param manifest Manifesto de exportação opcional
#' @return Lista contendo attempts_df, evaluable_attempts_df, questions_df e metadata
adapt_operational_attempts <- function(export_df, declared_provenance = NULL, file_path = NULL, manifest = NULL) {
  val_res <- validate_operational_export(export_df, allow_empty = TRUE)
  if (!val_res$is_valid) {
    stop("O dataset operacional viola o contrato estrutural e nao pode ser adaptado.")
  }
  
  # Auditoria de Procedência
  provenance_info <- if (exists("verify_data_provenance", mode = "function")) {
    verify_data_provenance(export_df, declared_provenance = declared_provenance, file_path = file_path, manifest = manifest)
  } else {
    list(
      provenance_type = "UNVERIFIED_SOURCE",
      is_proven_operational = FALSE,
      is_real_student_data = FALSE,
      can_generate_student_profile = FALSE,
      audit_verdict = "AUDITORIA_PROVENANCE_NAO_CARREGADA",
      reasons = character(0),
      warnings = character(0)
    )
  }
  
  df <- export_df
  n_total <- nrow(df)
  
  # 1. Normalização de Nomes e Tratamento de Idioma
  # discipline -> disciplina, board -> banca, year -> ano
  disc_val <- if ("discipline" %in% names(df)) as.character(df$discipline) else if ("disciplina" %in% names(df)) as.character(df$disciplina) else rep("Não Especificada", n_total)
  disc_val[is.na(disc_val) | trimws(disc_val) == ""] <- "Não Especificada"
  
  board_val <- if ("board" %in% names(df)) as.character(df$board) else if ("banca" %in% names(df)) as.character(df$banca) else rep("Não Especificada", n_total)
  board_val[is.na(board_val) | trimws(board_val) == ""] <- "Não Especificada"
  
  year_val <- if ("year" %in% names(df)) suppressWarnings(as.integer(df$year)) else if ("ano" %in% names(df)) suppressWarnings(as.integer(df$ano)) else rep(NA_integer_, n_total)
  
  topic_val <- if ("assunto" %in% names(df)) as.character(df$assunto) else rep(NA_character_, n_total)
  
  # 2. Tratamento Booleano Estrito de is_correct
  # true/"true"/TRUE -> TRUE; false/"false"/FALSE -> FALSE; NA/null -> NA
  raw_corr <- df$is_correct
  norm_corr <- rep(NA, n_total)
  for (i in seq_len(n_total)) {
    val <- raw_corr[i]
    if (is.na(val) || val == "NA" || val == "null") {
      norm_corr[i] <- NA
    } else if (isTRUE(val) || as.character(val) %in% c("TRUE", "true", "1")) {
      norm_corr[i] <- TRUE
    } else if (isFALSE(val) || as.character(val) %in% c("FALSE", "false", "0")) {
      norm_corr[i] <- FALSE
    } else {
      norm_corr[i] <- NA
    }
  }
  
  gabarito_st <- as.character(df$gabarito_status)
  gabarito_st <- toupper(trimws(gabarito_st))
  gabarito_st[is.na(gabarito_st) | gabarito_st == ""] <- "AUSENTE"
  
  # 3. Segregação Metrológica: Avaliável vs Não-Avaliável
  # Se gabarito for AUSENTE, SOB_REVISAO ou ANULADA, o item NÃO entra na acurácia pedagógica
  is_non_evaluable <- is.na(norm_corr) | (toupper(gabarito_st) %in% c("AUSENTE", "SOB_REVISAO", "ANULADA"))
  
  # Para itens não-avaliáveis, assegurar que is_correct seja NA
  norm_corr[is_non_evaluable] <- NA
  
  # 4. Construção do data.frame de Tentativas Adaptadas
  # Preserve original trace fields; a legacy omission remains unknown.
  if (n_total == 0) {
    adapted_attempts <- data.frame(
      event_id = character(0),
      event_type = character(0),
      session_id = character(0),
      origin_type = character(0),
      question_id = character(0),
      occurred_at = character(0),
      selected_option = character(0),
      is_correct = logical(0),
      confidence_level = integer(0),
      active_time_ms = numeric(0),
      gabarito_status = character(0),
      disciplina = character(0),
      banca = character(0),
      ano = integer(0),
      assunto = character(0),
      stringsAsFactors = FALSE
    )
    evaluable_sub <- adapted_attempts
  } else {
    adapted_attempts <- data.frame(
      event_id = if ("event_id" %in% names(df)) as.character(df$event_id) else rep(NA_character_, n_total),
      event_type = "ANSWER_SUBMITTED",
      session_id = if ("session_id" %in% names(df)) as.character(df$session_id) else rep(NA_character_, n_total),
      origin_type = if ("origin_type" %in% names(df)) as.character(df$origin_type) else rep(NA_character_, n_total),
      question_id = as.character(df$question_id),
      occurred_at = if ("occurred_at" %in% names(df)) as.character(df$occurred_at) else rep(NA_character_, n_total),
      selected_option = toupper(trimws(as.character(df$selected_option))),
      is_correct = norm_corr,
      confidence_level = as.integer(df$confidence_level),
      active_time_ms = as.numeric(df$active_time_ms),
      gabarito_status = gabarito_st,
      disciplina = disc_val,
      banca = board_val,
      ano = year_val,
      assunto = topic_val,
      stringsAsFactors = FALSE
    )
    evaluable_sub <- adapted_attempts[!is_non_evaluable, ]
  }
  
  # Anexar atributo de procedência nos dataframes
  attr(adapted_attempts, "provenance_info") <- provenance_info
  attr(evaluable_sub, "provenance_info") <- provenance_info
  
  # 5. Extração do Catálogo de Questões Distintas
  unique_qids <- unique(adapted_attempts$question_id)
  if (length(unique_qids) > 0) {
    catalog_rows <- lapply(unique_qids, function(qid) {
      first_row <- adapted_attempts[adapted_attempts$question_id == qid, ][1, ]
      is_annulled <- toupper(first_row$gabarito_status) == "ANULADA"
      data.frame(
        question_id = qid,
        enunciado = NA_character_, # The operational export does not contain source text.
        correct_option = if (is_annulled) "ANULADA" else NA_character_,
        disciplina = first_row$disciplina,
        assunto = first_row$assunto,
        banca = first_row$banca,
        ano = first_row$ano,
        is_annulled = is_annulled,
        stringsAsFactors = FALSE
      )
    })
    adapted_catalog <- do.call(rbind, catalog_rows)
  } else {
    adapted_catalog <- data.frame(
      question_id = character(0),
      enunciado = character(0),
      correct_option = character(0),
      disciplina = character(0),
      assunto = character(0),
      banca = character(0),
      ano = integer(0),
      is_annulled = logical(0),
      stringsAsFactors = FALSE
    )
  }
  
  # 6. Estatísticas Oficiais e Pedagógicas
  n_eval <- nrow(evaluable_sub)
  n_non_eval <- sum(is_non_evaluable)
  k_eval <- sum(evaluable_sub$is_correct == TRUE, na.rm = TRUE)
  n_annulled <- sum(toupper(gabarito_st) == "ANULADA")
  concurso_score <- k_eval + n_annulled
  
  cautions <- c(
    "1. Dados adaptados do contrato plano de tentativas do FiscalStudy (fiscalstudy_attempts.csv).",
    "2. Questoes com gabarito ausente/anuladas foram segregadas do denominador de acuracia pedagogica.",
    "3. Concurso score legado e uma soma descritiva, nao aplica pesos ou criterios eliminatorios da prova.",
    "4. Identidades, origens e timestamps existentes foram preservados; lacunas permanecem desconhecidas."
  )
  if (!provenance_info$is_proven_operational) {
    cautions <- c(
      cautions,
      sprintf("5. [ALERTA DE PROCEDENCIA]: Classificado como '%s'. VEDADO apresentar como historico real de estudante.", provenance_info$provenance_type)
    )
  }
  
  list(
    validation = val_res,
    questions_validation = list(
      is_valid = val_res$is_valid, has_warnings = nrow(adapted_catalog) > 0,
      summary = list(total_rows = nrow(adapted_catalog), blocking_errors = 0L, warnings = as.integer(nrow(adapted_catalog) > 0)),
      issues = if (nrow(adapted_catalog) > 0) data.frame(severity = "WARNING", rule_code = "CATALOG_SOURCE_FIELDS_NOT_EXPORTED", column_name = "enunciado,correct_option", row_index = "N/A", message = "Catalogo extraido das tentativas; texto e gabarito fonte nao foram exportados.", stringsAsFactors = FALSE) else val_res$issues[0, ]
    ),
    attempts_df = adapted_attempts,
    evaluable_attempts_df = evaluable_sub,
    questions_df = adapted_catalog,
    metadata = list(
      adapter_version = "1.1.0",
      validation_scope = "OPERATIONAL_ATTEMPTS_AND_DERIVED_CATALOG",
      catalog_source_verified = FALSE,
      data_provenance = provenance_info$provenance_type,
      is_proven_operational = provenance_info$is_proven_operational,
      is_real_student_data = provenance_info$is_real_student_data,
      can_generate_student_profile = provenance_info$can_generate_student_profile,
      provenance_verdict = provenance_info$audit_verdict,
      provenance_reasons = provenance_info$reasons,
      provenance_warnings = provenance_info$warnings,
      total_attempts = n_total,
      evaluable_attempts = n_eval,
      non_evaluable_attempts = n_non_eval,
      pedagogical_correct = k_eval,
      pedagogical_accuracy = if (n_eval > 0) round(k_eval / n_eval, 4) else NA_real_,
      annulled_count = n_annulled,
      concurso_official_score = concurso_score, # Legacy descriptive alias, not the exam rules.
      official_score_available = FALSE,
      descriptive_correct_plus_annulled = concurso_score,
      temporal_data_present = n_total > 0 && any(!is.na(parse_operational_timestamps(adapted_attempts$occurred_at))),
      temporal_data_complete = n_total > 0 && all(!is.na(parse_operational_timestamps(adapted_attempts$occurred_at))),
      temporal_observations = sum(!is.na(parse_operational_timestamps(adapted_attempts$occurred_at))),
      identity_data_complete = n_total > 0 && all(!is.na(adapted_attempts$event_id) & nzchar(trimws(adapted_attempts$event_id)) & !is.na(adapted_attempts$session_id) & nzchar(trimws(adapted_attempts$session_id))),
      quality_flags = c(
        paste0("PROVENANCE_", provenance_info$provenance_type),
        "OPERATIONAL_EXPORT_ADAPTED",
        "NO_SYNTHETIC_TIMESTAMPS_INJECTED",
        if (n_non_eval > 0) paste0("NON_EVALUABLE_EXCLUDED_", n_non_eval) else "ALL_EVALUABLE"
      ),
      methodological_cautions = cautions
    )
  )
}
