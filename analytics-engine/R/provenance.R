# R/provenance.R
# MÃÂ³dulo de Auditoria e VerificaÃÂ§ÃÂ£o de ProcedÃÂªncia dos Dados
# Projeto: FiscalStudy Analytics (R >= 4.0.0)

#' Tipos CanÃÂ´nicos de ProcedÃÂªncia de Dados
DATA_PROVENANCE_TYPES <- c(
  "PROVEN_OPERATIONAL",   # Dados autenticados extraÃÂ­dos com custÃÂ³dia do banco operacional real
  "DEMONSTRATION_SAMPLE", # Amostras ilustrativas de schema/desenvolvimento (ex: sample_data.csv)
  "SYNTHETIC_FIXTURE",    # Fixtures sintÃÂ©ticas controladas de teste (armazenadas em tests/fixtures/)
  "UNVERIFIED_SOURCE"     # Origem desconhecida, nÃÂ£o verificada ou sem cadeia de custÃÂ³dia
)

#' Calcula Hash Criptografico SHA-256 de Arquivo
#' Prioriza digest::digest (se disponivel); recorre a tools::sha256sum (Base R nativo).
#' Retorna NA_character_ em caso de erro, modulo indisponivel ou arquivo inacessivel (fail-closed).
#' NUNCA substitui SHA-256 por MD5.
compute_file_sha256 <- function(file_path) {
  if (is.null(file_path) || !is.character(file_path) || length(file_path) != 1 || !file.exists(file_path)) {
    return(NA_character_)
  }
  tryCatch({
    if (requireNamespace("digest", quietly = TRUE)) {
      tolower(as.character(digest::digest(file_path, algo = "sha256", file = TRUE)))
    } else if (requireNamespace("tools", quietly = TRUE) && exists("sha256sum", envir = asNamespace("tools"))) {
      res <- unname(as.character(tools::sha256sum(file_path)))
      if (is.na(res) || !nzchar(res)) NA_character_ else tolower(res)
    } else {
      NA_character_
    }
  }, error = function(e) NA_character_)
}

