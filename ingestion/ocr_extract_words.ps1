param(
    [string]$PagesDir = "ingestion/output/auditor_pages_300",
    [int]$FirstPage = 2,
    [int]$LastPage = 9,
    [string]$OutFile = "ingestion/output/auditor_words_300.json"
)

# OCR nativo do Windows (Windows.Media.Ocr, pt-BR). Para cada palavra grava o
# texto, a caixa delimitadora e o indice da linha OCR a que pertence (l), para
# que o extrator possa reconstruir linhas sem depender apenas de proximidade
# vertical (que fundia linhas de colunas diferentes).

Add-Type -AssemblyName System.Runtime.WindowsRuntime

$asTaskGeneric = ([System.WindowsRuntimeSystemExtensions].GetMethods() | Where-Object { 
    $_.Name -eq 'AsTask' -and $_.GetParameters().Count -eq 1 -and $_.GetParameters()[0].ParameterType.Name -eq 'IAsyncOperation`1' 
})[0]

function AwaitTask($WinRtTask, $ResultType) {
    $asTask = $asTaskGeneric.MakeGenericMethod($ResultType)
    $netTask = $asTask.Invoke($null, @($WinRtTask))
    $netTask.Wait(-1) | Out-Null
    return $netTask.Result
}

[void][Windows.Storage.StorageFile, Windows.Storage, ContentType = WindowsRuntime]
[void][Windows.Graphics.Imaging.BitmapDecoder, Windows.Graphics.Imaging, ContentType = WindowsRuntime]
[void][Windows.Media.Ocr.OcrEngine, Windows.Foundation.UniversalApiContract, ContentType = WindowsRuntime]

$engine = [Windows.Media.Ocr.OcrEngine]::TryCreateFromUserProfileLanguages()
Write-Host "OCR Engine initialized: $($engine.RecognizerLanguage.DisplayName)"

$pagesResult = [System.Collections.Generic.List[Object]]::new()

for ($pageNum = $FirstPage; $pageNum -le $LastPage; $pageNum++) {
    $imgPath = (Resolve-Path "$PagesDir/page_$pageNum.png").Path
    $file = AwaitTask ([Windows.Storage.StorageFile]::GetFileFromPathAsync($imgPath)) ([Windows.Storage.StorageFile])
    $stream = AwaitTask ($file.OpenAsync([Windows.Storage.FileAccessMode]::Read)) ([Windows.Storage.Streams.IRandomAccessStream])
    $decoder = AwaitTask ([Windows.Graphics.Imaging.BitmapDecoder]::CreateAsync($stream)) ([Windows.Graphics.Imaging.BitmapDecoder])
    $bitmap = AwaitTask ($decoder.GetSoftwareBitmapAsync()) ([Windows.Graphics.Imaging.SoftwareBitmap])
    
    $ocrResult = AwaitTask ($engine.RecognizeAsync($bitmap)) ([Windows.Media.Ocr.OcrResult])
    
    $wordsList = [System.Collections.Generic.List[Object]]::new()
    $lineIdx = 0
    foreach ($line in $ocrResult.Lines) {
        foreach ($word in $line.Words) {
            $wordsList.Add([ordered]@{
                t = $word.Text
                x = [int]$word.BoundingRect.X
                y = [int]$word.BoundingRect.Y
                w = [int]$word.BoundingRect.Width
                h = [int]$word.BoundingRect.Height
                l = $lineIdx
            })
        }
        $lineIdx++
    }
    
    Write-Host "Page $pageNum : $($wordsList.Count) words / $lineIdx lines."
    
    $pagesResult.Add([ordered]@{
        Page = $pageNum
        Width = $bitmap.PixelWidth
        Height = $bitmap.PixelHeight
        Words = $wordsList
    })
    $stream.Dispose()
}

$json = $pagesResult | ConvertTo-Json -Depth 5 -Compress
$outPath = Join-Path (Get-Location) $OutFile
[System.IO.File]::WriteAllText($outPath, $json, (New-Object System.Text.UTF8Encoding($false)))
Write-Host "Saved word tokens to $OutFile"
