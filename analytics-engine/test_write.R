Sys.setlocale("LC_ALL", "C")
utf8_value <- "Direito Tribut\u00e1rio: exce\u00e7\u00e3o, aten\u00e7\u00e3o e mem\u00f3ria"
cat("utf8_value raw bytes:\n")
print(charToRaw(utf8_value))

f1 <- tempfile()
utils::write.csv(data.frame(x = utf8_value, stringsAsFactors=FALSE), f1, row.names=FALSE, fileEncoding="UTF-8")
cat("write.csv file raw bytes:\n")
raw1 <- readBin(f1, what = "raw", n = file.info(f1)$size)
print(raw1)
print(rawToChar(raw1))
