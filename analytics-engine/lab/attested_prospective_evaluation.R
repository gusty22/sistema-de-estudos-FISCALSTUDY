# Offline custody boundary. The public key/source identity come from the trusted host,
# never from JSON. OpenSSL is used only for signature verification, not model fitting.
source("lab/prospective_evaluation.R")

evaluate_attested_prospective <- function(path, trusted_public_key, trusted_source_id,
                                         synthetic_test=FALSE) {
  if (!is.character(trusted_source_id) || length(trusted_source_id)!=1L ||
      is.na(trusted_source_id) || !nzchar(trusted_source_id) || !file.exists(trusted_public_key))
    stop("External source identity/public key required")
  bytes <- readBin(path,"raw",n=file.info(path)$size)
  envelope <- jsonlite::fromJSON(rawToChar(bytes),simplifyVector=FALSE)
  if (!is.character(envelope$attestationJson) || length(envelope$attestationJson)!=1L ||
      !is.character(envelope$signatureBase64) || length(envelope$signatureBase64)!=1L)
    stop("Signed custody statement required")
  work <- tempfile(); dir.create(work,mode="0700")
  on.exit(unlink(work,recursive=TRUE),add=TRUE)
  statement_path <- file.path(work,"statement"); signature_path <- file.path(work,"signature")
  frozen <- file.path(work,"input.json"); key <- file.path(work,"trusted.pem")
  writeBin(bytes,frozen)
  public_bytes <- readBin(trusted_public_key,"raw",n=file.info(trusted_public_key)$size)
  writeBin(public_bytes,key)
  writeBin(charToRaw(enc2utf8(envelope$attestationJson)),statement_path)
  writeBin(jsonlite::base64_dec(envelope$signatureBase64),signature_path)
  status <- system2("openssl",c("dgst","-sha256","-verify",shQuote(key),
    "-signature",shQuote(signature_path),shQuote(statement_path)),stdout=FALSE,stderr=FALSE)
  if (!identical(status,0L)) stop("Invalid export signature or unavailable OpenSSL")
  statement <- jsonlite::fromJSON(envelope$attestationJson,simplifyVector=FALSE)
  input <- jsonlite::fromJSON(envelope$inputJson,simplifyVector=FALSE)
  expected_kind <- if (isTRUE(synthetic_test)) "SYNTHETIC_FIXTURE" else "OPERATIONAL_EVENT_STORE_V1"
  if (!identical(statement$version,"prospective-custody-v1") ||
      !identical(statement$sourceId,trusted_source_id) ||
      !identical(statement$sourceKind,expected_kind) || !identical(input$sourceKind,expected_kind) ||
      !identical(statement$studentId,input$studentId) || !identical(input$studentId,"LOCAL_SINGLE_USER") ||
      !identical(statement$inputSha256,envelope$inputSha256) ||
      !identical(statement$snapshotRowid,envelope$snapshotRowid)) stop("Custody scope mismatch")
  exported <- parse_evidence_timestamp(statement$exportedAt)
  if (length(exported)!=1L || is.na(exported)) stop("Invalid export timestamp")
  for (event in input$events) {
    if (parse_evidence_timestamp(event$recorded_at)>exported) stop("Export precedes event")
  }
  result <- evaluate_prospective(frozen,require_current_capture=TRUE)
  result$source_authentication <- if (isTRUE(synthetic_test))
    "VERIFIED_SIGNATURE_SYNTHETIC_INTEGRATION_ONLY" else "VERIFIED_SIGNATURE_EXTERNALLY_TRUSTED_INSTALLATION"
  result$custody <- list(version=statement$version,source_id=trusted_source_id,
    public_key_file_sha256=digest::digest(public_bytes,algo="sha256",serialize=FALSE),
    statement_sha256=digest::digest(enc2utf8(envelope$attestationJson),algo="sha256",serialize=FALSE),
    exported_at=statement$exportedAt,
    trust_limit="Trusted local server/key and database custody; no independent timestamp or proof of unobserved assistance")
  result$six_scientific_targets <- setNames(as.list(rep("NOT_ESTABLISHED",6L)),c(
    "DELAYED_ITEM_RETRIEVAL","NOVEL_ITEM_CORRECTNESS","APPLICATION_SUCCESS",
    "TRANSFER_SUCCESS","ACTIVITY_DURATION_SECONDS","POST_INTERVENTION_SUCCESS"))
  result$personal_profile <- "NOT_CREATED"
  result
}

if (sys.nframe()==0L) {
  args <- commandArgs(trailingOnly=TRUE)
  if (length(args)!=5L || !args[5L] %in% c("synthetic-test","operational") || file.exists(args[2L]))
    stop("Usage: input.json NEW-report.json EXTERNAL-public.pem EXTERNAL-source-id synthetic-test|operational")
  out <- evaluate_attested_prospective(args[1L],args[3L],args[4L],args[5L]=="synthetic-test")
  connection <- file(args[2L],open="wxb")
  serialized <- as.character(jsonlite::toJSON(out,auto_unbox=TRUE,pretty=TRUE,null="null",na="null",digits=16))
  writeBin(charToRaw(paste0(enc2utf8(serialized),"\n")),connection)
  close(connection)
}
