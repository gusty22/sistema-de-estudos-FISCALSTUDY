Sys.setlocale("LC_ALL", "C")
utf8_csv <- tempfile("utf8-contract-", fileext = ".csv")
utf8_value <- "Direito Tribut\u00e1rio: exce\u00e7\u00e3o, aten\u00e7\u00e3o e mem\u00f3ria"
utf8_df <- data.frame(discipline = utf8_value, stringsAsFactors = FALSE)
utils::write.csv(utf8_df, utf8_csv, row.names = FALSE, fileEncoding = "UTF-8")

raw_bytes <- readBin(utf8_csv, what = "raw", n = file.info(utf8_csv)$size)
cat("raw_bytes length:", length(raw_bytes), "\n")
text_content <- rawToChar(raw_bytes)
cat("rawToChar raw:", paste(as.character(charToRaw(text_content)), collapse=" "), "\n")
cat("rawToChar charToRaw matches raw_bytes?", identical(charToRaw(text_content), raw_bytes), "\n")
Encoding(text_content) <- "UTF-8"
cat("After Encoding UTF-8, charToRaw:", paste(as.character(charToRaw(text_content)), collapse=" "), "\n")

# Now check read.table / read.csv behavior:
cat("\nTesting read.table / read.csv:\n")
# read.table uses scan(). Does scan() convert?
scanned <- scan(text = text_content, what = character(), sep = ",", quiet = TRUE, encoding = "UTF-8")
cat("scanned[2] raw:", paste(as.character(charToRaw(scanned[2])), collapse=" "), "\n")
