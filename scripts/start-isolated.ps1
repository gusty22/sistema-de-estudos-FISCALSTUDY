param([ValidateRange(1024,65535)][int]$Port=18080)
$ErrorActionPreference='Stop'
$projectRoot=(Resolve-Path -LiteralPath (Split-Path -Parent $PSScriptRoot)).Path
$runRoot=Join-Path $projectRoot ('target/isolated-runs/'+(Get-Date -Format 'yyyyMMdd-HHmmss')+'-'+[guid]::NewGuid().ToString('N').Substring(0,8))
$runPath=[System.IO.Path]::GetFullPath($runRoot)
$allowedPath=[System.IO.Path]::GetFullPath((Join-Path $projectRoot 'target'))+[System.IO.Path]::DirectorySeparatorChar
if(-not $runPath.StartsWith($allowedPath,[System.StringComparison]::OrdinalIgnoreCase)){throw 'Invalid isolated run path'}
New-Item -ItemType Directory -Path $runPath -Force | Out-Null
$env:FISCALSTUDY_PROJECT_ROOT=$projectRoot
$env:FISCALSTUDY_DATA_DIR=$runPath
$env:FISCALSTUDY_PORT=[string]$Port
$env:FISCALSTUDY_BIND='127.0.0.1'
$env:FISCALSTUDY_ANKI_NETWORK_ALLOWED='false'
$env:SPRING_PROFILES_ACTIVE='isolated'
Write-Host ('Disposable data: '+$runPath)
Write-Host ('API: http://127.0.0.1:'+$Port)
& node (Join-Path $PSScriptRoot 'validate-backend.cjs') '-DskipTests' 'spring-boot:run'
exit $LASTEXITCODE
