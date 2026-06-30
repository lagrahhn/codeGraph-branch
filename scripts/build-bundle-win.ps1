# Build a self-contained CodeGraph bundle for Windows (win32-x64).
# PowerShell equivalent of scripts/build-bundle.sh win32-x64
param(
  [string]$Target = 'win32-x64',
  [string]$NodeVersion = 'v24.16.0'
)

$ErrorActionPreference = 'Stop'
$Root = Split-Path -Parent $PSScriptRoot
$Out = Join-Path $Root 'release'
$Work = Join-Path $env:TEMP "codegraph-bundle-$Target"
$Stage = Join-Path $Work "codegraph-$Target"
$NodeDist = "node-$NodeVersion-win-x64"
$NodeUrl = "https://nodejs.org/dist/$NodeVersion/$NodeDist.zip"
$NodeZip = Join-Path $Work 'node.zip'

Remove-Item -Recurse -Force $Work -ErrorAction SilentlyContinue
New-Item -ItemType Directory -Force -Path (Join-Path $Stage 'lib'), (Join-Path $Stage 'bin'), $Out | Out-Null

Write-Host "[bundle] downloading $NodeUrl"
Invoke-WebRequest -Uri $NodeUrl -OutFile $NodeZip
Expand-Archive -Path $NodeZip -DestinationPath $Work -Force

Write-Host "[bundle] building app"
Push-Location $Root
npm run build | Out-Null
Pop-Location

Copy-Item -Recurse (Join-Path $Root 'dist') (Join-Path $Stage 'lib/dist')
Copy-Item (Join-Path $Root 'package.json'), (Join-Path $Root 'package-lock.json') (Join-Path $Stage 'lib')

Write-Host "[bundle] installing production dependencies"
Push-Location (Join-Path $Stage 'lib')
npm ci --omit=dev --ignore-scripts | Out-Null
Pop-Location
Remove-Item (Join-Path $Stage 'lib/package-lock.json') -ErrorAction SilentlyContinue

Copy-Item (Join-Path $Work "$NodeDist/node.exe") (Join-Path $Stage 'node.exe')
$launcher = '@"%~dp0..\node.exe" --liftoff-only "%~dp0..\lib\dist\bin\codegraph.js" %*' + "`r`n"
[System.IO.File]::WriteAllText((Join-Path $Stage 'bin/codegraph.cmd'), $launcher)

$Archive = Join-Path $Out "codegraph-$Target.zip"
Remove-Item $Archive -ErrorAction SilentlyContinue
Compress-Archive -Path $Stage -DestinationPath $Archive -Force
$sizeMb = [math]::Round((Get-Item $Archive).Length / 1MB, 1)
Write-Host "[bundle] wrote $Archive ($sizeMb MB)"

Push-Location $Root
npm pack --pack-destination $Out | Out-Null
Pop-Location

Write-Host "[bundle] npm pack -> $Out"
Get-ChildItem $Out | ForEach-Object { Write-Host "  $($_.Name) ($([math]::Round($_.Length/1MB,2)) MB)" }
