param(
    [ValidateSet('environment','backend','frontend','python','r','all')][string]$Scope = 'environment'
)
$ErrorActionPreference = 'Stop'
$projectRoot = Split-Path -Parent $PSScriptRoot
$validationDir = Join-Path $projectRoot 'target/validation'
New-Item -ItemType Directory -Force -Path $validationDir | Out-Null
function Resolve-Executable([string]$configured, [string[]]$candidates, [string]$name) {
    if ($configured -and (Test-Path -LiteralPath $configured)) { return (Resolve-Path -LiteralPath $configured).Path }
    foreach ($candidate in $candidates) { if (Test-Path -LiteralPath $candidate) { return (Resolve-Path -LiteralPath $candidate).Path } }
    $found = Get-Command $name -ErrorAction SilentlyContinue
    if ($found -and $found.Source -notmatch 'WindowsApps') { return $found.Source }
    return $null
}
$pythonRoots = @((Join-Path $env:LOCALAPPDATA 'Programs/Python'), (Join-Path $env:USERPROFILE 'AppData/Local/Programs/Python'))
$pythonCandidates = @()
foreach ($pythonRoot in $pythonRoots) {
    foreach ($installDir in @(Get-ChildItem -LiteralPath $pythonRoot -Directory -ErrorAction SilentlyContinue)) {
        $candidate = Join-Path $installDir.FullName 'python.exe'
        if (Test-Path -LiteralPath $candidate) { $pythonCandidates += $candidate }
    }
}
$pythonCandidates = @($pythonCandidates | Sort-Object -Descending -Unique)
$pythonExe = Resolve-Executable $env:FISCALSTUDY_PYTHON $pythonCandidates 'python.exe'
$rCandidates = @(Get-ChildItem -Path (Join-Path $env:ProgramFiles 'R/*/bin/Rscript.exe') -ErrorAction SilentlyContinue | Sort-Object FullName -Descending | Select-Object -ExpandProperty FullName)
$rExe = Resolve-Executable $env:FISCALSTUDY_RSCRIPT $rCandidates 'Rscript.exe'
if (-not $env:JAVA_HOME) {
    $jdk = Get-ChildItem -Path (Join-Path $env:ProgramFiles 'Eclipse Adoptium/jdk-*') -Directory -ErrorAction SilentlyContinue | Sort-Object Name -Descending | Select-Object -First 1
    if ($jdk) { $env:JAVA_HOME = $jdk.FullName }
}
if ($Scope -eq 'environment') {
    [pscustomobject]@{ Project=$projectRoot; JavaHome=$env:JAVA_HOME; Python=$pythonExe; Rscript=$rExe }
    exit 0
}
$checks = if ($Scope -eq 'all') { @('backend','frontend','python','r') } else { @($Scope) }
$results = @()
foreach ($check in $checks) {
    $log = Join-Path $validationDir ($check + '.log')
    Push-Location $projectRoot
    try {
        switch ($check) {
            'backend' {
                Set-Location (Join-Path $projectRoot 'backend')
                & node (Join-Path $projectRoot 'scripts/validate-backend.cjs') test *> $log
            }
            'frontend' {
                Set-Location (Join-Path $projectRoot 'frontend')
                & npm.cmd run build *> $log
                if ($LASTEXITCODE -eq 0) { & npm.cmd run lint *>> $log }
            }
            'python' {
                if (-not $pythonExe) { throw 'Python indisponível: configure FISCALSTUDY_PYTHON.' }
                & $pythonExe -m unittest discover -s tests -p 'test_*.py' *> $log
            }
            'r' {
                if (-not $rExe) { throw 'Rscript indisponível: configure FISCALSTUDY_RSCRIPT.' }
                Set-Location (Join-Path $projectRoot 'analytics-engine')
                & $rExe tests/test_runner.R *> $log
            }
        }
        $checkExit = $LASTEXITCODE
        $results += [pscustomobject]@{ Check=$check; ExitCode=$checkExit; Log=$log }
        Get-Content -LiteralPath $log -Tail 12
    } finally { Pop-Location }
}
$results | Format-Table -AutoSize
if ($results | Where-Object ExitCode -ne 0) { exit 1 }
