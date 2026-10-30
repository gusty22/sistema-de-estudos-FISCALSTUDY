Sys.setlocale("LC_ALL", "C")
source("R/validation.R")

utf8_value <- "Direito Tribut\u00e1rio: exce\u00e7\u00e3o, aten\u00e7\u00e3o e mem\u00f3ria"

# Write true UTF-8 CSV
f_real <- tempfile(fileext = ".csv")
header_line <- "\"discipline\"\n"
data_line <- paste0("\"", utf8_value, "\"\n")
con_w <- file(f_real, open = "wb")
writeBin(charToRaw(header_line), con_w)
writeBin(charToRaw(data_line), con_w)
close(con_w)

# Add BOM
bom_csv <- tempfile(fileext = ".csv")
utf8_raw <- readBin(f_real, what = "raw", n = file.info(f_real)$size)
writeBin(c(as.raw(c(239, 187, 191)), utf8_raw), bom_csv)

bom_read <- read_utf8_csv(bom_csv, stringsAsFactors = FALSE)
cat("bom_read column names:", names(bom_read), "\n")
cat("bom_read$discipline:", bom_read$discipline, "\n")
cat("identical?", identical(bom_read$discipline, utf8_value), "\n")
cat("names(bom_read) identical with 'discipline'?", identical(names(bom_read), "discipline"), "\n")
