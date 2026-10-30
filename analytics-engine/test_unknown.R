Sys.setlocale("LC_ALL", "C")

utf8_value <- "Direito Tribut\u00e1rio: exce\u00e7\u00e3o, aten\u00e7\u00e3o e mem\u00f3ria"
df <- data.frame(discipline = utf8_value, stringsAsFactors = FALSE)

encoded_csv <- df
for (col in names(encoded_csv)[vapply(encoded_csv, is.character, logical(1))]) {
  vals <- enc2utf8(encoded_csv[[col]])
  Encoding(vals) <- "unknown"
  encoded_csv[[col]] <- vals
}

f_test <- tempfile(fileext = ".csv")
con <- file(f_test, open = "wb")
utils::write.csv(encoded_csv, file = con, row.names = FALSE)
close(con)

raw_bytes <- readBin(f_test, what = "raw", n = file.info(f_test)$size)
cat("Raw bytes after Encoding(values) <- 'unknown':\n")
print(raw_bytes)
cat("Text:\n")
cat(rawToChar(raw_bytes))
