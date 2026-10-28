# Read-only experimental adapter: existing ASSISTments snapshot, no production input.
source("R/provenance.R")
source("lab/contextual_prequential.R")
args <- commandArgs(trailingOnly=TRUE)
if(length(args)!=3L || file.exists(args[2])) stop("Expected events.json NEW-results.json snapshot.json")
allowed <- paste0(normalizePath("lab/runs",winslash="/",mustWork=TRUE),"/")
for(path in args) {
 full <- if(file.exists(path)) normalizePath(path,winslash="/",mustWork=TRUE) else
   paste0(normalizePath(dirname(path),winslash="/",mustWork=TRUE),"/",basename(path))
 if(!startsWith(tolower(full),tolower(allowed))) stop("Experiment path confinement")
}
snapshot <- jsonlite::fromJSON(args[3])
if(!identical(snapshot$contract_version,"assistments_ordered_v1") ||
 !identical(snapshot$can_apply,FALSE) ||
 !identical(snapshot$input_sha256,compute_file_sha256(args[1]))) stop("Invalid input manifest")
d <- jsonlite::fromJSON(args[1])
if(nrow(d)!=snapshot$row_count || any(!d$origin_type %in% "PUBLIC_HUMAN_DATASET") ||
 any(!d$chronology %in% "ORDINAL_ORDER_ID_ONLY")) stop("Invalid origin/chronology")
p <- contextual_prequential(d)
out <- contextual_report(p)
out$predictions <- p
out$input_sha256 <- snapshot$input_sha256
out$r_version <- R.version.string
writeLines(jsonlite::toJSON(out,auto_unbox=TRUE,pretty=TRUE,na="null",null="null",digits=16),args[2])