#' Audita e Verifica a ProcedÃÂªncia de um Conjunto de Dados
#' @param df data.frame com os dados a serem auditados
#' @param declared_provenance String com a procedÃÂªncia declarada (opcional)
#' @param file_path Caminho do arquivo de origem (opcional)
#' @param manifest Lista de metadados de manifesto de exportaÃÂ§ÃÂ£o (opcional)
#' @return Lista padronizada de auditoria de procedÃÂªncia
verify_data_provenance <- function(df, declared_provenance = NULL, file_path = NULL, manifest = NULL) {
  reasons <- character(0)
  warnings <- character(0)
  
  if (is.null(df) || !is.data.frame(df) || nrow(df) == 0) {
    return(list(
      provenance_type = "UNVERIFIED_SOURCE",
      is_proven_operational = FALSE,
      is_real_student_data = FALSE,
      can_generate_student_profile = FALSE,
      audit_verdict = "DADOS_NULOS_OU_VAZIOS",
      reasons = c("Dataset nulo, invalido ou sem registros."),
      warnings = c("Impossivel determinar procedencia de dataset vazio.")
    ))
  }
  
  # Normalizar path
  path_str <- if (!is.null(file_path)) tolower(as.character(file_path)) else ""
  
  # 0. Verificacao Prioritaria de Integridade do Manifesto (se fornecido)
  has_crypto_verified <- FALSE
  if (!is.null(manifest) && is.list(manifest)) {
    # 0.1 Divergencia de contagem de registros rejeita imediatamente
    if (!is.null(manifest$total_records) && !is.na(manifest$total_records)) {
      exp_count <- suppressWarnings(as.integer(manifest$total_records))
      if (!is.na(exp_count) && nrow(df) != exp_count) {
        return(list(
          provenance_type = "UNVERIFIED_SOURCE",
          is_proven_operational = FALSE,
          is_real_student_data = FALSE,
          can_generate_student_profile = FALSE,
          audit_verdict = "REJEITADO_INCONSISTENCIA_MANIFESTO",
          reasons = c(
            sprintf("RECORD_COUNT_MISMATCH: Total de registros no CSV (%d) diverge do manifesto (%d). Arquivo modificado.", nrow(df), exp_count)
          ),
          warnings = c(
            "REJEICAO DE INTEGRIDADE: Total de registros no CSV diverge do manifesto correspondente.",
            "O laboratorio R recusa aceitar silenciosamente arquivos modificados.",
            "Nenhum perfil real de estudante sera emitido sob dados inconsistentes."
          )
        ))
      }
    }

    raw_chk <- if (!is.null(manifest$checksum)) trimws(as.character(manifest$checksum)) else NA_character_
    has_chk <- !is.na(raw_chk) && raw_chk != "" && tolower(raw_chk) != "na"
    manifest_checksum <- if (has_chk) tolower(raw_chk) else NA_character_

    # 0.2 Se pretensao for operacional, hash no manifesto e mandatorio
    if (!is.null(declared_provenance) && declared_provenance == "PROVEN_OPERATIONAL" && !has_chk) {
      return(list(
        provenance_type = "UNVERIFIED_SOURCE",
        is_proven_operational = FALSE,
        is_real_student_data = FALSE,
        can_generate_student_profile = FALSE,
        audit_verdict = "REJEITADO_MANIFESTO_SEM_HASH",
        reasons = c("MANIFEST_CHECKSUM_MISSING: Manifesto nao contem hash SHA-256 criptografico obrigatorio para comprovacao operacional."),
        warnings = c(
          "REJEICAO DE INTEGRIDADE: Manifesto sem hash criptografico SHA-256.",
          "O laboratorio R recusa aceitar dados operacionais sem integridade criptografica verificavel.",
          "Nenhum perfil real de estudante sera emitido sob manifesto sem hash."
        )
      ))
    }

    # 0.3 Se pretensao for operacional, o arquivo deve existir para calculo do hash
    if (!is.null(declared_provenance) && declared_provenance == "PROVEN_OPERATIONAL") {
      if (is.null(file_path) || !file.exists(file_path)) {
        return(list(
          provenance_type = "UNVERIFIED_SOURCE",
          is_proven_operational = FALSE,
          is_real_student_data = FALSE,
          can_generate_student_profile = FALSE,
          audit_verdict = "REJEITADO_ARQUIVO_INACESSIVEL_PARA_HASH",
          reasons = c("FILE_UNAVAILABLE_FOR_HASH: Arquivo fisico de exportacao ausente ou inacessivel para verificacao criptografica do manifesto."),
          warnings = c(
            "REJEICAO DE INTEGRIDADE: Impossivel verificar o hash do manifesto sem o arquivo no disco.",
            "Nenhum perfil real de estudante sera emitido sem comprovacao criptografica ponta a ponta."
          )
        ))
      }
    }

    # 0.4 Se ha hash declarado ou pretensao operacional com arquivo presente, executa checagem criptografica
    if (has_chk && !is.null(file_path) && file.exists(file_path)) {
      calc_hash <- compute_file_sha256(file_path)

      if (is.na(calc_hash) || calc_hash == "") {
        return(list(
          provenance_type = "UNVERIFIED_SOURCE",
          is_proven_operational = FALSE,
          is_real_student_data = FALSE,
          can_generate_student_profile = FALSE,
          audit_verdict = "REJEITADO_FALHA_VERIFICACAO_CRIPTOGRAFICA",
          reasons = c("CRYPTO_VERIFICATION_UNAVAILABLE: Nao foi possivel executar a verificacao criptografica do arquivo (modulo criptografico indisponivel ou erro de I/O)."),
          warnings = c(
            "REJEICAO DE INTEGRIDADE: Situacao em que nao e possivel executar a verificacao criptografica.",
            "O laboratorio R exige verificacao criptografica executavel para atestar procedencia operacional."
          )
        ))
      }

      if (calc_hash != manifest_checksum) {
        return(list(
          provenance_type = "UNVERIFIED_SOURCE",
          is_proven_operational = FALSE,
          is_real_student_data = FALSE,
          can_generate_student_profile = FALSE,
          audit_verdict = "REJEITADO_INCONSISTENCIA_MANIFESTO",
          reasons = c(
            sprintf("CHECKSUM_MISMATCH: Hash SHA-256 do arquivo entregue (%s) diverge do manifesto (%s). Arquivo modificado ou manifesto corrompido.", calc_hash, manifest_checksum)
          ),
          warnings = c(
            "REJEICAO DE INTEGRIDADE: O arquivo de exportacao e o manifesto representam conjuntos de dados divergentes.",
            "O laboratorio R recusa aceitar silenciosamente arquivos modificados ou inconsistentes.",
            "Nenhum perfil real de estudante sera emitido sob dados inconsistentes."
          )
        ))
      }
      has_crypto_verified <- TRUE
    }
  }
  
  # 1. DetecÃÂ§ÃÂ£o de Fixtures SintÃÂ©ticas de Teste
  is_fixture_path <- grepl("fixtures|test_", path_str)
  if (is_fixture_path || (!is.null(declared_provenance) && declared_provenance == "SYNTHETIC_FIXTURE")) {
    return(list(
      provenance_type = "SYNTHETIC_FIXTURE",
      is_proven_operational = FALSE,
      is_real_student_data = FALSE,
      can_generate_student_profile = FALSE,
      audit_verdict = "FIXTURE_SINTETICA_CONTROLADA",
      reasons = c("Arquivo localizado em diretorio de fixtures ou declarado como fixture sintetica."),
      warnings = c("PROIBIDO apresentar resultados desta fixture como historico real de estudante.")
    ))
  }
  
  # 2. DetecÃÂ§ÃÂ£o de Amostras Demonstrativas (ex: sample_data.csv, operational_export_v1.csv derivado de sample_data)
  is_sample_name <- grepl("sample", path_str)
  has_round_times <- FALSE
  if ("active_time_ms" %in% names(df)) {
    time_num <- suppressWarnings(as.numeric(df$active_time_ms))
    time_clean <- time_num[!is.na(time_num) & time_num > 0]
    if (length(time_clean) > 0) {
      # Verificar se a grande maioria dos tempos termina em milhares redondos (tÃÂ­pico de demo manual)
      has_round_times <- (sum(time_clean %% 1000 == 0) / length(time_clean)) > 0.70
    }
  }
  
  # Assinatura idÃÂªntica aos 20 registros conhecidos de sample_data.csv
  is_known_sample_rows <- (nrow(df) == 20 &&
                           all(c("1", "2", "3", "4", "11", "12", "13", "14") %in% as.character(df$question_id)))
  
  if (is_sample_name || is_known_sample_rows) {
    reasons <- c(reasons,
      if (is_known_sample_rows) "Registros coincidem exatamente com a amostra ilustrativa de 20 questoes de sample_data.csv." else "Nome do arquivo indica dados de exemplo/sample.",
      "Ausencia de identificador de estudante, sessao autenticada e timestamp de banco de producao.",
      if (has_round_times) "Valores de active_time_ms com padrao arredondado tipico de massa de teste manual." else NULL
    )
    reasons <- reasons[!sapply(reasons, is.null)]
    
    warnings <- c(
      "BLOQUEIO EPISTEMICO: O dataset foi identificado como AMOSTRA DEMONSTRATIVA (DEMONSTRATION_SAMPLE).",
      "E terminantemente vedado classificar esses dados como historico real de aprendizagem do estudante.",
      "Resultados analiticos gerados sobre esta amostra devem ser rotulados estritamente como validacao de contrato/amostra de teste."
    )
    
    return(list(
      provenance_type = "DEMONSTRATION_SAMPLE",
      is_proven_operational = FALSE,
      is_real_student_data = FALSE,
      can_generate_student_profile = FALSE,
      audit_verdict = "AMOSTRA_DEMONSTRATIVA_DE_CONTRATO",
      reasons = reasons,
      warnings = warnings
    ))
  }
  
  # 3. Auditoria Estrita de PretensÃÂ£o Operacional (PROVEN_OPERATIONAL)
  if (!is.null(declared_provenance) && declared_provenance == "PROVEN_OPERATIONAL") {
    # Para ser aceito como PROVEN_OPERATIONAL, exige critÃÂ©rios objetivos:
    # A) Manifesto estruturado de exportaÃÂ§ÃÂ£o com assinatura ou carimbo do banco
    # B) Campos de rastreabilidade temporal e identificaÃÂ§ÃÂ£o de ambiente
    has_valid_manifest <- (!is.null(manifest) && is.list(manifest) &&
                           !is.null(manifest$export_timestamp) &&
                           !is.null(manifest$database_source) &&
                           isTRUE(manifest$is_production_environment) &&
                           isTRUE(has_crypto_verified))


    
    has_audit_temporal <- ("occurred_at" %in% names(df) &&
                           any(!is.na(df$occurred_at) & trimws(as.character(df$occurred_at)) != ""))
    
    has_session_trace <- ("session_id" %in% names(df) &&
                          length(unique(df$session_id[!is.na(df$session_id)])) >= 1)
    
    # File integrity and a production manifest do not establish learning provenance.
    # Require explicit per-attempt origins from the Java CSV export contract.
    has_personal_origins <- ("origin_type" %in% names(df) &&
                             all(!is.na(df$origin_type) & df$origin_type == "REAL_STUDY"))

    if (has_valid_manifest && has_audit_temporal && has_session_trace && has_personal_origins) {
      return(list(
        provenance_type = "PROVEN_OPERATIONAL",
        is_proven_operational = TRUE,
        is_real_student_data = TRUE,
        can_generate_student_profile = TRUE,
        audit_verdict = "PROCEDENCIA_OPERACIONAL_COMPROVADA",
        reasons = c(
          "Manifesto operacional com integridade SHA-256 verificada (nao constitui assinatura ou autenticacao do autor).",
          "Campos de rastreabilidade temporal e sessao presentes; origem REAL_STUDY declarada em todas as tentativas.",
          "Elegibilidade baseada na origem registrada; nao comprova aprendizagem nem a veracidade da declaracao."
        ),
        warnings = character(0)
      ))
    } else {
      # Tentativa de declarar como operacional sem evidÃÂªncias de custÃÂ³dia
      reasons <- c(
        "Declarado como PROVEN_OPERATIONAL, mas falhou na auditoria de custodia.",
        if (!has_valid_manifest) "Manifesto de exportacao operacional integro ausente." else NULL,
        if (!has_personal_origins) "ORIGIN_NOT_PERSONAL: Exigida origem REAL_STUDY explicita em todas as tentativas; dados ausentes, mistos ou de teste permanecem nao verificados." else NULL,
        if (!has_audit_temporal) "Timestamps de resolucao (occurred_at) ausentes ou invalidos." else NULL,
        if (!has_session_trace) "Identificadores de sessao de estudo (session_id) ausentes." else NULL
      )
      reasons <- reasons[!sapply(reasons, is.null)]
      
      warnings <- c(
        "REJEICAO DE PROCEDENCIA: Pretensao de dados operacionais reais REJEITADA por falta de cadeia de custodia.",
        "Rebaixado compulsoriamente para UNVERIFIED_SOURCE.",
        "Nenhum perfil real de estudante sera emitido."
      )
      
      return(list(
        provenance_type = "UNVERIFIED_SOURCE",
        is_proven_operational = FALSE,
        is_real_student_data = FALSE,
        can_generate_student_profile = FALSE,
        audit_verdict = "REJEITADO_FALTA_DE_CUSTODIA",
        reasons = reasons,
        warnings = warnings
      ))
    }
  }
  
  # 4. Caso PadrÃÂ£o: Origem NÃÂ£o Verificada
  list(
    provenance_type = "UNVERIFIED_SOURCE",
    is_proven_operational = FALSE,
    is_real_student_data = FALSE,
    can_generate_student_profile = FALSE,
    audit_verdict = "FONTE_NAO_VERIFICADA",
    reasons = c("Procedencia nao documentada e sem manifesto operacional verificavel."),
    warnings = c("Tratar como amostra de teste. Nao inferir proficiencia real do estudante.")
  )
}

