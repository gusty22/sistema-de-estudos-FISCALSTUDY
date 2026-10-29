#!/usr/bin/env Rscript
# Run from analytics-engine. Input documents are inert JSON/CSV, never R code.
# Usage: Rscript run_learning_orchestrator.R request.json NEW-result.json
args <- commandArgs(trailingOnly=TRUE)
if (length(args)!=2L) stop('Usage: Rscript run_learning_orchestrator.R request.json NEW-result.json')
source('R/provenance.R')
source('R/learning_profile.R')
source('R/evidence_specialists.R')
source('R/learning_orchestrator.R')
source('R/analytical_portability.R')
request <- read_analytical_bundle(args[1])$payload
if (!identical(request$request_version,'learning-orchestrator-request-v1')) stop('Unknown request version')
# Deliberately ignore embedded authority_registry, specialists, gate and provenance
# claims. Only the existing host-built specialists can support admission here.
# The orchestrator emits the contextual proposal, three-policy comparison and
# execution trace together; the transport never reconstructs a decision rationale.
# Audit actual CSV bytes; an imported verification flag is not custody.
if (!portable_scalar_text(request$events_csv) || !file.exists(request$events_csv)) stop('Missing events CSV')
events_size <- file.info(request$events_csv)$size
if (is.na(events_size) || events_size > 64*1024^2) stop('Events CSV exceeds size bound')
events <- read.csv(request$events_csv,stringsAsFactors=FALSE,check.names=FALSE,na.strings=c('','NA'))
manifest <- request$events_manifest
if (!'origin' %in% names(events) && 'origin_type' %in% names(events)) events$origin <- events$origin_type
provenance <- audit_learning_provenance(events,declared_provenance=request$declared_provenance,
                                      file_path=request$events_csv,manifest=manifest)
rows_to_frame <- function(rows) {
  if (is.null(rows) || !length(rows)) return(data.frame())
  if (!is.list(rows) || !all(vapply(rows,is.list,logical(1)))) stop('Invalid row records')
  fields <- names(rows[[1]])
  if (!all(vapply(rows,function(r) identical(names(r),fields) && all(vapply(r,function(v) length(v)==1L && !is.list(v),logical(1))),logical(1)))) stop('Inconsistent row schema')
  do.call(rbind,lapply(rows,function(r) as.data.frame(r,stringsAsFactors=FALSE)))
}
relations <- rows_to_frame(request$concept_relations)
snapshot <- list(student_id=request$student_id,run_id=request$run_id,cutoff=request$cutoff,
                 evidence=events,provenance=provenance,concept_relations=relations)
result <- orchestrate_learning(snapshot,request$context,candidates=rows_to_frame(request$candidates))
result$transport <- list(request_sha256=compute_file_sha256(args[1]),events_sha256=compute_file_sha256(request$events_csv),
  input_provenance=provenance$provenance_type,r_version=as.character(getRversion()),
  authority_registry='BUILTIN_LOW_RISK_POLICY_ONLY',external_assessments=import_external_assessments(
    if (is.null(request$external_assessments)) list() else request$external_assessments,request$cutoff))
write_analytical_bundle(result,args[2])
cat('Observation-only result written; operational authority unchanged.\n')
