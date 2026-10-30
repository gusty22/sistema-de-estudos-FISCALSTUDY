Sys.setlocale("LC_ALL", "C")
source("R/validation.R")

utf8_value <- "Direito Tribut\u00e1rio: exce\u00e7\u00e3o, aten\u00e7\u00e3o e mem\u00f3ria"

# Write a real UTF-8 file with true bytes c3 a1, etc.
f_real <- tempfile(fileext = ".csv")
# Write line directly using useBytes = TRUE:
header_line <- "\"discipline\"\n"
data_line <- paste0("\"", utf8_value, "\"\n")
con_w <- file(f_real, open = "wb")
writeBin(charToRaw(header_line), con_w)
writeBin(charToRaw(data_line), con_w)
close(con_w)

cat("f_real size:", file.info(f_real)$size, "\n")
raw_bytes <- readBin(f_real, what = "raw", n = file.info(f_real)$size)
cat("f_real raw bytes:\n")
print(raw_bytes)

# Now test read_utf8_csv on f_real under locale C:
res <- read_utf8_csv(f_real, stringsAsFactors = FALSE)
cat("read_utf8_csv result:\n")
print(res)
print(Encoding(res$discipline))
print(charToRaw(res$discipline))
cat("identical with utf8_value?", identical(res$discipline, utf8_value), "\n")