#' Cria Estrutura CanÃÂ´nica de Manifesto de ExportaÃÂ§ÃÂ£o Operacional
#' @param export_timestamp Timestamp ISO-8601 UTC do momento da extraÃÂ§ÃÂ£o
#' @param database_source Identificador do banco de dados (ex: 'fiscalstudy.db:event_store')
#' @param student_id Identificador anÃÂ´nimo ou UUID do estudante
#' @param is_production_environment Booleano indicando se a extraÃÂ§ÃÂ£o ÃÂ© de produÃÂ§ÃÂ£o real
#' @param checksum Hash SHA-256 dos registros exportados (opcional)
#' @return Lista de manifesto estruturada
create_operational_manifest <- function(export_timestamp,
                                        database_source = "db/fiscalstudy.db",
                                        student_id = "default_user",
                                        is_production_environment = TRUE,
                                        checksum = NULL) {
  list(
    manifest_version = "1.0.0",
    export_timestamp = as.character(export_timestamp),
    database_source = as.character(database_source),
    student_id = as.character(student_id),
    is_production_environment = isTRUE(is_production_environment),
    checksum = if (!is.null(checksum)) as.character(checksum) else NA_character_,
    provenance_guarantee = "OPERATIONAL_DATABASE_EXTRACTION"
  )
}
