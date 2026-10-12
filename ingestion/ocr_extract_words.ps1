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

for ($pageNum = 2; $pageNum -le 9; $pageNum++) {
    $imgPath = (Resolve-Path "ingestion/output/auditor_pages/page_$pageNum.png").Path
    $file = AwaitTask ([Windows.Storage.StorageFile]::GetFileFromPathAsync($imgPath)) ([Windows.Storage.StorageFile])
    $stream = AwaitTask ($file.OpenAsync([Windows.Storage.FileAccessMode]::Read)) ([Windows.Storage.Streams.IRandomAccessStream])
    $decoder = AwaitTask ([Windows.Graphics.Imaging.BitmapDecoder]::CreateAsync($stream)) ([Windows.Graphics.Imaging.BitmapDecoder])
    $bitmap = AwaitTask ($decoder.GetSoftwareBitmapAsync()) ([Windows.Graphics.Imaging.SoftwareBitmap])
    
    $ocrResult = AwaitTask ($engine.RecognizeAsync($bitmap)) ([Windows.Media.Ocr.OcrResult])
    
    $wordsList = [System.Collections.Generic.List[Object]]::new()
    foreach ($line in $ocrResult.Lines) {
        foreach ($word in $line.Words) {
            $wordsList.Add(@{
                t = $word.Text
                x = [int]$word.BoundingRect.X
                y = [int]$word.BoundingRect.Y
                w = [int]$word.BoundingRect.Width
                h = [int]$word.BoundingRect.Height
            })
        }
    }
    
    Write-Host "Page $pageNum : $($wordsList.Count) words extracted."
    
    $pagesResult.Add(@{
        Page = $pageNum
        Words = $wordsList
    })
}

$json = $pagesResult | ConvertTo-Json -Depth 5
[System.IO.File]::WriteAllText("$(Get-Location)\ingestion\output\auditor_words.json", $json, [System.Text.Encoding]::UTF8)
Write-Host "Saved word tokens to ingestion/output/auditor_words.json"
