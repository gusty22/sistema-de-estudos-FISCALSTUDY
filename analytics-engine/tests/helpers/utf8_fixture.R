# Fixture transport must preserve declared UTF-8 bytes even under Windows locale C.
# write.csv(fileEncoding="UTF-8") still translates marked text through LC_CTYPE.
# Match the binary byte-copy approach used by export_metrics_package, without
# changing the process locale or the production input/output contracts.
write_utf8_fixture_csv <- function(data, path) {
  encoded <- data
  for (column in names(encoded)[vapply(encoded, is.character, logical(1))]) {
    values <- enc2utf8(encoded[[column]])
    if (any(!is.na(values) & !validUTF8(values))) stop("Invalid UTF-8 fixture text")
    Encoding(values) <- "unknown"
    encoded[[column]] <- values
  }
  connection <- file(path, open = "wb")
  on.exit(close(connection), add = TRUE)
  utils::write.csv(encoded, connection, row.names = FALSE)
}
