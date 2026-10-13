# scripts/export_pilot_session.ps1
# FiscalStudy — Procedimento Automatizado de Exportação e Auditoria da Sessão Piloto Real

param(
    [string]$BackendUrl = "http://localhost:8080",
    [string]$AnalyticsDir = "C:\Users\washi\Downloads\fiscalstudy-analytics",
    [string]$OutputDir = "C:\Users\washi\Downloads\fiscalstudy-analytics\data\operational"
)

$ErrorActionPreference = "Stop"

Write-Host "=================================================================" -ForegroundColor Cyan
Write-Host "   FiscalStudy — Exportacao e Validacao da Sessao Piloto Real   " -ForegroundColor Cyan
Write-Host "=================================================================" -ForegroundColor Cyan

# 1. Verificar se o backend esta respondendo
try {
    $healthCheck = Invoke-WebRequest -Uri "$BackendUrl/api/v1/questions/disciplines" -UseBasicParsing -TimeoutSec 3
    if ($healthCheck.StatusCode -ne 200) {
        Write-Error "O backend em $BackendUrl respondeu com status inesperado."
    }
} catch {
    Write-Host "[ERRO] Backend nao encontrado em $BackendUrl." -ForegroundColor Red
    Write-Host "Certifique-se de que o backend Java esta rodando (.\\mvnw spring-boot:run no diretorio backend)." -ForegroundColor Yellow
    exit 1
}

# 2. Criar diretorio de destino para dados operacionais
if (!(Test-Path $OutputDir)) {
    New-Item -ItemType Directory -Path $OutputDir -Force | Out-Null
}

$csvPath = Join-Path $OutputDir "fiscalstudy_attempts.csv"
$manifestPath = Join-Path $OutputDir "export_manifest.json"

Write-Host "[1/4] Baixando exportacao CSV autenticada (origin=REAL_STUDY)..." -ForegroundColor Yellow
& curl.exe -s -S "$BackendUrl/api/v1/analytics/export?origin=REAL_STUDY" -o "$csvPath"

Write-Host "[2/4] Baixando manifesto correspondente..." -ForegroundColor Yellow
& curl.exe -s -S "$BackendUrl/api/v1/analytics/export/manifest?origin=REAL_STUDY" -o "$manifestPath"

# 3. Validacao local previa do SHA-256
$calcHash = (Get-FileHash -Path $csvPath -Algorithm SHA256).Hash.ToLower()
$manifestContent = Get-Content -Path $manifestPath -Raw -Encoding UTF8 | ConvertFrom-Json
$expectedHash = $manifestContent.checksum.ToLower()

Write-Host "[3/4] Checando integridade criptografica local..." -ForegroundColor Yellow
Write-Host "  - Hash do CSV baixado:  $calcHash" -ForegroundColor Gray
Write-Host "  - Hash no manifesto:    $expectedHash" -ForegroundColor Gray
Write-Host "  - Total de registros:   $($manifestContent.total_records)" -ForegroundColor Gray
Write-Host "  - Origem declarada:     $($manifestContent.declared_origin)" -ForegroundColor Gray

if ($calcHash -ne $expectedHash) {
    Write-Host "[ALERTA] Divergencia criptografica detectada! O arquivo nao coincide com o manifesto." -ForegroundColor Red
    exit 1
} else {
    Write-Host "  -> Integridade criptografica confirmada com sucesso!" -ForegroundColor Green
}

# 4. Execucao do Laboratorio R de Analise Psicométrica
$rScriptPath = "C:\Program Files\R\R-4.5.1\bin\x64\Rscript.exe"
if (!(Test-Path $rScriptPath)) {
    $rScriptCmd = Get-Command Rscript -ErrorAction SilentlyContinue
    if ($rScriptCmd) { $rScriptPath = $rScriptCmd.Source }
}

if ((Test-Path $rScriptPath) -and (Test-Path (Join-Path $AnalyticsDir "R\evaluate_operational.R"))) {
    Write-Host "[4/4] Executando FiscalStudy Analytics (R)..." -ForegroundColor Yellow
    $evalOutputJson = Join-Path $AnalyticsDir "output\metrics\pilot_session_evaluation.json"
    $analyticsNormalized = $AnalyticsDir -replace '\\', '/'
    $csvNormalized = $csvPath -replace '\\', '/'
    $jsonNormalized = $evalOutputJson -replace '\\', '/'
    $rCommand = "setwd('$analyticsNormalized'); source('R/evaluate_operational.R'); run_operational_evaluation('$csvNormalized', '$jsonNormalized')"
    
    & $rScriptPath -e "$rCommand"
    
    if (Test-Path $evalOutputJson) {
        Write-Host ""
        Write-Host "=================================================================" -ForegroundColor Green
        Write-Host "   SESSAO PILOTO VALIDADA E PROCESSADA COM SUCESSO!             " -ForegroundColor Green
        Write-Host "=================================================================" -ForegroundColor Green
        Write-Host "Relatorio gerado em: $evalOutputJson" -ForegroundColor Cyan
    }
} else {
    Write-Host "[AVISO] Rscript ou laboratorio R nao localizados no caminho padrao." -ForegroundColor Yellow
    Write-Host "Os arquivos foram exportados com sucesso em: $OutputDir" -ForegroundColor Green
}
